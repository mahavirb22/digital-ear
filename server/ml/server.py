"""
Digital Ear — ML Prediction Server (Flask)
==========================================
Runs on port 5001. The Node.js backend calls this service for ML-based anomaly detection.

Endpoints:
  POST /predict        — Predict if a reading is anomalous
  POST /train          — Retrain the model from MongoDB data
  GET  /health         — Health check
  GET  /model/info     — Model metadata and stats
"""

import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS
from model import train_model, predict, load_model, fetch_training_data

app = Flask(__name__)
CORS(app)

# Load model at startup, train if not exists
model_dict, scaler, metadata = load_model()
if model_dict is None:
    print("[ML Server] No trained model found. Training now...")
    model_dict, scaler, metadata = train_model()


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model_dict is not None,
        'training_samples': metadata.get('n_samples', 0) if metadata else 0,
    })


@app.route('/predict', methods=['POST'])
def predict_endpoint():
    """
    Expects JSON body:
    {
      "soundEnergy": 47000,
      "frequency": 1100,
      "vibration": "NORMAL" or "DETECTED",
      "current": 0.25
    }
    """
    global model_dict, scaler, metadata

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    sound_energy = data.get('soundEnergy', 0)
    frequency = data.get('frequency', 0)
    vibration = data.get('vibration', 'NORMAL')
    current = data.get('current', 0)

    result = predict(sound_energy, frequency, vibration, current, model_dict, scaler, metadata)
    return jsonify(result)


@app.route('/train', methods=['POST'])
def train_endpoint():
    """Retrain the model from latest MongoDB data."""
    global model_dict, scaler, metadata

    try:
        model_dict, scaler, metadata = train_model()
        return jsonify({
            'status': 'success',
            'samples': metadata.get('n_samples', 0),
            'feature_stats': metadata.get('feature_stats', {}),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/model/info', methods=['GET'])
def model_info():
    """Return current model metadata."""
    if metadata is None:
        return jsonify({'error': 'No model trained yet'}), 404

    return jsonify({
        'n_samples': metadata.get('n_samples', 0),
        'feature_names': metadata.get('feature_names', []),
        'feature_stats': metadata.get('feature_stats', {}),
    })


if __name__ == '__main__':
    port = int(os.getenv('ML_PORT', 5001))
    print(f"[ML Server] Starting on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=False)
