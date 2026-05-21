import React, { useState, useEffect } from 'react';
import { fetchMachines, createMachine, startCalibration, fetchRegisteredDevices } from '../api';
import toast from 'react-hot-toast';

const CalibrationModal = ({ onClose }) => {
  const [machines, setMachines] = useState([]);
  const [devices, setDevices] = useState([]);
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [newMachineName, setNewMachineName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const CALIBRATION_DURATION = 120; // 120 seconds

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [machinesData, devicesData] = await Promise.all([
        fetchMachines(),
        fetchRegisteredDevices()
      ]);
      setMachines(machinesData);
      setDevices(devicesData);
      if (machinesData.length > 0) setSelectedMachineId(machinesData[0]._id);
      if (devicesData.length > 0) setSelectedDeviceId(devicesData[0].deviceId);
    } catch (error) {
      toast.error('Failed to load data for calibration');
    }
  };

  const handleStart = async () => {
    if (!selectedDeviceId) {
      return toast.error('Please select a device.');
    }

    let machineId = selectedMachineId;

    if (isCreating) {
      if (!newMachineName.trim()) return toast.error('Please enter a machine name.');
      try {
        const newMachine = await createMachine(newMachineName.trim());
        machineId = newMachine._id;
        toast.success(`Machine ${newMachine.name} created!`);
      } catch (err) {
        return toast.error(err.response?.data?.error || 'Failed to create machine');
      }
    } else if (!machineId) {
      return toast.error('Please select a machine.');
    }

    try {
      await startCalibration(machineId, selectedDeviceId, CALIBRATION_DURATION);
      setIsCalibrating(true);
      setTimeLeft(CALIBRATION_DURATION);
      toast.success('Calibration started. Please ensure the machine is running normally.');

      // Start countdown
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setIsCalibrating(false);
            toast.success('Calibration complete!');
            setTimeout(onClose, 1500);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to start calibration');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-panel p-lg rounded-xl w-full min-w-[300px] sm:min-w-[400px] max-w-md shadow-2xl relative border border-primary/20">
        <button 
          onClick={!isCalibrating ? onClose : undefined} 
          className={`absolute top-4 right-4 text-outline hover:text-white transition-colors ${isCalibrating ? 'opacity-50 cursor-not-allowed' : ''}`}
          disabled={isCalibrating}
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <h2 className="font-h2 text-h2 text-on-surface mb-md flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary">precision_manufacturing</span>
          Machine Calibration
        </h2>

        {isCalibrating ? (
          <div className="flex flex-col items-center py-xl">
            <div className="relative flex items-center justify-center w-32 h-32 mb-lg">
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="60" stroke="rgba(255,255,255,0.1)" strokeWidth="4" fill="none" />
                <circle 
                  cx="64" cy="64" r="60" 
                  stroke="var(--motor-primary)" 
                  strokeWidth="4" fill="none" 
                  strokeDasharray="377"
                  strokeDashoffset={377 - (377 * (CALIBRATION_DURATION - timeLeft) / CALIBRATION_DURATION)}
                  className="transition-all duration-1000 linear"
                />
              </svg>
              <span className="font-data-lg text-h1 text-primary">{timeLeft}s</span>
            </div>
            <p className="font-body text-body text-center text-on-surface-variant max-w-xs">
              Gathering normal operational baseline. <br/>
              <span className="text-warning">Please keep the machine running normally.</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="font-body-sm text-body-sm text-outline mb-sm">
              Attach a sensor device to a machine and calibrate it to establish a baseline. Anomaly detection will be tuned to this specific machine's normal state.
            </p>

            {/* Select Device */}
            <div className="flex flex-col gap-xs">
              <label className="font-label text-label uppercase tracking-widest text-on-surface">Sensor Device</label>
              <select 
                value={selectedDeviceId}
                onChange={e => setSelectedDeviceId(e.target.value)}
                className="bg-surface-container-low border border-white/10 rounded-lg p-sm text-on-surface outline-none focus:border-primary"
              >
                {devices.length === 0 && <option value="">No devices found</option>}
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.name || d.deviceId}</option>
                ))}
              </select>
            </div>

            {/* Select/Create Machine */}
            <div className="flex flex-col gap-xs mt-sm">
              <div className="flex justify-between items-end">
                <label className="font-label text-label uppercase tracking-widest text-on-surface">Machine Profile</label>
                <button 
                  type="button" 
                  className="text-[11px] text-primary hover:underline uppercase tracking-widest font-bold"
                  onClick={() => setIsCreating(!isCreating)}
                >
                  {isCreating ? 'Select Existing' : '+ New Machine'}
                </button>
              </div>

              {isCreating ? (
                <input 
                  type="text" 
                  placeholder="e.g., Conveyor Belt Alpha"
                  value={newMachineName}
                  onChange={e => setNewMachineName(e.target.value)}
                  className="bg-surface-container-low border border-white/10 rounded-lg p-sm text-on-surface outline-none focus:border-primary"
                />
              ) : (
                <select 
                  value={selectedMachineId}
                  onChange={e => setSelectedMachineId(e.target.value)}
                  className="bg-surface-container-low border border-white/10 rounded-lg p-sm text-on-surface outline-none focus:border-primary"
                >
                  {machines.length === 0 && <option value="">No machines registered</option>}
                  {machines.map(m => (
                    <option key={m._id} value={m._id}>{m.name} {m.isCalibrated ? '(Calibrated)' : '(Uncalibrated)'}</option>
                  ))}
                </select>
              )}
            </div>

            <button 
              onClick={handleStart}
              className="w-full bg-primary text-on-primary font-label text-label uppercase tracking-widest py-md rounded-lg hover:bg-primary-fixed transition-colors mt-lg flex items-center justify-center gap-xs"
            >
              <span className="material-symbols-outlined text-[18px]">play_circle</span>
              Start 120s Calibration
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalibrationModal;
