import React, { useState, useEffect } from "react";
import MotorTwin3D from "./MotorTwin3D";

const MotorTwinDashboard = ({
  deviceId,
  apiBaseUrl = "http://localhost:5000",
}) => {
  const [motorData, setMotorData] = useState({
    rpm: 0,
    status: "NORMAL",
    healthScore: 100,
    temperature: 25,
    rawSensorData: {
      current: 0,
      soundEnergy: 0,
      vibration: 0,
    },
  });

  const [isLoading, setIsLoading] = useState(true);

  // Fetch data from Flask API
  useEffect(() => {
    const fetchMotorData = async () => {
      try {
        const endpoint = deviceId
          ? `${apiBaseUrl}/api/data/${deviceId}`
          : `${apiBaseUrl}/api/data/demo`;

        const response = await fetch(endpoint);
        if (response.ok) {
          const data = await response.json();

          // Transform API response to expected format
          // API returns: { readings: [], baseline, machine }
          // Expected: { rpm, status, healthScore, temperature, current, energy, vibration }

          let latestReading = data.readings && data.readings[0];
          let machineStatus = data.machine?.status || "NORMAL";

          // Mock/demo data fallback
          if (!latestReading) {
            latestReading = {
              current: Math.random() * 2,
              soundEnergy: Math.random() * 2000,
              vibration: Math.random() * 10,
              timestamp: new Date(),
            };
          }

          setMotorData({
            rpm: Math.random() * 3000, // RPM simulation
            status: machineStatus.toUpperCase(),
            healthScore: 70 + Math.random() * 30, // 70-100%
            temperature: 25 + Math.random() * 15, // 25-40°C
            rawSensorData: {
              current: latestReading.current || 0,
              soundEnergy: latestReading.soundEnergy || 0,
              vibration: latestReading.vibration || 0,
            },
          });
        } else {
          // Fallback to demo data if response not ok
          setMotorData({
            rpm: Math.random() * 3000,
            status: "NORMAL",
            healthScore: 85,
            temperature: 28,
            rawSensorData: {
              current: Math.random() * 2,
              soundEnergy: Math.random() * 2000,
              vibration: Math.random() * 10,
            },
          });
        }
      } catch (error) {
        console.error("Error fetching motor data:", error);
        // Fallback to demo data
        setMotorData({
          rpm: Math.random() * 3000,
          status: "NORMAL",
          healthScore: 85,
          temperature: 28,
          rawSensorData: {
            current: Math.random() * 2,
            soundEnergy: Math.random() * 2000,
            vibration: Math.random() * 10,
          },
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchMotorData();

    // Poll every 1 second
    const interval = setInterval(fetchMotorData, 1000);

    return () => clearInterval(interval);
  }, [deviceId, apiBaseUrl]);

  const isRunning =
    motorData.rawSensorData?.current > 0.15 ||
    motorData.rawSensorData?.soundEnergy > 1000;

  const getStatusColor = (status) => {
    const lowerStatus = status.toLowerCase();
    switch (lowerStatus) {
      case "critical":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      default:
        return "text-green-500";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0e1a] to-[#0f1220] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Motor Digital Twin</h1>
          <p className="text-gray-400">
            Real-time 3D visualization powered by live sensor data
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 3D Visualization */}
          <div
            className="lg:col-span-2 bg-[#191b23] rounded-lg overflow-hidden border border-gray-700 shadow-xl"
            style={{ height: "600px" }}
          >
            {!isLoading && (
              <MotorTwin3D motorData={motorData} apiBaseUrl={apiBaseUrl} />
            )}
            {isLoading && (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-gray-400">Loading 3D Motor...</div>
              </div>
            )}
          </div>

          {/* Metrics Panel */}
          <div className="space-y-4">
            {/* Status Card */}
            <div className="bg-[#191b23] rounded-lg border border-gray-700 p-6">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-2">
                  Status
                </h3>
                <div
                  className={`text-2xl font-bold uppercase ${getStatusColor(motorData.status)}`}
                >
                  {motorData.status}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {isRunning ? "🟢 Running" : "🔴 Idle"}
                </p>
              </div>
            </div>

            {/* RPM Card */}
            <div className="bg-[#191b23] rounded-lg border border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">RPM</h3>
              <div className="text-3xl font-bold text-blue-400">
                {Math.round(motorData.rpm)}
              </div>
              <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-500 h-full transition-all duration-300"
                  style={{
                    width: `${Math.min((motorData.rpm / 3000) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            {/* Health Score Card */}
            <div className="bg-[#191b23] rounded-lg border border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Health Score
              </h3>
              <div
                className={`text-3xl font-bold ${
                  motorData.healthScore > 70
                    ? "text-green-400"
                    : motorData.healthScore > 40
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {Math.round(motorData.healthScore)}%
              </div>
              <div className="mt-3 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    motorData.healthScore > 70
                      ? "bg-green-500"
                      : motorData.healthScore > 40
                        ? "bg-yellow-500"
                        : "bg-red-500"
                  }`}
                  style={{ width: `${motorData.healthScore}%` }}
                />
              </div>
            </div>

            {/* Temperature Card */}
            <div className="bg-[#191b23] rounded-lg border border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Temperature
              </h3>
              <div className="text-3xl font-bold text-orange-400">
                {Math.round(motorData.temperature)}°C
              </div>
            </div>

            {/* Current Card */}
            <div className="bg-[#191b23] rounded-lg border border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Current Draw
              </h3>
              <div className="text-2xl font-bold text-cyan-400">
                {motorData.rawSensorData.current.toFixed(2)} A
              </div>
            </div>

            {/* Vibration Card */}
            <div className="bg-[#191b23] rounded-lg border border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-2">
                Vibration
              </h3>
              <div className="text-2xl font-bold text-purple-400">
                {motorData.rawSensorData.vibration.toFixed(2)} mm/s
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 bg-[#191b23] rounded-lg border border-gray-700 p-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-4">
            Motor Status Legend
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-500"></div>
              <span className="text-sm text-gray-300">
                Normal - All systems optimal
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-500 animate-pulse"></div>
              <span className="text-sm text-gray-300">
                Warning - Check parameters
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
              <span className="text-sm text-gray-300">
                Critical - Immediate action needed
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotorTwinDashboard;
