/**
 * Calibration Routes
 * ML-based machine calibration endpoints
 */

const express = require("express");
const router = express.Router();
const calibrationController = require("../controllers/calibrationController");
const authMiddleware = require("../middleware/authMiddleware");

// All calibration routes require authentication
router.use(authMiddleware);

/**
 * GET /api/calibrate/machines/all
 * List all calibrated machines across system
 */
router.get("/machines/all", calibrationController.listAllMachines);

/**
 * POST /api/calibrate/:machineId/start
 * Start calibration for a machine
 */
router.post("/:machineId/start", calibrationController.startCalibration);

/**
 * POST /api/calibrate/:machineId/sample
 * Add calibration sample during data collection
 */
router.post("/:machineId/sample", calibrationController.addCalibrationSample);

/**
 * POST /api/calibrate/:machineId/finalize
 * Finalize calibration and train ML model
 */
router.post("/:machineId/finalize", calibrationController.finalizeCalibration);

/**
 * GET /api/calibrate/:machineId/status
 * Get calibration status for machine
 */
router.get("/:machineId/status", calibrationController.getCalibrationStatus);

/**
 * POST /api/calibrate/:machineId/ml-predict
 * Get ML-based prediction for sensor reading
 */
router.post(
  "/:machineId/ml-predict",
  calibrationController.getMachinePrediction,
);

module.exports = router;
