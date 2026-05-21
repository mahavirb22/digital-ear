const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

router.post('/data', dataController.saveReading);
router.get('/data/active-devices', dataController.getDevices);
router.get('/data/:deviceId', dataController.getDeviceReadings);

module.exports = router;
