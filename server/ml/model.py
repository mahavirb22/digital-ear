"""
Digital Ear — ML Anomaly Detection Model
=========================================
Uses Isolation Forest + One-Class SVM ensemble for predictive machine maintenance.

Training data baseline (from ESP32 INMP441 sensor readings):
  - Sound Energy: 40000–55000 (normal operating range)
  - Frequency:    500–1750 Hz (normal acoustic signature)
  - Vibration:    0 = NORMAL, 1 = DETECTED
  - Current:      0.00–0.50 A (normal draw)

The model learns the "normal" operating envelope and flags anything outside it.
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM
from pymongo import MongoClient
from dotenv import load_dotenv

# Load env from parent directory
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'trained_model.pkl')
SCALER_PATH = os.path.join(os.path.dirname(__file__), 'scaler.pkl')
META_PATH = os.path.join(os.path.dirname(__file__), 'model_meta.pkl')

# Minimum readings required to train
MIN_TRAINING_SAMPLES = 30


def get_mongo_client():
    uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017/digital_ear')
    client = MongoClient(uri)
    # Extract DB name from URI or use default
    db_name = uri.split('/')[-1].split('?')[0] if '/' in uri else 'digital_ear'
    if not db_name:
        db_name = 'test'
    return client, db_name


def fetch_training_data(device_id=None, limit=500):
    """
    Fetch sensor readings from MongoDB.
    Uses non-anomaly readings as the 'normal' training set.
    """
    client, db_name = get_mongo_client()
    db = client[db_name]
    collection = db['sensorreadings']

    query = {'isAnomaly': False}
    if device_id:
        query['deviceId'] = device_id

    readings = list(collection.find(query).sort('timestamp', -1).limit(limit))
    client.close()

    if len(readings) < MIN_TRAINING_SAMPLES:
        return None

    features = []
    for r in readings:
        vib = 1.0 if r.get('vibration') == 'DETECTED' else 0.0
        features.append([
            float(r.get('soundEnergy', 0)),
            float(r.get('frequency', 0)),
            vib,
            float(r.get('current', 0)),
        ])

    return np.array(features)


def generate_synthetic_training_data():
    """
    Generate synthetic 'normal' operating data based on observed ESP32 ranges.
    Used as seed data before real readings accumulate.
    
    Based on real ESP32 + INMP441 readings:
      Sound Energy: 40000–55000 (Gaussian centered at 47000, σ=3000)
      Frequency:    500–1750 Hz (Gaussian centered at 1100, σ=300)
      Vibration:    0 (NORMAL) for 95% of readings
      Current:      0.00–0.50 A (Gaussian centered at 0.25, σ=0.12)
    """
    np.random.seed(42)
    n_samples = 200

    sound_energy = np.random.normal(47000, 3000, n_samples).clip(35000, 58000)
    frequency = np.random.normal(1100, 300, n_samples).clip(400, 1800)
    vibration = np.random.choice([0.0, 1.0], n_samples, p=[0.95, 0.05])
    current = np.random.normal(0.25, 0.12, n_samples).clip(0.0, 0.55)

    return np.column_stack([sound_energy, frequency, vibration, current])


def train_model(data=None):
    """
    Train an Isolation Forest + One-Class SVM ensemble.
    Returns (model_dict, scaler, metadata).
    """
    if data is None:
        # Try fetching from MongoDB first
        data = fetch_training_data()
        if data is None:
            print("[ML] Not enough real data. Using synthetic baseline data.")
            data = generate_synthetic_training_data()
        else:
            print(f"[ML] Training on {len(data)} real sensor readings from MongoDB.")

    # Standardize features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(data)

    # Model 1: Isolation Forest — great for high-dimensional anomaly detection
    iso_forest = IsolationForest(
        n_estimators=100,
        contamination=0.05,  # Expect ~5% anomalies
        max_samples='auto',
        random_state=42,
    )
    iso_forest.fit(X_scaled)

    # Model 2: One-Class SVM — learns the boundary of normal data
    oc_svm = OneClassSVM(
        kernel='rbf',
        gamma='scale',
        nu=0.05,  # ~5% margin for anomalies
    )
    oc_svm.fit(X_scaled)

    # Compute feature statistics for interpretability
    feature_names = ['soundEnergy', 'frequency', 'vibration', 'current']
    stats = {}
    for i, name in enumerate(feature_names):
        col = data[:, i]
        stats[name] = {
            'mean': float(np.mean(col)),
            'std': float(np.std(col)),
            'min': float(np.min(col)),
            'max': float(np.max(col)),
        }

    model_dict = {
        'isolation_forest': iso_forest,
        'one_class_svm': oc_svm,
    }
    metadata = {
        'n_samples': len(data),
        'feature_stats': stats,
        'feature_names': feature_names,
    }

    # Save to disk
    joblib.dump(model_dict, MODEL_PATH)
    joblib.dump(scaler, SCALER_PATH)
    joblib.dump(metadata, META_PATH)

    print(f"[ML] Model trained on {len(data)} samples. Saved to {MODEL_PATH}")
    print(f"[ML] Feature stats: {stats}")

    return model_dict, scaler, metadata


def load_model():
    """Load the trained model from disk."""
    if not os.path.exists(MODEL_PATH):
        return None, None, None
    model_dict = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    metadata = joblib.load(META_PATH)
    return model_dict, scaler, metadata


def predict(sound_energy, frequency, vibration, current, model_dict=None, scaler=None, metadata=None):
    """
    Predict whether a reading is anomalous.
    Uses ensemble voting: both models must agree for high confidence.
    
    Returns:
      {
        'isAnomaly': bool,
        'confidence': float (0-1),
        'isoForestScore': float,
        'svmScore': float,
        'reasons': [str],
        'severity': 'warning' | 'critical'
      }
    """
    if model_dict is None:
        model_dict, scaler, metadata = load_model()
    
    if model_dict is None:
        return {'isAnomaly': False, 'confidence': 0.0, 'reasons': ['Model not trained yet'], 'severity': 'warning'}

    vib = 1.0 if vibration == 'DETECTED' else (float(vibration) if isinstance(vibration, (int, float)) else 0.0)
    features = np.array([[float(sound_energy), float(frequency), vib, float(current)]])
    X_scaled = scaler.transform(features)

    # Isolation Forest: -1 = anomaly, 1 = normal
    iso_pred = model_dict['isolation_forest'].predict(X_scaled)[0]
    iso_score = model_dict['isolation_forest'].score_samples(X_scaled)[0]

    # One-Class SVM: -1 = anomaly, 1 = normal
    svm_pred = model_dict['one_class_svm'].predict(X_scaled)[0]
    svm_score = model_dict['one_class_svm'].decision_function(X_scaled)[0]

    # Ensemble decision
    votes_anomaly = (iso_pred == -1) + (svm_pred == -1)
    is_anomaly = votes_anomaly >= 1  # At least one model flags it

    # Confidence: higher when both agree
    confidence = votes_anomaly / 2.0

    # Build reasons
    reasons = []
    severity = 'warning'
    stats = metadata.get('feature_stats', {})

    if iso_pred == -1:
        reasons.append(f'Isolation Forest flagged anomaly (score: {iso_score:.3f})')
    if svm_pred == -1:
        reasons.append(f'One-Class SVM flagged anomaly (score: {svm_score:.3f})')

    # Identify which parameters are out of normal range
    if stats:
        se_stats = stats.get('soundEnergy', {})
        if se_stats and (sound_energy > se_stats['mean'] + 2 * se_stats['std'] or sound_energy < se_stats['mean'] - 2 * se_stats['std']):
            reasons.append(f"Sound energy abnormal: {sound_energy:.0f} (normal: {se_stats['mean']:.0f} ± {se_stats['std']:.0f})")
            severity = 'critical'

        f_stats = stats.get('frequency', {})
        if f_stats and (frequency > f_stats['mean'] + 2 * f_stats['std'] or frequency < f_stats['mean'] - 2 * f_stats['std']):
            reasons.append(f"Frequency abnormal: {frequency:.0f} Hz (normal: {f_stats['mean']:.0f} ± {f_stats['std']:.0f})")
            severity = 'critical'

        c_stats = stats.get('current', {})
        if c_stats and (current > c_stats['mean'] + 2 * c_stats['std']):
            reasons.append(f"Current surge: {current:.2f} A (normal: {c_stats['mean']:.2f} ± {c_stats['std']:.2f})")
            severity = 'critical'

    if votes_anomaly == 2:
        severity = 'critical'

    return {
        'isAnomaly': bool(is_anomaly),
        'confidence': float(confidence),
        'isoForestScore': float(iso_score),
        'svmScore': float(svm_score),
        'reasons': reasons,
        'severity': severity,
    }


if __name__ == '__main__':
    print("=== Digital Ear ML Model ===")
    print("Training model...")
    model_dict, scaler, metadata = train_model()
    
    print("\n--- Testing predictions ---")
    # Normal reading
    result = predict(47000, 1100, 'NORMAL', 0.25, model_dict, scaler, metadata)
    print(f"Normal:   anomaly={result['isAnomaly']}, conf={result['confidence']:.1%}")
    
    # Abnormal reading
    result = predict(75000, 250, 'DETECTED', 3.5, model_dict, scaler, metadata)
    print(f"Abnormal: anomaly={result['isAnomaly']}, conf={result['confidence']:.1%}, reasons={result['reasons']}")
