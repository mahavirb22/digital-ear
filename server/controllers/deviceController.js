const Device = require('../models/Device');
const { checkForStoppages } = require('../services/anomalyDetector');
const Notification = require('../models/Notification');

const OFFLINE_THRESHOLD_MS = 30000; // 30 seconds

exports.registerDevice = async (req, res) => {
  try {
    const { deviceId, name } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'Device ID is required' });
    }

    const existing = await Device.findOne({ deviceId });
    if (existing) {
      return res.status(400).json({ error: `Device ${deviceId} is already registered` });
    }

    const device = new Device({
      deviceId,
      name: name || deviceId,
      registeredBy: req.user?.userId || null,
    });
    await device.save();

    res.status(201).json({ message: 'Device registered successfully', device });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
};

exports.removeDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const device = await Device.findOneAndDelete({ deviceId });
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Cascade delete associated readings and notifications
    const SensorReading = require('../models/SensorReading');
    const Notification = require('../models/Notification');
    const Machine = require('../models/Machine');

    await SensorReading.deleteMany({ deviceId });
    await Notification.deleteMany({ deviceId });

    // Detach from any machine and force auto-decalibration
    await Machine.updateMany(
      { deviceAttached: device._id },
      { 
        $set: { 
          deviceAttached: null,
          isCalibrated: false,
          calibrationStatus: 'none',
          calibrationError: null,
          baseline: {
            soundEnergy: 0,
            frequency: 0,
            vibrationLevel: 0,
            current: 0
          }
        } 
      }
    );

    res.json({ message: 'Device and its data removed successfully' });
  } catch (error) {
    console.error('Error removing device:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
};

exports.getRegisteredDevices = async (req, res) => {
  try {
    const devices = await Device.find({}).sort({ registeredAt: -1 });

    // Update status based on lastSeen timestamp
    const now = Date.now();
    const updated = devices.map(d => {
      const doc = d.toObject();
      if (!doc.lastSeen) {
        doc.status = 'offline';
      } else if (now - new Date(doc.lastSeen).getTime() > OFFLINE_THRESHOLD_MS) {
        doc.status = 'offline';
      }
      return doc;
    });

    res.json(updated);
  } catch (error) {
    console.error('Error fetching registered devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
};

exports.checkStoppages = async (req, res) => {
  try {
    const stoppages = checkForStoppages();

    // Create notifications for stoppages
    for (const stoppage of stoppages) {
      // Check if machine was scheduled off
      const device = await Device.findOne({ deviceId: stoppage.deviceId }).populate('attachedMachine');
      const isScheduledOff = device && device.attachedMachine && device.attachedMachine.status === 'scheduled_off';

      if (!isScheduledOff) {
        const machineName = device && device.attachedMachine ? device.attachedMachine.name : stoppage.deviceId;
        const message = `Unexpected Power Loss / Breaker Tripped on Machine ${machineName}!`;

        const recentNotif = await Notification.findOne({
          deviceId: stoppage.deviceId,
          message: { $regex: /Unexpected Power Loss/ },
          timestamp: { $gte: new Date(Date.now() - 30000) } // Don't spam — only if not notified in last 30s
        });

        if (!recentNotif) {
          await new Notification({
            deviceId: stoppage.deviceId,
            message,
            severity: 'critical'
          }).save();
        }
      }

      // Mark device as offline (always, regardless of scheduled_off status)
      await Device.findOneAndUpdate(
        { deviceId: stoppage.deviceId },
        { status: 'offline' }
      );
    }

    res.json({ stoppages });
  } catch (error) {
    console.error('Error checking stoppages:', error);
    res.status(500).json({ error: 'Failed to check stoppages' });
  }
};
