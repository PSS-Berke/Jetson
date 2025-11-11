import Cookies from 'js-cookie';
import type {
  Machine,
  Job,
  User,
  LoginCredentials,
  SignupData,
  AuthResponse,
  ProductionEntry
} from '@/types';
import type { JobCostEntry } from '@/lib/jobCostUtils';
import { calculateAverageCostFromRequirements } from '@/lib/jobCostUtils';

const AUTH_BASE_URL = 'https://xnpm-iauo-ef2d.n7e.xano.io/api:spcRzPtb';
const API_BASE_URL = 'https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb';
const JOBS_BASE_URL = 'https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6';
const TOKEN_KEY = 'auth_token';

// Re-export types for backwards compatibility
export type { Machine, Job, User };

// Store token in cookies only
export const setToken = (token: string): void => {
  Cookies.set(TOKEN_KEY, token, { expires: 7, secure: true, sameSite: 'strict' });
};

// Get token from cookies
export const getToken = (): string | null => {
  return Cookies.get(TOKEN_KEY) || null;
};

// Remove token from cookies
export const removeToken = (): void => {
  Cookies.remove(TOKEN_KEY);
};

// Generic fetch wrapper with automatic token attachment
const apiFetch = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  baseType: 'auth' | 'api' | 'jobs' = 'api'
): Promise<T> => {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  // Attach Bearer token if available
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const baseUrl = baseType === 'auth' ? AUTH_BASE_URL : baseType === 'jobs' ? JOBS_BASE_URL : API_BASE_URL;
  
  // Debug logging for jobs endpoint
  if (endpoint.includes('/jobs')) {
    console.log('[apiFetch] Jobs request:', {
      url: `${baseUrl}${endpoint}`,
      method: options.method,
      body: options.body,
      headers
    });
  }
  
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));

    // Suppress error logging for endpoints that may not be configured yet
    const isProductionEndpoint = endpoint.includes('/production_entry');
    const isJobCostEndpoint = endpoint.includes('/job_cost_entry');

    // Log error details for debugging (unless it's an expected endpoint error)
    if (!isProductionEndpoint && !isJobCostEndpoint) {
      console.error('[API Error]', {
        endpoint,
        baseType,
        fullUrl: `${baseType === 'auth' ? AUTH_BASE_URL : baseType === 'jobs' ? JOBS_BASE_URL : API_BASE_URL}${endpoint}`,
        status: response.status,
        statusText: response.statusText,
        error
      });
    }

    // Handle unauthorized/expired token
    if (response.status === 401 || error.code === 'ERROR_CODE_UNAUTHORIZED') {
      removeToken();
      // Only redirect on client side
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    throw new Error(error.message || `HTTP ${response.status}`);
  }

  const responseData = await response.json();
  
  // Debug logging for jobs endpoint
  if (endpoint.includes('/jobs')) {
    console.log('[apiFetch] Jobs response:', responseData);
  }
  
  return responseData;
};

// Login user
export const login = async (credentials: LoginCredentials): Promise<User> => {
  const data = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }, 'auth');

  if (data.authToken) {
    setToken(data.authToken);
  }

  return data.user || (data as unknown as User);
};

// Signup (admin creates new user)
export const signup = async (userData: SignupData): Promise<User> => {
  const data = await apiFetch<User>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  }, 'auth');

  return data;
};

// Get current user
export const getMe = async (): Promise<User> => {
  const data = await apiFetch<User>('/auth/me', {
    method: 'GET',
  }, 'auth');

  return data;
};

// Logout (client-side only)
export const logout = (): void => {
  removeToken();
};

// Generic API object with common HTTP methods
export const api = {
  get: async <T = unknown>(endpoint: string, baseType: 'auth' | 'api' | 'jobs' = 'api'): Promise<T> => {
    return apiFetch<T>(endpoint, { method: 'GET' }, baseType);
  },
  
  post: async <T = unknown>(endpoint: string, data: unknown, baseType: 'auth' | 'api' | 'jobs' = 'api'): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }, baseType);
  },
  
  put: async <T = unknown>(endpoint: string, data: unknown, baseType: 'auth' | 'api' | 'jobs' = 'api'): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }, baseType);
  },
  
  patch: async <T = unknown>(endpoint: string, data: unknown, baseType: 'auth' | 'api' | 'jobs' = 'api'): Promise<T> => {
    return apiFetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, baseType);
  },
  
  delete: async <T = unknown>(endpoint: string, baseType: 'auth' | 'api' | 'jobs' = 'api'): Promise<T> => {
    return apiFetch<T>(endpoint, { method: 'DELETE' }, baseType);
  },
};

// Get all machines
export const getMachines = async (status?: string, facilitiesId?: number): Promise<Machine[]> => {
  const params = new URLSearchParams();

  // Only append status parameter if it has a value
  if (status && status !== '') {
    params.append('status', status);
  }

  // Only append facilities_id parameter if it has a value
  if (facilitiesId && facilitiesId > 0) {
    params.append('facilities_id', facilitiesId.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/machines?${queryString}` : '/machines';

  const data = await apiFetch<any[]>(endpoint, {
    method: 'GET',
  });

  // Transform API response to match Machine interface
  return data.map(machine => ({
    ...machine,
    line: machine.name ? parseInt(machine.name) : machine.line || 0,
    capabilities: machine.details || machine.capabilities || {},
    speed_hr: machine.speed_hr ? parseFloat(machine.speed_hr) : undefined,
    shiftCapacity: machine.shiftCapacity ? parseFloat(machine.shiftCapacity) : undefined,
    // Infer process_type_key from machine type if not provided
    process_type_key: machine.process_type_key || inferProcessTypeKey(machine.type),
  }));
};

// Helper function to infer process_type_key from machine type
const inferProcessTypeKey = (type: string): string => {
  const typeMap: { [key: string]: string } = {
    'insert': 'insert',
    'inserter': 'insert',
    'inserters': 'insert',
    'folder': 'fold',
    'folders': 'fold',
    'fold': 'fold',
    'hp press': 'laser',
    'laser': 'laser',
    'inkjet': 'inkjet',
    'inkjetter': 'inkjet',
    'inkjetters': 'inkjet',
    'affix': 'affix',
    'affixer': 'affix',
    'affixers': 'affix',
  };
  
  const normalizedType = type.toLowerCase().trim();
  return typeMap[normalizedType] || 'insert'; // Default to 'insert' if unknown
};

// Create a new machine
export const createMachine = async (machineData: Omit<Machine, 'id' | 'created_at'>): Promise<Machine> => {
  console.log('[createMachine] Creating machine:', machineData);
  console.log('[createMachine] Capabilities object:', machineData.capabilities);
  
  // Transform frontend data to API format
  const apiData = {
    ...machineData,
    name: machineData.line?.toString() || '0',
    details: machineData.capabilities || {},
  };
  
  console.log('[createMachine] Request body:', JSON.stringify(apiData, null, 2));
  const result = await apiFetch<any>('/machines', {
    method: 'POST',
    body: JSON.stringify(apiData),
  });
  console.log('[createMachine] Response:', result);
  
  // Transform API response to frontend format
  return {
    ...result,
    line: result.name ? parseInt(result.name) : result.line || 0,
    capabilities: result.details || result.capabilities || {},
    speed_hr: result.speed_hr ? parseInt(result.speed_hr) : 0,
    process_type_key: result.process_type_key || inferProcessTypeKey(result.type),
  };
};

// Update an existing machine
export const updateMachine = async (machineId: number, machineData: Partial<Machine>): Promise<Machine> => {
  console.log('[updateMachine] Updating machine:', machineId, 'with data:', machineData);
  console.log('[updateMachine] Capabilities object:', machineData.capabilities);
  
  // Transform frontend data to API format
  const apiData: any = { ...machineData };
  if (machineData.line !== undefined) {
    apiData.name = machineData.line.toString();
  }
  if (machineData.capabilities !== undefined) {
    apiData.details = machineData.capabilities;
  }
  
  console.log('[updateMachine] Request body:', JSON.stringify(apiData, null, 2));
  const result = await apiFetch<any>(`/machines/${machineId}`, {
    method: 'PATCH',
    body: JSON.stringify(apiData),
  });
  console.log('[updateMachine] Response:', result);
  
  // Transform API response to frontend format
  return {
    ...result,
    line: result.name ? parseInt(result.name) : result.line || 0,
    capabilities: result.details || result.capabilities || {},
    speed_hr: result.speed_hr ? parseInt(result.speed_hr) : 0,
    process_type_key: result.process_type_key || inferProcessTypeKey(result.type),
  };
};

// Delete a machine
export const deleteMachine = async (machineId: number): Promise<void> => {
  console.log('[deleteMachine] Deleting machine:', machineId);
  await apiFetch<void>(`/machines/${machineId}`, {
    method: 'DELETE',
  });
};

// Get all jobs
export const getJobs = async (facilitiesId?: number): Promise<Job[]> => {
  console.log('[getJobs] Called with facilitiesId:', facilitiesId, 'Type:', typeof facilitiesId);
  
  const params = new URLSearchParams();

  if (facilitiesId !== undefined && facilitiesId !== null) {
    params.append('facilities_id', facilitiesId.toString());
    console.log('[getJobs] Added facilities_id to params:', facilitiesId);
  } else {
    console.log('[getJobs] No facilities_id added (was undefined or null)');
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/jobs?${queryString}` : '/jobs';
  const fullUrl = `${JOBS_BASE_URL}${endpoint}`;
  
  console.log('[getJobs] Full URL:', fullUrl);
  console.log('[getJobs] Endpoint:', endpoint);

  return apiFetch<Job[]>(endpoint, {
    method: 'GET',
  }, 'jobs');
};

// Update a job
export const updateJob = async (jobId: number, jobData: Partial<Job>): Promise<Job> => {
  return apiFetch<Job>(`/jobs/${jobId}`, {
    method: 'PATCH',
    body: JSON.stringify(jobData),
  }, 'jobs');
};

// Delete a job
export const deleteJob = async (jobId: number): Promise<void> => {
  await apiFetch<void>(`/jobs/${jobId}`, {
    method: 'DELETE',
  }, 'jobs');
};

// Batch create multiple jobs
// Since Xano doesn't have a /batch endpoint, we'll make individual POST requests in chunks
export const batchCreateJobs = async (
  jobs: Partial<Job>[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ success: Job[]; failures: { job: Partial<Job>; error: string }[] }> => {
  const CHUNK_SIZE = 25; // Process 25 jobs at a time to avoid overwhelming the API
  const success: Job[] = [];
  const failures: { job: Partial<Job>; error: string }[] = [];

  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (job) => {
        try {
          const createdJob = await apiFetch<Job>('/jobs', {
            method: 'POST',
            body: JSON.stringify(job),
          }, 'jobs');
          return createdJob;
        } catch (error) {
          throw { job, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    chunkResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        const failureData = result.reason as { job: Partial<Job>; error: string };
        failures.push(failureData);
      }
    });

    // Call progress callback if provided
    if (onProgress) {
      onProgress(Math.min(i + CHUNK_SIZE, jobs.length), jobs.length);
    }
  }

  return { success, failures };
};

// ============================================================================
// Production Entry API Functions
// ============================================================================

// Get production entries with optional filters
export const getProductionEntries = async (
  facilitiesId?: number,
  startDate?: number,
  endDate?: number
): Promise<ProductionEntry[]> => {
  const params = new URLSearchParams();

  if (facilitiesId !== undefined && facilitiesId !== null) {
    params.append('facilities_id', facilitiesId.toString());
  }

  if (startDate !== undefined && startDate !== null) {
    params.append('start_date', startDate.toString());
  }

  if (endDate !== undefined && endDate !== null) {
    params.append('end_date', endDate.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/production_entry?${queryString}` : '/production_entry';

  console.log('[getProductionEntries] Fetching from:', endpoint);
  const result = await apiFetch<ProductionEntry[]>(endpoint, {
    method: 'GET',
  }, 'jobs');
  console.log('[getProductionEntries] Received', result.length, 'entries:', result);
  return result;
};

// Add a new production entry
export const addProductionEntry = async (data: Omit<ProductionEntry, 'id' | 'created_at' | 'updated_at'>): Promise<ProductionEntry> => {
  console.log('[addProductionEntry] Submitting entry:', data);
  const result = await apiFetch<ProductionEntry>('/production_entry', {
    method: 'POST',
    body: JSON.stringify(data),
  }, 'jobs');
  console.log('[addProductionEntry] Response:', result);
  return result;
};

// Update an existing production entry
export const updateProductionEntry = async (production_entry_id: number, data: Partial<ProductionEntry>): Promise<ProductionEntry> => {
  console.log('[updateProductionEntry] Updating entry:', production_entry_id, 'with data:', data);
  const result = await apiFetch<ProductionEntry>(`/production_entry/${production_entry_id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }, 'jobs');
  console.log('[updateProductionEntry] Response:', result);
  return result;
};

// Delete a production entry
export const deleteProductionEntry = async (production_entry_id: number): Promise<void> => {
  await apiFetch<void>(`/production_entry/${production_entry_id}`, {
    method: 'DELETE',
  }, 'jobs');
};

// Batch create multiple production entries
// Since Xano doesn't have a /batch endpoint, we'll make individual POST requests in parallel
export const batchCreateProductionEntries = async (
  entries: Omit<ProductionEntry, 'id' | 'created_at' | 'updated_at'>[]
): Promise<ProductionEntry[]> => {
  // Create all entries in parallel for much faster performance
  const createdEntries = await Promise.all(
    entries.map(entry => addProductionEntry(entry))
  );

  return createdEntries;
};

// ============================================================================
// Job Cost Entry API Functions
// ============================================================================

// Get job cost entries with optional filters
export const getJobCostEntries = async (
  facilitiesId?: number,
  startDate?: number,
  endDate?: number
): Promise<JobCostEntry[]> => {
  const params = new URLSearchParams();

  if (facilitiesId !== undefined && facilitiesId !== null) {
    params.append('facilities_id', facilitiesId.toString());
  }

  if (startDate !== undefined && startDate !== null) {
    params.append('start_date', startDate.toString());
  }

  if (endDate !== undefined && endDate !== null) {
    params.append('end_date', endDate.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/job_cost_entry?${queryString}` : '/job_cost_entry';

  console.log('[getJobCostEntries] Fetching from:', endpoint);
  const result = await apiFetch<JobCostEntry[]>(endpoint, {
    method: 'GET',
  }, 'jobs');
  console.log('[getJobCostEntries] Received', result.length, 'entries:', result);
  return result;
};

// Add a new job cost entry
export const addJobCostEntry = async (
  data: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<JobCostEntry> => {
  console.log('[addJobCostEntry] Submitting entry:', data);
  const result = await apiFetch<JobCostEntry>('/job_cost_entry', {
    method: 'POST',
    body: JSON.stringify(data),
  }, 'jobs');
  console.log('[addJobCostEntry] Response:', result);
  return result;
};

// Update an existing job cost entry
export const updateJobCostEntry = async (
  id: number,
  data: Partial<Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'>>
): Promise<JobCostEntry> => {
  console.log('[updateJobCostEntry] Updating entry:', id, 'with data:', data);
  const result = await apiFetch<JobCostEntry>(`/job_cost_entry/${id}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }, 'jobs');
  console.log('[updateJobCostEntry] Response:', result);
  return result;
};

// Delete a job cost entry
export const deleteJobCostEntry = async (id: number): Promise<void> => {
  console.log('[deleteJobCostEntry] Deleting entry:', id);
  await apiFetch<void>(`/job_cost_entry/${id}`, {
    method: 'DELETE',
  }, 'jobs');
  console.log('[deleteJobCostEntry] Entry deleted successfully');
};

// Batch create multiple job cost entries
// Since Xano doesn't have a /batch endpoint, we'll make individual POST requests in parallel
export const batchCreateJobCostEntries = async (
  entries: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'>[]
): Promise<JobCostEntry[]> => {
  console.log('[batchCreateJobCostEntries] Creating', entries.length, 'entries in parallel');
  // Create all entries in parallel for much faster performance
  const createdEntries = await Promise.all(
    entries.map(entry => addJobCostEntry(entry))
  );
  console.log('[batchCreateJobCostEntries] Successfully created', createdEntries.length, 'entries');
  return createdEntries;
};

// ============================================================================
// Bulk Job Operations
// ============================================================================

/**
 * Bulk delete multiple jobs
 * @param jobIds - Array of job IDs to delete
 * @returns Object with success and failure counts
 */
export const bulkDeleteJobs = async (
  jobIds: number[]
): Promise<{ success: number; failures: { jobId: number; error: string }[] }> => {
  const failures: { jobId: number; error: string }[] = [];
  let successCount = 0;

  // Delete jobs in parallel for better performance
  const results = await Promise.allSettled(
    jobIds.map(async (jobId) => {
      try {
        await deleteJob(jobId);
        return jobId;
      } catch (error) {
        throw { jobId, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    })
  );

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      successCount++;
    } else {
      const failureData = result.reason as { jobId: number; error: string };
      failures.push(failureData);
    }
  });

  console.log(`[bulkDeleteJobs] Deleted ${successCount} of ${jobIds.length} jobs`);
  return { success: successCount, failures };
};

/**
 * Bulk update job status or other fields
 * @param jobIds - Array of job IDs to update
 * @param updates - Partial job data to apply to all jobs
 * @returns Object with success and failure counts
 */
export const bulkUpdateJobs = async (
  jobIds: number[],
  updates: Partial<Job>
): Promise<{ success: Job[]; failures: { jobId: number; error: string }[] }> => {
  const failures: { jobId: number; error: string }[] = [];
  const success: Job[] = [];

  // Update jobs in parallel for better performance
  const results = await Promise.allSettled(
    jobIds.map(async (jobId) => {
      try {
        const updatedJob = await updateJob(jobId, updates);
        return updatedJob;
      } catch (error) {
        throw { jobId, error: error instanceof Error ? error.message : 'Unknown error' };
      }
    })
  );

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      success.push(result.value);
    } else {
      const failureData = result.reason as { jobId: number; error: string };
      failures.push(failureData);
    }
  });

  console.log(`[bulkUpdateJobs] Updated ${success.length} of ${jobIds.length} jobs`);
  return { success, failures };
};

// ============================================================================
// Machine Variables API Functions (Dynamic Form Builder)
// ============================================================================

/**
 * Fetch machine variables/fields configuration for a specific process type
 * Used to dynamically generate form fields based on the selected process type
 *
 * @param processType - The process type (e.g., 'insert', 'fold', 'laser')
 * @returns Array of machine variable configurations
 */
export const getMachineVariables = async (processType: string): Promise<any[]> => {
  console.log('[getMachineVariables] Fetching variables for process type:', processType);

  const params = new URLSearchParams();
  params.append('process_type', processType);

  const endpoint = `/machine_variables?${params.toString()}`;

  const result = await apiFetch<any[]>(endpoint, {
    method: 'GET',
  });

  console.log('[getMachineVariables] Response:', result);
  return result;
};

// ============================================================================
// Job Cost Entry Sync Functions (Auto-populate from Requirements)
// ============================================================================

/**
 * Automatically sync job_cost_entry record from job requirements
 * Called after job creation or update to populate actual_cost_per_m from price_per_m
 *
 * @param jobId - The job ID
 * @param requirements - Array of job requirements (can be JSON string or array)
 * @param startDate - Job start date (used as entry date)
 * @param facilitiesId - Facility ID
 * @returns Created/updated JobCostEntry or null if no valid pricing
 */
export const syncJobCostEntryFromRequirements = async (
  jobId: number,
  requirements: string | any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  startDate: string | number,
  facilitiesId?: number
): Promise<JobCostEntry | null> => {
  try {
    console.log('[syncJobCostEntryFromRequirements] Starting sync for job:', jobId);

    // Parse requirements if it's a string
    let requirementsArray: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (typeof requirements === 'string') {
      try {
        requirementsArray = JSON.parse(requirements);
      } catch (e) {
        console.error('[syncJobCostEntryFromRequirements] Failed to parse requirements:', e);
        return null;
      }
    } else {
      requirementsArray = requirements;
    }

    // Calculate average cost from requirements
    const averageCost = calculateAverageCostFromRequirements(requirementsArray);

    if (averageCost === 0) {
      console.log('[syncJobCostEntryFromRequirements] No valid price_per_m found in requirements');
      return null;
    }

    // Convert start date to timestamp if it's a string
    let dateTimestamp: number;
    if (typeof startDate === 'string') {
      dateTimestamp = new Date(startDate).getTime();
    } else {
      dateTimestamp = startDate;
    }

    console.log('[syncJobCostEntryFromRequirements] Calculated average cost:', averageCost);

    // Check if a job_cost_entry already exists for this job and date range
    // We'll look for entries within a day of the start date to avoid duplicates
    const dayStart = dateTimestamp;
    const dayEnd = dateTimestamp + (24 * 60 * 60 * 1000);

    try {
      const existingEntries = await getJobCostEntries(facilitiesId, dayStart, dayEnd);
      const existingEntry = existingEntries.find(entry => entry.job === jobId);

      if (existingEntry) {
        // Update existing entry
        console.log('[syncJobCostEntryFromRequirements] Updating existing entry:', existingEntry.id);
        const updated = await updateJobCostEntry(existingEntry.id, {
          actual_cost_per_m: averageCost,
          notes: existingEntry.notes || 'Auto-synced from requirements',
        });
        console.log('[syncJobCostEntryFromRequirements] Entry updated successfully');
        return updated;
      }
    } catch {
      // If fetching existing entries fails, continue to create new one
      console.log('[syncJobCostEntryFromRequirements] Could not fetch existing entries, will create new');
    }

    // Create new entry
    const newEntry = await addJobCostEntry({
      job: jobId,
      date: dateTimestamp,
      actual_cost_per_m: averageCost,
      notes: 'Auto-synced from requirements',
      facilities_id: facilitiesId,
    });

    console.log('[syncJobCostEntryFromRequirements] New entry created:', newEntry.id);
    return newEntry;
  } catch (error) {
    console.error('[syncJobCostEntryFromRequirements] Error syncing job cost entry:', error);
    // Don't throw - we don't want to fail job creation/update if cost entry sync fails
    return null;
  }
};
