import { useState, useEffect } from 'react';
import { fetchSensorData } from '../api';

const useSensorData = (deviceId) => {
  const [readings, setReadings] = useState([]);
  const [latestReading, setLatestReading] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    const loadData = async () => {
      try {
        const data = await fetchSensorData(deviceId);
        // The backend sorts newest first, we might want to reverse it for Recharts (oldest to newest)
        const reversedData = [...data].reverse();
        setReadings(reversedData);
        if (data.length > 0) {
          setLatestReading(data[0]);
        }
      } catch (error) {
        console.error('Failed to load sensor data', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [deviceId]);

  return { readings, latestReading, loading };
};

export default useSensorData;
