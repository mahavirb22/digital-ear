const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

router.post('/subscribe', notificationController.subscribe);
router.get('/notifications', notificationController.getAllNotifications);
router.get('/notifications/:deviceId', notificationController.getDeviceNotifications);
router.patch('/notifications/:id/acknowledge', notificationController.acknowledgeNotification);

module.exports = router;
