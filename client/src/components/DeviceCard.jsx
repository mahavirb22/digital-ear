import React from 'react';
import { Link } from 'react-router-dom';
import useSensorData from '../hooks/useSensorData';

const DeviceCard = ({ deviceId }) => {
  const { readings, latestReading, loading } = useSensorData(deviceId);

  if (loading || !latestReading) {
    return (
      <div className="glass-panel p-md rounded-lg flex flex-col gap-md">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-xs">
            <div className="flex items-center gap-xs">
              <div className="skeleton h-2 w-2 rounded-full"></div>
              <div className="skeleton h-4 w-20"></div>
            </div>
            <div className="skeleton h-2 w-28"></div>
          </div>
          <div className="skeleton h-5 w-16 rounded"></div>
        </div>
        <div className="border-t border-white/5 pt-sm grid grid-cols-2 gap-sm">
          <div className="flex flex-col gap-xs">
            <div className="skeleton h-2 w-20"></div>
            <div className="flex gap-[2px] items-end h-10">
              {[...Array(10)].map((_, j) => (
                <div key={j} className="skeleton w-[6px] rounded-sm" style={{ height: `${8 + Math.random() * 28}px` }}></div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-sm justify-end">
            <div className="flex justify-between"><div className="skeleton h-2 w-12"></div><div className="skeleton h-2 w-10"></div></div>
            <div className="flex justify-between"><div className="skeleton h-2 w-14"></div><div className="skeleton h-2 w-12"></div></div>
          </div>
        </div>
        <div className="skeleton h-8 w-full rounded mt-xs"></div>
      </div>
    );
  }

  const isAnomaly = latestReading.isAnomaly;

  return (
    <div className={`glass-panel p-md rounded-lg flex flex-col gap-md relative overflow-hidden group hover:border-primary/30 transition-colors ${isAnomaly ? 'pulse-danger' : ''}`}>
      {isAnomaly && (
        <div className="absolute top-0 right-0 w-16 h-16 bg-error/10 blur-xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
      )}
      <div className="flex justify-between items-start relative z-10">
        <div>
          <div className={`font-data-md flex items-center gap-xs ${isAnomaly ? 'text-error' : 'text-primary'}`}>
            <span className={`w-2 h-2 rounded-full ${isAnomaly ? 'bg-error animate-pulse' : 'bg-primary/50'}`}></span>
            {deviceId}
          </div>
          <div className="font-data-sm text-outline text-[10px]">
            Last seen: {new Date(latestReading.timestamp).toLocaleTimeString()}
          </div>
        </div>
        <div className={`font-label border px-xs py-[2px] rounded text-[9px] ${
          isAnomaly 
          ? 'text-error border-error/50 bg-error/10' 
          : 'text-surface-tint border-primary/20 bg-primary/5'
        }`}>
          {isAnomaly ? 'DETECTED' : 'NORMAL'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm pt-sm border-t border-white/5 relative z-10">
        <div>
          <div className="font-data-sm text-outline text-[10px] mb-xs">Sound Energy</div>
          <div className="sparkline">
            {readings.slice(-10).map((r, i) => (
              <div 
                key={i} 
                className={`sparkline-bar ${r.isAnomaly ? 'danger' : ''}`} 
                style={{ height: `${Math.min(100, (r.soundEnergy / 80000) * 100)}%` }}
              ></div>
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-end gap-xs">
          <div className="flex justify-between">
            <span className="font-data-sm text-outline text-[10px]">Current</span>
            <span className={`font-data-sm ${isAnomaly && latestReading.current > 2.0 ? 'text-error font-bold' : 'text-on-surface'}`}>
              {latestReading.current.toFixed(1)} A
            </span>
          </div>
          <div className="flex justify-between">
            <span className="font-data-sm text-outline text-[10px]">Frequency</span>
            <span className={`font-data-sm ${isAnomaly && (latestReading.frequency < 300 || latestReading.frequency > 2000) ? 'text-error font-bold' : 'text-on-surface'}`}>
              {latestReading.frequency.toFixed(0)} Hz
            </span>
          </div>
        </div>
      </div>

      <Link 
        to={`/device/${deviceId}`} 
        className={`w-full mt-sm py-xs border rounded font-data-sm text-center transition-colors relative z-10 ${
          isAnomaly 
          ? 'border-error/30 text-error hover:bg-error/10' 
          : 'border-white/10 text-primary hover:bg-white/5'
        }`}
      >
        {isAnomaly ? 'Investigate' : 'View Details'}
      </Link>
    </div>
  );
};

export default DeviceCard;
