"""
Per-Machine ML Model Management
================================
Handles machine-specific Isolation Forest models with calibration.
"""

import os
import json
import pickle
import numpy as np
from datetime import datetime
from pathlib import Path
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

MODELS_DIR = Path(__file__).parent / "machine_models"
MODELS_DIR.mkdir(exist_ok=True)

class MachineProfile:
    """Manages individual machine profiles and ML models"""
    
    def __init__(self, machine_id):
        self.machine_id = machine_id
        self.profile_path = MODELS_DIR / f"{machine_id}_profile.json"
        self.model_path = MODELS_DIR / f"{machine_id}_model.pkl"
        self.scaler_path = MODELS_DIR / f"{machine_id}_scaler.pkl"
        
        self.baseline = None
        self.training_data = []
        self.model = None
        self.scaler = None
        self.calibration_status = "uncalibrated"
        self.health_score = 100
        
        self._load()
    
    def _load(self):
        """Load machine profile from disk"""
        if self.profile_path.exists():
            with open(self.profile_path, 'r') as f:
                profile = json.load(f)
                self.baseline = profile.get('baseline', {})
                self.training_data = profile.get('trainingData', [])
                self.calibration_status = profile.get('status', 'uncalibrated')
        
        # Load sklearn objects
        if self.model_path.exists():
            with open(self.model_path, 'rb') as f:
                self.model = pickle.load(f)
        
        if self.scaler_path.exists():
            with open(self.scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
    
    def _save(self):
        """Save machine profile to disk"""
        profile = {
            'machineId': self.machine_id,
            'baseline': self.baseline,
            'trainingData': self.training_data,
            'status': self.calibration_status,
            'calibrationDate': datetime.now().isoformat(),
            'healthScore': self.health_score
        }
        
        with open(self.profile_path, 'w') as f:
            json.dump(profile, f, indent=2)
        
        # Save sklearn objects
        if self.model:
            with open(self.model_path, 'wb') as f:
                pickle.dump(self.model, f)
        
        if self.scaler:
            with open(self.scaler_path, 'wb') as f:
                pickle.dump(self.scaler, f)
    
    def add_training_sample(self, reading):
        """
        Add sample during calibration
        reading: {frequency, soundEnergy, current, vibration}
        """
        # Convert vibration to numeric (DETECTED=1, others=0)
        vibration_val = 1.0 if reading.get('vibration') == 'DETECTED' else 0.0
        
        feature_vector = [
            reading.get('frequency', 0),
            reading.get('soundEnergy', 0),
            reading.get('current', 0),
            vibration_val
        ]
        
        self.training_data.append(feature_vector)
    
    def finalize_calibration(self):
        """
        Train model after collecting samples.
        Requires at least 20 samples.
        """
        if len(self.training_data) < 20:
            return {
                'success': False,
                'error': f'Insufficient samples: {len(self.training_data)}/20'
            }
        
        try:
            # Convert to numpy array
            X_train = np.array(self.training_data)
            
            # Compute baseline (mean of training data)
            self.baseline = {
                'frequency': float(np.mean(X_train[:, 0])),
                'soundEnergy': float(np.mean(X_train[:, 1])),
                'current': float(np.mean(X_train[:, 2])),
                'vibration': float(np.mean(X_train[:, 3]))
            }
            
            # Scale data
            self.scaler = StandardScaler()
            X_scaled = self.scaler.fit_transform(X_train)
            
            # Train Isolation Forest
            self.model = IsolationForest(
                contamination=0.1,  # Expect ~10% anomalies
                random_state=42,
                n_estimators=100
            )
            self.model.fit(X_scaled)
            
            self.calibration_status = "trained"
            self._save()
            
            return {
                'success': True,
                'samples': len(self.training_data),
                'baseline': self.baseline,
                'message': f'Machine {self.machine_id} trained on {len(self.training_data)} samples'
            }
        
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def predict(self, reading):
        """
        Predict if reading is anomalous.
        Returns: {isAnomaly, confidence, healthScore}
        """
        if self.calibration_status != "trained" or self.model is None:
            return {
                'isAnomaly': False,
                'reason': 'Model not trained',
                'healthScore': 100
            }
        
        try:
            vibration_val = 1.0 if reading.get('vibration') == 'DETECTED' else 0.0
            
            feature_vector = np.array([[
                reading.get('frequency', 0),
                reading.get('soundEnergy', 0),
                reading.get('current', 0),
                vibration_val
            ]])
            
            # Scale using training scaler
            X_scaled = self.scaler.transform(feature_vector)
            
            # Predict (-1 = anomaly, 1 = normal)
            prediction = self.model.predict(X_scaled)[0]
            anomaly_score = self.model.score_samples(X_scaled)[0]
            
            is_anomaly = prediction == -1
            
            # Calculate health score (0-100)
            # anomaly_score ranges from ~-1 to ~1, convert to health %
            health_score = max(0, min(100, int((1 - (-anomaly_score)) * 50)))
            
            self.health_score = health_score
            
            return {
                'isAnomaly': is_anomaly,
                'anomalyScore': float(anomaly_score),
                'healthScore': health_score,
                'baseline': self.baseline,
                'samplesCount': len(self.training_data)
            }
        
        except Exception as e:
            return {
                'isAnomaly': False,
                'error': str(e),
                'healthScore': 100
            }
    
    def start_calibration(self):
        """Reset for new calibration session"""
        self.training_data = []
        self.calibration_status = "calibrating"
        self._save()
        return {'status': 'calibration_started', 'machineId': self.machine_id}
    
    def get_status(self):
        """Get machine profile status"""
        return {
            'machineId': self.machine_id,
            'status': self.calibration_status,
            'baseline': self.baseline,
            'healthScore': self.health_score,
            'trainingDataPoints': len(self.training_data),
            'profilePath': str(self.profile_path)
        }


# Global machine profiles cache
_profiles = {}

def get_machine_profile(machine_id):
    """Get or create machine profile"""
    if machine_id not in _profiles:
        _profiles[machine_id] = MachineProfile(machine_id)
    return _profiles[machine_id]

def list_all_machines():
    """List all trained machine profiles"""
    profiles = []
    for profile_file in MODELS_DIR.glob("*_profile.json"):
        machine_id = profile_file.stem.replace("_profile", "")
        profile = get_machine_profile(machine_id)
        profiles.append(profile.get_status())
    return profiles
