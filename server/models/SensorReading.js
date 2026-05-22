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

sensorReadingSchema.pre('validate', function () {
  if (this.vibration === 'DETECTED' || this.vibration === 'NORMAL') {
    return;
  }
  const val = Number(this.vibration);
  if (!isNaN(val)) {
    this.vibration = val > 0 ? 'DETECTED' : 'NORMAL';
  }
});

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
