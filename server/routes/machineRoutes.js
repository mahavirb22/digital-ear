const express = require('express');
const router = express.Router();
const machineController = require('../controllers/machineController');

router.get('/', machineController.getMachines);
router.post('/', machineController.createMachine);
router.post('/:machineId/calibrate', machineController.startCalibration);
router.patch('/:machineId/maintenance-complete', machineController.markMaintenanceComplete);
router.patch('/:machineId/turn-off', machineController.turnOffMachine);
router.patch('/:machineId/status', machineController.updateMachineStatus);

module.exports = router;
