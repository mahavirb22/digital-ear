const express = require('express');
const router = express.Router();
const { retrainModel } = require('../services/anomalyDetector');
const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';

// POST /api/ml/train — Retrain the ML model
router.post('/train', async (req, res) => {
  try {
    const result = await retrainModel();
    if (result) {
      res.json({ message: 'Model retrained successfully', ...result });
    } else {
      res.status(500).json({ error: 'Failed to retrain model' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrain model' });
  }
});

// GET /api/ml/info — Get model info
router.get('/info', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/model/info`, { timeout: 3000 });
    res.json(response.data);
  } catch (error) {
    res.status(503).json({ error: 'ML service unavailable' });
  }
});

// GET /api/ml/health — Check ML service health
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2000 });
    res.json(response.data);
  } catch (error) {
    res.json({ status: 'unavailable', model_loaded: false, message: 'ML service is not running. Using statistical fallback.' });
  }
});

module.exports = router;
