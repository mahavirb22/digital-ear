const Machine = require('../models/Machine');
const Device = require('../models/Device');

const activeCalibrations = {}; // { deviceId: { machineId: string, readings: [] } }

/**
 * Start buffering readings for a device.
 */
exports.startCalibration = (deviceId, machineId) => {
  activeCalibrations[deviceId] = {
    machineId,
    readings: []
  };
};

/**
 * Add a reading if the device is currently calibrating.
 * Returns true if the reading was absorbed by calibration (meaning do not trigger anomaly).
 */
exports.addReadingIfCalibrating = (deviceId, reading) => {
  if (activeCalibrations[deviceId]) {
    activeCalibrations[deviceId].readings.push(reading);
    return true;
  }
  return false;
};

/**
 * Finalize the calibration for a device, compute averages, and save to Machine.
 */
exports.finalizeCalibration = async (deviceId) => {
  const session = activeCalibrations[deviceId];
  if (!session) return;
  
  const { machineId, readings } = session;
  delete activeCalibrations[deviceId];

  if (readings.length < 5) {
    try {
      await Machine.findByIdAndUpdate(machineId, {
        isCalibrated: false,
        calibrationStatus: 'failed',
        calibrationError: 'Insufficient readings collected during calibration. Please check connection.',
        updatedAt: new Date()
      });
      console.error(`[Calibration] Machine ${machineId} calibration rejected (Insufficient readings: ${readings.length}).`);
    } catch (err) {
      console.error(`[Calibration] Failed to update machine ${machineId} for rejected calibration:`, err);
    }
    return;
  }

  // Compute averages and standard deviation for sanity check
  let sumSound = 0, sumFreq = 0, sumCurrent = 0, sumVib = 0;
  let maxCurrent = 0;
  
  for (const r of readings) {
    sumSound += r.soundEnergy || 0;
    sumFreq += r.frequency || 0;
    const currentVal = r.current || 0;
    sumCurrent += currentVal;
    if (currentVal > maxCurrent) maxCurrent = currentVal;
    sumVib += r.vibration === 'DETECTED' ? 1 : 0;
  }

  const count = readings.length || 1;
  const avgCurrent = sumCurrent / count;

  let currentVariance = 0;
  for (const r of readings) {
    currentVariance += Math.pow((r.current || 0) - avgCurrent, 2);
  }
  const currentStd = Math.sqrt(currentVariance / count);

  if (avgCurrent > 1.8) {
    try {
      await Machine.findByIdAndUpdate(machineId, {
        isCalibrated: false,
        calibrationStatus: 'failed',
        calibrationError: 'Average current overload detected.',
        updatedAt: new Date()
      });
      console.error(`[Calibration] Machine ${machineId} calibration rejected (Average current: ${avgCurrent.toFixed(2)}A).`);
    } catch (err) {
      console.error(`[Calibration] Failed to update machine ${machineId} for rejected calibration:`, err);
    }
    return;
  }

  if (currentStd > 0.2) {
    try {
      await Machine.findByIdAndUpdate(machineId, {
        isCalibrated: false,
        calibrationStatus: 'failed',
        calibrationError: 'Current fluctuation too high during calibration.',
        updatedAt: new Date()
      });
      console.error(`[Calibration] Machine ${machineId} calibration rejected (std: ${currentStd.toFixed(2)}).`);
    } catch (err) {
      console.error(`[Calibration] Failed to update machine ${machineId} for rejected calibration:`, err);
    }
    return;
  }

  if (maxCurrent > 1.5) {
    try {
      await Machine.findByIdAndUpdate(machineId, {
        isCalibrated: false,
        calibrationStatus: 'failed',
        calibrationError: 'Maximum current exceeds 1.5A safety threshold.',
        updatedAt: new Date()
      });
      console.error(`[Calibration] Machine ${machineId} calibration rejected (max current: ${maxCurrent.toFixed(2)}A).`);
    } catch (err) {
      console.error(`[Calibration] Failed to update machine ${machineId} for rejected calibration:`, err);
    }
    return;
  }

  const baseline = {
    soundEnergy: sumSound / count,
    frequency: sumFreq / count,
    current: avgCurrent,
    vibrationLevel: sumVib / count // 0.0 to 1.0 proportion
  };

  try {
    await Machine.findByIdAndUpdate(machineId, {
      baseline,
      isCalibrated: true,
      calibrationStatus: 'ready',
      calibrationError: null,
      updatedAt: new Date()
    });
    console.log(`[Calibration] Machine ${machineId} calibrated successfully with ${readings.length} readings.`);
  } catch (err) {
    console.error(`[Calibration] Failed to save baseline for machine ${machineId}:`, err);
  }
};
