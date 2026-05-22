import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import useSensorData from '../hooks/useSensorData';
import useNotifications from '../hooks/useNotifications';
import { acknowledgeNotification, turnOffMachine, turnOnMachine } from '../api';
import toast from 'react-hot-toast';

const DeviceDetail = () => {
  const { deviceId } = useParams();
  const { readings, latestReading, baseline, machine, loading } = useSensorData(deviceId);
  const { notifications } = useNotifications(deviceId);

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeNotification(id);
      toast.success('Alert acknowledged');
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const handleTurnOff = async () => {
    try {
      if (!machine) return;
      await turnOffMachine(machine._id);
      toast.success('Machine turned off. Monitoring paused.');
    } catch (error) {
      toast.error('Failed to turn off machine');
    }
  };

  const handleTurnOn = async () => {
    try {
      if (!machine) return;
      await turnOnMachine(machine._id);
      toast.success('Machine turned on. Monitoring resumed.');
    } catch (error) {
      toast.error('Failed to turn on machine');
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
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card p-md rounded-lg flex flex-col justify-between h-32">
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
          {[1, 2].map(i => (
            <div key={i} className="glass-card rounded-lg p-md flex flex-col gap-sm">
              <div className="flex justify-between items-center mb-sm">
                <div className="skeleton h-3 w-36"></div>
                <div className="skeleton h-3 w-24"></div>
              </div>
              <div className="h-64 w-full flex items-end gap-[3px] px-4 pb-4">
                {[...Array(30)].map((_, j) => (
                  <div key={j} className="skeleton flex-1 rounded-t" style={{ height: `${20 + Math.random() * 80}%` }}></div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Alerts Skeleton */}
        <div className="glass-card rounded-lg overflow-hidden">
          <div className="p-md border-b border-white/5">
            <div className="skeleton h-5 w-52"></div>
          </div>
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center justify-between p-md border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="skeleton h-5 w-20 rounded"></div>
                <div className="skeleton h-4 w-64"></div>
              </div>
              <div className="flex items-center gap-6">
                <div className="skeleton h-3 w-16"></div>
                <div className="skeleton h-7 w-28 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const isAnomaly = latestReading.isAnomaly;
  const isMachineOff = machine && machine.status === 'scheduled_off';

  // Calculate baseline ranges (±20% from baseline)
  const getBaselineRange = (baselineValue, margin = 0.2) => {
    if (!baselineValue) return { min: 0, max: 0 };
    return {
      min: baselineValue * (1 - margin),
      max: baselineValue * (1 + margin)
    };
  };

  return (
    <div className="space-y-lg">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-slate-400 hover:text-white transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </Link>
          <h1 className="font-h1 text-h1 text-on-surface">Device: {deviceId}</h1>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-DEFAULT border ${
            isAnomaly 
            ? 'bg-error-container/20 border-error-container/50 text-error' 
            : 'bg-primary-container/20 border-primary-container/50 text-primary'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isAnomaly ? 'bg-error animate-pulse' : 'bg-primary'}`}></span>
            <span className="font-label text-label uppercase tracking-widest">
              {isAnomaly ? 'Anomaly Detected' : isMachineOff ? 'Monitoring Paused' : 'Operational'}
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
                  <span className="material-symbols-outlined text-[16px]">power_on</span>
                  Turn On
                </button>
              ) : (
                <button
                  onClick={handleTurnOff}
                  className="flex items-center gap-2 px-4 py-2 bg-warning/20 hover:bg-warning/30 text-warning border border-warning/50 rounded-lg font-label text-label uppercase tracking-widest transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
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
            <span className="font-label text-label text-outline uppercase">Sound Energy</span>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">volume_up</span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-on-surface">{latestReading.soundEnergy.toFixed(0)}</span>
              <span className="font-data-sm text-data-sm text-outline">Units</span>
            </div>
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">Baseline Range</div>
              <div className="flex justify-between">
                <span className="font-data-sm text-outline">{getBaselineRange(baseline.soundEnergy).min.toFixed(0)}</span>
                <span className="font-data-sm text-outline">–</span>
                <span className="font-data-sm text-outline">{getBaselineRange(baseline.soundEnergy).max.toFixed(0)}</span>
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">Base: {baseline.soundEnergy.toFixed(0)}</div>
            </div>
          )}
        </div>

        {/* Frequency */}
        <div className="glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">Frequency</span>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">waves</span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-on-surface">{latestReading.frequency.toFixed(0)}</span>
              <span className="font-data-sm text-data-sm text-outline">Hz</span>
            </div>
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">Baseline Range</div>
              <div className="flex justify-between">
                <span className="font-data-sm text-outline">{getBaselineRange(baseline.frequency).min.toFixed(0)}</span>
                <span className="font-data-sm text-outline">–</span>
                <span className="font-data-sm text-outline">{getBaselineRange(baseline.frequency).max.toFixed(0)}</span>
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">Base: {baseline.frequency.toFixed(0)}</div>
            </div>
          )}
        </div>

        {/* Vibration */}
        <div className={`glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group transition-all duration-300 ${latestReading.vibration === 'HIGH' ? 'border-error/50 shadow-[inset_0_0_20px_rgba(255,180,171,0.05)]' : 'hover:border-white/30'}`}>
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">Vibration</span>
            <span className={`material-symbols-outlined text-[20px] ${latestReading.vibration === 'HIGH' ? 'text-error/70' : 'text-outline-variant'}`}>vibration</span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className={`font-data-lg text-data-lg ${latestReading.vibration === 'HIGH' ? 'text-error' : 'text-on-surface'}`}>
                {latestReading.vibration}
              </span>
            </div>
            {latestReading.vibration === 'HIGH' && (
              <div className="flex items-center text-error font-data-sm text-data-sm glow-warning">
                <span className="material-symbols-outlined text-[16px]">warning</span>
              </div>
            )}
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">Baseline Level</div>
              <div className="font-data-sm text-outline">{(baseline.vibrationLevel * 100).toFixed(0)}%</div>
              <div className="text-[10px] text-outline-variant mt-xs">Expected: NORMAL</div>
            </div>
          )}
        </div>

        {/* Current */}
        <div className="glass-card p-md rounded-lg flex flex-col justify-between relative overflow-hidden group hover:border-white/30 transition-all duration-300">
          <div className="flex justify-between items-start mb-md">
            <span className="font-label text-label text-outline uppercase">Current</span>
            <span className="material-symbols-outlined text-outline-variant text-[20px]">bolt</span>
          </div>
          <div className="flex items-end justify-between mb-md">
            <div className="flex items-baseline gap-1">
              <span className="font-data-lg text-data-lg text-on-surface">{latestReading.current.toFixed(2)}</span>
              <span className="font-data-sm text-data-sm text-outline">A</span>
            </div>
          </div>
          {baseline && (
            <div className="pt-md border-t border-white/10">
              <div className="font-data-xs text-outline-variant uppercase tracking-widest mb-xs">Baseline Range</div>
              <div className="flex justify-between">
                <span className="font-data-sm text-outline">{getBaselineRange(baseline.current, 0.15).min.toFixed(2)}</span>
                <span className="font-data-sm text-outline">–</span>
                <span className="font-data-sm text-outline">{getBaselineRange(baseline.current, 0.15).max.toFixed(2)}</span>
              </div>
              <div className="text-[10px] text-outline-variant mt-xs">Base: {baseline.current.toFixed(2)}A</div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Sound Energy Chart */}
        <div className="glass-card rounded-lg p-md flex flex-col gap-sm">
          <div className="flex justify-between items-center mb-sm">
            <h3 className="font-label text-label text-on-surface uppercase">Sound Energy History</h3>
            <span className="font-data-sm text-data-sm text-outline">Last 50 samples</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={readings}>
                <defs>
                  <linearGradient id="colorEnergy" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffb786" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ffb786" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3038" vertical={false} />
                <XAxis 
                  dataKey="timestamp" 
                  hide={true}
                />
                <YAxis stroke="#8c909f" fontSize={10} tickFormatter={(val) => `${val}`} />
                <Tooltip 
                  contentStyle={{ background: '#191b23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  labelStyle={{ color: '#8c909f' }}
                  itemStyle={{ color: '#ffb786' }}
                  labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                />
                <Area type="monotone" dataKey="soundEnergy" stroke="#ffb786" fillOpacity={1} fill="url(#colorEnergy)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Frequency Chart */}
        <div className="glass-card rounded-lg p-md flex flex-col gap-sm">
          <div className="flex justify-between items-center mb-sm">
            <h3 className="font-label text-label text-on-surface uppercase">Frequency Tracking</h3>
            <span className="font-data-sm text-data-sm text-outline">Target: 300-2000 Hz</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={readings}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e3038" vertical={false} />
                <XAxis dataKey="timestamp" hide={true} />
                <YAxis stroke="#8c909f" fontSize={10} />
                <Tooltip 
                  contentStyle={{ background: '#191b23', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px' }}
                  labelFormatter={(label) => new Date(label).toLocaleTimeString()}
                />
                <Line type="monotone" dataKey="frequency" stroke="#adc6ff" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Alert History List */}
      <div className="glass-card rounded-lg overflow-hidden flex flex-col">
        <div className="p-md border-b border-white/5 bg-surface-container-low">
          <h3 className="font-h2 text-h2 text-on-surface">Recent Alerts for {deviceId}</h3>
        </div>
        <div className="flex flex-col">
          {notifications.length > 0 ? (
            notifications.map(notif => (
              <div key={notif._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-md border-b border-white/5 hover:bg-white/5 transition-colors group gap-2 sm:gap-4">
                <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                  <div className={`flex items-center gap-2 border px-2 py-0.5 rounded-DEFAULT w-20 sm:w-24 justify-center flex-shrink-0 ${
                    notif.severity === 'critical' 
                    ? 'bg-error-container/20 border-error-container/50 text-error' 
                    : 'bg-tertiary-container/20 border-tertiary-container/50 text-tertiary'
                  }`}>
                    <span className="font-label text-[9px] uppercase tracking-wider">{notif.severity}</span>
                  </div>
                  <span className="font-data-md text-data-md text-on-surface text-xs sm:text-sm truncate">{notif.message}</span>
                </div>
                <div className="flex items-center gap-3 sm:gap-6 ml-auto sm:ml-0 flex-shrink-0">
                  <span className="font-data-sm text-data-sm text-outline text-[10px] sm:text-xs">
                    {new Date(notif.timestamp).toLocaleTimeString()}
                  </span>
                  {notif.acknowledged ? (
                    <span className="font-data-sm text-outline-variant px-2 sm:px-3 py-1 w-20 sm:w-[116px] text-center border border-white/5 rounded text-[10px] sm:text-xs">ACK'D</span>
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
            <div className="p-xl text-center text-outline">No alerts recorded for this device.</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeviceDetail;
