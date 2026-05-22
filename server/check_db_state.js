const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Device = require('./models/Device');
const Machine = require('./models/Machine');
const SensorReading = require('./models/SensorReading');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const devices = await Device.find({}).populate('attachedMachine');
  console.log('=== DEVICES ===');
  for (const d of devices) {
    console.log(`Device ID: ${d.deviceId}`);
    console.log(`Name: ${d.name}`);
    console.log(`Status: ${d.status}`);
    console.log(`Attached Machine:`, d.attachedMachine);
  }

  const readings = await SensorReading.find({ deviceId: 'DIGITAL_EAR_01' })
    .sort({ timestamp: -1 })
    .limit(5);
  console.log('\n=== LAST 5 READINGS FOR DIGITAL_EAR_01 ===');
  console.log(JSON.stringify(readings, null, 2));

  await mongoose.disconnect();
}

check();
