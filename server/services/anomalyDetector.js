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
const WINDOW_SIZE = 60;
const STOPPAGE_TIMEOUT_MS = 30000; // 30 seconds without data = machine stopped
const STOPPAGE_GRACE_PERIOD_MS = 8000;  // 8 seconds of continuous NORMAL before flagging stoppage

// Hard threshold safety nets (always apply)
const HARD_THRESHOLDS = {
  soundEnergy: { max: 60000 },
  frequency: { min: 300, max: 2000 },
  current: { max: 1.2 },
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

    // Use 3-sigma (standard industrial practice for Statistical Process Control)
    // to reduce false positives from minor random noise.
    const SIGMA_THRESHOLD = 3;

    // Minimum standard deviation (noise floor) to prevent hypersensitivity
    // on extremely stable signals.
    const MIN_STD_ENERGY = 3000;
    const MIN_STD_FREQ = 30;
    const MIN_STD_CURRENT = 0.05;

    const energyStd = Math.max(energyStats.std, MIN_STD_ENERGY);
    const freqStd = Math.max(freqStats.std, MIN_STD_FREQ);
    const currentStd = Math.max(currentStats.std, MIN_STD_CURRENT);

    if (Math.abs(soundEnergy - energyStats.mean) > SIGMA_THRESHOLD * energyStd) {
      const direction = soundEnergy > energyStats.mean ? 'spike' : 'drop';
      reasons.push(`Sound energy ${direction} (σ-deviation: ${((soundEnergy - energyStats.mean) / energyStd).toFixed(1)}σ)`);
    }

    if (Math.abs(frequency - freqStats.mean) > SIGMA_THRESHOLD * freqStd) {
      const direction = frequency > freqStats.mean ? 'spike' : 'drop';
      reasons.push(`Frequency ${direction} (σ-deviation: ${((frequency - freqStats.mean) / freqStd).toFixed(1)}σ)`);
    }

    if (Math.abs(current - currentStats.mean) > SIGMA_THRESHOLD * currentStd) {
      const direction = current > currentStats.mean ? 'surge' : 'drop';
      reasons.push(`Current ${direction} (σ-deviation: ${((current - currentStats.mean) / currentStd).toFixed(1)}σ)`);
    }
  }

  return reasons;
}

/**
 * Analyze a single reading — ML first, statistical fallback.
 * Returns { isAnomaly: boolean, reasons: string[], severity: 'warning'|'critical', mlUsed: boolean }
 */
async function analyzeReading(reading, machineBaseline = null, machineStatus = 'running') {
  const { deviceId, soundEnergy, frequency, current, vibration } = reading;

  // Initialize device window if needed
  if (!deviceWindows[deviceId]) {
    deviceWindows[deviceId] = { readings: [], lastSeen: new Date(), offStartTime: null };
  }

  const window = deviceWindows[deviceId];
  window.lastSeen = new Date();

  if (machineStatus === 'scheduled_off') {
    window.offStartTime = null;
    return {
      isAnomaly: false,
      reasons: [],
      severity: 'warning',
      mlUsed: false,
      frequentDeviations: false,
      zeroDriftAdjustment: null
    };
  }

  // Initialize offStartTime from DB if the machine is off/stopped and we don't have it in memory
  if (!window.offStartTime && vibration === 'NORMAL') {
    try {
      const SensorReading = require('../models/SensorReading');
      const lastActive = await SensorReading.findOne({
        deviceId,
        vibration: { $in: ['DETECTED', 'HIGH'] }
      }).sort({ timestamp: -1 });

      if (lastActive) {
        const firstOff = await SensorReading.findOne({
          deviceId,
          vibration: 'NORMAL',
          timestamp: { $gt: lastActive.timestamp }
        }).sort({ timestamp: 1 });
        window.offStartTime = firstOff ? firstOff.timestamp : new Date();
      } else {
        const oldestOff = await SensorReading.findOne({
          deviceId,
          vibration: 'NORMAL'
        }).sort({ timestamp: 1 });
        window.offStartTime = oldestOff ? oldestOff.timestamp : new Date();
      }
    } catch (err) {
      console.error('[Anomaly] Failed to fetch offStartTime from DB:', err);
    }
  }

  // Raw deviations found in the current reading
  const rawDeviations = [];
  let isStoppage = false;

  // 1. Vibration Stoppage Check (Layer 0)
  if (vibration === 'NORMAL') {
    if (!machineBaseline || machineBaseline.vibrationLevel > 0.1) {
      isStoppage = true;
      rawDeviations.push("Machine is not running (No vibration detected)");
    } else {
      // Vibration-less machine: fallback to checking current
      if (machineBaseline.current > 0.1 && current < 0.1) {
        isStoppage = true;
        rawDeviations.push("Machine is not running (Zero current detected)");
      }
    }
  }

  if (isStoppage) {
    if (!window.offStartTime) window.offStartTime = new Date();
  } else {
    // Motor is running (vibration DETECTED). Reset the stoppage timer and clear stale
    // anomaly window entries so past NORMAL readings don't keep maintenance alert alive.
    window.offStartTime = null;
    if (vibration === 'DETECTED') {
      // Mark all stale anomaly entries in the window as non-anomalous so the
      // debounce counters (duration/frequency) reset cleanly when motor resumes.
      for (const r of window.readings) {
        if (r.vibration !== 'DETECTED') {
          r.isRawAnomaly = false;
        }
      }
    }
  }

  // 2. Absolute limits (Fail-Safe Outliers) - Scale based on baseline if calibrated
  const currentMax = machineBaseline 
    ? Math.max(HARD_THRESHOLDS.current.max, machineBaseline.current * 2)
    : HARD_THRESHOLDS.current.max;

  const soundMax = machineBaseline
    ? Math.max(HARD_THRESHOLDS.soundEnergy.max, machineBaseline.soundEnergy * 2.5)
    : HARD_THRESHOLDS.soundEnergy.max;

  const freqMin = machineBaseline
    ? Math.min(HARD_THRESHOLDS.frequency.min, machineBaseline.frequency * 0.5)
    : HARD_THRESHOLDS.frequency.min;

  const freqMax = machineBaseline
    ? Math.max(HARD_THRESHOLDS.frequency.max, machineBaseline.frequency * 2.0)
    : HARD_THRESHOLDS.frequency.max;

  const isOutcurrent = current > currentMax;
  const isOutsound = soundEnergy > soundMax;
  const isOutfreq = frequency < freqMin || frequency > freqMax;
  const isOutvib = vibration === 'HIGH';

  if (isOutcurrent) rawDeviations.push(`Overcurrent (${current.toFixed(2)} A)`);
  if (isOutsound) rawDeviations.push(`High sound energy (${soundEnergy.toFixed(0)} units)`);
  if (isOutfreq) rawDeviations.push(`Abnormal frequency (${frequency.toFixed(0)} Hz)`);
  if (isOutvib) rawDeviations.push(`High vibration levels detected`);

  // 3. Baseline Deviations (if calibrated and machine is running)
  if (machineBaseline && !isStoppage) {
    const TOLERANCE = 0.3; // 30% deviation
    
    const checkBaseline = (val, base, name, unit = '') => {
      if (base > 0.05) {
        if (val > base * (1 + TOLERANCE)) {
          rawDeviations.push(`${name} surge (30%+ above baseline: ${val.toFixed(2)}${unit} vs ${base.toFixed(2)}${unit})`);
        } else if (val < base * (1 - TOLERANCE)) {
          rawDeviations.push(`${name} drop (30%+ below baseline: ${val.toFixed(2)}${unit} vs ${base.toFixed(2)}${unit})`);
        }
      }
    };

    checkBaseline(soundEnergy, machineBaseline.soundEnergy, 'Sound energy');
    // Only check baseline/min frequency if baseline frequency is within safe limit
    if (machineBaseline.frequency >= HARD_THRESHOLDS.frequency.min) {
      checkBaseline(frequency, machineBaseline.frequency, 'Frequency', 'Hz');
    }
    checkBaseline(current, machineBaseline.current, 'Current', 'A');
  }

  // 4. ML / Statistical Fallback deviations
  let mlUsed = false;
  let mlAnomaly = false;
  const mlReasons = [];

  if (!isStoppage) {
    if (mlServiceAvailable) {
      const mlResult = await getMLPrediction(reading);
      if (mlResult) {
        mlUsed = true;
        if (mlResult.isAnomaly) {
          mlAnomaly = true;
          mlResult.reasons.forEach(r => mlReasons.push(r));
        }
      }
    } else {
      // Statistical fallback deviations
      const statReasons = statisticalAnalysis(reading, window);
      rawDeviations.push(...statReasons);
    }
  }

  // Merge ML reasons if found
  if (mlAnomaly) {
    mlReasons.forEach(reason => {
      if (!rawDeviations.some(r => r.toLowerCase().includes(reason.substring(0, 15).toLowerCase()))) {
        rawDeviations.push(reason);
      }
    });
  }

  // 5. Multivariate Sensor Fusion (Correlation Logic)
  const isCurrentHigh = machineBaseline 
    ? (current > Math.max(machineBaseline.current * 1.25, 0.8))
    : (current > 0.85);

  const isVibrationNormal = vibration === 'DETECTED';
  const isVibrationHigh = vibration === 'HIGH';

  const isAudioHigh = machineBaseline
    ? (soundEnergy > Math.max(machineBaseline.soundEnergy * 1.25, 45000) || 
       frequency < Math.min(500, machineBaseline.frequency * 0.7) || 
       frequency > Math.max(1800, machineBaseline.frequency * 1.3))
    : (soundEnergy > 45000 || frequency < 500 || frequency > 1800);

  const isAudioNormal = !isAudioHigh;

  let fusionDiagnostic = null;
  let fusionSeverity = null;

  if (isCurrentHigh && isVibrationNormal && isAudioNormal) {
    fusionDiagnostic = "Condition A: Motor struggling against heavy load or internal electrical fault (mechanical components intact).";
    fusionSeverity = 'warning';
  } else if (!isCurrentHigh && isVibrationHigh && isAudioHigh) {
    fusionDiagnostic = "Condition B: Mechanical issue detected (loose mounting, failing bearing, or misaligned shaft).";
    fusionSeverity = 'critical';
  } else if (isCurrentHigh && isVibrationHigh && isAudioHigh) {
    fusionDiagnostic = "Condition C: Compounding failure. Mechanical jam causing severe vibration/noise and forcing motor electrical overload.";
    fusionSeverity = 'critical';
  }

  // 6. Sliding window & debouncing evaluation
  const isRawAnomaly = rawDeviations.length > 0 || mlAnomaly || fusionDiagnostic !== null;
  
  // Push to rolling window
  window.readings.push({ soundEnergy, frequency, current, vibration, isRawAnomaly, timestamp: new Date() });
  if (window.readings.length > WINDOW_SIZE) {
    window.readings.shift();
  }

  // Determine immediate critical breaches (Level 2)
  // Stoppage is only critical if it has persisted beyond the grace period
  const stoppageConfirmed = isStoppage && window.offStartTime &&
    (new Date() - window.offStartTime) > STOPPAGE_GRACE_PERIOD_MS;

  const hasImmediateCriticalBreach = 
    stoppageConfirmed || 
    isOutcurrent || 
    isOutsound || 
    isOutfreq || 
    isOutvib || 
    fusionSeverity === 'critical';

  let isAnomaly = false;
  let severity = 'warning';
  const reasons = [];

  if (hasImmediateCriticalBreach) {
    isAnomaly = true;
    severity = 'critical';
    if (stoppageConfirmed) {
      reasons.push(...rawDeviations);
    } else {
      if (fusionDiagnostic) {
        reasons.push(fusionDiagnostic);
      }
      reasons.push(...rawDeviations);
    }
  } else if (isRawAnomaly) {
    // Warning state - check debouncing (continuous duration or frequency count)
    let durationTrigger = false;
    if (window.readings.length >= 10) {
      durationTrigger = window.readings.slice(-10).every(r => r.isRawAnomaly);
    }

    const recentAnomaliesCount = window.readings.filter(r => r.isRawAnomaly).length;
    const frequencyTrigger = recentAnomaliesCount >= 5;

    if (durationTrigger || frequencyTrigger) {
      isAnomaly = true;
      severity = 'warning';
      if (durationTrigger) {
        reasons.push("Duration Trigger: Continuous sensor deviation detected for 10 seconds.");
      }
      if (frequencyTrigger) {
        reasons.push("Frequency Trigger: 5 sensor spikes detected within 60 seconds.");
      }
      if (fusionDiagnostic) {
        reasons.push(fusionDiagnostic);
      }
      reasons.push(...rawDeviations);
    }
  }

  // Zero-drift tracking logic
  let zeroDriftAdjustment = null;
  if (window.offStartTime && machineBaseline && machineBaseline.current > 0) {
    const offDurationMs = new Date() - window.offStartTime;
    if (offDurationMs > 5 * 60 * 1000) { // 5 minutes
      zeroDriftAdjustment = machineBaseline.current * 0.99 + current * 0.01;
    }
  }

  // Calculate frequent deviations (> 30% anomalous in the window)
  let frequentDeviations = false;
  if (window.readings.length >= 20) {
    const anomalyCount = window.readings.filter(r => r.isRawAnomaly).length;
    if (anomalyCount / window.readings.length > 0.3) {
      frequentDeviations = true;
    }
  }

  return {
    isAnomaly,
    reasons: [...new Set(reasons)],
    severity,
    mlUsed,
    frequentDeviations,
    zeroDriftAdjustment
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
        message: `Network Offline: Device ${deviceId} stopped sending data ${Math.floor(elapsed / 1000)}s ago.`,
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

function resetDeviceWindow(deviceId) {
  if (deviceWindows[deviceId]) {
    delete deviceWindows[deviceId];
  }
}

module.exports = {
  analyzeReading,
  checkForStoppages,
  getDeviceStatus,
  retrainModel,
  resetDeviceWindow
};
