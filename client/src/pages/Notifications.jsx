import React, { useState, useEffect } from 'react';
import useNotifications from '../hooks/useNotifications';
import { acknowledgeNotification, fetchMachines } from '../api';
import toast from 'react-hot-toast';

const Notifications = () => {
  const { notifications, loading } = useNotifications();
  const [machines, setMachines] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedMachineFilter, setSelectedMachineFilter] = useState('all');

  useEffect(() => {
    const loadMachines = async () => {
      try {
        const data = await fetchMachines();
        setMachines(data);
      } catch (error) {
        console.error('Failed to fetch machines for filtering', error);
      }
    };
    loadMachines();
  }, []);

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeNotification(id);
      toast.success('Alert acknowledged');
    } catch (error) {
      toast.error('Failed to acknowledge alert');
    }
  };

  const getMachineName = (deviceId) => {
    const machine = machines.find(m => m.deviceAttached && m.deviceAttached.deviceId === deviceId);
    return machine ? machine.name : null;
  };

  const filteredNotifications = notifications.filter(notif => {
    // 1. Status Filter
    if (filter === 'unread' && notif.acknowledged) return false;
    if (filter === 'critical' && notif.severity !== 'critical') return false;
    if (filter === 'warning' && notif.severity !== 'warning') return false;

    // 2. Machine Filter
    if (selectedMachineFilter !== 'all') {
      if (selectedMachineFilter === 'unassigned') {
        const hasMachine = machines.some(m => m.deviceAttached?.deviceId === notif.deviceId);
        if (hasMachine) return false;
      } else {
        if (notif.deviceId !== selectedMachineFilter) return false;
      }
    }
    return true;
  });

  return (
    <div className="max-w-[1400px] mx-auto w-full">
      <div className="mb-margin">
        <h1 className="font-h1 text-h1 text-on-surface mb-xs">Alerts Log</h1>
        <p className="font-body text-body text-on-surface-variant">Real-time acoustic event telemetry.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-gutter mb-lg">
        {/* Severity Filter Tabs */}
        <div className="lg:col-span-2 flex flex-col gap-xs">
          <span className="font-label text-label uppercase tracking-widest text-outline text-[10px]">Filter by Status</span>
          <div className="flex gap-sm pb-xs overflow-x-auto no-scrollbar">
            {['all', 'unread', 'critical', 'warning'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-md py-sm rounded-DEFAULT font-label text-label uppercase tracking-widest border transition-colors whitespace-nowrap ${
                  filter === f 
                  ? 'bg-primary-container text-on-primary-container border-transparent' 
                  : 'bg-transparent text-on-surface-variant hover:text-on-surface hover:bg-white/5 border-white/10'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Machine Filter Dropdown */}
        <div className="lg:col-span-2 flex flex-col gap-xs">
          <span className="font-label text-label uppercase tracking-widest text-outline text-[10px]">Filter by Machine</span>
          <select
            value={selectedMachineFilter}
            onChange={(e) => setSelectedMachineFilter(e.target.value)}
            className="bg-surface-container-low border border-white/10 rounded-lg p-sm text-on-surface outline-none focus:border-primary w-full h-[38px] text-body-sm"
          >
            <option value="all">All Machines & Devices</option>
            {machines.map(m => (
              <option key={m._id} value={m.deviceAttached?.deviceId || 'none'} disabled={!m.deviceAttached}>
                {m.name} {m.deviceAttached ? `(${m.deviceAttached.deviceId})` : '(No Sensor)'}
              </option>
            ))}
            <option value="unassigned">Unassigned Telemetry</option>
          </select>
        </div>
      </div>

      {/* Notifications Feed */}
      <div className="flex flex-col gap-sm">
        {loading && notifications.length === 0 ? (
          <>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="glass-panel rounded-lg p-md flex items-start gap-md border-l-4 border-l-white/5">
                <div className="skeleton h-6 w-6 rounded-full flex-shrink-0 mt-xs"></div>
                <div className="flex-1 min-w-0 flex flex-col gap-sm">
                  <div className="flex items-center gap-sm">
                    <div className="skeleton h-5 w-20 rounded"></div>
                    <div className="skeleton h-3 w-32"></div>
                  </div>
                  <div className="skeleton h-4 w-full max-w-[400px]"></div>
                  <div className="skeleton h-3 w-48"></div>
                </div>
                <div className="skeleton h-8 w-28 rounded flex-shrink-0 ml-auto"></div>
              </div>
            ))}
          </>
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map(notif => {
            const machineName = getMachineName(notif.deviceId);
            return (
              <div 
                key={notif._id} 
                className={`glass-panel rounded-lg p-md flex flex-col sm:flex-row sm:items-start gap-md group hover:bg-white/5 transition-colors border-l-4 ${
                  notif.severity === 'critical' ? 'border-l-error' : 'border-l-tertiary'
                } ${notif.acknowledged ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-md w-full">
                  <div className="flex-shrink-0 pt-xs">
                    <span className={`material-symbols-outlined ${
                      notif.severity === 'critical' ? 'text-error pulse-danger' : 'text-tertiary pulse-warning'
                    }`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {notif.severity === 'critical' ? 'error' : 'warning'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-sm mb-xs flex-wrap">
                      <span className="font-data-sm text-data-sm text-primary px-sm py-xs bg-surface-container-high rounded border border-white/10 uppercase tracking-wider">
                        {machineName ? `${machineName} (${notif.deviceId})` : `Device: ${notif.deviceId}`}
                      </span>
                      <span className="font-data-sm text-data-sm text-outline-variant whitespace-nowrap">
                        {new Date(notif.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="font-body-sm text-body-sm text-on-surface leading-snug">{notif.message}</p>
                  </div>
                </div>
                {!notif.acknowledged && (
                  <div className="w-full sm:w-auto flex-shrink-0 sm:ml-auto pt-2 sm:pt-sm">
                    <button 
                      onClick={() => handleAcknowledge(notif._id)}
                      className="w-full sm:w-auto px-md py-sm rounded-DEFAULT bg-primary text-on-primary font-label text-label uppercase tracking-widest hover:bg-primary-fixed transition-all hover:shadow-[0_0_10px_rgba(173,198,255,0.5)]"
                    >
                      Acknowledge
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-xl text-center glass-panel rounded-xl mt-lg border-dashed">
            <span className="material-symbols-outlined text-[64px] text-surface-container-highest mb-margin" style={{ fontVariationSettings: "'wght' 200" }}>done_all</span>
            <h3 className="font-h2 text-h2 text-on-surface mb-xs">Telemetry Nominal</h3>
            <p className="font-body text-body text-on-surface-variant max-w-[450px] mx-auto">All monitoring stations are reporting normal parameters. No active alerts for the selected filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
