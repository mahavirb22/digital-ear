const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Machine = require('./models/Machine');
const Device = require('./models/Device');
const SensorReading = require('./models/SensorReading');

const API_URL = 'http://localhost:5000/api';
const TEST_DEVICE_ID = 'TEST-FLOW-01';
const TEST_MACHINE_NAME = 'Test Ingestion Machine';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  try {
    // 1. Clean up existing test data
    console.log('🧹 Cleaning up any old test records...');
    const oldMachine = await Machine.findOne({ name: TEST_MACHINE_NAME });
    if (oldMachine) {
      await Device.deleteMany({ attachedMachine: oldMachine._id });
    }
    await Device.deleteOne({ deviceId: TEST_DEVICE_ID });
    await Machine.deleteOne({ name: TEST_MACHINE_NAME });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });
    console.log('✅ Clean up done.');

    // 2. Create Machine (Uncalibrated)
    console.log('🏭 Creating test machine...');
    const machine = new Machine({ name: TEST_MACHINE_NAME });
    await machine.save();
    console.log(`✅ Machine created: ${machine._id}`);

    // 3. Create Device (Registered but not calibrating/calibrated)
    console.log('📟 Registering device (State A: Added only)...');
    const device = new Device({
      deviceId: TEST_DEVICE_ID,
      name: 'Test Flow Device',
      attachedMachine: machine._id
    });
    await device.save();

    machine.deviceAttached = device._id;
    await machine.save();
    console.log(`✅ Device registered and attached to machine.`);

    // ==========================================
    // STATE A: ADDED ONLY
    // ==========================================
    console.log('\n--- Testing State A: Added Only (Registered but not calibrating/calibrated) ---');
    
    console.log('📡 Sending simulated reading from ESP32...');
    let res = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 35000,
      frequency: 950,
      vibration: 'DETECTED',
      current: 0.9
    });

    console.log('Response Status:', res.status);
    console.log('Response Body:', res.data);

    // Assert response content
    if (res.data.message !== 'Device connected. Waiting for calibration to start.') {
      throw new Error(`State A: Unexpected response message: ${res.data.message}`);
    }

    // Verify no SensorReading is stored in DB
    const readingCountStateA = await SensorReading.countDocuments({ deviceId: TEST_DEVICE_ID });
    console.log(`DB SensorReading Count: ${readingCountStateA} (Expected: 0)`);
    if (readingCountStateA !== 0) {
      throw new Error('State A: Stored sensor reading in DB when it should NOT have.');
    }

    // Verify Device is online and has lastSeen updated
    const updatedDeviceStateA = await Device.findOne({ deviceId: TEST_DEVICE_ID });
    console.log('Device status in DB:', updatedDeviceStateA.status);
    console.log('Device lastSeen in DB:', updatedDeviceStateA.lastSeen);
    if (updatedDeviceStateA.status !== 'online' || !updatedDeviceStateA.lastSeen) {
      throw new Error('State A: Device should be marked online and have lastSeen updated.');
    }
    console.log('✅ State A test passed!');

    // ==========================================
    // STATE B: CALIBRATING
    // ==========================================
    console.log('\n--- Testing State B: Calibration Started ---');
    console.log('🚀 Triggering calibration for 5 seconds...');
    const calibRes = await axios.post(`${API_URL}/machines/${machine._id}/calibrate`, {
      deviceId: TEST_DEVICE_ID,
      durationSeconds: 5
    });
    console.log('Calibration Endpoint Response:', calibRes.data);

    console.log('📡 Sending reading during calibration...');
    res = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 40000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 1.0
    });

    console.log('Response Status:', res.status);
    console.log('Response Body:', res.data);

    if (res.data.message !== 'Reading saved for calibration') {
      throw new Error(`State B: Unexpected response message: ${res.data.message}`);
    }

    // Verify reading IS stored in DB during calibration
    const readingsStateB = await SensorReading.find({ deviceId: TEST_DEVICE_ID });
    console.log(`DB SensorReading Count: ${readingsStateB.length} (Expected: 1)`);
    if (readingsStateB.length !== 1) {
      throw new Error('State B: Expected exactly 1 stored reading in DB during calibration.');
    }
    console.log('Stored reading isAnomaly:', readingsStateB[0].isAnomaly, '(Expected: false)');
    if (readingsStateB[0].isAnomaly !== false) {
      throw new Error('State B: Reading should not flag anomaly during calibration.');
    }
    console.log('✅ State B test passed!');

    // ==========================================
    // STATE C: CALIBRATED (NORMAL MONITORING)
    // ==========================================
    console.log('\n⏳ Waiting 6 seconds for calibration to finalize...');
    await wait(6000);

    // Verify machine is calibrated
    const updatedMachine = await Machine.findById(machine._id);
    console.log('Machine isCalibrated in DB:', updatedMachine.isCalibrated);
    if (!updatedMachine.isCalibrated) {
      throw new Error('State C: Machine should be calibrated by now.');
    }
    console.log('Machine Calibrated Baseline:', updatedMachine.baseline);

    console.log('\n--- Testing State C: Calibrated (Normal Monitoring) ---');

    console.log('📡 Sending nominal reading (matching baseline)...');
    res = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: updatedMachine.baseline.soundEnergy,
      frequency: updatedMachine.baseline.frequency,
      vibration: 'DETECTED',
      current: updatedMachine.baseline.current
    });
    console.log('Nominal Response:', res.data);
    if (res.data.isAnomaly !== false) {
      throw new Error('State C: Expected nominal reading to have isAnomaly = false.');
    }

    console.log('📡 Sending anomaly reading (VIBRATION = NORMAL)...');
    res = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: updatedMachine.baseline.soundEnergy,
      frequency: updatedMachine.baseline.frequency,
      vibration: 'NORMAL',
      current: updatedMachine.baseline.current
    });
    console.log('Anomaly Response:', res.data);
    if (res.data.isAnomaly !== true || !res.data.reasons.includes('Machine is not running (No vibration detected)')) {
      throw new Error('State C: Expected vibration NORMAL to be flagged as machine stoppage anomaly.');
    }

    // Verify DB count and anomaly flags
    const finalReadings = await SensorReading.find({ deviceId: TEST_DEVICE_ID }).sort({ timestamp: 1 });
    console.log(`DB SensorReading Count: ${finalReadings.length} (Expected: 3 - 1 from calibration, 2 from normal monitoring)`);
    if (finalReadings.length !== 3) {
      throw new Error(`State C: Expected exactly 3 readings, got ${finalReadings.length}`);
    }

    console.log('Reading 1 (Calibration) isAnomaly:', finalReadings[0].isAnomaly, '(Expected: false)');
    console.log('Reading 2 (Nominal) isAnomaly:', finalReadings[1].isAnomaly, '(Expected: false)');
    console.log('Reading 3 (Anomaly) isAnomaly:', finalReadings[2].isAnomaly, '(Expected: true)');

    if (finalReadings[0].isAnomaly !== false || finalReadings[1].isAnomaly !== false || finalReadings[2].isAnomaly !== true) {
      throw new Error('State C: Mismatched anomaly flags on stored readings.');
    }

    console.log('✅ State C test passed!');

    // 9. Clean up
    console.log('\n🧹 Cleaning up test database entries...');
    await Device.deleteOne({ deviceId: TEST_DEVICE_ID });
    await Machine.deleteOne({ _id: machine._id });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });
    console.log('✅ Cleanup completed.');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ TEST ENCOUNTERED FAILURE:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.status, error.response.data);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
  }
}

runVerification();
