const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  soundEnergy: { type: Number, required: true },
  frequency: { type: Number, required: true },
  vibration: { type: String, enum: ['DETECTED', 'NORMAL', 'HIGH'], required: true },
  current: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  isAnomaly: { type: Boolean, default: false }
});

sensorReadingSchema.pre('validate', function () {
  if (this.vibration === 'DETECTED' || this.vibration === 'NORMAL' || this.vibration === 'HIGH') {
    return;
  }
  const val = Number(this.vibration);
  if (!isNaN(val)) {
    if (val > 120) {
      this.vibration = 'HIGH';
    } else if (val > 0) {
      this.vibration = 'DETECTED';
    } else {
      this.vibration = 'NORMAL';
    }
  }
});

module.exports = mongoose.model('SensorReading', sensorReadingSchema);
