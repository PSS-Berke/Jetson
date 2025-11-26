/**
 * Machine Matching Engine
 *
 * Intelligent capacity-based matching system that compares job requirements
 * against machine capabilities to recommend the best machines for a job.
 */

import type { Machine, MachineCapabilityValue } from "@/types";
import { calculateTimeEstimate, calculateUtilizationPercent } from "./capacityUtils";
import { evaluateRulesForMachineObject } from "./rulesEngine";

// ============================================================================
// TYPES
// ============================================================================

export interface MatchingCriteria {
  processType: string;
  jobRequirements: Record<string, any>;
  quantity: number;
  startDate: number; // Unix timestamp
  dueDate: number; // Unix timestamp
  facilityId?: number;
}

export interface MachineMatch {
  machine: Machine;
  matchScore: number; // 0-100
  canHandle: boolean; // Whether machine meets all requirements
  matchReasons: string[]; // Why this machine matches (or doesn't)
  estimatedHours: number; // How long this job would take
  currentUtilization: number; // Current capacity usage (0-100%)
  speedWithModifiers: number; // Adjusted speed after rules
  staffingRequired: number; // People needed
}

export interface MachineAvailability {
  machineId: number;
  date: string; // YYYY-MM-DD
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  assignedJobIds: number[];
}

export interface CapabilityMatch {
  parameter: string; // e.g., "paper_size"
  required: any; // Job requirement value
  machineCapability: any; // Machine capability value
  matches: boolean;
  reason: string;
}

// ============================================================================
// CAPABILITY MATCHING LOGIC
// ============================================================================

/**
 * Check if a single requirement matches a machine capability
 */
export function matchCapability(
  parameter: string,
  requiredValue: any,
  machineCapabilities: Record<string, MachineCapabilityValue>
): CapabilityMatch {
  // If machine has no capabilities defined, it can't match anything
  if (!machineCapabilities || Object.keys(machineCapabilities).length === 0) {
    return {
      parameter,
      required: requiredValue,
      machineCapability: undefined,
      matches: false,
      reason: `Machine has no ${parameter} capability defined`,
    };
  }

  // Common capability patterns and their matching logic
  const capabilityKey = findCapabilityKey(parameter, machineCapabilities);

  if (!capabilityKey) {
    // No matching capability found
    return {
      parameter,
      required: requiredValue,
      machineCapability: undefined,
      matches: false,
      reason: `Machine has no ${parameter} capability defined`,
    };
  }

  const machineValue = machineCapabilities[capabilityKey];

  // Handle different types of matching
  if (Array.isArray(machineValue)) {
    // Machine supports multiple options (e.g., supported_paper_sizes: ["6x9", "9x12"])
    const matches = machineValue.includes(requiredValue);
    return {
      parameter,
      required: requiredValue,
      machineCapability: machineValue,
      matches,
      reason: matches
        ? `✓ Machine supports ${parameter}: ${requiredValue}`
        : `✗ Machine doesn't support ${parameter}: ${requiredValue} (supports: ${machineValue.join(", ")})`,
    };
  }

  if (typeof machineValue === "object" && machineValue !== null) {
    // Range matching (e.g., { min: 2, max: 6 } for pockets)
    const range = machineValue as { min?: number; max?: number };
    if (range.min !== undefined || range.max !== undefined) {
      const numericValue = typeof requiredValue === "number" ? requiredValue : parseFloat(requiredValue);
      if (isNaN(numericValue)) {
        return {
          parameter,
          required: requiredValue,
          machineCapability: machineValue,
          matches: false,
          reason: `✗ Cannot compare non-numeric value ${requiredValue} to range`,
        };
      }

      const matchesMin = range.min === undefined || numericValue >= range.min;
      const matchesMax = range.max === undefined || numericValue <= range.max;
      const matches = matchesMin && matchesMax;

      return {
        parameter,
        required: requiredValue,
        machineCapability: machineValue,
        matches,
        reason: matches
          ? `✓ ${requiredValue} is within machine range [${range.min ?? "-∞"} to ${range.max ?? "∞"}]`
          : `✗ ${requiredValue} is outside machine range [${range.min ?? "-∞"} to ${range.max ?? "∞"}]`,
      };
    }
  }

  if (typeof machineValue === "boolean") {
    // Boolean capability (e.g., affix_capable: true)
    const matches = machineValue === true && (requiredValue === true || requiredValue === "true" || requiredValue === 1);
    return {
      parameter,
      required: requiredValue,
      machineCapability: machineValue,
      matches,
      reason: matches
        ? `✓ Machine has ${parameter} capability`
        : `✗ Machine doesn't have ${parameter} capability`,
    };
  }

  // Direct value comparison
  const matches = String(machineValue).toLowerCase() === String(requiredValue).toLowerCase();
  return {
    parameter,
    required: requiredValue,
    machineCapability: machineValue,
    matches,
    reason: matches
      ? `✓ Machine ${parameter} matches: ${requiredValue}`
      : `✗ Machine ${parameter} is ${machineValue}, required ${requiredValue}`,
  };
}

/**
 * Find the capability key in machine capabilities that matches the parameter
 * Handles various naming conventions (paper_size, supported_paper_sizes, paperSize, etc.)
 */
function findCapabilityKey(
  parameter: string,
  capabilities: Record<string, MachineCapabilityValue>
): string | null {
  // Direct match
  if (capabilities[parameter] !== undefined) {
    return parameter;
  }

  // Try common variations
  const variations = [
    parameter,
    `supported_${parameter}`,
    `supported_${parameter}s`,
    `${parameter}_range`,
    `min_${parameter}`,
    `max_${parameter}`,
    `${parameter}_capable`,
    parameter.replace(/_/g, ""), // Remove underscores
    parameter.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()), // camelCase
  ];

  for (const variation of variations) {
    if (capabilities[variation] !== undefined) {
      return variation;
    }
  }

  // Check for min/max range pattern
  if (capabilities[`min_${parameter}`] !== undefined || capabilities[`max_${parameter}`] !== undefined) {
    // Return a virtual key that we'll handle specially
    return `${parameter}_range`;
  }

  return null;
}

/**
 * Match all job requirements against a machine's capabilities
 */
export function matchJobRequirementsToMachine(
  jobRequirements: Record<string, any>,
  machine: Machine,
  processType: string
): {
  canHandle: boolean;
  matches: CapabilityMatch[];
  score: number; // 0-100 based on how well it matches
} {
  const matches: CapabilityMatch[] = [];
  let totalRequirements = 0;
  let metRequirements = 0;

  // Check process type match first
  if (machine.process_type_key !== processType) {
    return {
      canHandle: false,
      matches: [
        {
          parameter: "process_type",
          required: processType,
          machineCapability: machine.process_type_key,
          matches: false,
          reason: `✗ Machine process type (${machine.process_type_key}) doesn't match job requirement (${processType})`,
        },
      ],
      score: 0,
    };
  }

  // Iterate through all job requirements and check against machine capabilities
  for (const [parameter, requiredValue] of Object.entries(jobRequirements)) {
    // Skip metadata fields that aren't capability requirements
    if (["process_type", "id", "job_id", "created_at"].includes(parameter)) {
      continue;
    }

    // Skip empty/null values
    if (requiredValue === null || requiredValue === undefined || requiredValue === "") {
      continue;
    }

    totalRequirements++;
    const match = matchCapability(parameter, requiredValue, machine.capabilities || {});
    matches.push(match);

    if (match.matches) {
      metRequirements++;
    }
  }

  // Calculate score (0-100)
  const canHandle = totalRequirements === 0 ? true : metRequirements === totalRequirements;
  const score = totalRequirements === 0 ? 50 : Math.round((metRequirements / totalRequirements) * 100);

  return {
    canHandle,
    matches,
    score,
  };
}

// ============================================================================
// AVAILABILITY CALCULATION
// ============================================================================

/**
 * Calculate machine availability for a date range
 * This is a placeholder - in production, you'd query the database for assigned jobs
 */
export async function calculateMachineAvailability(
  machineId: number,
  startDate: number,
  dueDate: number,
  assignedJobs?: Array<{ machines_id: number[]; start_date: number; due_date: number; quantity: number; }>
): Promise<number> {
  // Default capacity: 16 hours/day (2 shifts × 8 hours)
  const hoursPerDay = 16;

  // Calculate number of days in the job window
  const days = Math.ceil((dueDate - startDate) / (1000 * 60 * 60 * 24));
  const totalAvailableHours = days * hoursPerDay;

  // If no job data provided, assume machine is available
  if (!assignedJobs || assignedJobs.length === 0) {
    return totalAvailableHours;
  }

  // Calculate allocated hours from existing jobs
  let allocatedHours = 0;
  for (const job of assignedJobs) {
    // Check if this job is assigned to this machine
    if (!job.machines_id.includes(machineId)) {
      continue;
    }

    // Check if job overlaps with our date range
    const jobStart = job.start_date;
    const jobEnd = job.due_date;

    if (jobEnd < startDate || jobStart > dueDate) {
      // No overlap
      continue;
    }

    // Calculate overlap period
    const overlapStart = Math.max(jobStart, startDate);
    const overlapEnd = Math.min(jobEnd, dueDate);
    const overlapDays = Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24));

    // Estimate hours (this is simplified - in reality you'd calculate from job requirements)
    const estimatedJobHours = overlapDays * 8; // Assume 8 hours per day
    allocatedHours += estimatedJobHours;
  }

  return Math.max(0, totalAvailableHours - allocatedHours);
}

/**
 * Calculate current utilization percentage
 */
export function calculateCurrentUtilization(
  allocatedHours: number,
  availableHours: number
): number {
  if (availableHours === 0) return 100;
  return Math.min(100, Math.round((allocatedHours / availableHours) * 100));
}

// ============================================================================
// MACHINE RANKING & SCORING
// ============================================================================

/**
 * Score a machine based on multiple factors
 */
function scoreMachine(
  machine: Machine,
  matchResult: { canHandle: boolean; matches: CapabilityMatch[]; score: number },
  utilizationPercent: number,
  estimatedHours: number
): number {
  // Capability match score (40 points max)
  const capabilityScore = (matchResult.score / 100) * 40;

  // Utilization score (30 points max) - lower utilization = higher score
  const utilizationScore = Math.max(0, 30 - (utilizationPercent / 100) * 30);

  // Speed/efficiency score (30 points max)
  // Machines with higher speed get higher scores
  const maxSpeed = 10000; // Reasonable max speed for normalization
  const speedScore = Math.min(30, (machine.speed_hr / maxSpeed) * 30);

  const totalScore = capabilityScore + utilizationScore + speedScore;

  return Math.round(totalScore);
}

/**
 * Find matching machines for a job and rank them
 */
export async function findMatchingMachines(
  criteria: MatchingCriteria,
  availableMachines: Machine[],
  existingJobs?: Array<{ machines_id: number[]; start_date: number; due_date: number; quantity: number; }>
): Promise<MachineMatch[]> {
  const matches: MachineMatch[] = [];

  for (const machine of availableMachines) {
    // Filter by process type
    if (machine.process_type_key !== criteria.processType) {
      continue;
    }

    // Filter by facility if specified
    if (criteria.facilityId && machine.facilities_id !== criteria.facilityId) {
      continue;
    }

    // Check capability matching
    const matchResult = matchJobRequirementsToMachine(
      criteria.jobRequirements,
      machine,
      criteria.processType
    );

    // Calculate estimated hours using rules engine for accurate speed
    const ruleResult = await evaluateRulesForMachineObject(
      machine,
      criteria.jobRequirements
    );

    const effectiveSpeed = ruleResult.calculatedSpeed;
    const estimatedHours = calculateTimeEstimate(criteria.quantity, effectiveSpeed.toString());

    // Calculate availability
    const availableHours = await calculateMachineAvailability(
      machine.id,
      criteria.startDate,
      criteria.dueDate,
      existingJobs
    );

    const totalHours = Math.ceil((criteria.dueDate - criteria.startDate) / (1000 * 60 * 60 * 24)) * 16;
    const allocatedHours = totalHours - availableHours;
    const currentUtilization = calculateCurrentUtilization(allocatedHours, totalHours);

    // Score the machine
    const matchScore = scoreMachine(machine, matchResult, currentUtilization, estimatedHours);

    // Build human-readable reasons
    const matchReasons: string[] = [];

    if (!matchResult.canHandle) {
      matchReasons.push("❌ Cannot handle job:");
      matchResult.matches.forEach(m => {
        if (!m.matches) {
          matchReasons.push(`  ${m.reason}`);
        }
      });
    } else {
      matchReasons.push("✅ Can handle job:");
      matchResult.matches.forEach(m => {
        matchReasons.push(`  ${m.reason}`);
      });
    }

    matchReasons.push(`📊 Current utilization: ${currentUtilization}%`);
    matchReasons.push(`⏱️  Estimated time: ${estimatedHours.toFixed(1)} hours`);
    matchReasons.push(`⚡ Speed: ${effectiveSpeed} units/hr (${ruleResult.matchedRule ? "with rule modifiers" : "base speed"})`);
    matchReasons.push(`👥 Staffing: ${ruleResult.peopleRequired} ${ruleResult.peopleRequired === 1 ? "person" : "people"}`);

    matches.push({
      machine,
      matchScore,
      canHandle: matchResult.canHandle,
      matchReasons,
      estimatedHours,
      currentUtilization,
      speedWithModifiers: effectiveSpeed,
      staffingRequired: ruleResult.peopleRequired,
    });
  }

  // Sort by score (highest first), then by canHandle status
  return matches.sort((a, b) => {
    // Prioritize machines that can handle the job
    if (a.canHandle && !b.canHandle) return -1;
    if (!a.canHandle && b.canHandle) return 1;

    // Then sort by score
    return b.matchScore - a.matchScore;
  });
}

/**
 * Get the single best machine for a job
 */
export async function findBestMachine(
  criteria: MatchingCriteria,
  availableMachines: Machine[],
  existingJobs?: Array<{ machines_id: number[]; start_date: number; due_date: number; quantity: number; }>
): Promise<MachineMatch | null> {
  const matches = await findMatchingMachines(criteria, availableMachines, existingJobs);

  // Return the top match that can actually handle the job
  const bestMatch = matches.find(m => m.canHandle);
  return bestMatch || null;
}

/**
 * Check if a specific machine can handle a job
 */
export function canMachineHandleJob(
  machine: Machine,
  processType: string,
  jobRequirements: Record<string, any>
): { canHandle: boolean; reasons: string[] } {
  const matchResult = matchJobRequirementsToMachine(
    jobRequirements,
    machine,
    processType
  );

  const reasons = matchResult.matches.map(m => m.reason);

  return {
    canHandle: matchResult.canHandle,
    reasons,
  };
}
