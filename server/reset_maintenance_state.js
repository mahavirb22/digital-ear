// reset_maintenance_state.js
// Run this script to clear any lingering maintenance flags on machines.
// It connects to MongoDB, finds all Machine documents with needsMaintenance=true,
// sets the flag to false, and logs the action.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Machine = require('./models/Machine');

async function reset() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    const result = await Machine.updateMany({ needsMaintenance: true }, { needsMaintenance: false });
    console.log(`Reset ${result.nModified || result.modifiedCount} machines' maintenance flag.`);
  } catch (err) {
    console.error('Error resetting maintenance flag:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected');
  }
}

reset();
