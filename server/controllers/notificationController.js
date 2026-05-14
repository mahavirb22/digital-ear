const Subscription = require('../models/Subscription');
const Notification = require('../models/Notification');

exports.subscribe = async (req, res) => {
  try {
    const subscription = req.body;
    
    const existing = await Subscription.findOne({ endpoint: subscription.endpoint });
    if (!existing) {
      const newSub = new Subscription(subscription);
      await newSub.save();
    }
    
    res.status(201).json({ message: 'Subscription saved.' });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({})
      .sort({ timestamp: -1 })
      .limit(50);
      
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching all notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getDeviceNotifications = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const notifications = await Notification.find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(20);
      
    res.status(200).json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.acknowledgeNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findByIdAndUpdate(
      id,
      { acknowledged: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    res.status(200).json(notification);
  } catch (error) {
    console.error('Error acknowledging notification:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
