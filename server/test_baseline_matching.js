const { analyzeReading } = require('./services/anomalyDetector');

const baseline = {
  soundEnergy: 1203315.589,
  frequency: 1245.535,
  current: 0.143,
  vibrationLevel: 1.0
};

const reading = {
  deviceId: 'DIGITAL_EAR_01',
  soundEnergy: 1203315.589,
  frequency: 1245.535,
  current: 0.143,
  vibration: 'DETECTED'
};

async function test() {
  console.log('Testing with exact baseline matching readings:');
  const res = await analyzeReading(reading, baseline);
  console.log('Result:', JSON.stringify(res, null, 2));
}

test();
