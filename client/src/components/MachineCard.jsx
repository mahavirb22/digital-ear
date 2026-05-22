import React from "react";
import { Link } from "react-router-dom";
import useSensorData from "../hooks/useSensorData";
import { markMaintenanceComplete, turnOffMachine, turnOnMachine } from "../api";
import toast from "react-hot-toast";

const MachineCard = ({ machine, onRefresh }) => {
  const deviceId = machine.deviceAttached
    ? machine.deviceAttached.deviceId
    : null;
  // We unconditionally call the hook, but it handles null deviceId internally
  const { readings, latestReading } = useSensorData(deviceId);

  const isCritical = machine.needsMaintenance;

  const handleMaintenanceComplete = async () => {
    try {
      await markMaintenanceComplete(machine._id);
      toast.success("Maintenance marked as completed!");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error("Failed to update maintenance status");
    }
  };

  const handleTurnOff = async () => {
    try {
      await turnOffMachine(machine._id);
      toast.success("Machine status set to Scheduled Off!");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error("Failed to schedule machine turn off");
    }
  };

  const handleTurnOn = async () => {
    try {
      await turnOnMachine(machine._id);
      toast.success("Machine turned on! Monitoring resumed.");
      if (onRefresh) onRefresh();
    } catch (err) {
      toast.error("Failed to turn on machine");
    }
  };

  return (
    <div
      className={`glass-panel p-md rounded-lg flex flex-col gap-sm border transition-colors relative overflow-hidden group ${
        isCritical
          ? "border-error shadow-[0_0_15px_rgba(255,82,82,0.2)] pulse-danger"
          : machine.status === "scheduled_off"
            ? "border-white/5 opacity-75 hover:opacity-100 hover:border-white/10"
            : "border-primary/10 hover:border-primary/30"
      }`}
    >
      {isCritical && (
        <div className="absolute top-0 right-0 w-24 h-24 bg-error/20 blur-2xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
      )}

      <div className="flex justify-between items-start relative z-10">
        <div className="flex flex-col">
          <h3
            className={`font-h2 flex items-center gap-xs ${isCritical ? "text-error" : "text-primary"}`}
          >
            {isCritical && (
              <span className="material-symbols-outlined text-[20px] animate-pulse">
                warning
              </span>
            )}
            {machine.name}
          </h3>
          <div className="font-data-sm text-outline-variant flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-[14px]">
              sensors
            </span>
            {machine.deviceAttached
              ? machine.deviceAttached.name || machine.deviceAttached.deviceId
              : "No sensor attached"}
          </div>
        </div>
        <div
          className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
            isCritical
              ? "bg-error text-on-error animate-pulse"
              : machine.status === "scheduled_off"
                ? "bg-zinc-500/30 text-zinc-400"
                : machine.isCalibrated
                  ? "bg-green-500/20 text-green-400"
                  : "bg-warning/20 text-warning"
          }`}
        >
          {isCritical
            ? "Maintenance Required"
            : machine.status === "scheduled_off"
              ? "Scheduled Off"
              : machine.isCalibrated
                ? "Calibrated"
                : "Needs Baseline"}
        </div>
      </div>

      {machine.calibrationError && (
        <div className="p-sm bg-error/10 border border-error/30 rounded-lg text-error text-[12px] font-medium flex items-center gap-xs relative z-10">
          <span className="material-symbols-outlined text-[18px] shrink-0 text-error animate-pulse">
            error
          </span>
          <span>Calibration failed: {machine.calibrationError}</span>
        </div>
      )}

      {machine.isCalibrated && (
        <div className="grid grid-cols-4 gap-xs mt-xs p-sm bg-surface-container-low rounded-lg border border-white/5 relative z-10">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-outline tracking-widest">
              Base Sound
            </span>
            <span className="font-data-sm text-on-surface">
              {(machine.baseline.soundEnergy / 1000).toFixed(1)}k
            </span>
            <span className="text-[8px] text-outline-variant mt-0.5">
              Range: {((machine.baseline.soundEnergy * 0.8) / 1000).toFixed(1)}-
              {((machine.baseline.soundEnergy * 1.2) / 1000).toFixed(1)}k
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-outline tracking-widest">
              Base Freq
            </span>
            <span className="font-data-sm text-on-surface">
              {Math.round(machine.baseline.frequency)}Hz
            </span>
            <span className="text-[8px] text-outline-variant mt-0.5">
              Range: {Math.round(machine.baseline.frequency * 0.8)}-
              {Math.round(machine.baseline.frequency * 1.2)}Hz
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-outline tracking-widest">
              Base Curr
            </span>
            <span className="font-data-sm text-on-surface">
              {machine.baseline.current.toFixed(2)}A
            </span>
            <span className="text-[8px] text-outline-variant mt-0.5">
              Range: {(machine.baseline.current * 0.85).toFixed(2)}-
              {(machine.baseline.current * 1.15).toFixed(2)}A
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase text-outline tracking-widest">
              Base Vib
            </span>
            <span className="font-data-sm text-on-surface">
              {Math.round(machine.baseline.vibrationLevel * 100)}%
            </span>
            <span className="text-[8px] text-outline-variant mt-0.5">
              Expected: Normal
            </span>
          </div>
        </div>
      )}

      {/* Live Monitoring Graphs */}
      {deviceId && latestReading && machine.isCalibrated && (
        <div className="grid grid-cols-2 gap-sm pt-sm border-t border-white/5 relative z-10 mt-xs">
          <div>
            <div className="flex justify-between items-center mb-xs">
              <span className="font-data-sm text-outline text-[10px]">
                Live Sound Energy
              </span>
            </div>
            <div className="sparkline">
              {readings.slice(-10).map((r, i) => {
                const isSurge =
                  r.soundEnergy > machine.baseline.soundEnergy * 1.3;
                return (
                  <div
                    key={i}
                    className={`sparkline-bar ${isSurge ? "danger" : ""}`}
                    style={{
                      height: `${Math.min(100, (r.soundEnergy / Math.max(80000, machine.baseline.soundEnergy * 1.5)) * 100)}%`,
                    }}
                  ></div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col justify-end gap-xs">
            <div className="flex justify-between items-center">
              <span className="font-data-sm text-outline text-[10px]">
                Live Current
              </span>
              <span
                className={`font-data-sm ${latestReading.current > machine.baseline.current * 1.3 ? "text-error font-bold" : "text-on-surface"}`}
              >
                {latestReading.current.toFixed(2)} A
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-data-sm text-outline text-[10px]">
                Live Frequency
              </span>
              <span
                className={`font-data-sm ${latestReading.frequency > machine.baseline.frequency * 1.3 || latestReading.frequency < machine.baseline.frequency * 0.7 ? "text-error font-bold" : "text-on-surface"}`}
              >
                {latestReading.frequency.toFixed(0)} Hz
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-sm mt-sm relative z-10">
        {isCritical && (
          <button
            onClick={handleMaintenanceComplete}
            className="flex-1 bg-error/20 hover:bg-error/30 text-error border border-error/50 font-label text-label uppercase tracking-widest py-sm rounded-lg transition-colors flex items-center justify-center gap-xs"
          >
            <span className="material-symbols-outlined text-[16px]">build</span>
            Reset
          </button>
        )}

        {machine.status === "scheduled_off" ? (
          <button
            onClick={handleTurnOn}
            className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/50 font-label text-label uppercase tracking-widest py-sm rounded-lg transition-colors flex items-center justify-center gap-xs"
          >
            <span className="material-symbols-outlined text-[16px]">
              power_on
            </span>
            Turn On
          </button>
        ) : (
          machine.deviceAttached && (
            <button
              onClick={handleTurnOff}
              className="flex-1 bg-warning/20 hover:bg-warning/30 text-warning border border-warning/50 font-label text-label uppercase tracking-widest py-sm rounded-lg transition-colors flex items-center justify-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">
                power_settings_new
              </span>
              Turn Off
            </button>
          )
        )}

        {deviceId && (
          <Link
            to={`/device/${deviceId}`}
            className={`flex-1 border py-sm rounded-lg font-label text-label uppercase tracking-widest text-center transition-colors flex items-center justify-center gap-xs ${
              isCritical
                ? "border-error/30 text-error hover:bg-error/10"
                : "border-white/10 text-primary hover:bg-white/5"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              query_stats
            </span>
            Details
          </Link>
        )}
      </div>
    </div>
  );
};

export default MachineCard;
