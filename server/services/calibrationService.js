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

  if (readings.length === 0) {
    console.warn(`[Calibration] No readings collected for machine ${machineId}. Baseline will be zero.`);
  }

  // Compute averages
  let sumSound = 0, sumFreq = 0, sumCurrent = 0, sumVib = 0;
  
  for (const r of readings) {
    sumSound += r.soundEnergy || 0;
    sumFreq += r.frequency || 0;
    sumCurrent += r.current || 0;
    sumVib += r.vibration === 'DETECTED' ? 1 : 0;
  }

  const count = readings.length || 1;
  const baseline = {
    soundEnergy: sumSound / count,
    frequency: sumFreq / count,
    current: sumCurrent / count,
    vibrationLevel: sumVib / count // 0.0 to 1.0 proportion
  };

  try {
    await Machine.findByIdAndUpdate(machineId, {
      baseline,
      isCalibrated: true,
      updatedAt: new Date()
    });
    console.log(`[Calibration] Machine ${machineId} calibrated successfully with ${readings.length} readings.`);
  } catch (err) {
    console.error(`[Calibration] Failed to save baseline for machine ${machineId}:`, err);
  }
};
