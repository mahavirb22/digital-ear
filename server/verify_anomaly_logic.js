const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Machine = require('./models/Machine');
const Device = require('./models/Device');
const SensorReading = require('./models/SensorReading');
const Notification = require('./models/Notification');
const { analyzeReading } = require('./services/anomalyDetector');

const TEST_DEVICE_ID = 'TEST-ANOMALY-01';
const TEST_MACHINE_NAME = 'Test Anomaly Machine';

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected.');

  try {
    console.log('🧹 Cleaning up test database records...');
    await Device.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Machine.deleteMany({ name: TEST_MACHINE_NAME });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });

    // Setup Test Machine and Device
    const machine = new Machine({
      name: TEST_MACHINE_NAME,
      isCalibrated: true,
      calibrationStatus: 'ready',
      baseline: {
        soundEnergy: 30000,
        frequency: 1000,
        current: 0.6,
        vibrationLevel: 1.0 // Expects vibration
      }
    });
    await machine.save();

    const device = new Device({
      deviceId: TEST_DEVICE_ID,
      name: 'Test Anomaly Device',
      attachedMachine: machine._id,
      status: 'online'
    });
    await device.save();

    machine.deviceAttached = device._id;
    await machine.save();

    console.log('\n✅ Setup completed. Starting Anomaly Detection Tests...\n');

    // ----------------------------------------------------
    // TEST 1: Normal Running State (Vibration DETECTED is healthy!)
    // ----------------------------------------------------
    console.log('--- TEST 1: Normal Running State ---');
    const normalReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 0.6
    };
    let res = await analyzeReading(normalReading, machine.baseline);
    console.log('Analysis result (Normal):', res);
    if (res.isAnomaly) {
      throw new Error('TEST 1 FAILED: Expected DETECTED vibration and nominal readings to be normal.');
    }
    console.log('✅ TEST 1 passed!\n');

    // ----------------------------------------------------
    // TEST 2: Temporary Spike Debouncing (Frequency Trigger)
    // ----------------------------------------------------
    console.log('--- TEST 2: Temporary Spike Debouncing (Frequency Trigger) ---');
    // Send 3 spikes (current = 0.85A - Level 1)
    const spikeReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 0.85
    };

    console.log('Sending spike 1...');
    res = await analyzeReading(spikeReading, machine.baseline);
    console.log('Result 1:', res.isAnomaly, res.reasons);
    if (res.isAnomaly) {
      throw new Error('TEST 2 FAILED: Expected single spike to be debounced (ignored).');
    }

    console.log('Sending spike 2, 3, 4...');
    await analyzeReading(spikeReading, machine.baseline);
    await analyzeReading(spikeReading, machine.baseline);
    res = await analyzeReading(spikeReading, machine.baseline);
    console.log('Result 4:', res.isAnomaly, res.reasons);
    if (res.isAnomaly) {
      throw new Error('TEST 2 FAILED: Expected 4 spikes to still be debounced.');
    }

    console.log('Sending spike 5 (Frequency Trigger Threshold = 5 in 60s)...');
    res = await analyzeReading(spikeReading, machine.baseline);
    console.log('Result 5:', res.isAnomaly, res.reasons);
    if (!res.isAnomaly || !res.reasons.some(r => r.includes('Frequency Trigger'))) {
      throw new Error('TEST 2 FAILED: Expected frequency trigger to fire on 5th spike.');
    }
    if (res.severity !== 'warning') {
      throw new Error(`TEST 2 FAILED: Expected severity to be warning, got ${res.severity}`);
    }
    console.log('✅ TEST 2 passed!\n');

    // ----------------------------------------------------
    // TEST 3: Duration Trigger (10 continuous seconds of deviation)
    // ----------------------------------------------------
    console.log('--- TEST 3: Duration Trigger ---');
    // Clear device Windows by detaching/re-initializing or cleaning window
    // Let's create a new test device ID to start with a fresh window
    const TEST_DEVICE_ID_2 = 'TEST-ANOMALY-02';
    await Device.deleteMany({ deviceId: TEST_DEVICE_ID_2 });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID_2 });

    const device2 = new Device({
      deviceId: TEST_DEVICE_ID_2,
      name: 'Test Device 2',
      attachedMachine: machine._id
    });
    await device2.save();

    console.log('Sending 9 continuous warning readings...');
    for (let i = 1; i <= 9; i++) {
      res = await analyzeReading({
        deviceId: TEST_DEVICE_ID_2,
        soundEnergy: 30000,
        frequency: 1000,
        vibration: 'DETECTED',
        current: 0.85
      }, machine.baseline);
      if (res.isAnomaly) {
        // Wait, on the 5th reading, the frequency trigger might fire (>= 5 warnings).
        // Let's verify that frequency trigger is fired, or we can test duration triggers.
        // Wait, if 5th fires frequency, that is expected. But on the 10th, both triggers can fire.
        // Let's make sure that on the 10th reading it also flags duration.
        console.log(`Reading ${i}: anomaly=${res.isAnomaly}, reasons=${res.reasons}`);
      }
    }

    console.log('Sending 10th continuous warning reading...');
    res = await analyzeReading({
      deviceId: TEST_DEVICE_ID_2,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 0.85
    }, machine.baseline);
    console.log('10th Reading Result:', res.isAnomaly, res.reasons);
    if (!res.isAnomaly || !res.reasons.some(r => r.includes('Duration Trigger'))) {
      throw new Error('TEST 3 FAILED: Expected duration trigger on 10th continuous deviation.');
    }
    console.log('✅ TEST 3 passed!\n');

    // Clean up device 2
    await Device.deleteOne({ deviceId: TEST_DEVICE_ID_2 });

    // ----------------------------------------------------
    // TEST 4: Immediate Critical Outlier (Fail-safe Bypass)
    // ----------------------------------------------------
    console.log('--- TEST 4: Immediate Critical Outlier ---');
    const criticalReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 1.3 // Over 1.2A absolute maximum
    };
    // Send a fresh nominal reading to clear warning status, then send critical
    res = await analyzeReading(criticalReading, machine.baseline);
    console.log('Critical outlier result:', res);
    if (!res.isAnomaly || res.severity !== 'critical' || !res.reasons.some(r => r.includes('Overcurrent'))) {
      throw new Error('TEST 4 FAILED: Expected immediate critical overcurrent alarm, bypassing debouncing.');
    }
    console.log('✅ TEST 4 passed!\n');

    // ----------------------------------------------------
    // TEST 5: Multivariate Sensor Fusion
    // ----------------------------------------------------
    console.log('--- TEST 5: Multivariate Sensor Fusion ---');
    
    // 5.1 Condition A: Current High + Vibration Normal + Audio Normal
    console.log('5.1 Testing Condition A (Electrical/load fault)...');
    const condAReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 0.9
    };
    // Since current=0.9 is a warning deviation, it requires debouncing unless it triggers frequency/duration.
    // Let's send it 5 times to trigger frequency warning and view the diagnostic reason.
    for (let i = 0; i < 4; i++) {
      await analyzeReading(condAReading, machine.baseline);
    }
    res = await analyzeReading(condAReading, machine.baseline);
    console.log('Condition A Result:', res);
    if (!res.isAnomaly || !res.reasons.some(r => r.includes('Condition A'))) {
      throw new Error('TEST 5.1 FAILED: Expected Condition A fault isolation reason.');
    }

    // 5.2 Condition B: Current Normal + Vibration HIGH + Audio HIGH
    console.log('5.2 Testing Condition B (Mechanical fault)...');
    const condBReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 50000, // Audio High
      frequency: 1000,
      vibration: 'HIGH', // Vibration High
      current: 0.6 // Current Normal
    };
    // Vibration HIGH is an immediate critical breach, so this should trigger instantly
    res = await analyzeReading(condBReading, machine.baseline);
    console.log('Condition B Result:', res);
    if (!res.isAnomaly || res.severity !== 'critical' || !res.reasons.some(r => r.includes('Condition B'))) {
      throw new Error('TEST 5.2 FAILED: Expected immediate critical Condition B mechanical fault isolation.');
    }

    // 5.3 Condition C: Current High + Vibration HIGH + Audio HIGH
    console.log('5.3 Testing Condition C (Compounding mechanical jam)...');
    const condCReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 50000, // Audio High
      frequency: 1000,
      vibration: 'HIGH', // Vibration High
      current: 0.9 // Current High
    };
    res = await analyzeReading(condCReading, machine.baseline);
    console.log('Condition C Result:', res);
    if (!res.isAnomaly || res.severity !== 'critical' || !res.reasons.some(r => r.includes('Condition C'))) {
      throw new Error('TEST 5.3 FAILED: Expected immediate critical Condition C compounding jam fault isolation.');
    }
    console.log('✅ TEST 5 passed!\n');

    // ----------------------------------------------------
    // TEST 6: Correct Vibration Logic (Stoppage detected AFTER grace period)
    // ----------------------------------------------------
    console.log('--- TEST 6: Vibration Stoppage Grace Period ---');
    const stoppedReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 0,
      frequency: 0,
      vibration: 'NORMAL', // Stopped
      current: 0.0
    };
    // First NORMAL reading should NOT immediately be critical (grace period)
    res = await analyzeReading(stoppedReading, machine.baseline);
    console.log('1st stopped reading (should be non-critical):', res.isAnomaly, res.severity);
    // It may flag isRawAnomaly but not hasImmediateCriticalBreach yet.
    // After grace period (8s), it should be critical. Simulate by calling many times.
    // Wait 9 seconds to exceed grace period
    console.log('Waiting 9 seconds to exceed grace period...');
    await wait(9000);
    res = await analyzeReading(stoppedReading, machine.baseline);
    console.log('Stopped machine result (after grace period):', res);
    if (!res.isAnomaly || res.severity !== 'critical' || !res.reasons.some(r => r.includes('No vibration detected'))) {
      throw new Error('TEST 6 FAILED: Expected critical machine stoppage alert after grace period.');
    }
    console.log('✅ TEST 6 passed!\n');

    // ----------------------------------------------------
    // TEST 7: Motor Resume Clears Anomaly State
    // ----------------------------------------------------
    console.log('--- TEST 7: Motor Resume Clears Maintenance State ---');
    const resumedReading = {
      deviceId: TEST_DEVICE_ID,
      soundEnergy: 30000,
      frequency: 1000,
      vibration: 'DETECTED',
      current: 0.6
    };
    res = await analyzeReading(resumedReading, machine.baseline);
    console.log('Motor resumed result (should be normal):', res.isAnomaly, res.reasons);
    if (res.isAnomaly) {
      throw new Error('TEST 7 FAILED: Expected motor resume with DETECTED vibration to clear anomaly state.');
    }
    console.log('✅ TEST 7 passed!\n');

    // ----------------------------------------------------
    // CLEANUP
    // ----------------------------------------------------
    console.log('🧹 Cleaning up test database records...');
    await Device.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Machine.deleteMany({ name: TEST_MACHINE_NAME });
    await SensorReading.deleteMany({ deviceId: TEST_DEVICE_ID });
    await Notification.deleteMany({ deviceId: TEST_DEVICE_ID });
    console.log('✅ Clean up completed.');

    console.log('\n🎉 ALL ANOMALY DETECTION LOGIC TESTS PASSED SUCCESSFULLY! 🎉');

  } catch (err) {
    console.error('\n❌ TEST ENCOUNTERED FAILURE:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB.');
    process.exit(0);
  }
}

runTests();
