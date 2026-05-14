import { useState } from 'react';
import { subscribeToPush } from '../api';

const VAPID_PUBLIC_KEY = 'BBh2r0A8mvmMuzPwPr9AYzHWWwyL2HoxCtH07kLGumHKqb9Vu5od0kLsbEaM7PiGtiaAXtpcosemc7dLXECpgIg';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const usePushNotifications = () => {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState(null);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setError('Push notifications are not supported by the browser.');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError('Permission for notifications was denied');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // Send to backend
      await subscribeToPush(subscription);
      setIsSubscribed(true);
      
    } catch (err) {
      console.error('Failed to subscribe to push notifications:', err);
      setError(err.message);
    }
  };

  return { isSubscribed, subscribe, error };
};

export default usePushNotifications;
