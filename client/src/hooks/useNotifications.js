import { useState, useEffect } from 'react';
import { fetchNotifications } from '../api';

const useNotifications = (deviceId = '') => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchNotifications(deviceId);
        setNotifications(data);
        setUnreadCount(data.filter(n => !n.acknowledged).length);
      } catch (error) {
        console.error('Failed to load notifications', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [deviceId]);

  return { notifications, unreadCount, loading };
};

export default useNotifications;
