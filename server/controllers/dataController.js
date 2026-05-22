const webpush = require('web-push');
const SensorReading = require('../models/SensorReading');
const Notification = require('../models/Notification');
const Subscription = require('../models/Subscription');
const Device = require('../models/Device');
const { analyzeReading } = require('../services/anomalyDetector');

const lastNotificationTimes = {};

const normalizeVibration = (vibration) => {
  if (vibration === 'DETECTED' || vibration === 'NORMAL') {
    return vibration;
  }
  const val = Number(vibration);
  if (!isNaN(val)) {
    return val > 0 ? 'DETECTED' : 'NORMAL';
  }
  return vibration;
};

exports.saveReading = async (req, res) => {
  try {
    let { deviceId, soundEnergy, frequency, vibration, current } = req.body;
    vibration = normalizeVibration(vibration);
    req.body.vibration = vibration;

    // Check if device is registered
    const device = await Device.findOne({ deviceId }).populate('attachedMachine');
    if (!device) {
      return res.status(404).json({ error: `Device ${deviceId} is not registered. Please register it first.` });
    }

    // 1. Check if device is currently calibrating
    const now = new Date();
    if (device.calibrationEndTime && device.calibrationEndTime > now) {
      // Update device last seen & status to prevent offline flag during calibration
      device.lastSeen = new Date();
      device.status = 'online';
      await device.save();

      const calibrationService = require('../services/calibrationService');
      // Add reading to memory buffer
      calibrationService.addReadingIfCalibrating(deviceId, req.body);
      
      // Store raw reading but skip anomaly detection
      const newReading = new SensorReading({
        deviceId, soundEnergy, frequency, vibration, current, isAnomaly: false
      });
      await newReading.save();

      return res.status(200).json({ 
        message: 'Reading saved for calibration',
        isAnomaly: false,
        reasons: [] 
      });
    }

    // 2. Normal mode — Run anomaly detection if machine is calibrated
    const isCalibrated = device.attachedMachine && device.attachedMachine.isCalibrated;
    if (!isCalibrated) {
      // State A: Device registered/added, but calibration not started/completed yet
      // Update device last seen & status to prevent offline/never-connected flag
      device.lastSeen = new Date();
      device.status = 'online';
      await device.save();

      return res.status(200).json({
        message: 'Device connected. Waiting for calibration to start.',
        isAnomaly: false,
        reasons: []
      });
    }

    const machineBaseline = device.attachedMachine.baseline;

    const analysis = await analyzeReading({ deviceId, soundEnergy, frequency, vibration, current }, machineBaseline);

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

    if (analysis.zeroDriftAdjustment !== null && analysis.zeroDriftAdjustment !== undefined) {
      const Machine = require('../models/Machine');
      await Machine.findByIdAndUpdate(device.attachedMachine._id, {
        'baseline.current': analysis.zeroDriftAdjustment
      });
      device.attachedMachine.baseline.current = analysis.zeroDriftAdjustment;
    }

    // Create notification if anomaly detected
    const isCalibratedMachine = device.attachedMachine && device.attachedMachine.isCalibrated;
    if (analysis.isAnomaly && analysis.reasons.length > 0 && !isCalibratedMachine) {
      const nowMs = Date.now();
      const lastTime = lastNotificationTimes[deviceId] || 0;
      if (nowMs - lastTime > 5 * 60 * 1000) {
        lastNotificationTimes[deviceId] = nowMs;
        const message = `Anomaly on ${deviceId}: ${analysis.reasons.join(', ')}`;
        
        const notification = new Notification({
          deviceId,
          message,
          severity: analysis.severity
        });
        await notification.save();

        // Send push notifications
        const subscriptions = await Subscription.find({});
        try {
          const payload = JSON.stringify({ title: 'System Alert', body: message });
          const pushPromises = subscriptions.map(sub => webpush.sendNotification(sub, payload).catch(() => {}));
          await Promise.all(pushPromises);
        } catch (pushError) {
          console.error('Push notification error:', pushError.message);
        }
      }
    }

    // 3. Update machine maintenance status based on baseline comparison
    if (device.attachedMachine && device.attachedMachine.isCalibrated) {
      const Machine = require('../models/Machine');
      const currentNeedsMaintenance = analysis.isAnomaly; // True if it differs (anomalous), False if it matches (normal)

      if (device.attachedMachine.needsMaintenance !== currentNeedsMaintenance) {
        await Machine.findByIdAndUpdate(device.attachedMachine._id, { needsMaintenance: currentNeedsMaintenance });
        
        // Save to local object so the UI/rest of backend uses the updated value
        device.attachedMachine.needsMaintenance = currentNeedsMaintenance;

        if (currentNeedsMaintenance) {
          const maintenanceMsg = `MAINTENANCE REQUIRED: Machine '${device.attachedMachine.name}' is deviating from its calibrated baseline! Reasons: ${analysis.reasons.join(', ')}`;
          await new Notification({
            deviceId,
            message: maintenanceMsg,
            severity: 'critical'
          }).save();

          // Send push notifications
          const subscriptions = await Subscription.find({});
          try {
            const payload = JSON.stringify({ title: 'Maintenance Required', body: maintenanceMsg });
            const pushPromises = subscriptions.map(sub => webpush.sendNotification(sub, payload).catch(() => {}));
            await Promise.all(pushPromises);
          } catch (pushError) {
            console.error('Push notification error:', pushError.message);
          }
        } else {
          const normalMsg = `SYSTEM NORMAL: Machine '${device.attachedMachine.name}' is back within its baseline range.`;
          await new Notification({
            deviceId,
            message: normalMsg,
            severity: 'warning'
          }).save();

          // Send push notifications
          const subscriptions = await Subscription.find({});
          try {
            const payload = JSON.stringify({ title: 'System Normal', body: normalMsg });
            const pushPromises = subscriptions.map(sub => webpush.sendNotification(sub, payload).catch(() => {}));
            await Promise.all(pushPromises);
          } catch (pushError) {
            console.error('Push notification error:', pushError.message);
          }
        }
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
    // Only return device IDs that actually exist in the Device collection
    const registeredDevices = await Device.find({}, 'deviceId');
    const registeredIds = registeredDevices.map(d => d.deviceId);
    
    // Find which of those have sent readings
    const devices = await SensorReading.distinct('deviceId', { deviceId: { $in: registeredIds } });
    
    res.status(200).json(devices);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.saveBatchReadings = async (req, res) => {
  try {
    const { deviceId, readings } = req.body;
    if (!deviceId || !Array.isArray(readings) || readings.length === 0) {
      return res.status(400).json({ error: 'Invalid batch payload' });
    }

    const device = await Device.findOne({ deviceId }).populate('attachedMachine');
    if (!device) {
      return res.status(404).json({ error: `Device ${deviceId} is not registered.` });
    }

    // Process backdated timestamps based on 1 reading per second
    const now = new Date();
    const isCalibrated = device.attachedMachine && device.attachedMachine.isCalibrated;
    const machineBaseline = isCalibrated ? device.attachedMachine.baseline : null;
    
    // Process in order, oldest first. Assuming array is oldest to newest.
    // If we assume 1 sec interval, we can just assign timestamps.
    const total = readings.length;
    let anyAnomaly = false;

    for (let i = 0; i < total; i++) {
      const reading = readings[i];
      reading.vibration = normalizeVibration(reading.vibration);
      const ageVal = typeof reading.age === 'number' ? reading.age : (total - 1 - i);
      const timestamp = new Date(now.getTime() - (ageVal * 1000));
      
      let isAnomaly = false;
      if (isCalibrated) {
        const analysis = await analyzeReading({ deviceId, ...reading }, machineBaseline);
        isAnomaly = analysis.isAnomaly;
        if (isAnomaly) anyAnomaly = true;
      }
      
      const newReading = new SensorReading({
        deviceId,
        soundEnergy: reading.soundEnergy,
        frequency: reading.frequency,
        vibration: reading.vibration,
        current: reading.current,
        isAnomaly,
        timestamp
      });
      await newReading.save();
    }

    device.lastSeen = now;
    device.status = anyAnomaly ? 'anomaly' : 'online';
    await device.save();

    res.status(200).json({ message: `Batch of ${total} readings saved successfully`, count: total });
  } catch (error) {
    console.error('Error saving batch readings:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
