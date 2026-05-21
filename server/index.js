require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const setupWebPush = require('./config/webpush');

// Import routes
const dataRoutes = require('./routes/data');
const notificationRoutes = require('./routes/notifications');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/devices');
const mlRoutes = require('./routes/ml');
const machineRoutes = require('./routes/machineRoutes');

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// Configurations
connectDB();
setupWebPush();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', dataRoutes);
app.use('/api', notificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/ml', mlRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
