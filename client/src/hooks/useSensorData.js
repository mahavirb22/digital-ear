import { useState, useEffect } from "react";
import { fetchSensorData } from "../api";

const useSensorData = (deviceId) => {
  const [readings, setReadings] = useState([]);
  const [latestReading, setLatestReading] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [machine, setMachine] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!deviceId) return;

    const loadData = async () => {
      try {
        const data = await fetchSensorData(deviceId);

        // Handle new response structure with baseline and machine
        let readingsArray = [];
        let baselineData = null;
        let machineData = null;

        if (data.readings) {
          // New structure: { readings, baseline, machine }
          readingsArray = data.readings;
          baselineData = data.baseline;
          machineData = data.machine;
        } else if (Array.isArray(data)) {
          // Old structure: simple array
          readingsArray = data;
        }

        const reversedData = [...readingsArray].reverse();
        setReadings(reversedData);
        setBaseline(baselineData);
        setMachine(machineData);

        if (readingsArray.length > 0) {
          setLatestReading(readingsArray[0]);
        }
      } catch (error) {
        console.error("Failed to load sensor data", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [deviceId]);

  return { readings, latestReading, baseline, machine, loading };
};

export default useSensorData;
