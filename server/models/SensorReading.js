const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  soundEnergy: { type: Number, required: true },
  frequency: { type: Number, required: true },
  vibration: { type: String, enum: ['DETECTED', 'NORMAL'], required: true },
  current: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  isAnomaly: { type: Boolean, default: false }
});

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
