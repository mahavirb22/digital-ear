import React, { useRef, useEffect, useState } from 'react';

const statusClassMap = {
  normal: '',
  warning: 'motor-card--warning',
  critical: 'motor-card--critical',
};

const trendIcons = {
  up: 'trending_up',
  down: 'trending_down',
  stable: 'trending_flat',
};

const trendColors = {
  up: 'text-[#7dd87d]',
  down: 'text-error',
  stable: 'text-outline',
};

const DashboardCard = ({
  icon,
  label,
  value,
  unit,
  status = 'normal',
  trend,
  formatValue,
  children,
}) => {
  const [flash, setFlash] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (prevValue.current !== value) {
      setFlash(true);
      prevValue.current = value;
      const timer = setTimeout(() => setFlash(false), 400);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const displayValue =
    formatValue ? formatValue(value)
    : typeof value === 'number' ? value.toFixed(1)
    : value;

  const cardClass = `motor-card ${statusClassMap[status] || ''}`;

  return (
    <div className={cardClass} id={`motor-card-${label?.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between mb-3">
        <span
          className="material-symbols-outlined text-[20px]"
          style={{
            color: status === 'critical' ? 'var(--motor-error)'
                 : status === 'warning' ? 'var(--motor-tertiary)'
                 : 'var(--motor-primary)',
          }}
        >
          {icon}
        </span>
        {trend && (
          <span
            className={`material-symbols-outlined text-[16px] ${trendColors[trend]}`}
          >
            {trendIcons[trend]}
          </span>
        )}
      </div>

      <span className="font-label text-label text-outline uppercase block mb-1">
        {label}
      </span>

      <div className="flex items-baseline gap-1">
        <span
          className={`font-data-lg text-data-lg text-on-surface transition-all duration-200 ${
            flash ? 'motor-value-change' : ''
          }`}
        >
          {displayValue}
        </span>
        {unit && (
          <span className="font-data-sm text-data-sm text-outline">
            {unit}
          </span>
        )}
      </div>

      {children && <div className="mt-2">{children}</div>}
    </div>
  );
};

export default DashboardCard;
