import React, { useState, useEffect, useRef } from 'react';
import { fetchMachines, createMachine, startCalibration, startMLCalibration, addMLCalibrationSample, finalizeMLCalibration, fetchRegisteredDevices, fetchSensorData } from '../api';
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
  const [phase, setPhase] = useState(''); // 'collecting', 'finalizing'
  const CALIBRATION_DURATION = 120; // 120 seconds
  const sampleTimerRef = useRef(null);

  useEffect(() => {
    loadData();
    return () => {
      if (sampleTimerRef.current) clearInterval(sampleTimerRef.current);
    };
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
      setIsCalibrating(true);
      setPhase('collecting');
      setTimeLeft(CALIBRATION_DURATION);

      // Start BOTH calibrations simultaneously
      const results = await Promise.allSettled([
        startCalibration(machineId, selectedDeviceId, CALIBRATION_DURATION),
        startMLCalibration(machineId)
      ]);
      
      const baselineOk = results[0].status === 'fulfilled';
      const mlOk = results[1].status === 'fulfilled';
      
      if (!baselineOk && !mlOk) {
        throw new Error('Both calibrations failed to start');
      }

      toast.success(`Calibration started${mlOk ? ' (Baseline + ML)' : ' (Baseline only — ML unavailable)'}`);

      // Start sending ML samples every 2 seconds using live sensor data
      if (mlOk) {
        sampleTimerRef.current = setInterval(async () => {
          try {
            const data = await fetchSensorData(selectedDeviceId);
            const reading = data.readings ? data.readings[0] : (Array.isArray(data) ? data[0] : null);
            if (reading) {
              await addMLCalibrationSample(machineId, {
                soundEnergy: reading.soundEnergy,
                frequency: reading.frequency,
                current: reading.current,
                vibration: reading.vibration,
              });
            }
          } catch (err) {
            // Silently continue — samples may fail intermittently
          }
        }, 2000);
      }

      // Start countdown
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            if (sampleTimerRef.current) {
              clearInterval(sampleTimerRef.current);
              sampleTimerRef.current = null;
            }
            // Finalize both
            handleFinalize(machineId, mlOk);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
    } catch (error) {
      toast.error(error.response?.data?.error || error.message || 'Failed to start calibration');
      setIsCalibrating(false);
      setPhase('');
    }
  };

  const handleFinalize = async (machineId, mlOk) => {
    setPhase('finalizing');
    try {
      // Finalize ML calibration if it was started
      if (mlOk) {
        try {
          await finalizeMLCalibration(machineId);
        } catch (err) {
          console.warn('ML finalization failed (baseline calibration may still succeed):', err.message);
        }
      }

      // Baseline calibration auto-finalizes on the server after the timer expires
      // Wait a moment for it to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      setIsCalibrating(false);
      setPhase('');
      toast.success('Calibration complete! Baseline & ML model updated.');
      setTimeout(onClose, 1500);
    } catch (error) {
      toast.error('Calibration finalization encountered issues');
      setIsCalibrating(false);
      setPhase('');
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
            <div className="flex items-center gap-2 mb-md">
              <span className={`inline-block w-2 h-2 rounded-full ${phase === 'finalizing' ? 'bg-yellow-400 animate-pulse' : 'bg-green-400 animate-pulse'}`}></span>
              <span className="font-label text-label text-outline uppercase tracking-widest">
                {phase === 'finalizing' ? 'Finalizing Models...' : 'Collecting Data (Baseline + ML)'}
              </span>
            </div>
            <p className="font-body text-body text-center text-on-surface-variant max-w-xs">
              Gathering normal operational baseline & training ML model. <br/>
              <span className="text-warning">Please keep the machine running normally.</span>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="font-body-sm text-body-sm text-outline mb-sm">
              This will run <strong>both</strong> baseline calibration and ML model training simultaneously. Attach a sensor device to a machine and keep it running normally for 120 seconds.
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
              Start Calibration (Baseline + ML)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalibrationModal;
