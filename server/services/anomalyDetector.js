/**
 * Anomaly Detection Service
 * 
 * Hybrid approach:
 *   1. ML Model (Isolation Forest + One-Class SVM) via Python microservice on port 5001
 *   2. Statistical fallback (rolling mean ± 2σ) if ML service is unavailable
 *   3. Hard threshold safety nets (always active)
 *   4. Machine stoppage detection via last-seen tracking
 */

const axios = require('axios');

// ML service URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001';
let mlServiceAvailable = false;

// Check ML service health on startup
async function checkMLService() {
  try {
    const res = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 2000 });
    mlServiceAvailable = res.data.status === 'ok';
    if (mlServiceAvailable) {
      console.log(`[Anomaly] ML service connected (${res.data.training_samples} training samples)`);
    }
  } catch (err) {
    mlServiceAvailable = false;
    console.warn('[Anomaly] ML service unavailable — using statistical fallback');
  }
}
checkMLService();
// Re-check every 30 seconds
setInterval(checkMLService, 30000);

// In-memory rolling window per device
const deviceWindows = {}; // { deviceId: { readings: [], lastSeen: Date } }
const WINDOW_SIZE = 50;
const STOPPAGE_TIMEOUT_MS = 10000; // 10 seconds without data = machine stopped

// Hard threshold safety nets (always apply)
const HARD_THRESHOLDS = {
  soundEnergy: { max: 60000 },
  frequency: { min: 300, max: 2000 },
  current: { max: 2.0 },
};

/**
 * Compute mean and standard deviation for an array of numbers.
 */
function computeStats(values) {
  if (values.length < 2) return { mean: values[0] || 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (values.length - 1);
  const std = Math.sqrt(variance);
  return { mean, std };
}

/**
 * Get ML prediction from the Python service.
 */
async function getMLPrediction(reading) {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/predict`, {
      soundEnergy: reading.soundEnergy,
      frequency: reading.frequency,
      vibration: reading.vibration,
      current: reading.current,
    }, { timeout: 3000 });
    return res.data;
  } catch (err) {
    mlServiceAvailable = false;
    return null;
  }
}

/**
 * Run statistical analysis (fallback when ML is unavailable).
 */
function statisticalAnalysis(reading, window) {
  const { soundEnergy, frequency, current } = reading;
  const reasons = [];

  if (window.readings.length >= 10) {
    const energyValues = window.readings.map(r => r.soundEnergy);
    const freqValues = window.readings.map(r => r.frequency);
    const currentValues = window.readings.map(r => r.current);

    const energyStats = computeStats(energyValues);
    const freqStats = computeStats(freqValues);
    const currentStats = computeStats(currentValues);

    const SIGMA_THRESHOLD = 2;

    if (energyStats.std > 0 && Math.abs(soundEnergy - energyStats.mean) > SIGMA_THRESHOLD * energyStats.std) {
      const direction = soundEnergy > energyStats.mean ? 'spike' : 'drop';
      reasons.push(`Sound energy ${direction} (σ-deviation: ${((soundEnergy - energyStats.mean) / energyStats.std).toFixed(1)}σ)`);
    }

    if (freqStats.std > 0 && Math.abs(frequency - freqStats.mean) > SIGMA_THRESHOLD * freqStats.std) {
      const direction = frequency > freqStats.mean ? 'spike' : 'drop';
      reasons.push(`Frequency ${direction} (σ-deviation: ${((frequency - freqStats.mean) / freqStats.std).toFixed(1)}σ)`);
    }

    if (currentStats.std > 0 && Math.abs(current - currentStats.mean) > SIGMA_THRESHOLD * currentStats.std) {
      const direction = current > currentStats.mean ? 'surge' : 'drop';
      reasons.push(`Current ${direction} (σ-deviation: ${((current - currentStats.mean) / currentStats.std).toFixed(1)}σ)`);
    }
  }

  return reasons;
}

/**
 * Analyze a single reading — ML first, statistical fallback.
 * Returns { isAnomaly: boolean, reasons: string[], severity: 'warning'|'critical', mlUsed: boolean }
 */
async function analyzeReading(reading) {
  const { deviceId, soundEnergy, frequency, current, vibration } = reading;

  // Initialize device window if needed
  if (!deviceWindows[deviceId]) {
    deviceWindows[deviceId] = { readings: [], lastSeen: new Date() };
  }

  const window = deviceWindows[deviceId];
  window.lastSeen = new Date();

  const reasons = [];
  let severity = 'warning';
  let mlUsed = false;

  // --- Layer 1: Hard Threshold Checks (always active) ---
  if (soundEnergy > HARD_THRESHOLDS.soundEnergy.max) {
    reasons.push(`High sound energy (${soundEnergy.toFixed(0)} units)`);
    severity = 'critical';
  }
  if (frequency < HARD_THRESHOLDS.frequency.min || frequency > HARD_THRESHOLDS.frequency.max) {
    reasons.push(`Abnormal frequency (${frequency.toFixed(0)} Hz)`);
    severity = 'critical';
  }
  if (current > HARD_THRESHOLDS.current.max) {
    reasons.push(`Overcurrent (${current.toFixed(2)} A)`);
    severity = 'critical';
  }
  if (vibration === 'DETECTED') {
    reasons.push('Vibration detected');
  }

  // --- Layer 2: ML Model (primary) or Statistical (fallback) ---
  if (mlServiceAvailable) {
    const mlResult = await getMLPrediction(reading);
    if (mlResult && mlResult.isAnomaly) {
      mlUsed = true;
      // Add ML-specific reasons (avoid duplicates)
      for (const reason of mlResult.reasons) {
        if (!reasons.some(r => r.toLowerCase().includes(reason.substring(0, 15).toLowerCase()))) {
          reasons.push(reason);
        }
      }
      if (mlResult.severity === 'critical') severity = 'critical';
    } else if (mlResult) {
      mlUsed = true; // ML ran but said it's normal — still counts
    }
  } else {
    // Fallback to statistical analysis
    const statReasons = statisticalAnalysis(reading, window);
    reasons.push(...statReasons);
  }

  // Add reading to the rolling window
  window.readings.push({ soundEnergy, frequency, current, vibration, timestamp: new Date() });
  if (window.readings.length > WINDOW_SIZE) {
    window.readings.shift();
  }

  return {
    isAnomaly: reasons.length > 0,
    reasons,
    severity: reasons.length > 0 ? severity : 'warning',
    mlUsed,
  };
}

/**
 * Retrain the ML model by calling the Python service.
 */
async function retrainModel() {
  try {
    const res = await axios.post(`${ML_SERVICE_URL}/train`, {}, { timeout: 30000 });
    console.log(`[Anomaly] ML model retrained on ${res.data.samples} samples`);
    return res.data;
  } catch (err) {
    console.error('[Anomaly] Failed to retrain ML model:', err.message);
    return null;
  }
}

/**
 * Check all tracked devices for stoppages.
 */
function checkForStoppages() {
  const now = new Date();
  const stoppedDevices = [];

  for (const [deviceId, window] of Object.entries(deviceWindows)) {
    const elapsed = now - window.lastSeen;
    if (elapsed > STOPPAGE_TIMEOUT_MS && window.readings.length > 0) {
      stoppedDevices.push({
        deviceId,
        message: `Device ${deviceId} stopped sending data ${Math.floor(elapsed / 1000)}s ago. Possible machine stoppage.`,
      });
    }
  }

  return stoppedDevices;
}

/**
 * Get the status of a specific device or all devices.
 */
function getDeviceStatus(deviceId) {
  if (deviceId) {
    const window = deviceWindows[deviceId];
    if (!window) return { status: 'unknown', lastSeen: null };
    const elapsed = Date.now() - window.lastSeen;
    return {
      status: elapsed > STOPPAGE_TIMEOUT_MS ? 'offline' : 'online',
      lastSeen: window.lastSeen,
    };
  }

  const statuses = {};
  for (const [id, window] of Object.entries(deviceWindows)) {
    const elapsed = Date.now() - window.lastSeen;
    statuses[id] = {
      status: elapsed > STOPPAGE_TIMEOUT_MS ? 'offline' : 'online',
      lastSeen: window.lastSeen,
    };
  }
  return statuses;
}

module.exports = { analyzeReading, checkForStoppages, getDeviceStatus, retrainModel };
