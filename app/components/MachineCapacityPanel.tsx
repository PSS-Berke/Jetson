'use client';

import { useState } from 'react';
import { MachineCapacityData } from '@/types/calendar';
import CapacityIndicator from './CapacityIndicator';
import { getCapacityStatus } from '@/lib/capacityUtils';

interface MachineCapacityPanelProps {
  machineCapacities: Map<number, MachineCapacityData>;
  onMachineClick?: (machineId: number) => void;
  selectedMachineIds?: number[];
}

export default function MachineCapacityPanel({
  machineCapacities,
  onMachineClick,
  selectedMachineIds = []
}: MachineCapacityPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const capacitiesArray = Array.from(machineCapacities.values());

  // Sort by utilization (highest first)
  const sortedCapacities = capacitiesArray.sort(
    (a, b) => b.averageUtilization - a.averageUtilization
  );

  return (
    <div className="bg-white rounded-lg border border-[var(--border)] shadow-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <h3 className="text-lg font-semibold text-[var(--dark-blue)]">
          Machine Capacity
        </h3>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-[var(--text-light)] hover:text-[var(--text-dark)] text-xl"
        >
          {isCollapsed ? '+' : '−'}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-4">
          {sortedCapacities.length === 0 ? (
            <p className="text-center text-[var(--text-light)] py-8">
              No machine data available
            </p>
          ) : (
            <div className="space-y-4">
              {sortedCapacities.map(capacity => {
                const isSelected = selectedMachineIds.includes(capacity.machine.id);

                return (
                  <div
                    key={capacity.machine.id}
                    onClick={() => onMachineClick?.(capacity.machine.id)}
                    className={`p-4 rounded-lg border transition-all ${
                      onMachineClick ? 'cursor-pointer hover:shadow-md' : ''
                    } ${
                      isSelected
                        ? 'border-[var(--primary-blue)] bg-blue-50'
                        : 'border-[var(--border)] hover:border-[var(--primary-blue)]'
                    }`}
                  >
                    {/* Machine Info */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-[var(--text-dark)]">
                          Line {capacity.machine.line}
                        </h4>
                        <p className="text-sm text-[var(--text-light)]">
                          {capacity.machine.type}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          capacity.machine.status === 'running'
                            ? 'bg-green-100 text-green-800'
                            : capacity.machine.status === 'available' ||
                              capacity.machine.status === 'avalible'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {capacity.machine.status}
                      </span>
                    </div>

                    {/* Capacity Indicator */}
                    <CapacityIndicator
                      utilizationPercent={capacity.averageUtilization}
                      size="md"
                      showPercentage={true}
                      className="mb-3"
                    />

                    {/* Capacity Status */}
                    <div className="text-xs text-[var(--text-light)] space-y-1">
                      <p>{getCapacityStatus(capacity.averageUtilization)}</p>
                      {capacity.peakUtilization > 0 && (
                        <p>
                          Peak: {capacity.peakUtilization}%
                          {capacity.peakDate && (
                            <span className="ml-1">
                              ({new Date(capacity.peakDate).toLocaleDateString()})
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {/* Additional Machine Details */}
                    {capacity.machine.max_size && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <p className="text-xs text-[var(--text-light)]">
                          Max Size: {capacity.machine.max_size}
                        </p>
                        {capacity.machine.speed_hr && (
                          <p className="text-xs text-[var(--text-light)]">
                            Speed: {capacity.machine.speed_hr}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
