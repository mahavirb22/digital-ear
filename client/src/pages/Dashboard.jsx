import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchDevices, fetchRegisteredDevices } from '../api';
import useNotifications from '../hooks/useNotifications';
import DeviceCard from '../components/DeviceCard';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  const [registeredDevices, setRegisteredDevices] = useState([]);
  const { notifications } = useNotifications();
  const [loading, setLoading] = useState(true);
  const prevNotifCount = useRef(0);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const [active, registered] = await Promise.all([
          fetchDevices(),
          fetchRegisteredDevices()
        ]);
        setDevices(active);
        setRegisteredDevices(registered);
      } catch (error) {
        console.error('Failed to fetch devices', error);
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

  // If no registered devices, show empty state
  if (registeredDevices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-xl text-center min-h-[60vh]">
        <div className="glass-panel rounded-xl p-xl max-w-[500px] w-full flex flex-col items-center gap-lg">
          <span className="material-symbols-outlined text-[80px] text-surface-container-highest" style={{ fontVariationSettings: "'wght' 200" }}>sensors_off</span>
          <div>
            <h2 className="font-h1 text-h1 text-on-surface mb-xs">No Devices Connected</h2>
            <p className="font-body text-body text-on-surface-variant max-w-[400px] mx-auto mb-lg">
              The Digital Ear system requires at least one ESP32 sensor node to be registered before you can begin monitoring.
            </p>
          </div>
          <Link
            to="/connect-device"
            className="bg-primary text-on-primary font-label text-label uppercase tracking-widest px-lg py-md rounded-lg hover:bg-primary-fixed transition-all hover:shadow-[0_0_10px_rgba(173,198,255,0.5)] flex items-center justify-center gap-sm w-full sm:w-auto"
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            Connect a Device
          </Link>
        </div>
      </div>
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

      {/* Device Grid Header */}
      <div className="flex justify-between items-end border-b border-white/5 pb-sm mt-margin">
        <h2 className="font-h2 text-on-surface">Device Telemetry Array</h2>
        <span className="font-data-sm text-outline">Showing {devices.length} active nodes</span>
      </div>

      {/* Device Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {devices.length > 0 ? (
          devices.map(deviceId => (
            <DeviceCard key={deviceId} deviceId={deviceId} />
          ))
        ) : (
          <div className="col-span-full py-xl text-center text-outline">No active telemetry streams. Waiting for device data...</div>
        )}
      </div>
    </>
  );
};

export default Dashboard;

