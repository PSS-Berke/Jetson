/**
 * Centralized type definitions for the Jetson Capacity Planner
 * This file serves as the single source of truth for common types
 */

// ============================================================================
// Machine Types
// ============================================================================

export type MachineStatus = 'running' | 'available' | 'avalible' | 'maintenance';

/**
 * Machine entity from the API
 */
export interface Machine {
  id: number;
  created_at: number;
  line: number;
  type: string;
  max_size: string;
  speed_hr: string;
  status: MachineStatus;
  pockets?: number;
  shiftCapacity?: number;
  currentJob?: {
    number: string;
    name: string;
  };
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
  price_per_m: string;
  add_on_charges: string;
  ext_price: string;
  total_billing: string;
  client: string;
  machines: string;
}

/**
 * Job requirement parsed from the requirements field
 */
export interface JobRequirement {
  process_type?: string;
  paper_size?: string;
  pockets?: number;
  shifts_id?: number;
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
