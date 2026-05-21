import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchDevices, fetchRegisteredDevices, fetchMachines } from '../api';
import useNotifications from '../hooks/useNotifications';
import MachineCard from '../components/MachineCard';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  const [registeredDevices, setRegisteredDevices] = useState([]);
  const [machines, setMachines] = useState([]);
  const { notifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const prevNotifCount = useRef(0);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const [active, registered, machinesData] = await Promise.all([
          fetchDevices(),
          fetchRegisteredDevices(),
          fetchMachines()
        ]);
        setDevices(active);
        setRegisteredDevices(registered);
        setMachines(machinesData);
      } catch (error) {
        console.error('Failed to fetch dashboard data', error);
      } finally {
        setLoading(false);
      }
    };
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  // Real-time anomaly toast
  useEffect(() => {
    if (prevNotifCount.current > 0 && notifications.length > prevNotifCount.current) {
      const newNotifs = notifications.slice(0, notifications.length - prevNotifCount.current);
      newNotifs.forEach(n => {
        if (n.severity === 'critical') {
          toast.error(n.message, { duration: 6000, icon: '🚨' });
        } else {
          toast(n.message, { duration: 4000, icon: '⚠️' });
        }
      });
    }
    prevNotifCount.current = notifications.length;
  }, [notifications]);

  const totalAnomaliesToday = notifications.filter(n => {
    const today = new Date().setHours(0, 0, 0, 0);
    return new Date(n.timestamp).getTime() > today;
  }).length;

  const hasCritical = notifications.some(n => n.severity === 'critical' && !n.acknowledged);

  // Skeleton loading state
  if (loading) {
    return (
      <>
        {/* Hero Stats Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel p-md rounded-lg flex flex-col gap-sm">
              <div className="flex justify-between items-center">
                <div className="skeleton h-3 w-24"></div>
                <div className="skeleton h-4 w-4 rounded-full"></div>
              </div>
              <div className="skeleton h-9 w-16 mt-xs"></div>
              <div className="skeleton h-3 w-32"></div>
            </div>
          ))}
        </div>
        {/* Header Skeleton */}
        <div className="flex justify-between items-end border-b border-white/5 pb-sm mt-margin">
          <div className="skeleton h-5 w-48"></div>
          <div className="skeleton h-3 w-32"></div>
        </div>
        {/* Device Grid Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-panel p-md rounded-lg flex flex-col gap-md">
              <div className="flex justify-between items-start">
                <div className="flex flex-col gap-xs">
                  <div className="flex items-center gap-xs">
                    <div className="skeleton h-2 w-2 rounded-full"></div>
                    <div className="skeleton h-4 w-24"></div>
                  </div>
                  <div className="skeleton h-2 w-32"></div>
                </div>
                <div className="skeleton h-5 w-16 rounded"></div>
              </div>
              <div className="border-t border-white/5 pt-sm grid grid-cols-2 gap-sm">
                <div className="flex flex-col gap-xs">
                  <div className="skeleton h-2 w-20"></div>
                  <div className="flex gap-[2px]">
                    {[...Array(10)].map((_, j) => (
                      <div key={j} className="skeleton w-[6px] rounded-sm" style={{ height: `${10 + Math.random() * 30}px` }}></div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-sm">
                  <div className="flex justify-between"><div className="skeleton h-2 w-12"></div><div className="skeleton h-2 w-10"></div></div>
                  <div className="flex justify-between"><div className="skeleton h-2 w-14"></div><div className="skeleton h-2 w-12"></div></div>
                </div>
              </div>
              <div className="skeleton h-8 w-full rounded mt-xs"></div>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Hero Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        {/* Stat 1 */}
        <div className="glass-panel p-md rounded-lg flex flex-col gap-sm">
          <div className="flex justify-between items-center text-outline">
            <span className="font-data-sm uppercase tracking-widest text-[10px]">Active Devices</span>
            <span className="material-symbols-outlined text-[16px]">sensors</span>
          </div>
          <div className="font-data-lg text-primary text-[32px] text-glow-primary">{devices.length}</div>
          <div className="font-data-sm text-outline-variant">System baseline nominal.</div>
        </div>
        {/* Stat 2 */}
        <div className="glass-panel p-md rounded-lg flex flex-col gap-sm">
          <div className="flex justify-between items-center text-outline">
            <span className="font-data-sm uppercase tracking-widest text-[10px]">Total Anomalies Today</span>
            <span className="material-symbols-outlined text-[16px] text-tertiary">warning</span>
          </div>
          <div className="font-data-lg text-tertiary text-[32px]">{totalAnomaliesToday}</div>
          <div className="font-data-sm text-outline-variant">Real-time event tracking.</div>
        </div>
        {/* Stat 3 */}
        <div className="glass-panel p-md rounded-lg flex flex-col gap-sm border-tertiary/30">
          <div className="flex justify-between items-center text-outline">
            <span className="font-data-sm uppercase tracking-widest text-[10px]">System Status</span>
            <span className={`w-2 h-2 rounded-full ${hasCritical ? 'bg-error animate-pulse' : 'bg-tertiary animate-pulse'}`}></span>
          </div>
          <div className={`font-data-lg text-[32px] ${hasCritical ? 'text-error' : 'text-tertiary'}`}>
            {hasCritical ? 'CRITICAL' : totalAnomaliesToday > 0 ? 'WARNING' : 'NOMINAL'}
          </div>
          <div className="font-data-sm text-outline-variant">
            {hasCritical ? 'Immediate intervention required.' : 'Acoustic monitoring active.'}
          </div>
        </div>
      </div>

      {/* Machines Section */}
      <div className="flex justify-between items-end border-b border-white/5 pb-sm mt-margin mb-md">
        <h2 className="font-h2 text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">precision_manufacturing</span>
          Machine Profiles
        </h2>
        <span className="font-data-sm text-outline">Showing {machines.length} configured machines</span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-xl">
        {machines.length > 0 ? (
          machines.map(machine => (
            <MachineCard 
              key={machine._id} 
              machine={machine} 
              onRefresh={async () => {
                const machinesData = await fetchMachines();
                setMachines(machinesData);
              }} 
            />
          ))
        ) : (
          <div className="col-span-full py-xl px-md text-center text-outline-variant bg-surface-container-low rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-sm">
            <span className="material-symbols-outlined text-[48px] text-outline-variant">precision_manufacturing</span>
            <div className="font-h2 text-on-surface text-base">No Machine Profiles Registered</div>
            <p className="max-w-[400px] text-body-sm text-outline mx-auto">
              Please register a device first, then complete the 2-minute calibration sequence to establish baseline normal readings.
            </p>
            <Link 
              to="/connect-device"
              className="mt-sm bg-primary/10 border border-primary/20 text-primary font-label text-label uppercase tracking-widest px-md py-sm rounded-lg hover:bg-primary/20 transition-all flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-[16px]">add_circle</span>
              Go to Device Management
            </Link>
          </div>
        )}
      </div>

      {/* How it Works / System Overview Section */}
      <div className="glass-panel p-lg rounded-xl mt-margin flex flex-col gap-md border-primary/10">
        <h3 className="font-h2 text-on-surface flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">info</span>
          Acoustic Anomaly Detection System — How it Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md text-body-sm text-outline">
          <div className="flex flex-col gap-xs p-sm bg-surface-container-low rounded-lg border border-white/5">
            <div className="flex items-center gap-xs font-bold text-on-surface mb-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">precision_manufacturing</span>
              1. Calibration Baseline
            </div>
            During a 2-minute calibration sequence, the system captures normal operating sounds, frequencies, current, and vibrations to build a reference profile of a healthy machine.
          </div>
          <div className="flex flex-col gap-xs p-sm bg-surface-container-low rounded-lg border border-white/5">
            <div className="flex items-center gap-xs font-bold text-on-surface mb-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">graphic_eq</span>
              2. Acoustic Monitoring
            </div>
            Microphones capture real-time acoustic signatures. The server processes signals with FFT spectral analysis and compares them continuously against the machine's baseline.
          </div>
          <div className="flex flex-col gap-xs p-sm bg-surface-container-low rounded-lg border border-white/5">
            <div className="flex items-center gap-xs font-bold text-on-surface mb-xs">
              <span className="material-symbols-outlined text-primary text-[18px]">notifications_active</span>
              3. Anomaly & Maintenance
            </div>
            Deviations exceeding 30% or flagged by ML trigger immediate alerts. Persistent deviations flag the machine as "Maintenance Required" to prevent failure.
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;


