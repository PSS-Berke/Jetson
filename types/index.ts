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
export type MachineCapabilityValue = string | number | string[] | boolean | undefined;

// ============================================================================
// Typed Capability Interfaces for Each Process Type
// ============================================================================

/**
 * Base interface for all machine capabilities
 */
export interface BaseCapabilities {
  // Common fields across all types
  price_per_m?: number;
}

/**
 * Insert machine capabilities
 */
export interface InsertCapabilities extends BaseCapabilities {
  supported_paper_sizes?: string[];
  min_pockets?: number;
  max_pockets?: number;
}

/**
 * Label/Apply machine capabilities
 */
export interface LabelApplyCapabilities extends BaseCapabilities {
  supported_application_types?: string[];
  supported_label_sizes?: string[];
  supported_paper_sizes?: string[];
}

/**
 * Fold machine capabilities
 */
export interface FoldCapabilities extends BaseCapabilities {
  supported_fold_types?: string[];
  supported_paper_stocks?: string[];
  supported_paper_sizes?: string[];
}

/**
 * Laser machine capabilities
 */
export interface LaserCapabilities extends BaseCapabilities {
  supported_print_types?: string[];
  supported_paper_stocks?: string[];
  supported_paper_sizes?: string[];
  supported_colors?: string[];
}

/**
 * HP Press machine capabilities
 */
export interface HpPressCapabilities extends BaseCapabilities {
  supported_print_types?: string[];
  supported_paper_stocks?: string[];
  supported_paper_sizes?: string[];
  supported_colors?: string[];
}

/**
 * Ink Jet machine capabilities
 */
export interface InkJetCapabilities extends BaseCapabilities {
  supported_print_types?: string[];
  supported_paper_sizes?: string[];
  supported_colors?: string[];
}

/**
 * Labeling machine capabilities
 */
export interface LabelingCapabilities extends BaseCapabilities {
  supported_label_sizes?: string[];
  supported_paper_sizes?: string[];
  supported_label_types?: string[];
}

/**
 * Union type of all process-specific capabilities
 */
export type ProcessSpecificCapabilities =
  | InsertCapabilities
  | LabelApplyCapabilities
  | FoldCapabilities
  | LaserCapabilities
  | HpPressCapabilities
  | InkJetCapabilities
  | LabelingCapabilities;

/**
 * Custom capability fields added via form builder
 * These are prefixed with 'custom_' to avoid collisions
 */
export interface CustomCapabilityField {
  fieldName: string; // Must start with 'custom_'
  fieldValue: string | number | boolean | string[];
}

/**
 * Complete machine capabilities combining process-specific and custom fields
 */
export interface MachineCapabilities {
  // Process-specific fields (typed based on process_type_key)
  [key: string]: MachineCapabilityValue;
}

/**
 * Machine entity from the API
 * Now supports dynamic, process-specific capabilities
 */
export interface Machine {
  id: number;
  created_at: number;
  line: string;
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
  job_number: string;
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
  sub_client?: string; // Sub-client name as a string (not an object)
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
  machines: { id: number; line: string }[];
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
  return user.role === "admin" || user.admin === true;
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

// ============================================================================
// Dynamic Field Filter Types
// ============================================================================

/**
 * Operator types for dynamic field filtering
 */
export type DynamicFieldOperator =
  | "equals"
  | "not_equals"
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "between"
  | "is_true"
  | "is_false"
  | "is_empty"
  | "is_not_empty";

/**
 * Filter value types based on operator
 */
export type DynamicFieldFilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | { min: number; max: number }
  | null;

/**
 * Field type from machine variables
 */
export type DynamicFieldType =
  | "text"
  | "number"
  | "integer"
  | "boolean"
  | "select"
  | "dropdown"
  | "currency";

/**
 * Field definition from machine variables
 */
export interface DynamicFieldDefinition {
  name: string; // Field key (e.g., "basic_oe", "paper_size")
  label: string; // Display label (e.g., "Basic OE", "Paper Size")
  type: DynamicFieldType;
  options?: string[]; // Available options for dropdown/select fields
  required?: boolean;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
  };
}

/**
 * A single dynamic field filter configuration
 */
export interface DynamicFieldFilter {
  id: string; // Unique ID for React keys
  processType: string; // Normalized process type (e.g., "insert", "laser")
  fieldName: string; // Field key to filter on
  fieldLabel: string; // Display label for the field
  fieldType: DynamicFieldType; // Type of the field
  operator: DynamicFieldOperator; // How to compare values
  value: DynamicFieldFilterValue; // The filter value
  options?: string[]; // Available options for dropdown/select fields
}

// ============================================================================
// Process Type Breakdown Types
// ============================================================================

/**
 * Breakdown of a process type by a specific dynamic field value
 * Used to show sub-rows under process type summaries
 */
export interface ProcessTypeBreakdown {
  processType: string; // Normalized process type (e.g., "insert", "laser")
  fieldName: string; // The field being grouped by (e.g., "paper_size", "basic_oe")
  fieldValue: any; // The specific value for this breakdown row (e.g., "6x9", true)
  fieldLabel: string; // Display label for the field value
  quantities: { [timeRangeKey: string]: number }; // Quantities per time period
  totalQuantity: number; // Sum of all quantities
  jobCount: number; // Number of unique jobs in this breakdown
  revenue?: number; // Optional: total revenue for this breakdown
}

// ============================================================================
// Cell-Level Notes Types
// ============================================================================

/**
 * Granularity of time periods for cell-level notes
 */
export type CellGranularity = "weekly" | "monthly" | "quarterly";

/**
 * Identifier for a specific cell in the projections table
 * Used to attach notes to specific time period cells rather than entire jobs
 */
export interface CellIdentifier {
  jobId: number;
  periodLabel: string; // Human-readable label (e.g., "8/25", "Nov '24", "Q4 '24")
  periodStart: number; // Unix timestamp for period start
  periodEnd: number; // Unix timestamp for period end
  granularity: CellGranularity; // Time period granularity
}

/**
 * Generate a unique key for a cell identifier
 * Format: "{jobId}:{granularity}:{periodStart}:{periodEnd}"
 */
export const getCellKey = (cellId: CellIdentifier): string => {
  return `${cellId.jobId}:${cellId.granularity}:${cellId.periodStart}:${cellId.periodEnd}`;
};

/**
 * Generate the period key component for API storage
 * Format: "{granularity}:{periodStart}:{periodEnd}"
 */
export const getPeriodKey = (cellId: CellIdentifier): string => {
  return `${cellId.granularity}:${cellId.periodStart}:${cellId.periodEnd}`;
};

/**
 * Parse a cell key back into its components
 */
export const parseCellKey = (cellKey: string): CellIdentifier | null => {
  const parts = cellKey.split(":");
  if (parts.length !== 4) return null;

  const [jobIdStr, granularity, periodStartStr, periodEndStr] = parts;
  const jobId = parseInt(jobIdStr, 10);
  const periodStart = parseInt(periodStartStr, 10);
  const periodEnd = parseInt(periodEndStr, 10);

  if (
    isNaN(jobId) ||
    isNaN(periodStart) ||
    isNaN(periodEnd) ||
    !["weekly", "monthly", "quarterly"].includes(granularity)
  ) {
    return null;
  }

  return {
    jobId,
    periodLabel: "", // Not stored in key
    periodStart,
    periodEnd,
    granularity: granularity as CellGranularity,
  };
};
