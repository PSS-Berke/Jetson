/**
 * Centralized type definitions for the Jetson Capacity Planner
 * This file serves as the single source of truth for common types
 */

// ============================================================================
// Machine Types
// ============================================================================

export type MachineStatus = 'running' | 'available' | 'avalible' | 'maintenance';

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
  type: string; // Display name (e.g., "Inserter", "Folder")
  process_type_key?: string; // Maps to processTypeConfig keys (insert, fold, laser, etc.)
  facilities_id?: number;
  status: MachineStatus;

  // Dynamic capabilities based on process type
  // Examples:
  // - Inserter: { supported_paper_sizes: ['6x9', '9x12'], max_pockets: 6 }
  // - Folder: { supported_fold_types: ['Half Fold', 'Tri-fold'], supported_paper_stocks: ['20# Bond'] }
  capabilities?: {
    [key: string]: MachineCapabilityValue;
  };

  // Performance metrics
  speed_hr: number; // Speed per hour
  shiftCapacity?: number; // Capacity per shift

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
export interface ParsedJob extends Omit<Job, 'client' | 'machines'> {
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
  admin: boolean;
  [key: string]: string | number | boolean | undefined;
}

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
  job: import('@/hooks/useJobs').ParsedJob;
  projected_quantity: number;
  actual_quantity: number;
  variance: number; // actual - projected
  variance_percentage: number; // (variance / projected) * 100
  entry_ids: number[]; // Array of production entry IDs for this job in the period
  last_updated_at?: number; // Timestamp of most recent production entry for this job
}
