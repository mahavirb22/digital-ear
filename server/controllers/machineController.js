const Machine = require('../models/Machine');
const Device = require('../models/Device');
const calibrationService = require('../services/calibrationService');

exports.getMachines = async (req, res) => {
  try {
    const machines = await Machine.find().populate('deviceAttached', 'deviceId name status');
    res.status(200).json(machines);
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.createMachine = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Machine name is required' });

    const newMachine = new Machine({ name });
    await newMachine.save();
    res.status(201).json(newMachine);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Machine name already exists' });
    console.error('Error creating machine:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.startCalibration = async (req, res) => {
  try {
    const { machineId } = req.params;
    const { deviceId, durationSeconds = 120 } = req.body;

    if (!deviceId) return res.status(400).json({ error: 'deviceId is required' });

    const machine = await Machine.findById(machineId);
    if (!machine) return res.status(404).json({ error: 'Machine not found' });

    const device = await Device.findOne({ deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    // Detach any other machine from this device, and attach this one
    device.attachedMachine = machine._id;
    device.calibrationEndTime = new Date(Date.now() + durationSeconds * 1000);
    await device.save();

    machine.deviceAttached = device._id;
    await machine.save();

    // Start memory buffering
    calibrationService.startCalibration(deviceId, machine._id);

    // Schedule finalization
    setTimeout(() => {
      calibrationService.finalizeCalibration(deviceId);
    }, durationSeconds * 1000);

    res.status(200).json({ 
      message: `Calibration started for ${durationSeconds} seconds`,
      calibrationEndTime: device.calibrationEndTime,
      machine,
      device
    });

  } catch (error) {
    console.error('Error starting calibration:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.markMaintenanceComplete = async (req, res) => {
  try {
    const { machineId } = req.params;
    const machine = await Machine.findById(machineId);
    
    if (!machine) return res.status(404).json({ error: 'Machine not found' });
    
    machine.needsMaintenance = false;
    await machine.save();
    
    res.status(200).json({ message: 'Maintenance marked as complete', machine });
  } catch (error) {
    console.error('Error marking maintenance complete:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
