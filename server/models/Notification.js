const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ['warning', 'critical'], required: true },
  timestamp: { type: Date, default: Date.now },
  acknowledged: { type: Boolean, default: false }
});

module.exports = mongoose.model('Notification', notificationSchema);
