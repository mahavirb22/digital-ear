const mongoose = require('mongoose');

const machineSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  deviceAttached: { type: mongoose.Schema.Types.ObjectId, ref: 'Device', default: null },
  isCalibrated: { type: Boolean, default: false },
  needsMaintenance: { type: Boolean, default: false },
  baseline: {
    soundEnergy: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },
    vibrationLevel: { type: Number, default: 0 }, // 0.0 to 1.0 (proportion of 'DETECTED')
    current: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Machine', machineSchema);
