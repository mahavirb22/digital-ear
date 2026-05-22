import React, { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import useSensorData from "../hooks/useSensorData";
import useNotifications from "../hooks/useNotifications";
import {
  acknowledgeNotification,
  turnOffMachine,
  turnOnMachine,
  getMLPrediction,
} from "../api";
import toast from "react-hot-toast";

const DeviceDetail = () => {
  const { deviceId } = useParams();
  const { readings, latestReading, baseline, machine, loading } =
    useSensorData(deviceId);
  const { notifications } = useNotifications(deviceId);

  // ML Prediction state
  const [mlResult, setMlResult] = useState(null);
  const [mlLoading, setMlLoading] = useState(false);

  // Fetch ML prediction whenever latestReading changes
  const fetchMLPrediction = useCallback(async () => {
    if (!machine || !machine.isCalibrated || !latestReading) return;
    try {
      setMlLoading(true);
      const result = await getMLPrediction(machine._id, {
        soundEnergy: latestReading.soundEnergy,
        frequency: latestReading.frequency,
        current: latestReading.current,
        vibration: latestReading.vibration,
      });
      setMlResult(result);
    } catch (err) {
      // ML service may be unavailable
      setMlResult(null);
    } finally {
      setMlLoading(false);
    }
  }, [machine, latestReading]);

  useEffect(() => {
    fetchMLPrediction();
  }, [fetchMLPrediction]);

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeNotification(id);
      toast.success("Alert acknowledged");
    } catch (error) {
      toast.error("Failed to acknowledge alert");
    }
  };

  const handleTurnOff = async () => {
    try {
      if (!machine) return;
      await turnOffMachine(machine._id);
      toast.success("Machine turned off. Monitoring paused.");
    } catch (error) {
      toast.error("Failed to turn off machine");
    }
  };

  const handleTurnOn = async () => {
    try {
      if (!machine) return;
      await turnOnMachine(machine._id);
      toast.success("Machine turned on. Monitoring resumed.");
    } catch (error) {
      toast.error("Failed to turn on machine");
    }
  };

  if (loading || !latestReading) {
    return (
      <div className="space-y-lg">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="skeleton h-6 w-6 rounded-full"></div>
          <div className="skeleton h-7 w-48"></div>
          <div className="skeleton h-6 w-28 rounded"></div>
        </div>
        {/* KPI Tiles Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="glass-card p-md rounded-lg flex flex-col justify-between h-32"
            >
              <div className="flex justify-between items-start">
                <div className="skeleton h-3 w-20"></div>
                <div className="skeleton h-5 w-5 rounded"></div>
              </div>
              <div className="flex items-baseline gap-1">
                <div className="skeleton h-8 w-20"></div>
                <div className="skeleton h-3 w-8"></div>
              </div>
            </div>
          ))}
        </div>
        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="glass-card rounded-lg p-md flex flex-col gap-sm"
            >
              <div className="flex justify-between items-center mb-sm">
                <div className="skeleton h-3 w-36"></div>
                <div className="skeleton h-3 w-24"></div>
              </div>
              <div className="h-64 w-full flex items-end gap-[3px] px-4 pb-4">
                {[...Array(30)].map((_, j) => (
                  <div
                    key={j}
                    className="skeleton flex-1 rounded-t"
                    style={{ height: `${20 + Math.random() * 80}%` }}
                  ></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isAnomaly = latestReading.isAnomaly;
  const isMachineOff = machine && machine.status === "scheduled_off";

  // Baseline comparison results
  const getBaselineRange = (baselineValue, margin = 0.2) => {
    if (!baselineValue) return { min: 0, max: 0 };
    return {
      min: baselineValue * (1 - margin),
      max: baselineValue * (1 + margin),
    };
  };

  const isOutOfRange = (value, baseValue, margin = 0.3) => {
    if (!baseValue) return false;
    return value > baseValue * (1 + margin) || value < baseValue * (1 - margin);
  };

  // Compute baseline anomaly
  const baselineAnomaly = baseline
    ? isOutOfRange(latestReading.soundEnergy, baseline.soundEnergy) ||
      isOutOfRange(latestReading.current, baseline.current, 0.15)
    : false;

  // ML anomaly
  const mlAnomaly = mlResult ? mlResult.isAnomaly : false;
  const mlReason = mlResult?.reason || mlResult?.message || "";

  // Combined verdict
  const combinedAnomaly = baselineAnomaly && mlAnomaly;
  const eitherAnomaly = baselineAnomaly || mlAnomaly;

  return (
    <div className="space-y-lg">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="text-slate-400 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-h1 text-h1 text-on-surface">
            Device: {deviceId}
          </h1>
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-DEFAULT border ${
              isAnomaly
                ? "bg-error-container/20 border-error-container/50 text-error"
                : "bg-primary-container/20 border-primary-container/50 text-primary"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${isAnomaly ? "bg-error animate-pulse" : "bg-primary"}`}
            ></span>
            <span className="font-label text-label uppercase tracking-widest">
              {isAnomaly
                ? "Anomaly Detected"
                : isMachineOff
                  ? "Monitoring Paused"
                  : "Operational"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {machine && (
            <div className="flex gap-2">
              {isMachineOff ? (
                <button
                  onClick={handleTurnOn}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 rounded-lg font-label text-label uppercase tracking-widest transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    power_on
                  </span>
                  Turn On
                </button>
              ) : (
                <button
                  onClick={handleTurnOff}
                  className="flex items-center gap-2 px-4 py-2 bg-warning/20 hover:bg-warning/30 text-warning border border-warning/50 rounded-lg font-label text-label uppercase tracking-widest transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    power_settings_new
                  </span>
                  Turn Off
                </button>
              )}
            </div>
          )}
          <div className="font-data-sm text-data-sm text-outline flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined text-[16px]">sync</span>
            Last Sync: {new Date(latestReading.timestamp).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* KPI Tiles with Baseline Ranges */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {/* Sound Energy */}
        <div className="glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">
              Sound Energy
            </span>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">
              volume_up
            </span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-on-surface">
                {latestReading.soundEnergy.toFixed(0)}
              </span>
              <span className="font-data-sm text-data-sm text-outline">
                Units
              </span>
            </div>
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">
                Baseline Range
              </div>
              <div className="flex justify-between">
                <span className="font-data-sm text-outline">
                  {getBaselineRange(baseline.soundEnergy).min.toFixed(0)}
                </span>
                <span className="font-data-sm text-outline">–</span>
                <span className="font-data-sm text-outline">
                  {getBaselineRange(baseline.soundEnergy).max.toFixed(0)}
                </span>
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">
                Base: {baseline.soundEnergy.toFixed(0)}
              </div>
            </div>
          )}
        </div>

        {/* Frequency */}
        <div className="glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">
              Frequency
            </span>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">
              waves
            </span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-on-surface">
                {latestReading.frequency.toFixed(0)}
              </span>
              <span className="font-data-sm text-data-sm text-outline">Hz</span>
            </div>
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">
                Baseline Range
              </div>
              <div className="flex justify-between">
                <span className="font-data-sm text-outline">200</span>
                <span className="font-data-sm text-outline">–</span>
                <span className="font-data-sm text-outline">1500</span>
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">
                All motors supported (no anomaly check)
              </div>
            </div>
          )}
        </div>

        {/* Vibration */}
        <div
          className={`glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group transition-all duration-300 ${latestReading.vibration === "HIGH" ? "border-error/50 shadow-[inset_0_0_20px_rgba(255,180,171,0.05)]" : "hover:border-white/30"}`}
        >
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">
              Vibration
            </span>
            <span
              className={`material-symbols-outlined text-[20px] ${latestReading.vibration === "HIGH" ? "text-error/70" : "text-outline-variant"}`}
            >
              vibration
            </span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span
                className={`font-data-lg text-data-lg ${latestReading.vibration === "HIGH" ? "text-error" : "text-on-surface"}`}
              >
                {latestReading.vibration}
              </span>
            </div>
            {latestReading.vibration === "HIGH" && (
              <div className="flex items-center text-error font-data-sm text-data-sm glow-warning">
                <span className="material-symbols-outlined text-[16px]">
                  warning
                </span>
              </div>
            )}
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">
                Baseline Level
              </div>
              <div className="font-data-sm text-outline">
                {(baseline.vibrationLevel * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">
                Expected: DETECTED (motor vibrating)
              </div>
            </div>
          )}
        </div>

        {/* Current */}
        <div className="glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">
              Current
            </span>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">
              bolt
            </span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-on-surface">
                {latestReading.current.toFixed(2)}
              </span>
              <span className="font-data-sm text-data-sm text-outline">A</span>
            </div>
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">
                Baseline Range
              </div>
              <div className="flex justify-between">
                <span className="font-data-sm text-outline">
                  {getBaselineRange(baseline.current, 0.15).min.toFixed(2)}
                </span>
                <span className="font-data-sm text-outline">–</span>
                <span className="font-data-sm text-outline">
                  {getBaselineRange(baseline.current, 0.15).max.toFixed(2)}
                </span>
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">
                Base: {baseline.current.toFixed(2)}A
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Anomaly Analysis Panel — Baseline + ML + Combined */}
      {machine && machine.isCalibrated && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
          {/* Baseline Comparison */}
          <div className={`glass-card p-md rounded-lg border ${baselineAnomaly ? 'border-error/50' : 'border-green-500/30'}`}>
            <div className="flex items-center gap-2 mb-md">
              <span className={`material-symbols-outlined text-[22px] ${baselineAnomaly ? 'text-error' : 'text-green-400'}`}>
                compare_arrows
              </span>
              <h3 className="font-label text-label text-on-surface uppercase tracking-widest">
                Baseline Comparison
              </h3>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-md ${baselineAnomaly ? 'bg-error/15 text-error' : 'bg-green-500/15 text-green-400'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${baselineAnomaly ? 'bg-error animate-pulse' : 'bg-green-500'}`}></span>
              <span className="font-label text-[13px] uppercase tracking-wider font-bold">
                {baselineAnomaly ? 'Deviation Detected' : 'Within Normal Range'}
              </span>
            </div>
            <div className="space-y-xs text-[12px]">
              <div className="flex justify-between">
                <span className="text-outline">Sound</span>
                <span className={isOutOfRange(latestReading.soundEnergy, baseline.soundEnergy) ? 'text-error font-bold' : 'text-green-400'}>
                  {latestReading.soundEnergy.toFixed(0)} / {baseline.soundEnergy.toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">Current</span>
                <span className={isOutOfRange(latestReading.current, baseline.current, 0.15) ? 'text-error font-bold' : 'text-green-400'}>
                  {latestReading.current.toFixed(2)}A / {baseline.current.toFixed(2)}A
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-outline">Vibration</span>
                <span className="text-on-surface">{latestReading.vibration}</span>
              </div>
            </div>
          </div>

          {/* ML Prediction */}
          <div className={`glass-card p-md rounded-lg border ${mlAnomaly ? 'border-error/50' : mlResult ? 'border-blue-500/30' : 'border-white/10'}`}>
            <div className="flex items-center gap-2 mb-md">
              <span className={`material-symbols-outlined text-[22px] ${mlAnomaly ? 'text-error' : 'text-blue-400'}`}>
                smart_toy
              </span>
              <h3 className="font-label text-label text-on-surface uppercase tracking-widest">
                ML Model Analysis
              </h3>
            </div>
            {mlResult ? (
              <>
                {/* Trained / Not Trained badge */}
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg mb-sm text-[11px] ${mlResult.trained ? 'bg-blue-500/10 text-blue-400' : 'bg-warning/10 text-warning'}`}>
                  <span className="material-symbols-outlined text-[14px]">
                    {mlResult.trained ? 'model_training' : 'warning'}
                  </span>
                  <span className="uppercase tracking-wider font-bold">
                    {mlResult.trained ? 'Model Trained' : 'Not Calibrated'}
                  </span>
                  {mlResult.algorithm && (
                    <span className="ml-auto text-outline text-[10px]">{mlResult.algorithm}</span>
                  )}
                </div>

                {/* Status Badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-md ${mlAnomaly ? 'bg-error/15 text-error' : 'bg-green-500/15 text-green-400'}`}>
                  <span className={`w-2.5 h-2.5 rounded-full ${mlAnomaly ? 'bg-error animate-pulse' : 'bg-green-500'}`}></span>
                  <span className="font-label text-[13px] uppercase tracking-wider font-bold">
                    {mlAnomaly ? 'Anomaly Detected' : 'Normal Operation'}
                  </span>
                  {mlResult.anomalyCount !== undefined && (
                    <span className="ml-auto text-[11px] text-outline">
                      {mlResult.anomalyCount}/{mlResult.totalSensors || 4} sensors flagged
                    </span>
                  )}
                </div>

                {/* Per-sensor deviations from server */}
                {mlResult.deviations && mlResult.deviations.length > 0 && (
                  <div className="space-y-xs mb-md">
                    <div className="text-[10px] text-outline uppercase tracking-widest mb-xs">Sensor Analysis</div>
                    {mlResult.deviations.map((d) => (
                      <div key={d.sensor} className="flex items-center justify-between text-[12px]">
                        <span className="text-outline w-24">{d.sensor}</span>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${d.status === 'anomaly' ? 'text-error font-bold' : d.status === 'warning' ? 'text-warning' : 'text-on-surface'}`}>
                            {typeof d.live === 'number' ? (d.sensor === 'Current' ? d.live.toFixed(2) : d.live.toFixed(0)) : d.live}
                          </span>
                          <span className="text-outline-variant">/</span>
                          <span className="text-outline font-mono">
                            {typeof d.baseline === 'number' ? (d.sensor === 'Current' ? d.baseline.toFixed(2) : d.baseline.toFixed(0)) : d.baseline}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                            d.status === 'anomaly' ? 'bg-error/20 text-error' 
                            : d.status === 'warning' ? 'bg-warning/20 text-warning' 
                            : 'bg-green-500/10 text-green-400'
                          }`}>
                            {d.deviation >= 0 ? '+' : ''}{d.deviation}%
                          </span>
                          <span className={`material-symbols-outlined text-[14px] ${
                            d.status === 'anomaly' ? 'text-error' 
                            : d.status === 'warning' ? 'text-warning' 
                            : 'text-green-400'
                          }`}>
                            {d.status === 'anomaly' ? 'error' : d.status === 'warning' ? 'warning' : 'check_circle'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reason from model */}
                <div className="pt-sm border-t border-white/10">
                  <div className="text-[10px] text-outline uppercase tracking-widest mb-xs">Diagnosis</div>
                  <p className={`text-[12px] flex items-start gap-1 ${mlAnomaly ? 'text-error' : 'text-green-400'}`}>
                    <span className="material-symbols-outlined text-[14px] mt-px shrink-0">
                      {mlAnomaly ? 'warning' : 'check_circle'}
                    </span>
                    <span>{mlResult.reason || mlReason || 'No diagnosis available'}</span>
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-lg text-outline">
                <span className="material-symbols-outlined text-[32px] mb-sm opacity-40">
                  cloud_off
                </span>
                <span className="text-[12px]">{mlLoading ? 'Loading prediction...' : 'Calibrate machine to enable ML analysis'}</span>
              </div>
            )}
          </div>

          {/* Combined Verdict */}
          <div className={`glass-card p-md rounded-lg border-2 ${combinedAnomaly ? 'border-error/70 bg-error/5' : eitherAnomaly ? 'border-warning/50 bg-warning/5' : 'border-green-500/40 bg-green-500/5'}`}>
            <div className="flex items-center gap-2 mb-md">
              <span className={`material-symbols-outlined text-[22px] ${combinedAnomaly ? 'text-error' : eitherAnomaly ? 'text-warning' : 'text-green-400'}`}>
                {combinedAnomaly ? 'gpp_bad' : eitherAnomaly ? 'shield' : 'verified_user'}
              </span>
              <h3 className="font-label text-label text-on-surface uppercase tracking-widest">
                Combined Verdict
              </h3>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-md ${combinedAnomaly ? 'bg-error/20 text-error' : eitherAnomaly ? 'bg-warning/20 text-warning' : 'bg-green-500/20 text-green-400'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${combinedAnomaly ? 'bg-error animate-pulse' : eitherAnomaly ? 'bg-warning animate-pulse' : 'bg-green-500'}`}></span>
              <span className="font-label text-[13px] uppercase tracking-wider font-bold">
                {combinedAnomaly
                  ? 'Confirmed Anomaly'
                  : eitherAnomaly
                    ? 'Under Investigation'
                    : 'System Healthy'}
              </span>
            </div>
            <div className="space-y-xs text-[12px]">
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[16px] ${baselineAnomaly ? 'text-error' : 'text-green-400'}`}>
                  {baselineAnomaly ? 'close' : 'check'}
                </span>
                <span className="text-outline">Baseline: {baselineAnomaly ? 'Deviation' : 'Normal'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-[16px] ${mlAnomaly ? 'text-error' : mlResult ? 'text-green-400' : 'text-outline'}`}>
                  {mlAnomaly ? 'close' : mlResult ? 'check' : 'remove'}
                </span>
                <span className="text-outline">ML Model: {mlResult ? (mlAnomaly ? 'Anomaly' : 'Healthy') : 'N/A'}</span>
              </div>
              <div className="mt-sm pt-sm border-t border-white/10">
                <p className="text-[11px] text-outline-variant">
                  {combinedAnomaly
                    ? '⚠️ Both systems agree: Maintenance is required immediately.'
                    : eitherAnomaly
                      ? '🔍 One system flagged an issue. Monitor closely before taking action.'
                      : '✅ Both systems agree: Machine is operating within healthy parameters.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Sound Energy Chart */}
        <div className="glass-card rounded-lg p-md flex flex-col gap-sm">
          <div className="flex justify-between items-center mb-sm">
            <h3 className="font-label text-label text-on-surface uppercase">
              Sound Energy History
            </h3>
            <span className="font-data-sm text-data-sm text-outline">
              Last 50 samples
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readings}>
                <defs>
                  <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffb786" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ffb786" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2e3038"
                  vertical={false}
                />
                <XAxis dataKey="timestamp" hide={true} />
                <YAxis
                  stroke="#8c909f"
                  fontSize={10}
                  tickFormatter={(val) => `${val}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#191b23",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                  labelStyle={{ color: "#8c909f" }}
                  itemStyle={{ color: "#ffb786" }}
                  labelFormatter={(label) =>
                    new Date(label).toLocaleTimeString()
                  }
                />
                <Area
                  type="monotone"
                  dataKey="soundEnergy"
                  stroke="#ffb786"
                  fillOpacity={1}
                  fill="url(#colorEnergy)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequency Chart */}
        <div className="glass-card rounded-lg p-md flex flex-col gap-sm">
          <div className="flex justify-between items-center mb-sm">
            <h3 className="font-label text-label text-on-surface uppercase">
              Frequency Tracking
            </h3>
            <span className="font-data-sm text-data-sm text-outline">
              Range: 200-1500 Hz (all motors supported)
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={readings}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#2e3038"
                  vertical={false}
                />
                <XAxis dataKey="timestamp" hide={true} />
                <YAxis stroke="#8c909f" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "#191b23",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "4px",
                  }}
                  labelFormatter={(label) =>
                    new Date(label).toLocaleTimeString()
                  }
                />
                <Line
                  type="monotone"
                  dataKey="frequency"
                  stroke="#adc6ff"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alert History List */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col">
        <div className="p-md border-b border-white/5 bg-surface-container-low">
          <h3 className="font-h2 text-h2 text-on-surface">
            Recent Alerts for {deviceId}
          </h3>
        </div>
        <div className="flex flex-col">
          {notifications.length > 0 ? (
            notifications.map((notif) => (
              <div
                key={notif._id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-md border-b border-white/5 hover:bg-white/5 transition-colors group gap-2 sm:gap-4"
              >
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <div
                    className={`flex items-center gap-2 border px-2 py-0.5 rounded-DEFAULT w-20 sm:w-24 justify-center flex-shrink-0 ${
                      notif.severity === "critical"
                        ? "bg-error-container/20 border-error-container/50 text-error"
                        : "bg-tertiary-container/20 border-tertiary-container/50 text-tertiary"
                    }`}
                  >
                    <span className="font-label text-[9px] uppercase tracking-wider">
                      {notif.severity}
                    </span>
                  </div>
                  <span className="font-data-md text-data-md text-on-surface text-xs sm:text-sm truncate">
                    {notif.message}
                  </span>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 ml-auto sm:ml-0 flex-shrink-0">
                  <span className="font-data-sm text-data-sm text-outline text-[10px] sm:text-xs">
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </span>
                  {notif.acknowledged ? (
                    <span className="font-data-sm text-outline-variant px-2 sm:px-3 py-1 w-20 sm:w-[116px] text-center border border-white/5 rounded text-[10px] sm:text-xs">
                      ACK'D
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledge(notif._id)}
                      className="bg-primary/10 text-primary border border-primary/30 px-2 sm:px-3 py-1 rounded-DEFAULT font-label text-[10px] sm:text-label hover:bg-primary/20 transition-all duration-300 w-20 sm:w-[116px]"
                    >
                      ACK
                      <span className="hidden sm:inline">NOWLEDGE</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="p-xl text-center text-outline">
              No alerts recorded for this device.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceDetail;
