import {
  TOTAL_HOURS_PER_DAY,
  calculateDaysDifference,
  timestampToDate,
} from "./dateUtils";
import { getCapacityColor } from "./theme";
import type { Machine } from "@/types";
import type { ParsedJob } from "@/hooks/useJobs";

// Re-export types for backwards compatibility
export type { Machine };

export interface Job {
  id: number;
  job_number: number;
  quantity: number;
  start_date: number;
  due_date: number;
  time_estimate: number | null;
  machines: { id: number; line: number }[];
  total_billing: string;
  requirements?: { price_per_m?: string }[];
  add_on_charges?: string;
}

/**
 * Calculate revenue from requirements.price_per_m if available, otherwise use total_billing
 */
function getJobRevenue(job: Job | ParsedJob): number {
  // Check if job has parsed requirements with price_per_m
  if (
    "requirements" in job &&
    Array.isArray(job.requirements) &&
    job.requirements.length > 0
  ) {
    const revenue = job.requirements.reduce(
      (total: number, req: { price_per_m?: string }) => {
        const pricePerMStr = req.price_per_m;
        const isValidPrice =
          pricePerMStr &&
          pricePerMStr !== "undefined" &&
          pricePerMStr !== "null";
        const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
        return total + (job.quantity / 1000) * pricePerM;
      },
      0,
    );

    // Add add-on charges if available
    const addOnCharges = parseFloat(job.add_on_charges || "0");
    return revenue + addOnCharges;
  }

  // Fallback to total_billing
  return parseFloat(job.total_billing || "0");
}

/**
 * Parse speed_hr string to number (handles various formats)
 */
export const parseSpeedPerHour = (speedHr: string): number => {
  const parsed = parseFloat(speedHr.replace(/[^0-9.]/g, ""));
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Calculate time estimate based on quantity and machine speed
 * Formula: quantity / speed_hr = hours needed
 */
export const calculateTimeEstimate = (
  quantity: number,
  speedHr: string,
): number => {
  const speed = parseSpeedPerHour(speedHr);
  if (speed === 0) return 0;
  return quantity / speed;
};

/**
 * Calculate time estimate for a job with multiple machines
 * Divides the workload across all assigned machines
 */
export const calculateMultiMachineTimeEstimate = (
  quantity: number,
  machines: Machine[],
): number => {
  if (machines.length === 0) return 0;

  // Calculate total speed across all machines
  const totalSpeed = machines.reduce((sum, machine) => {
    return sum + parseSpeedPerHour(String(machine.speed_hr));
  }, 0);

  if (totalSpeed === 0) return 0;

  // Total time is quantity divided by combined speed
  return quantity / totalSpeed;
};

/**
 * Distribute job hours across assigned machines based on their speed
 */
export const distributeHoursAcrossMachines = (
  totalHours: number,
  machines: Machine[],
): Map<number, number> => {
  const hoursPerMachine = new Map<number, number>();

  if (machines.length === 0) return hoursPerMachine;

  // Calculate total speed
  const totalSpeed = machines.reduce((sum, machine) => {
    return sum + parseSpeedPerHour(String(machine.speed_hr));
  }, 0);

  if (totalSpeed === 0) {
    // If no speed data, distribute equally
    const equalHours = totalHours / machines.length;
    machines.forEach((machine) => {
      hoursPerMachine.set(machine.id, equalHours);
    });
    return hoursPerMachine;
  }

  // Distribute hours proportionally based on speed
  machines.forEach((machine) => {
    const machineSpeed = parseSpeedPerHour(String(machine.speed_hr));
    const proportion = machineSpeed / totalSpeed;
    hoursPerMachine.set(machine.id, totalHours * proportion);
  });

  return hoursPerMachine;
};

/**
 * Distribute job hours across date range (start_date to due_date)
 */
export const distributeHoursAcrossDays = (
  totalHours: number,
  startDate: number,
  dueDate: number,
): Map<string, number> => {
  const hoursPerDay = new Map<string, number>();

  const start = timestampToDate(startDate);
  const end = timestampToDate(dueDate);
  const numDays = calculateDaysDifference(start, end);

  if (numDays <= 0) return hoursPerDay;

  const hoursPerDayValue = totalHours / numDays;

  // Create date keys for each day in range
  for (let i = 0; i < numDays; i++) {
    const currentDate = new Date(start);
    currentDate.setDate(start.getDate() + i);
    const dateKey = currentDate.toISOString().split("T")[0];
    hoursPerDay.set(dateKey, hoursPerDayValue);
  }

  return hoursPerDay;
};

/**
 * Calculate daily capacity for a machine
 * Default: 2 shifts × 8 hours = 16 hours per day
 */
export const calculateDailyMachineCapacity = (machine: Machine): number => {
  // Use shiftCapacity if available, otherwise use default
  return machine.shiftCapacity
    ? machine.shiftCapacity * TOTAL_HOURS_PER_DAY
    : TOTAL_HOURS_PER_DAY;
};

/**
 * Calculate utilization percentage
 * Formula: (allocated_hours / available_hours) × 100
 */
export const calculateUtilizationPercent = (
  allocatedHours: number,
  availableHours: number,
): number => {
  if (availableHours === 0) return 0;
  return Math.round((allocatedHours / availableHours) * 100);
};

/**
 * Determine utilization color based on percentage
 * Green: < 50%, Yellow: 50-80%, Red: > 80%
 */
export const getUtilizationColor = (utilizationPercent: number): string => {
  if (utilizationPercent < 50) return "green";
  if (utilizationPercent <= 80) return "yellow";
  return "red";
};

/**
 * Get CSS color variable for utilization
 */
export const getUtilizationColorVar = (utilizationPercent: number): string => {
  // Convert percentage to 0-1 scale for theme function
  const utilization = utilizationPercent / 100;
  return getCapacityColor(utilization);
};

/**
 * Calculate revenue per day for a job
 */
export const calculateDailyRevenue = (
  job: Job | ParsedJob | string,
  startDate?: number,
  dueDate?: number,
): number => {
  let billing: number;
  let start: Date;
  let end: Date;

  // Handle legacy string signature for backwards compatibility
  if (typeof job === "string") {
    billing = parseFloat(job) || 0;
    start = timestampToDate(startDate!);
    end = timestampToDate(dueDate!);
  } else {
    // New signature: calculate from job object
    billing = getJobRevenue(job);
    start = timestampToDate(job.start_date);
    end = timestampToDate(job.due_date);
  }

  const numDays = calculateDaysDifference(start, end);

  if (numDays <= 0) return billing;

  return billing / numDays;
};

/**
 * Calculate pieces per day for a job
 */
export const calculateDailyPieces = (
  totalQuantity: number,
  startDate: number,
  dueDate: number,
): number => {
  const start = timestampToDate(startDate);
  const end = timestampToDate(dueDate);
  const numDays = calculateDaysDifference(start, end);

  if (numDays <= 0) return totalQuantity;

  return Math.round(totalQuantity / numDays);
};

/**
 * Check if a machine is over capacity on a specific day
 */
export const isOverCapacity = (
  allocatedHours: number,
  machineCapacity: number,
): boolean => {
  return allocatedHours > machineCapacity;
};

/**
 * Calculate total capacity across multiple machines
 */
export const calculateTotalCapacity = (machines: Machine[]): number => {
  return machines.reduce((total, machine) => {
    return total + calculateDailyMachineCapacity(machine);
  }, 0);
};

/**
 * Get capacity status text
 */
export const getCapacityStatus = (utilizationPercent: number): string => {
  if (utilizationPercent < 50) return "Low Utilization";
  if (utilizationPercent <= 80) return "Moderate Utilization";
  if (utilizationPercent <= 100) return "High Utilization";
  return "Over Capacity";
};

/**
 * Format hours for display
 */
export const formatHours = (hours: number): string => {
  return `${hours.toFixed(1)}h`;
};

/**
 * Format utilization percentage for display
 */
export const formatUtilization = (percent: number): string => {
  return `${percent}%`;
};
