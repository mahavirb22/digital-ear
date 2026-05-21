const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const Machine = require('./models/Machine');
const Device = require('./models/Device');
const calibrationService = require('./services/calibrationService');

async function testCalibration() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected.');

  const testDeviceId = 'DE-TEST-99';
  const testMachineName = 'Test Conveyor Machine ' + Date.now();

  try {
    // 1. Clean up any existing test device/machine
    await Device.deleteOne({ deviceId: testDeviceId });
    await Machine.deleteOne({ name: testMachineName });

    // 2. Create Machine
    console.log('Creating test machine...');
    const machine = new Machine({ name: testMachineName });
    await machine.save();
    console.log('Machine created:', machine._id);

    // 3. Create Device
    console.log('Creating test device...');
    const device = new Device({
      deviceId: testDeviceId,
      name: 'Test Device',
      attachedMachine: machine._id
    });
    await device.save();
    console.log('Device created:', device._id);

    // Attach device to machine
    machine.deviceAttached = device._id;
    await machine.save();

    // 4. Start Calibration
    console.log('Starting calibration session...');
    calibrationService.startCalibration(testDeviceId, machine._id);

    // 5. Feed test data
    console.log('Feeding mock readings...');
    const readings = [
      { soundEnergy: 40000, frequency: 1000, vibration: 'NORMAL', current: 1.0 },
      { soundEnergy: 45000, frequency: 1100, vibration: 'NORMAL', current: 1.2 },
      { soundEnergy: 42000, frequency: 1050, vibration: 'DETECTED', current: 1.1 },
      { soundEnergy: 41000, frequency: 1020, vibration: 'NORMAL', current: 1.0 },
    ];

    for (const r of readings) {
      calibrationService.addReadingIfCalibrating(testDeviceId, r);
    }

    // 6. Finalize Calibration
    console.log('Finalizing calibration...');
    await calibrationService.finalizeCalibration(testDeviceId);

    // 7. Verify Machine in DB
    const updatedMachine = await Machine.findById(machine._id);
    console.log('\n--- VERIFICATION RESULTS ---');
    console.log('Is Calibrated:', updatedMachine.isCalibrated);
    console.log('Baseline Readings:');
    console.log(' - Sound Energy:', updatedMachine.baseline.soundEnergy, '(Expected: 42000)');
    console.log(' - Frequency:', updatedMachine.baseline.frequency, '(Expected: 1042.5)');
    console.log(' - Current:', updatedMachine.baseline.current, '(Expected: 1.075)');
    console.log(' - Vibration Level:', updatedMachine.baseline.vibrationLevel, '(Expected: 0.25)');

    const floatEquals = (a, b) => Math.abs(a - b) < 1e-6;

    if (
      updatedMachine.isCalibrated === true &&
      floatEquals(updatedMachine.baseline.soundEnergy, 42000) &&
      floatEquals(updatedMachine.baseline.frequency, 1042.5) &&
      floatEquals(updatedMachine.baseline.current, 1.075) &&
      floatEquals(updatedMachine.baseline.vibrationLevel, 0.25)
    ) {
      console.log('\n✅ SUCCESS: Calibration correctly calculated and saved baseline data!');
    } else {
      console.log('\n❌ FAILURE: Mismatched calibration values.');
      process.exit(1);
    }

    // Clean up
    await Device.deleteOne({ deviceId: testDeviceId });
    await Machine.deleteOne({ _id: machine._id });
    console.log('Cleanup completed.');

  } catch (error) {
    console.error('Test encountered error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from DB.');
  }
}

testCalibration();
