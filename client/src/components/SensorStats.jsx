import React from 'react';
import DashboardCard from './DashboardCard';

const MiniGaugeSvg = ({ value, max = 2000, color }) => {
  const pct = Math.min(value / max, 1);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct * 0.75);

  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="mt-1">
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="3"
        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        transform="rotate(135 22 22)"
      />
      <circle
        cx="22"
        cy="22"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
        strokeDashoffset={offset}
        transform="rotate(135 22 22)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
    </svg>
  );
};

const VibrationBar = ({ level }) => {
  const bars = 5;
  const filledBars = Math.round(level * bars);

  return (
    <div className="flex items-end gap-[3px] h-5 mt-1">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className="w-[4px] rounded-sm transition-all duration-300"
          style={{
            height: `${40 + i * 15}%`,
            backgroundColor:
              i < filledBars
                ? level > 0.5
                  ? 'var(--motor-error)'
                  : 'var(--motor-primary)'
                : 'rgba(255,255,255,0.08)',
          }}
        />
      ))}
    </div>
  );
};

const getTemperatureColor = (temp) => {
  if (temp < 60) return 'var(--motor-green)';
  if (temp <= 85) return 'var(--motor-yellow)';
  return 'var(--motor-error)';
};

const getRpmStatus = (rpm) => {
  if (rpm < 400 || rpm > 2200) return 'critical';
  if (rpm < 800 || rpm > 1800) return 'warning';
  return 'normal';
};

const getTemperatureStatus = (temp) => {
  if (temp > 85) return 'critical';
  if (temp > 60) return 'warning';
  return 'normal';
};

const getVibrationStatus = (vibration) => {
  if (vibration > 0.5) return 'critical';
  return 'normal';
};

const getOverallStatus = (motorStatus) => {
  if (motorStatus === 'critical') return 'critical';
  if (motorStatus === 'warning') return 'warning';
  return 'normal';
};

const SensorStats = ({ motorData }) => {
  const rpmColor =
    getRpmStatus(motorData.rpm) === 'critical' ? 'var(--motor-error)'
    : getRpmStatus(motorData.rpm) === 'warning' ? 'var(--motor-tertiary)'
    : 'var(--motor-primary)';

  return (
    <div className="motor-stats-grid" id="motor-sensor-stats">
      {/* RPM */}
      <DashboardCard
        icon="speed"
        label="RPM"
        value={motorData.rpm}
        unit="RPM"
        status={getRpmStatus(motorData.rpm)}
        formatValue={(v) => Math.round(v).toLocaleString()}
      >
        <MiniGaugeSvg value={motorData.rpm} max={2000} color={rpmColor} />
      </DashboardCard>

      {/* Temperature */}
      <DashboardCard
        icon="thermostat"
        label="Temperature"
        value={motorData.temperature}
        unit="°C"
        status={getTemperatureStatus(motorData.temperature)}
        formatValue={(v) => v.toFixed(1)}
      >
        <div className="w-full h-[4px] rounded-full bg-white/5 mt-1 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(((motorData.temperature - 25) / 95) * 100, 100)}%`,
              backgroundColor: getTemperatureColor(motorData.temperature),
            }}
          />
        </div>
      </DashboardCard>

      {/* Vibration */}
      <DashboardCard
        icon="vibration"
        label="Vibration"
        value={motorData.vibration}
        unit="g"
        status={getVibrationStatus(motorData.vibration)}
        formatValue={(v) => v.toFixed(2)}
      >
        <VibrationBar level={motorData.vibration} />
      </DashboardCard>

      {/* Status */}
      <DashboardCard
        icon="monitor_heart"
        label="Status"
        value={motorData.status}
        status={getOverallStatus(motorData.status)}
        formatValue={(v) => v.toUpperCase()}
      >
        <div className="mt-1">
          <span
            className={`motor-status-badge motor-status-badge--${motorData.status}`}
          >
            {motorData.status.toUpperCase()}
          </span>
        </div>
      </DashboardCard>
    </div>
  );
};

export default SensorStats;
