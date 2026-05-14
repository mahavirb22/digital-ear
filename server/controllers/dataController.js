const webpush = require('web-push');
const SensorReading = require('../models/SensorReading');
const Notification = require('../models/Notification');
const Subscription = require('../models/Subscription');
const Device = require('../models/Device');
const { analyzeReading } = require('../services/anomalyDetector');

exports.saveReading = async (req, res) => {
  try {
    const { deviceId, soundEnergy, frequency, vibration, current } = req.body;

    // Check if device is registered
    const device = await Device.findOne({ deviceId });
    if (!device) {
      return res.status(404).json({ error: `Device ${deviceId} is not registered. Please register it first.` });
    }

    // Run anomaly detection model (ML + statistical hybrid)
    const analysis = await analyzeReading({ deviceId, soundEnergy, frequency, vibration, current });

    const newReading = new SensorReading({
      deviceId,
      soundEnergy,
      frequency,
      vibration,
      current,
      isAnomaly: analysis.isAnomaly
    });

    await newReading.save();

    // Update device last seen & status
    device.lastSeen = new Date();
    device.status = analysis.isAnomaly ? 'anomaly' : 'online';
    await device.save();

    // Create notification if anomaly detected
    if (analysis.isAnomaly && analysis.reasons.length > 0) {
      const message = `Anomaly on ${deviceId}: ${analysis.reasons.join(', ')}`;
      
      const notification = new Notification({
        deviceId,
        message,
        severity: analysis.severity
      });
      await notification.save();

      // Send push notifications
      try {
        const payload = JSON.stringify({ title: 'System Alert', body: message });
        const subscriptions = await Subscription.find({});
        
        const pushPromises = subscriptions.map(sub => {
          return webpush.sendNotification(sub, payload).catch(err => {
            console.error('Push notification failed for a sub:', err.statusCode || err.message);
          });
        });
        
        await Promise.all(pushPromises);
      } catch (pushError) {
        console.error('Push notification error:', pushError.message);
      }
    }

    res.status(200).json({ 
      message: 'Reading saved successfully',
      isAnomaly: analysis.isAnomaly,
      reasons: analysis.reasons 
    });
  } catch (error) {
    console.error('Error saving reading:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getDeviceReadings = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const readings = await SensorReading.find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(50);
      
    res.status(200).json(readings);
  } catch (error) {
    console.error('Error fetching readings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getDevices = async (req, res) => {
  try {
    const devices = await SensorReading.distinct('deviceId');
    res.status(200).json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
