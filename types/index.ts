/**
 * Centralized type definitions for the Jetson Capacity Planner
 * This file serves as the single source of truth for common types
 */

// ============================================================================
// Machine Types
// ============================================================================

export type MachineStatus =
  | "running"
  | "available"
  | "avalible"
  | "maintenance";

/**
 * Machine category - conveyances are primary machines, ancillary are attachments
 */
export type MachineCategory = "conveyance" | "ancillary";

/**
 * Machine capability values - can be strings, numbers, or arrays of strings
 */
export type MachineCapabilityValue = string | number | string[] | undefined;

/**
 * Machine entity from the API
 * Now supports dynamic, process-specific capabilities
 */
export interface Machine {
  id: number;
  created_at: number;
  line: number;
  name?: string; // Machine name/identifier
  type: string; // Display name (e.g., "Inserter", "Folder")
  process_type_key?: string; // Maps to processTypeConfig keys (insert, fold, laser, etc.)
  facilities_id?: number;
  status: MachineStatus;

  // NEW: Machine categorization and grouping
  machine_category?: MachineCategory; // Whether this is a conveyance or ancillary machine
  machine_group_id?: number; // Optional foreign key to machine_groups table

  // Dynamic capabilities based on process type
  // Examples:
  // - Inserter: { supported_paper_sizes: ['6x9', '9x12'], max_pockets: 6 }
  // - Folder: { supported_fold_types: ['Half Fold', 'Tri-fold'], supported_paper_stocks: ['20# Bond'] }
  capabilities?: {
    [key: string]: MachineCapabilityValue;
  };

  // Performance metrics
  speed_hr: number; // Speed per hour (can be 0 if determined by rules)
  shiftCapacity?: number; // Capacity per shift
  people_per_process?: number; // Number of people required for this machine

  // Legacy fields - kept for backward compatibility
  max_size?: string; // Deprecated - use capabilities.supported_paper_sizes
  pockets?: number; // Deprecated - use capabilities.max_pockets

  // Current job tracking
  currentJob?: {
    number: string;
    name: string;
  };

  // Allow additional dynamic fields
  [key: string]: string | number | boolean | object | undefined;
}

/**
 * Machine Group - for organizing machines with shared rules and configurations
 */
export interface MachineGroup {
  id: number;
  created_at: number;
  updated_at: number;
  name: string; // Group name (e.g., "Inserters with Affixers in Line")
  description?: string; // Optional description
  process_type_key: string; // All machines in group must have same process type
  machine_ids: number[]; // Array of machine IDs in this group
  facilities_id?: number; // Optional - restrict to specific facility
}

// ============================================================================
// Job Types
// ============================================================================

/**
 * Raw job entity from the API
 */
export interface Job {
  id: number;
  created_at: number;
  job_number: number;
  service_type: string;
  quantity: number;
  description: string;
  start_date: number;
  due_date: number;
  time_estimate: number | null;
  clients_id: number;
  machines_id: string;
  requirements: string;
  job_name: string;
  prgm: string;
  csr: string;
  facilities_id?: number;
  price_per_m: string;
  add_on_charges: string;
  ext_price: string;
  total_billing: string;
  client: string;
  sub_client?: string;
  machines: string;
  daily_split?: number[][]; // 2D array: weeks x days (Mon-Sun)
  weekly_split?: number[]; // Array of quantities per week (used in frontend forms)
  locked_weeks?: boolean[]; // Array of booleans indicating which weeks are locked
}

/**
 * Job requirement parsed from the requirements field
 * Supports dynamic fields based on process type configuration
 */
export interface JobRequirement {
  process_type: string; // Required - determines which fields are relevant
  price_per_m?: string;
  // Legacy field - no longer used but kept for backward compatibility
  shifts_id?: number;
  // All other fields are dynamic based on process type
  [key: string]: string | number | undefined;
}

/**
 * Parsed job with additional computed fields
 */
export interface ParsedJob extends Omit<Job, "client" | "machines"> {
  client: {
    id: number;
    name: string;
  } | null;
  machines: { id: number; line: number }[];
  parsedRequirements: JobRequirement[];
}

// ============================================================================
// Client Types
// ============================================================================

export interface Client {
  id: number;
  name: string;
}

// ============================================================================
// User & Auth Types
// ============================================================================

export interface User {
  id: number;
  email: string;
  name?: string;
  role?: string; // "admin" or other roles
  admin?: boolean; // Legacy field, prefer using role === "admin"
  notes_color?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Check if a user is an administrator
 * Handles both the new role-based system (role === "admin") and legacy admin boolean
 */
export const isAdmin = (user: User | null | undefined): boolean => {
  if (!user) return false;
  return user.role === "admin" || user.admin === true || user.admin === "true";
};

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  admin: boolean;
}

export interface AuthResponse {
  authToken: string;
  user?: User;
  [key: string]: string | number | boolean | User | undefined;
}

// ============================================================================
// Facility Types
// ============================================================================

export type FacilityId = 1 | 2;

export interface Facility {
  id: FacilityId;
  name: string;
}

// ============================================================================
// Machine Rules Types
// ============================================================================

/**
 * Operator types for rule conditions
 */
export type RuleOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "between"
  | "in"
  | "not_in";

/**
 * Logic operator for combining conditions
 */
export type LogicOperator = "AND" | "OR";

/**
 * A single condition in a rule
 */
export interface RuleCondition {
  parameter: string; // e.g., 'paper_size', 'pockets', 'fold_type'
  operator: RuleOperator;
  value: string | number | string[] | number[]; // Single value or array for 'in', 'between'
  logic?: LogicOperator; // How to combine with next condition (default: AND)
}

/**
 * Rule outputs that affect machine performance
 */
export interface RuleOutputs {
  speed_modifier: number; // Percentage of base speed (e.g., 80 = 80% of base speed)
  people_required: number; // Can be fractional (e.g., 0.25, 0.5, 0.75, 1, 2, etc.)
  fixed_rate?: number; // Fixed rate value
  notes?: string; // Optional explanation of why this rule affects performance
}

/**
 * Machine rule entity
 * Rules determine how job parameters affect machine speed and staffing requirements
 */
export interface MachineRule {
  id: number;
  created_at: number;
  updated_at: number;

  // Rule identity and scope
  name: string; // Descriptive name (e.g., "Large Envelope Speed Reduction")
  process_type_key: string; // Which process type this applies to (insert, fold, etc.)
  machine_id?: number; // Optional - if set, applies only to specific machine; if null, applies to all machines of this type
  machine_group_id?: number; // NEW: Optional - if set, applies to all machines in this group
  priority: number; // Higher priority rules are evaluated first (for tie-breaking)

  // Rule logic
  conditions: RuleCondition[]; // Array of conditions with AND/OR logic
  outputs: RuleOutputs; // Performance impacts when conditions are met

  // Metadata
  active?: boolean; // Whether this rule is currently active (default: true)
}

/**
 * Result of evaluating rules for a given set of parameters
 */
export interface RuleEvaluationResult {
  matchedRule?: MachineRule; // The rule that was applied (most restrictive)
  calculatedSpeed: number; // Final calculated speed after applying rule
  peopleRequired: number; // Number of people needed
  baseSpeed: number; // Original base speed before rule application
  explanation?: string; // Human-readable explanation of why this speed was chosen
}

// ============================================================================
// Production Tracking Types
// ============================================================================

/**
 * Production entry tracking actual quantities produced
 * Note: Xano uses 'job' field name for the foreign key relationship
 */
export interface ProductionEntry {
  id: number;
  job: number; // Xano's field name for job foreign key
  date: number; // Timestamp for the day/week of production
  actual_quantity: number;
  notes?: string;
  created_at: number;
  updated_at: number;
  facilities_id?: number;
}

/**
 * Comparison between projected and actual production
 */
export interface ProductionComparison {
  job: import("@/hooks/useJobs").ParsedJob;
  projected_quantity: number;
  actual_quantity: number;
  variance: number; // actual - projected
  variance_percentage: number; // (variance / projected) * 100
  entry_ids: number[]; // Array of production entry IDs for this job in the period
  last_updated_at?: number; // Timestamp of most recent production entry for this job
}
