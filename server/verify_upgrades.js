const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const axios = require('axios');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Machine = require('./models/Machine');
const Device = require('./models/Device');
const SensorReading = require('./models/SensorReading');
const Notification = require('./models/Notification');

const API_URL = 'http://localhost:5000/api';
const TEST_DEVICE_ID = 'TEST-UPGRADE-01';
const TEST_MACHINE_NAME = 'Test Upgrade Machine';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB.');

  try {
    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('🧹 Cleaning up old test records...');
    await Device.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Machine.deleteMany({ name: TEST_MACHINE_NAME });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });
    console.log('✅ Clean up done.');

    // ----------------------------------------------------
    // TEST 1: CALIBRATION SANITY CHECKS (FAILURE CASE: LOW COUNT)
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Calibration Failure - Low Count ---');
    let machine = new Machine({ name: TEST_MACHINE_NAME });
    await machine.save();
    let device = new Device({ deviceId: TEST_DEVICE_ID, name: 'Test Upgrade Device', attachedMachine: machine._id });
    await device.save();
    machine.deviceAttached = device._id;
    await machine.save();

    console.log('🚀 Starting calibration for 5 seconds...');
    await axios.post(`${API_URL}/machines/${machine._id}/calibrate`, {
      deviceId: TEST_DEVICE_ID,
      durationSeconds: 5
    });

    console.log('📡 Sending 2 readings (low count < 5)...');
    for (let i = 0; i < 2; i++) {
      const res = await axios.post(`${API_URL}/data`, {
        deviceId: TEST_DEVICE_ID,
        soundEnergy: 30000,
        frequency: 1000,
        vibration: 80.0,
        current: 1.0
      });
      console.log(`Reading ${i+1} response:`, res.data.message);
      await wait(300);
    }

    console.log('⏳ Waiting for calibration finalization...');
    await wait(6000);

    let updatedMachine = await Machine.findById(machine._id);
    console.log('Machine calibrationStatus:', updatedMachine.calibrationStatus);
    console.log('Machine calibrationError:', updatedMachine.calibrationError);
    if (updatedMachine.calibrationStatus !== 'failed' || !updatedMachine.calibrationError.includes('Insufficient readings')) {
      throw new Error('TEST 1 FAILED: Expected low reading count calibration rejection.');
    }
    console.log('✅ TEST 1 passed!');

    // ----------------------------------------------------
    // TEST 2: CALIBRATION SANITY CHECKS (FAILURE CASE: OVERLOAD CURRENT)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Calibration Failure - Overload Current ---');
    // Start calibration again
    await axios.post(`${API_URL}/machines/${machine._id}/calibrate`, {
      deviceId: TEST_DEVICE_ID,
      durationSeconds: 10
    });

    console.log('📡 Sending 6 readings with average current 2.0A (> 1.8A safety limit)...');
    for (let i = 0; i < 6; i++) {
      const res = await axios.post(`${API_URL}/data`, {
        deviceId: TEST_DEVICE_ID,
        soundEnergy: 30000,
        frequency: 1000,
        vibration: 80.0,
        current: 2.0
      });
      console.log(`Reading ${i+1} response:`, res.data.message);
      await wait(300);
    }
    console.log('⏳ Waiting for calibration finalization...');
    await wait(11000);

    updatedMachine = await Machine.findById(machine._id);
    console.log('Machine calibrationStatus:', updatedMachine.calibrationStatus);
    console.log('Machine calibrationError:', updatedMachine.calibrationError);
    if (updatedMachine.calibrationStatus !== 'failed' || !updatedMachine.calibrationError.includes('Average current')) {
      throw new Error('TEST 2 FAILED: Expected average current overload rejection.');
    }
    console.log('✅ TEST 2 passed!');

    // ----------------------------------------------------
    // TEST 3: CALIBRATION SANITY CHECKS (FAILURE CASE: HIGH CURRENT FLUCTUATION)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Calibration Failure - High Fluctuation ---');
    // Start calibration again
    await axios.post(`${API_URL}/machines/${machine._id}/calibrate`, {
      deviceId: TEST_DEVICE_ID,
      durationSeconds: 10
    });

    console.log('📡 Sending 6 readings with high deviation in current (stddev > 0.4)...');
    const currents = [0.2, 1.8, 0.2, 1.8, 0.2, 1.8]; // Avg = 1.0A, StdDev = 0.88A
    for (let i = 0; i < 6; i++) {
      const res = await axios.post(`${API_URL}/data`, {
        deviceId: TEST_DEVICE_ID,
        soundEnergy: 30000,
        frequency: 1000,
        vibration: 80.0,
        current: currents[i]
      });
      console.log(`Reading ${i+1} response:`, res.data.message);
      await wait(300);
    }
    console.log('⏳ Waiting for calibration finalization...');
    await wait(11000);

    updatedMachine = await Machine.findById(machine._id);
    console.log('Machine calibrationStatus:', updatedMachine.calibrationStatus);
    console.log('Machine calibrationError:', updatedMachine.calibrationError);
    if (updatedMachine.calibrationStatus !== 'failed' || !updatedMachine.calibrationError.includes('Current fluctuation too high')) {
      throw new Error('TEST 3 FAILED: Expected current fluctuation rejection.');
    }
    console.log('✅ TEST 3 passed!');

    // ----------------------------------------------------
    // TEST 4: SUCCESSFUL CALIBRATION
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Successful Calibration ---');
    await axios.post(`${API_URL}/machines/${machine._id}/calibrate`, {
      deviceId: TEST_DEVICE_ID,
      durationSeconds: 10
    });

    console.log('📡 Sending 6 stable nominal readings...');
    for (let i = 0; i < 6; i++) {
      const res = await axios.post(`${API_URL}/data`, {
        deviceId: TEST_DEVICE_ID,
        soundEnergy: 30000,
        frequency: 1000,
        vibration: 80.0,
        current: 1.0
      });
      console.log(`Reading ${i+1} response:`, res.data.message);
      await wait(300);
    }
    console.log('⏳ Waiting for calibration finalization...');
    await wait(11000);

    updatedMachine = await Machine.findById(machine._id);
    console.log('Machine isCalibrated:', updatedMachine.isCalibrated);
    console.log('Machine calibrationStatus:', updatedMachine.calibrationStatus);
    console.log('Machine Baseline:', updatedMachine.baseline);
    if (!updatedMachine.isCalibrated || updatedMachine.calibrationStatus !== 'ready') {
      throw new Error('TEST 4 FAILED: Expected calibration to succeed.');
    }
    console.log('✅ TEST 4 passed!');

    // ----------------------------------------------------
    // TEST 5: DEVICE DETACH AUTO-DECALIBRATION
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Detach Auto-Decalibration ---');
    console.log('Removing device via API...');
    await axios.delete(`${API_URL}/devices/${TEST_DEVICE_ID}`);

    updatedMachine = await Machine.findById(machine._id);
    console.log('After detach - deviceAttached:', updatedMachine.deviceAttached);
    console.log('After detach - isCalibrated:', updatedMachine.isCalibrated);
    console.log('After detach - calibrationStatus:', updatedMachine.calibrationStatus);
    console.log('After detach - baseline current:', updatedMachine.baseline.current);

    if (updatedMachine.deviceAttached !== null || updatedMachine.isCalibrated !== false || updatedMachine.calibrationStatus !== 'none' || updatedMachine.baseline.current !== 0) {
      throw new Error('TEST 5 FAILED: Expected machine parameters to reset on device detachment.');
    }

    // Re-register device and calibrate for subsequent tests
    console.log('Re-registering and calibrating device for next tests...');
    device = new Device({ deviceId: TEST_DEVICE_ID, name: 'Test Upgrade Device', attachedMachine: machine._id });
    await device.save();
    machine.deviceAttached = device._id;
    await machine.save();

    await axios.post(`${API_URL}/machines/${machine._id}/calibrate`, {
      deviceId: TEST_DEVICE_ID,
      durationSeconds: 8
    });
    for (let i = 0; i < 6; i++) {
      await axios.post(`${API_URL}/data`, {
        deviceId: TEST_DEVICE_ID,
        soundEnergy: 30000,
        frequency: 1000,
        vibration: 80.0,
        current: 1.0
      });
      await wait(300);
    }
    await wait(9000);
    console.log('✅ TEST 5 passed!');

    // ----------------------------------------------------
    // TEST 6: PRE-NOTIFICATION / SCHEDULED OFF VS RUNNING OUTAGES
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Scheduled Off vs Unexpected Power Loss ---');
    console.log('Clearing old notifications...');
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });

    // 6.1 Unexpected Outage (running)
    console.log('Simulating offline state when running...');
    await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 80.0,
      current: 1.0
    });

    console.log('⏳ Waiting 31 seconds to trigger stoppage timeout...');
    await wait(31000);

    console.log('Running stoppage check API...');
    let stoppageRes = await axios.get(`${API_URL}/devices/stoppages`);
    console.log('Stoppage Check Response:', stoppageRes.data);

    let criticalAlert = await Notification.findOne({ deviceId: TEST_DEVICE_ID, severity: 'critical' });
    console.log('Critical alert found:', criticalAlert ? criticalAlert.message : 'None');
    if (!criticalAlert || !criticalAlert.message.includes('Unexpected Power Loss')) {
      throw new Error('TEST 6.1 FAILED: Expected critical Unexpected Power Loss alert.');
    }
    console.log('✅ unexpected outage alerts successfully raised!');

    // 6.2 Scheduled Off (quiet)
    console.log('Setting machine status to scheduled_off...');
    await axios.patch(`${API_URL}/machines/${machine._id}/status`, { status: 'scheduled_off' });

    console.log('Clearing notifications...');
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });

    // Send a reading to refresh memory, then wait 31 seconds again
    await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 80.0,
      current: 1.0
    });

    console.log('⏳ Waiting 31 seconds to trigger stoppage timeout (scheduled off)...');
    await wait(31000);

    console.log('Running stoppage check API...');
    stoppageRes = await axios.get(`${API_URL}/devices/stoppages`);
    console.log('Stoppage Check Response:', stoppageRes.data);

    criticalAlert = await Notification.findOne({ deviceId: TEST_DEVICE_ID, severity: 'critical' });
    console.log('Critical alert found:', criticalAlert ? criticalAlert.message : 'None');
    if (criticalAlert) {
      throw new Error('TEST 6.2 FAILED: Unexpected critical alert during scheduled_off status.');
    }
    console.log('✅ Scheduled off quiet disconnect verified!');

    // Restore status to running
    await axios.patch(`${API_URL}/machines/${machine._id}/status`, { status: 'running' });
    console.log('✅ TEST 6 passed!');

    // ----------------------------------------------------
    // TEST 7: ALERT THROTTLING (TRANSITION-BASED AND RATE-LIMITED)
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Alert Throttling ---');
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });

    // Set device to online by sending a nominal reading
    await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 80.0,
      current: 1.0
    });

    // Send transition anomaly reading
    console.log('Sending first anomaly reading (transition)...');
    let dataRes = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 0.0, // Anomaly (Stopped)
      current: 1.0
    });
    console.log('Anomaly Response 1:', dataRes.data);

    let notifCount1 = await Notification.countDocuments({ deviceId: TEST_DEVICE_ID });
    console.log('Notifications in DB:', notifCount1, '(Expected: 1)');

    // Send a second anomaly reading immediately (no transition, rate-limited)
    console.log('Sending second anomaly reading immediately...');
    dataRes = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 0.0,
      current: 1.0
    });
    console.log('Anomaly Response 2:', dataRes.data);

    let notifCount2 = await Notification.countDocuments({ deviceId: TEST_DEVICE_ID });
    console.log('Notifications in DB:', notifCount2, '(Expected: 1 - throttled)');
    if (notifCount2 !== 1) {
      throw new Error('TEST 7 FAILED: Alert throttling failed, got multiple notifications.');
    }
    console.log('✅ TEST 7 passed!');

    // ----------------------------------------------------
    // TEST 8: VIBRATION-LESS MACHINE SUPPORT
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Vibration-Less Machine Support ---');
    console.log('Manually setting machine baseline vibrationLevel to 0.05...');
    await Machine.findByIdAndUpdate(machine._id, { 'baseline.vibrationLevel': 0.05 });

    console.log('Sending reading with vibration = 0.0...');
    // Without the bypass, this would be a stoppage anomaly. With bypass, it should be normal!
    dataRes = await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 0.0,
      current: 1.0
    });
    console.log('Vibration-less Response:', dataRes.data);
    if (dataRes.data.isAnomaly !== false) {
      throw new Error('TEST 8 FAILED: Expected NORMAL vibration to be accepted for vibration-less baseline.');
    }
    console.log('✅ TEST 8 passed!');

    // ----------------------------------------------------
    // TEST 9: DYNAMIC ZERO-TRACKING
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Dynamic Zero-Tracking ---');
    // Set baseline vibration level to 80.0 (expects vibration)
    await Machine.findByIdAndUpdate(machine._id, { 'baseline.vibrationLevel': 80.0, 'baseline.current': 1.0 });

    console.log('Clearing old readings to avoid interference with 5-minute window...');
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });

    console.log('Simulating machine off (vibration=0.0, sound=0) for > 5 minutes in DB...');
    const sixMinsAgo = new Date(Date.now() - 6 * 60 * 1000);
    const fiveHalfMinsAgo = new Date(Date.now() - 5.5 * 60 * 1000);

    await new SensorReading({
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 0,
      frequency: 0,
      vibration: 0.0,
      current: 0.15,
      timestamp: sixMinsAgo
    }).save();

    await new SensorReading({
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 0,
      frequency: 0,
      vibration: 0.0,
      current: 0.12,
      timestamp: fiveHalfMinsAgo
    }).save();

    // Now send current off reading (0.10A)
    console.log('Sending current machine-off reading (0.10A)...');
    await axios.post(`${API_URL}/data`, {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 0,
      frequency: 0,
      vibration: 0.0,
      current: 0.10
    });

    // Check baseline current
    updatedMachine = await Machine.findById(machine._id);
    console.log('Adjusted baseline current in DB:', updatedMachine.baseline.current);
    if (updatedMachine.baseline.current >= 1.0) {
      throw new Error('TEST 9 FAILED: Baseline current was not adjusted down by zero-tracking.');
    }
    console.log('✅ TEST 9 passed!');

    // ----------------------------------------------------
    // TEST 10: BATCH UPLOAD (WIFI OUTAGE BUFFERING)
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Batch Uploads ---');
    console.log('Clearing old readings for batch verification...');
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });

    console.log('Sending batch of 3 readings with age offsets...');
    const batchRes = await axios.post(`${API_URL}/data/batch`, {
      deviceId: TEST_DEVICE_ID,
      readings: [
        { soundEnergy: 30000, frequency: 1000, vibration: 80.0, current: 1.0, age: 10.0 }, // 10s ago
        { soundEnergy: 30000, frequency: 1000, vibration: 80.0, current: 1.0, age: 5.0 },  // 5s ago
        { soundEnergy: 30000, frequency: 1000, vibration: 80.0, current: 1.0, age: 0.0 }   // now
      ]
    });

    console.log('Batch Response:', batchRes.data);
    if (batchRes.status !== 200 || batchRes.data.count !== 3) {
      throw new Error('TEST 10 FAILED: Expected batch upload to succeed with 3 readings.');
    }

    // Verify readings in DB have correct timestamps
    const batchReadings = await SensorReading.find({ deviceId: TEST_DEVICE_ID }).sort({ timestamp: -1 }).limit(3);
    console.log('Latest batch reading timestamp:', batchReadings[0].timestamp);
    console.log('Oldest batch reading timestamp:', batchReadings[2].timestamp);

    const diff = batchReadings[0].timestamp.getTime() - batchReadings[2].timestamp.getTime();
    console.log('Time difference in ms:', diff, '(Expected: ~10000ms)');
    if (diff < 9000 || diff > 11000) {
      throw new Error('TEST 10 FAILED: Batch reading timestamps are incorrect.');
    }
    console.log('✅ TEST 10 passed!');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('\n🧹 Cleaning up test database entries...');
    await Device.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Machine.deleteMany({ _id: machine._id });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });
    console.log('✅ Cleanup completed.');

    console.log('\n🎉 ALL PHASE 2 UPGRADES VERIFIED SUCCESSFULLY! 🎉');

  } catch (error) {
    console.error('\n❌ TEST ENCOUNTERED FAILURE:', error.message);
    if (error.response) {
      console.error('Server response:', error.response.status, error.response.data);
    }
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

runVerification();
