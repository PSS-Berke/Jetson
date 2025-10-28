'use client';

import { getUtilizationColorVar, formatUtilization } from '@/lib/capacityUtils';

interface CapacityIndicatorProps {
  utilizationPercent: number;
  showPercentage?: boolean;
  showLabel?: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function CapacityIndicator({
  utilizationPercent,
  showPercentage = true,
  showLabel = false,
  label,
  size = 'md',
  className = ''
}: CapacityIndicatorProps) {
  const color = getUtilizationColorVar(utilizationPercent);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && label && (
        <div className={`${textSizeClasses[size]} font-semibold text-[var(--text-dark)] mb-1`}>
          {label}
        </div>
      )}

      <div className="flex items-center gap-3">
        {/* Progress Bar */}
        <div className="flex-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`${sizeClasses[size]} rounded-full transition-all duration-300`}
            style={{
              width: `${Math.min(utilizationPercent, 100)}%`,
              backgroundColor: color
            }}
          />
        </div>

        {/* Percentage Text */}
        {showPercentage && (
          <div
            className={`${textSizeClasses[size]} font-bold min-w-[3rem] text-right`}
            style={{ color }}
          >
            {formatUtilization(utilizationPercent)}
          </div>
        )}
      </div>
    </div>
  );
}
