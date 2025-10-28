'use client';

import { useMemo } from 'react';
import { ParsedJob } from './useJobs';
import { Machine, MachineCapacityData, DailySummary } from '@/types/calendar';
import { calculateMachineCapacities, calculateDailySummaries } from '@/lib/calendarUtils';

interface UseMachineCapacityProps {
  jobs: ParsedJob[];
  machines: Machine[];
  startDate: Date;
  endDate: Date;
}

interface UseMachineCapacityReturn {
  machineCapacities: Map<number, MachineCapacityData>;
  dailySummaries: Map<string, DailySummary>;
  overallUtilization: number;
  peakUtilization: number;
  peakMachine: Machine | null;
  lowUtilizationMachines: Machine[];
  highUtilizationMachines: Machine[];
}

/**
 * Hook for calculating and managing machine capacity data
 */
export const useMachineCapacity = ({
  jobs,
  machines,
  startDate,
  endDate
}: UseMachineCapacityProps): UseMachineCapacityReturn => {
  // Calculate machine capacities
  const machineCapacities = useMemo(() => {
    return calculateMachineCapacities(jobs, machines, startDate, endDate);
  }, [jobs, machines, startDate, endDate]);

  // Calculate daily summaries
  const dailySummaries = useMemo(() => {
    return calculateDailySummaries(jobs, machines, startDate, endDate);
  }, [jobs, machines, startDate, endDate]);

  // Calculate overall utilization across all machines
  const overallUtilization = useMemo(() => {
    if (machineCapacities.size === 0) return 0;

    let totalUtilization = 0;
    machineCapacities.forEach(capacity => {
      totalUtilization += capacity.averageUtilization;
    });

    return Math.round(totalUtilization / machineCapacities.size);
  }, [machineCapacities]);

  // Find peak utilization and machine
  const { peakUtilization, peakMachine } = useMemo(() => {
    let peak = 0;
    let machine: Machine | null = null;

    machineCapacities.forEach(capacity => {
      if (capacity.peakUtilization > peak) {
        peak = capacity.peakUtilization;
        machine = capacity.machine;
      }
    });

    return { peakUtilization: peak, peakMachine: machine };
  }, [machineCapacities]);

  // Find low utilization machines (< 50%)
  const lowUtilizationMachines = useMemo(() => {
    const machines: Machine[] = [];
    machineCapacities.forEach(capacity => {
      if (capacity.averageUtilization < 50) {
        machines.push(capacity.machine);
      }
    });
    return machines;
  }, [machineCapacities]);

  // Find high utilization machines (> 80%)
  const highUtilizationMachines = useMemo(() => {
    const machines: Machine[] = [];
    machineCapacities.forEach(capacity => {
      if (capacity.averageUtilization > 80) {
        machines.push(capacity.machine);
      }
    });
    return machines;
  }, [machineCapacities]);

  return {
    machineCapacities,
    dailySummaries,
    overallUtilization,
    peakUtilization,
    peakMachine,
    lowUtilizationMachines,
    highUtilizationMachines
  };
};
