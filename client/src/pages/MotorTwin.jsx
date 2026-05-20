import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import useMotorData from '../hooks/useMotorData';
import MotorViewer from '../components/MotorViewer';
import SensorStats from '../components/SensorStats';
import StatusPanel from '../components/StatusPanel';
import '../styles/motor.css';

const CanvasFallback = () => (
  <div className="flex items-center justify-center h-full min-h-[420px]">
    <div className="flex flex-col items-center gap-4">
      <div className="motor-loading-spinner" />
      <span className="font-label text-label text-outline uppercase tracking-widest">
        Loading 3D Model
      </span>
    </div>
  </div>
);

const LoadingSkeleton = () => (
  <div className="motor-twin-page">
    <div className="relative z-10 px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="skeleton h-6 w-6 rounded-full" />
          <div className="skeleton h-7 w-56" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
        <div className="skeleton h-4 w-36" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <div className="skeleton min-h-[420px] rounded-lg" />
        <div className="skeleton min-h-[420px] rounded-lg" />
      </div>
      <div className="motor-stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-32 rounded-lg" />
        ))}
      </div>
    </div>
  </div>
);

/**
 * Generates slowly oscillating demo data so the motor 
 * visually rotates and the dashboard feels alive.
 */
const useDemoMotorData = () => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2000);
    return () => clearInterval(interval);
  }, []);

  const motorData = useMemo(() => {
    const t = tick * 0.15;
    const rpm = Math.round(1200 + Math.sin(t) * 300);
    const temperature = parseFloat((45 + Math.sin(t * 0.7) * 12).toFixed(1));
    const vibration = parseFloat((0.12 + Math.sin(t * 1.3) * 0.08).toFixed(2));
    const current = parseFloat((1.2 + Math.sin(t * 0.5) * 0.3).toFixed(2));

    return {
      rpm,
      temperature,
      vibration,
      status: 'normal',
      isOverheating: false,
      isHighVibration: false,
      isFailurePredicted: false,
      healthScore: 92,
      rawSensorData: {
        soundEnergy: Math.round(320 + Math.sin(t * 0.9) * 80),
        frequency: rpm,
        current,
        vibration: 'NONE',
        isAnomaly: false,
        timestamp: new Date().toISOString(),
      },
    };
  }, [tick]);

  return { motorData, loading: false };
};

const MotorTwin = () => {
  const { deviceId } = useParams();
  const isDemo = !deviceId;

  // Use live data when a deviceId is present, demo data otherwise
  const liveHook = useMotorData(deviceId);
  const demoHook = useDemoMotorData();
  const { motorData, loading } = isDemo ? demoHook : liveHook;

  if (loading) {
    return <LoadingSkeleton />;
  }

  // Only show "not found" when a specific device was requested but has no data
  if (!isDemo && !motorData.rawSensorData) {
    return (
      <div className="motor-twin-page">
        <div className="relative z-10 flex items-center justify-center min-h-screen">
          <div className="glass-card p-8 rounded-lg flex flex-col items-center gap-4 max-w-md text-center">
            <span
              className="material-symbols-outlined text-[48px] text-outline"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              search_off
            </span>
            <h2 className="font-h2 text-h2 text-on-surface">
              Device Not Found
            </h2>
            <p className="font-body-sm text-body-sm text-outline">
              No sensor data available for device <span className="font-data-md text-primary">{deviceId}</span>.
              The device may be offline or the ID may be incorrect.
            </p>
            <Link
              to="/"
              id="motor-back-to-dashboard"
              className="mt-2 flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors font-label text-label uppercase"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusBadgeClass = `motor-status-badge motor-status-badge--${motorData.status}`;
  const lastSync = motorData.rawSensorData
    ? new Date(motorData.rawSensorData.timestamp).toLocaleTimeString()
    : '—';

  return (
    <div className="motor-twin-page" id="motor-twin-page">
      <div className="relative z-10 px-4 md:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* ── Header Bar ── */}
        <header
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          id="motor-header"
        >
          <div className="flex items-center gap-3">
            <Link
              to="/"
              id="motor-back-link"
              className="text-outline hover:text-on-surface transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-[22px]">
                arrow_back
              </span>
            </Link>
            <h1 className="font-h2 text-h2 text-on-surface">
              Motor Digital Twin
            </h1>
            <span className={statusBadgeClass}>
              {motorData.isFailurePredicted
                ? 'FAILURE PREDICTED'
                : motorData.status.toUpperCase()}
            </span>
            {isDemo && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
                Demo
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 font-data-sm text-data-sm text-outline flex-shrink-0">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            <span>Last Sync: {lastSync}</span>
            {deviceId && (
              <>
                <span className="text-white/20 mx-1">|</span>
                <span className="font-data-sm text-primary/60">{deviceId}</span>
              </>
            )}
          </div>
        </header>

        {/* ── Main Content: 2-column grid ── */}
        <div
          className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6"
          id="motor-main-grid"
        >
          {/* Left: 3D Viewer */}
          <div className="motor-canvas-container" id="motor-canvas-wrapper">
            <Suspense fallback={<CanvasFallback />}>
              <MotorViewer motorData={motorData} />
            </Suspense>

            {/* Overlay info */}
            <div className="absolute top-3 left-4 z-10 flex items-center gap-2">
              <span className="font-data-sm text-[10px] text-outline/60 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                {isDemo ? 'DC Motor' : deviceId}
              </span>
              <span className="font-data-sm text-[10px] text-outline/40 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                3D Preview
              </span>
            </div>

            <div className="absolute bottom-3 right-4 z-10">
              <span className="font-data-sm text-[10px] text-outline/40 bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded">
                Drag to orbit • Scroll to zoom
              </span>
            </div>
          </div>

          {/* Right: Status Panel */}
          <StatusPanel motorData={motorData} />
        </div>

        {/* ── Bottom: Sensor Stats Strip ── */}
        <SensorStats motorData={motorData} />
      </div>
    </div>
  );
};

export default MotorTwin;
