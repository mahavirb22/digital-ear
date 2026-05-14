const express = require('express');
const router = express.Router();
const dataController = require('../controllers/dataController');

router.post('/data', dataController.saveReading);
router.get('/data/:deviceId', dataController.getDeviceReadings);
router.get('/devices', dataController.getDevices);

module.exports = router;
