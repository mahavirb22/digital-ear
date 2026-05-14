const webpush = require('web-push');

const setupWebPush = () => {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    console.log('WebPush configured with VAPID details');
  } else {
    console.warn('WebPush VAPID details are missing from .env');
  }
};

module.exports = setupWebPush;
