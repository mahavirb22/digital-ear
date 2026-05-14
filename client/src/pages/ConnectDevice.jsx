import React, { useState, useEffect } from 'react';
import { fetchRegisteredDevices, registerDevice, removeDevice } from '../api';
import toast from 'react-hot-toast';

const ConnectDevice = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadDevices = async () => {
    try {
      const data = await fetchRegisteredDevices();
      setDevices(data);
    } catch (error) {
      console.error('Failed to fetch devices', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDevices();
    const interval = setInterval(loadDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      toast.error('Device ID is required');
      return;
    }
    setSubmitting(true);
    try {
      await registerDevice(deviceId.trim(), deviceName.trim() || deviceId.trim());
      toast.success(`Device ${deviceId} registered successfully`);
      setDeviceId('');
      setDeviceName('');
      loadDevices();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to register device');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id) => {
    try {
      await removeDevice(id);
      toast.success(`Device ${id} removed`);
      loadDevices();
    } catch (error) {
      toast.error('Failed to remove device');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'anomaly': return 'bg-error animate-pulse';
      case 'offline': default: return 'bg-outline-variant';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'online': return 'ONLINE';
      case 'anomaly': return 'ANOMALY';
      case 'offline': default: return 'OFFLINE';
    }
  };

  const getStatusBorderClass = (status) => {
    switch (status) {
      case 'online': return 'border-green-500/30';
      case 'anomaly': return 'border-error/50 pulse-danger';
      case 'offline': default: return '';
    }
  };

  return (
    <div className="max-w-[900px] mx-auto w-full">
      <div className="mb-margin">
        <h1 className="font-h1 text-h1 text-on-surface mb-xs">Device Management</h1>
        <p className="font-body text-body text-on-surface-variant">Register and monitor your ESP32 sensor nodes.</p>
      </div>

      {/* Register Form */}
      <div className="glass-panel rounded-xl p-lg mb-lg">
        <h2 className="font-h2 text-h2 text-on-surface mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">add_circle</span>
          Register New Device
        </h2>
        <form onSubmit={handleRegister} className="flex flex-col sm:flex-row gap-md">
          <div className="flex flex-col gap-xs flex-1">
            <label className="font-label text-label text-on-surface uppercase tracking-widest">Device ID</label>
            <input
              type="text"
              required
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              placeholder="e.g. ESP32-01"
              className="bg-surface-container-low border border-white/10 rounded-lg px-md py-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-body"
            />
          </div>
          <div className="flex flex-col gap-xs flex-1">
            <label className="font-label text-label text-on-surface uppercase tracking-widest">Device Name (Optional)</label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Motor Bay A"
              className="bg-surface-container-low border border-white/10 rounded-lg px-md py-sm text-on-surface focus:outline-none focus:border-primary transition-colors font-body"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="bg-primary text-on-primary font-label text-label uppercase tracking-widest px-lg py-sm rounded-lg hover:bg-primary-fixed transition-all hover:shadow-[0_0_10px_rgba(173,198,255,0.5)] whitespace-nowrap disabled:opacity-50"
            >
              {submitting ? 'Registering...' : 'Register'}
            </button>
          </div>
        </form>
      </div>

      {/* Registered Devices List */}
      <div className="glass-panel rounded-xl overflow-hidden">
        <div className="p-md border-b border-white/5 bg-surface-container-low flex justify-between items-center">
          <h2 className="font-h2 text-h2 text-on-surface">Registered Devices</h2>
          <span className="font-data-sm text-outline">{devices.length} device{devices.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex flex-col">
          {loading ? (
            <>
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-md border-b border-white/5">
                  <div className="flex items-center gap-md">
                    <div className="skeleton h-3 w-3 rounded-full"></div>
                    <div className="flex flex-col gap-xs">
                      <div className="skeleton h-4 w-28"></div>
                      <div className="skeleton h-3 w-20"></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-lg">
                    <div className="flex flex-col items-end gap-xs">
                      <div className="skeleton h-3 w-16"></div>
                      <div className="skeleton h-2 w-24"></div>
                    </div>
                    <div className="skeleton h-5 w-5 rounded"></div>
                  </div>
                </div>
              ))}
            </>
          ) : devices.length > 0 ? (
            devices.map(device => (
              <div key={device.deviceId} className={`flex flex-col sm:flex-row sm:items-center justify-between p-md border-b border-white/5 hover:bg-white/5 transition-colors gap-3 sm:gap-0 ${getStatusBorderClass(device.status)}`}>
                <div className="flex items-center gap-md">
                  <span className={`w-3 h-3 rounded-full ${getStatusColor(device.status)}`}></span>
                  <div>
                    <div className="font-data-md text-data-md text-on-surface break-all">{device.name || device.deviceId}</div>
                    <div className="font-data-sm text-data-sm text-outline break-all">{device.deviceId}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-lg w-full sm:w-auto">
                  <div className="text-left sm:text-right">
                    <div className={`font-label text-label uppercase tracking-widest ${
                      device.status === 'online' ? 'text-green-400' : 
                      device.status === 'anomaly' ? 'text-error' : 'text-outline-variant'
                    }`}>
                      {getStatusLabel(device.status)}
                    </div>
                    <div className="font-data-sm text-data-sm text-outline">
                      {device.lastSeen ? `Last: ${new Date(device.lastSeen).toLocaleTimeString()}` : 'Never connected'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemove(device.deviceId)}
                    className="text-outline-variant hover:text-error transition-colors p-sm"
                    title="Remove device"
                  >
                    <span className="material-symbols-outlined text-[20px]">delete</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-surface-container-highest mb-md" style={{ fontVariationSettings: "'wght' 200" }}>sensors_off</span>
              <h3 className="font-h2 text-h2 text-on-surface mb-xs">No Devices Registered</h3>
              <p className="font-body text-body text-on-surface-variant max-w-[400px] mx-auto">
                Register your ESP32 device above to start monitoring. The device ID must match the ID configured in your Arduino sketch.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConnectDevice;
