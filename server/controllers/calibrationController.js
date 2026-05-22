/**
 * Calibration Controller
 * Handles machine calibration workflow
 */

const axios = require("axios");
const Machine = require("../models/Machine");
const Device = require("../models/Device");
const calibrationService = require("../services/calibrationService");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:5001";

/**
 * Start calibration for a machine
 * POST /calibrate/:machineId/start
 */
exports.startCalibration = async (req, res) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findById(machineId).populate("deviceAttached");
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    // Find the attached device's deviceId for local calibration
    let deviceId = null;
    if (machine.deviceAttached) {
      const device = await Device.findById(machine.deviceAttached);
      if (device) deviceId = device.deviceId;
    }

    // Start ML service calibration
    let mlAvailable = false;
    try {
      await axios.post(
        `${ML_SERVICE_URL}/machine/${machine.name}/calibrate/start`,
      );
      mlAvailable = true;
    } catch (mlErr) {
      console.warn(
        "[Calibration] ML service unavailable, local calibration mode",
      );
    }

    // Also start local calibration buffer as fallback
    if (deviceId) {
      calibrationService.startCalibration(deviceId, machine._id);
    }

    // Update machine status
    machine.calibrationStatus = "calibrating";
    await machine.save();

    return res.json({
      status: "calibration_started",
      machineId: machine._id,
      machineName: machine.name,
      mlAvailable,
      message: "Machine calibration started. Send 30 seconds of healthy data.",
    });
  } catch (err) {
    console.error("[Calibration] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Add calibration sample (feedback from live sensor data)
 * POST /calibrate/:machineId/sample
 */
exports.addCalibrationSample = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { soundEnergy, frequency, current, vibration } = req.body;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    if (machine.calibrationStatus !== "calibrating" && machine.calibrationStatus !== "ready") {
      return res
        .status(400)
        .json({ error: "Machine is not in calibration mode" });
    }

    const sample = {
      soundEnergy: soundEnergy || 0,
      frequency: frequency || 0,
      current: current || 0,
      vibration: vibration || 0,
    };

    // Try ML service first
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/machine/${machine.name}/calibrate/sample`,
        sample,
      );

      // Also buffer locally as backup
      const device = await Device.findById(machine.deviceAttached);
      if (device) {
        calibrationService.addReadingIfCalibrating(device.deviceId, sample);
      }

      return res.json({
        status: "sample_added",
        samplesCollected: response.data.samplesCollected || 0,
      });
    } catch (mlErr) {
      // ML service unavailable — fall back to local calibration buffer
      console.warn("[Calibration] ML unavailable, using local buffer");
      const device = await Device.findById(machine.deviceAttached);
      if (device) {
        calibrationService.addReadingIfCalibrating(device.deviceId, sample);
      }

      return res.json({
        status: "sample_added",
        samplesCollected: 0,
        localMode: true,
      });
    }
  } catch (err) {
    console.error("[Calibration Sample] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }

};

/**
 * Finalize calibration and train model
 * POST /calibrate/:machineId/finalize
 */
exports.finalizeCalibration = async (req, res) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    if (machine.calibrationStatus !== "calibrating" && machine.calibrationStatus !== "ready") {
      return res.status(400).json({ error: "Machine is not in a valid state for calibration finalization" });
    }

    // Try ML service first
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/machine/${machine.name}/calibrate/finalize`,
      );

      if (!response.data.success) {
        return res.status(400).json({
          error: response.data.error || "Calibration failed",
        });
      }

      // Update machine with new baseline
      machine.baseline = response.data.baseline || {};
      machine.calibrationStatus = "ready";
      machine.isCalibrated = true;
      await machine.save();

      return res.json({
        status: "calibration_complete",
        baseline: machine.baseline,
        samplesUsed: response.data.samples || 0,
        message: `Machine ${machine.name} trained successfully`,
      });
    } catch (mlErr) {
      // ML service unavailable — fall back to local calibration
      console.warn("[Calibration Finalize] ML unavailable, using local finalize");
      const device = await Device.findById(machine.deviceAttached);
      if (device) {
        await calibrationService.finalizeCalibration(device.deviceId);
        // Reload machine to get updated baseline
        const updated = await Machine.findById(machineId);
        if (updated && updated.isCalibrated) {
          return res.json({
            status: "calibration_complete",
            baseline: updated.baseline,
            samplesUsed: 0,
            localMode: true,
            message: `Machine ${machine.name} calibrated locally (ML service unavailable)`,
          });
        } else {
          return res.status(400).json({
            error: updated.calibrationError || "Local calibration failed",
          });
        }
      } else {
        return res.status(503).json({ error: "No device attached and ML service unavailable" });
      }
    }
  } catch (err) {
    console.error("[Calibration Finalize] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Get calibration status
 * GET /calibrate/:machineId/status
 */
exports.getCalibrationStatus = async (req, res) => {
  try {
    const { machineId } = req.params;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    // Get ML service status
    let mlStatus = {};
    try {
      const response = await axios.get(
        `${ML_SERVICE_URL}/machine/${machine.name}/status`,
      );
      mlStatus = response.data;
    } catch (mlErr) {
      console.warn("[Status] ML service unavailable");
    }

    return res.json({
      machineId: machine._id,
      machineName: machine.name,
      calibrationStatus: machine.calibrationStatus,
      isCalibrated: machine.isCalibrated,
      baseline: machine.baseline,
      mlStatus: mlStatus,
      message: `Machine is ${machine.calibrationStatus}`,
    });
  } catch (err) {
    console.error("[Calibration Status] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * Get ML prediction for a reading
 * POST /calibrate/:machineId/ml-predict
 */
exports.getMachinePrediction = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { soundEnergy, frequency, current, vibration } = req.body;

    const machine = await Machine.findById(machineId);
    if (!machine) {
      return res.status(404).json({ error: "Machine not found" });
    }

    if (!machine.isCalibrated || !machine.baseline) {
      return res.json({
        isAnomaly: false,
        trained: false,
        algorithm: "none",
        reason: "Machine not calibrated — no baseline data available",
        deviations: [],
        baseline: null,
      });
    }

    // Try remote ML service first
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/machine/${machine.name}/predict`,
        {
          soundEnergy: soundEnergy || 0,
          frequency: frequency || 0,
          current: current || 0,
          vibration: vibration || "NORMAL",
        },
      );

      // Merge algorithm info
      return res.json({
        ...response.data,
        trained: true,
        algorithm: "Isolation Forest (Remote ML)",
        baseline: response.data.baseline || machine.baseline,
      });
    } catch (mlErr) {
      // ML service unavailable — do LOCAL statistical anomaly detection
      console.warn("[ML Predict] ML service down, using local statistical analysis");

      const base = machine.baseline;
      const deviations = [];
      let anomalyCount = 0;

      // Sound Energy check (±30% from baseline)
      const soundDev = base.soundEnergy > 0
        ? ((soundEnergy - base.soundEnergy) / base.soundEnergy) * 100
        : 0;
      const soundFlag = Math.abs(soundDev) > 30;
      if (soundFlag) anomalyCount++;
      deviations.push({
        sensor: "Sound Energy",
        live: soundEnergy || 0,
        baseline: base.soundEnergy,
        deviation: parseFloat(soundDev.toFixed(1)),
        status: soundFlag ? "anomaly" : Math.abs(soundDev) > 15 ? "warning" : "normal",
      });

      // Frequency check (±30% from baseline)
      const freqDev = base.frequency > 0
        ? ((frequency - base.frequency) / base.frequency) * 100
        : 0;
      const freqFlag = Math.abs(freqDev) > 30;
      if (freqFlag) anomalyCount++;
      deviations.push({
        sensor: "Frequency",
        live: frequency || 0,
        baseline: base.frequency,
        deviation: parseFloat(freqDev.toFixed(1)),
        status: freqFlag ? "anomaly" : Math.abs(freqDev) > 15 ? "warning" : "normal",
      });

      // Current check (±20% from baseline — current is more sensitive)
      const currDev = base.current > 0
        ? ((current - base.current) / base.current) * 100
        : 0;
      const currFlag = Math.abs(currDev) > 20;
      if (currFlag) anomalyCount++;
      deviations.push({
        sensor: "Current",
        live: current || 0,
        baseline: base.current,
        deviation: parseFloat(currDev.toFixed(1)),
        status: currFlag ? "anomaly" : Math.abs(currDev) > 10 ? "warning" : "normal",
      });

      // Vibration check
      const vibValue = typeof vibration === "number" ? vibration : 0;
      const vibBase = base.vibrationLevel || 0;
      const vibDev = vibBase > 0 ? ((vibValue - vibBase) / vibBase) * 100 : 0;
      const vibFlag = vibBase > 5 && vibValue < 3; // machine stopped unexpectedly
      if (vibFlag) anomalyCount++;
      deviations.push({
        sensor: "Vibration",
        live: vibValue,
        baseline: vibBase,
        deviation: parseFloat(vibDev.toFixed(1)),
        status: vibFlag ? "anomaly" : "normal",
      });

      // Final anomaly decision: 2+ sensors deviating = confirmed anomaly
      const isAnomaly = anomalyCount >= 2;
      const isSingleWarning = anomalyCount === 1;

      // Build reason
      const flaggedSensors = deviations.filter(d => d.status === "anomaly").map(d => d.sensor);
      let reason = "";
      if (isAnomaly) {
        reason = `Anomaly detected: ${flaggedSensors.join(", ")} deviate significantly from calibrated baseline. Maintenance recommended.`;
      } else if (isSingleWarning) {
        reason = `${flaggedSensors[0]} shows deviation from baseline but other sensors are normal. Monitoring closely.`;
      } else {
        reason = "All sensor readings are within the calibrated baseline range. Machine operating normally.";
      }

      return res.json({
        isAnomaly,
        trained: true,
        algorithm: "Statistical Baseline Analysis (Local)",
        reason,
        deviations,
        anomalyCount,
        totalSensors: 4,
        baseline: {
          soundEnergy: base.soundEnergy,
          frequency: base.frequency,
          current: base.current,
          vibration: vibBase,
        },
      });
    }
  } catch (err) {
    console.error("[ML Predict] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * List all trained machines
 * GET /calibrate/machines/all
 */
exports.listAllMachines = async (req, res) => {
  try {
    // Get from ML service
    let mlMachines = [];
    try {
      const response = await axios.get(`${ML_SERVICE_URL}/machines`);
      mlMachines = response.data.machines || [];
    } catch (mlErr) {
      console.warn("[List Machines] ML service unavailable");
    }

    // Get from DB
    const dbMachines = await Machine.find(
      { isCalibrated: true },
      "name isCalibrated baseline calibrationStatus",
    );

    return res.json({
      machines: {
        database: dbMachines,
        mlService: mlMachines,
      },
    });
  } catch (err) {
    console.error("[List Machines] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};
