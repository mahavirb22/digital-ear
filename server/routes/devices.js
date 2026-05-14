const express = require('express');
const router = express.Router();
const deviceController = require('../controllers/deviceController');

router.post('/register', deviceController.registerDevice);
router.delete('/:deviceId', deviceController.removeDevice);
router.get('/', deviceController.getRegisteredDevices);
router.get('/stoppages', deviceController.checkStoppages);

module.exports = router;
