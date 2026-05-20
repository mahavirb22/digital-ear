import React from 'react';

const getHealthColor = (score) => {
  if (score > 80) return 'var(--motor-green)';
  if (score >= 50) return 'var(--motor-yellow)';
  return 'var(--motor-error)';
};

const getStatusLabel = (status, isFailurePredicted) => {
  if (isFailurePredicted) return 'FAILURE PREDICTED';
  if (status === 'critical') return 'CRITICAL';
  if (status === 'warning') return 'WARNING';
  return 'OPERATIONAL';
};

const getMaintenanceMessage = (status, isFailurePredicted) => {
  if (isFailurePredicted) return 'FAILURE IMMINENT — SHUT DOWN RECOMMENDED';
  if (status === 'critical') return 'IMMEDIATE MAINTENANCE REQUIRED';
  if (status === 'warning') return 'Maintenance recommended within 48 hours';
  return 'Next scheduled maintenance: 12 days';
};

const getMaintenanceIcon = (status, isFailurePredicted) => {
  if (isFailurePredicted || status === 'critical') return 'error';
  if (status === 'warning') return 'schedule';
  return 'check_circle';
};

const getMaintenanceColor = (status, isFailurePredicted) => {
  if (isFailurePredicted || status === 'critical') return 'var(--motor-error)';
  if (status === 'warning') return 'var(--motor-tertiary)';
  return 'var(--motor-green)';
};

const HealthRing = ({ score }) => {
  const size = 140;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);

  return (
    <div className="motor-health-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="motor-health-ring__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="motor-health-ring__progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="motor-health-ring__label">
        <span
          className="font-data-lg text-[28px] font-semibold"
          style={{ color, fontFamily: "'JetBrains Mono', monospace" }}
        >
          {score}
        </span>
        <span className="font-label text-[10px] text-outline uppercase tracking-widest mt-0.5">
          Health
        </span>
      </div>
    </div>
  );
};

const StatusPanel = ({ motorData }) => {
  const {
    healthScore,
    status,
    isOverheating,
    isHighVibration,
    isFailurePredicted,
    rawSensorData,
  } = motorData;

  const statusLabel = getStatusLabel(status, isFailurePredicted);
  const maintenanceMsg = getMaintenanceMessage(status, isFailurePredicted);
  const maintenanceIcon = getMaintenanceIcon(status, isFailurePredicted);
  const maintenanceColor = getMaintenanceColor(status, isFailurePredicted);

  const alerts = [];
  if (isOverheating) {
    alerts.push({
      id: 'overheat',
      icon: 'thermostat',
      message: 'Motor temperature exceeding safe threshold',
      color: 'var(--motor-error)',
    });
  }
  if (isHighVibration) {
    alerts.push({
      id: 'vibration',
      icon: 'vibration',
      message: 'Abnormal vibration levels detected',
      color: 'var(--motor-tertiary)',
    });
  }
  if (isFailurePredicted) {
    alerts.push({
      id: 'failure',
      icon: 'warning',
      message: 'Predictive model indicates imminent failure',
      color: 'var(--motor-error)',
    });
  }

  const lastUpdated = rawSensorData
    ? new Date(rawSensorData.timestamp).toLocaleTimeString()
    : '—';

  return (
    <div className="motor-panel" id="motor-status-panel">
      {/* 1. Health Score Ring */}
      <div className="flex flex-col items-center gap-2">
        <span className="font-label text-label text-outline uppercase block mb-1">
          System Health
        </span>
        <HealthRing score={healthScore} />
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* 2. Status Indicator */}
      <div id="motor-status-indicator">
        <span className="font-label text-label text-outline uppercase block mb-2">
          Motor Status
        </span>
        <span
          className={`motor-status-badge motor-status-badge--${status}`}
          style={
            isFailurePredicted
              ? { animation: 'failureBlink 0.8s ease-in-out infinite' }
              : undefined
          }
        >
          {statusLabel}
        </span>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* 3. Sensor Readings Mini-Table */}
      <div id="motor-sensor-readings">
        <span className="font-label text-label text-outline uppercase block mb-2">
          Sensor Readings
        </span>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <span className="font-body-sm text-body-sm text-outline">
              Sound Energy
            </span>
            <span className="font-data-md text-data-md text-on-surface">
              {rawSensorData ? rawSensorData.soundEnergy.toFixed(0) : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body-sm text-body-sm text-outline">
              Frequency
            </span>
            <span className="font-data-md text-data-md text-on-surface">
              {rawSensorData ? `${rawSensorData.frequency.toFixed(0)} Hz` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-body-sm text-body-sm text-outline">
              Current
            </span>
            <span className="font-data-md text-data-md text-on-surface">
              {rawSensorData ? `${rawSensorData.current.toFixed(2)} A` : '—'}
            </span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-white/5">
            <span className="font-body-sm text-body-sm text-outline text-[11px]">
              Last Updated
            </span>
            <span className="font-data-sm text-data-sm text-outline">
              {lastUpdated}
            </span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* 4. Maintenance Prediction */}
      <div id="motor-maintenance-prediction">
        <span className="font-label text-label text-outline uppercase block mb-2">
          Maintenance
        </span>
        <div
          className="flex items-start gap-2 p-3 rounded-lg"
          style={{
            backgroundColor:
              status === 'normal'
                ? 'var(--motor-green-dim)'
                : status === 'warning'
                ? 'var(--motor-tertiary-dim)'
                : 'var(--motor-error-dim)',
            border: `1px solid ${maintenanceColor}33`,
          }}
        >
          <span
            className="material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0"
            style={{ color: maintenanceColor }}
          >
            {maintenanceIcon}
          </span>
          <span
            className="font-body-sm text-[13px] leading-snug"
            style={{ color: maintenanceColor }}
          >
            {maintenanceMsg}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* 5. Alert List */}
      <div id="motor-alert-list">
        <span className="font-label text-label text-outline uppercase block mb-2">
          Active Alerts
        </span>
        {alerts.length > 0 ? (
          <div className="flex flex-col gap-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-2 p-2 rounded-lg"
                style={{
                  backgroundColor: `${alert.color}15`,
                  border: `1px solid ${alert.color}33`,
                }}
              >
                <span
                  className="material-symbols-outlined text-[16px] mt-0.5 flex-shrink-0"
                  style={{ color: alert.color }}
                >
                  {alert.icon}
                </span>
                <span
                  className="font-body-sm text-[12px] leading-snug"
                  style={{ color: alert.color }}
                >
                  {alert.message}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-lg" style={{ backgroundColor: 'var(--motor-green-dim)', border: '1px solid rgba(125,216,125,0.2)' }}>
            <span
              className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--motor-green)' }}
            >
              check_circle
            </span>
            <span
              className="font-body-sm text-[12px]"
              style={{ color: 'var(--motor-green)' }}
            >
              All systems nominal
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatusPanel;
