const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { analyzeReading } = require('./services/anomalyDetector');

async function testIdleState() {
  console.log('Testing anomaly detector with idle machine state...');

  try {
    // Mock a reading representing a powered-off machine (soundEnergy = 0, current = 0, frequency = 0)
    const mockIdleReading = {
      deviceId: 'DIGITAL_EAR_01',
      soundEnergy: 0,
      frequency: 0,
      current: 0,
      vibration: 'NORMAL'
    };

    console.log('Analyzing mock reading:', mockIdleReading);
    const analysis = await analyzeReading(mockIdleReading);

    console.log('\n--- VERIFICATION RESULTS ---');
    console.log('Is Anomaly:', analysis.isAnomaly, '(Expected: false)');
    console.log('Reasons:', analysis.reasons, '(Expected: [])');

    if (analysis.isAnomaly === false && analysis.reasons.length === 0) {
      console.log('\n✅ SUCCESS: Idle state correctly identified as nominal! No false frequency anomaly generated.');
    } else {
      console.log('\n❌ FAILURE: Idle state flagged as anomalous.');
      process.exit(1);
    }

  } catch (error) {
    console.error('Test encountered error:', error);
    process.exit(1);
  }
}

testIdleState();
