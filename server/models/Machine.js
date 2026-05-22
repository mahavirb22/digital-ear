const mongoose = require("mongoose");

const machineSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  deviceAttached: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
    default: null,
  },
  status: {
    type: String,
    enum: ["running", "scheduled_off"],
    default: "running",
  },
  isCalibrated: { type: Boolean, default: false },
  calibrationStatus: {
    type: String,
    enum: ["none", "calibrating", "ready", "failed"],
    default: "none",
  },
  calibrationError: { type: String, default: null },
  needsMaintenance: { type: Boolean, default: false },
  baseline: {
    soundEnergy: { type: Number, default: 0 },
    frequency: { type: Number, default: 0 },
    vibrationLevel: { type: Number, default: 0 }, // 0.0 to 1.0 (proportion of 'DETECTED')
    current: { type: Number, default: 0 },
  },
  lastSensorReadingBeforeOff: {
    soundEnergy: { type: Number },
    frequency: { type: Number },
    vibration: { type: String },
    current: { type: Number },
    timestamp: { type: Date },
  },
  turnedOffAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Machine", machineSchema);
