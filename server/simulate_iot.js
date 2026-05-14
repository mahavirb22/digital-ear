const axios = require('axios');

const devices = ['DE-9921', 'DE-9922', 'DE-9923', 'DE-9924'];
const API_URL = 'http://localhost:5000/api';

// Auto-register devices before sending data
const registerDevices = async () => {
  for (const deviceId of devices) {
    try {
      await axios.post(`${API_URL}/devices/register`, { deviceId, name: deviceId });
      console.log(`Registered device: ${deviceId}`);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log(`Device ${deviceId} already registered`);
      } else {
        console.error(`Failed to register ${deviceId}:`, error.message);
      }
    }
  }
};

const sendData = async () => {
  for (const deviceId of devices) {
    const soundEnergy = Math.random() * 80000;
    const frequency = 300 + Math.random() * 2000;
    const current = 0.5 + Math.random() * 2.5;
    const vibration = soundEnergy > 60000 ? 'DETECTED' : 'NORMAL';

    const payload = {
      deviceId,
      soundEnergy,
      frequency,
      vibration,
      current
    };

    try {
      const res = await axios.post(`${API_URL}/data`, payload);
      const suffix = res.data.isAnomaly ? ' ⚠️  ANOMALY' : '';
      console.log(`[${deviceId}] Energy: ${soundEnergy.toFixed(0)} | Freq: ${frequency.toFixed(0)} Hz | Curr: ${current.toFixed(2)} A${suffix}`);
    } catch (error) {
      console.error(`Failed to send data for ${deviceId}:`, error.response?.data?.error || error.message);
    }
  }
};

const start = async () => {
  console.log('=== Digital Ear IoT Simulator ===');
  console.log('Registering devices...');
  await registerDevices();
  console.log('Starting data stream...\n');
  setInterval(sendData, 2000);
};

start();
