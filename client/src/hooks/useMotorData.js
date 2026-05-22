import { useMemo } from 'react';
import useSensorData from './useSensorData';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const deriveMotorData = (latestReading) => {
  if (!latestReading) {
    return {
      rpm: 0,
      temperature: 25,
      vibration: 0.0,
      status: 'normal',
      isOverheating: false,
      isHighVibration: false,
      isFailurePredicted: false,
      healthScore: 100,
      rawSensorData: null,
    };
  }

  const rpm = latestReading.frequency;
  const temperature = clamp(25 + latestReading.current * 20, 25, 120);
  const vibration = latestReading.vibration === 'HIGH' ? 0.85 : (latestReading.vibration === 'DETECTED' ? 0.2 : 0.0);

  const isAnomaly = latestReading.isAnomaly;
  const vibDetected = latestReading.vibration === 'DETECTED' || latestReading.vibration === 'HIGH';

  let status = 'normal';
  if (isAnomaly && latestReading.vibration === 'HIGH') {
    status = 'critical';
  } else if (isAnomaly) {
    status = 'warning';
  }

  const isOverheating = temperature > 85;
  const isHighVibration = vibration > 0.5;
  const isFailurePredicted = isAnomaly && (latestReading.vibration === 'HIGH') && latestReading.current > 2.0;

  // Health score calculation (100 = perfect, lower = worse)
  // RPM penalty: ideal range 800-1800, outside penalizes
  const rpmPenalty =
    rpm < 800 ? ((800 - rpm) / 800) * 30 :
    rpm > 1800 ? ((rpm - 1800) / 1800) * 30 :
    0;

  // Temperature penalty: scales from 0 at 25°C to 40 at 120°C
  const tempPenalty = ((temperature - 25) / 95) * 40;

  // Vibration penalty: 0 for none, 30 for detected
  const vibPenalty = vibration > 0.5 ? 30 : 0;

  const healthScore = clamp(Math.round(100 - rpmPenalty - tempPenalty - vibPenalty), 0, 100);

  return {
    rpm,
    temperature,
    vibration,
    status,
    isOverheating,
    isHighVibration,
    isFailurePredicted,
    healthScore,
    rawSensorData: latestReading,
  };
};

const useMotorData = (deviceId) => {
  const { latestReading, loading } = useSensorData(deviceId);

  const motorData = useMemo(
    () => deriveMotorData(latestReading),
    [latestReading]
  );

  return { motorData, loading };
};

export default useMotorData;
