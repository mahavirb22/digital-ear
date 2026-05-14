const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, default: '' },
  status: { type: String, enum: ['online', 'offline', 'anomaly'], default: 'offline' },
  lastSeen: { type: Date, default: null },
  registeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Device', deviceSchema);
