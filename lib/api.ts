import Cookies from "js-cookie";
import type {
  Machine,
  Job,
  User,
  LoginCredentials,
  SignupData,
  AuthResponse,
  ProductionEntry,
  MachineRule,
  MachineGroup,
} from "@/types";
import type { JobCostEntry } from "@/lib/jobCostUtils";
import { calculateAverageCostFromRequirements } from "@/lib/jobCostUtils";

const AUTH_BASE_URL = "https://xnpm-iauo-ef2d.n7e.xano.io/api:spcRzPtb";
const API_BASE_URL = "https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb";
const JOBS_BASE_URL = "https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6";
const TOKEN_KEY = "auth_token";

// Re-export types for backwards compatibility
export type { Machine, Job, User };

// Store token in cookies only
export const setToken = (token: string): void => {
  Cookies.set(TOKEN_KEY, token, {
    expires: 7,
    secure: true,
    sameSite: "strict",
  });
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
  baseType: "auth" | "api" | "jobs" = "api",
): Promise<T> => {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // Attach Bearer token if available
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const baseUrl =
    baseType === "auth"
      ? AUTH_BASE_URL
      : baseType === "jobs"
        ? JOBS_BASE_URL
        : API_BASE_URL;

  // Debug logging for jobs endpoint
  if (endpoint.includes("/jobs")) {
    console.log("[apiFetch] Jobs request:", {
      url: `${baseUrl}${endpoint}`,
      method: options.method,
      body: options.body,
      headers,
    });
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let error: any;
    let errorText: string = "";
    try {
      errorText = await response.text();
      console.log("[apiFetch] Raw error response:", errorText);
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || "Request failed" };
      }
    } catch {
      error = { message: "Request failed" };
    }

    // Suppress error logging for endpoints that may not be configured yet
    const isProductionEndpoint = endpoint.includes("/production_entry");
    const isJobCostEndpoint = endpoint.includes("/job_cost_entry");
    const isMachineRulesEndpoint = endpoint.includes("/machine_rules");
    const isMachineGroupsEndpoint = endpoint.includes("/machine_groups");

    // Log error details for debugging (unless it's an expected endpoint error)
    if (
      !isProductionEndpoint &&
      !isJobCostEndpoint &&
      !isMachineRulesEndpoint &&
      !isMachineGroupsEndpoint
    ) {
      console.error("[API Error]", {
        endpoint,
        baseType,
        fullUrl: `${baseType === "auth" ? AUTH_BASE_URL : baseType === "jobs" ? JOBS_BASE_URL : API_BASE_URL}${endpoint}`,
        status: response.status,
        statusText: response.statusText,
        error,
        errorString: JSON.stringify(error, null, 2),
        requestBody: options.body,
        requestBodyParsed: options.body
          ? JSON.parse(options.body as string)
          : null,
      });
    }

    // Handle unauthorized/expired token
    if (response.status === 401 || error.code === "ERROR_CODE_UNAUTHORIZED") {
      removeToken();
      // Only redirect on client side
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    // Extract more detailed error message
    const errorMessage =
      error.message || error.error || error.detail || `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  const responseData = await response.json();

  // Debug logging for jobs endpoint
  if (endpoint.includes("/jobs")) {
    console.log("[apiFetch] Jobs response:", responseData);
  }

  return responseData;
};

// Login user
export const login = async (credentials: LoginCredentials): Promise<User> => {
  const data = await apiFetch<AuthResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(credentials),
    },
    "auth",
  );

  if (data.authToken) {
    setToken(data.authToken);
  }

  return data.user || (data as unknown as User);
};

// Signup (admin creates new user)
export const signup = async (userData: SignupData): Promise<User> => {
  const data = await apiFetch<User>(
    "/auth/signup",
    {
      method: "POST",
      body: JSON.stringify(userData),
    },
    "auth",
  );

  return data;
};

// Get current user
export const getMe = async (): Promise<User> => {
  const data = await apiFetch<User>(
    "/auth/me",
    {
      method: "GET",
    },
    "auth",
  );

  return data;
};

// Logout (client-side only)
export const logout = (): void => {
  removeToken();
};

// Generic API object with common HTTP methods
export const api = {
  get: async <T = unknown>(
    endpoint: string,
    baseType: "auth" | "api" | "jobs" = "api",
  ): Promise<T> => {
    return apiFetch<T>(endpoint, { method: "GET" }, baseType);
  },

  post: async <T = unknown>(
    endpoint: string,
    data: unknown,
    baseType: "auth" | "api" | "jobs" = "api",
  ): Promise<T> => {
    return apiFetch<T>(
      endpoint,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
      baseType,
    );
  },

  put: async <T = unknown>(
    endpoint: string,
    data: unknown,
    baseType: "auth" | "api" | "jobs" = "api",
  ): Promise<T> => {
    return apiFetch<T>(
      endpoint,
      {
        method: "PUT",
        body: JSON.stringify(data),
      },
      baseType,
    );
  },

  patch: async <T = unknown>(
    endpoint: string,
    data: unknown,
    baseType: "auth" | "api" | "jobs" = "api",
  ): Promise<T> => {
    return apiFetch<T>(
      endpoint,
      {
        method: "PATCH",
        body: JSON.stringify(data),
      },
      baseType,
    );
  },

  delete: async <T = unknown>(
    endpoint: string,
    baseType: "auth" | "api" | "jobs" = "api",
  ): Promise<T> => {
    return apiFetch<T>(endpoint, { method: "DELETE" }, baseType);
  },
};

// Get all machines
export const getMachines = async (
  status?: string,
  facilitiesId?: number,
): Promise<Machine[]> => {
  const params = new URLSearchParams();

  // Only append status parameter if it has a value
  if (status && status !== "") {
    params.append("status", status);
  }

  // Only append facilities_id parameter if it has a value
  if (facilitiesId && facilitiesId > 0) {
    params.append("facilities_id", facilitiesId.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/machines?${queryString}` : "/machines";

  const data = await apiFetch<any[]>(endpoint, {
    method: "GET",
  });

  // Transform API response to match Machine interface
  return data.map((machine) => ({
    ...machine,
    line: machine.name ? parseInt(machine.name) : machine.line || 0,
    capabilities: machine.details || machine.capabilities || {},
    speed_hr: machine.speed_hr ? parseFloat(machine.speed_hr) : undefined,
    shiftCapacity: machine.shiftCapacity
      ? parseFloat(machine.shiftCapacity)
      : undefined,
    // Infer process_type_key from machine type if not provided
    process_type_key:
      machine.process_type_key || inferProcessTypeKey(machine.type),
  }));
};

// Helper function to infer process_type_key from machine type
const inferProcessTypeKey = (type: string): string => {
  const typeMap: { [key: string]: string } = {
    insert: "insert",
    inserter: "insert",
    inserters: "insert",
    folder: "fold",
    folders: "fold",
    fold: "fold",
    "hp press": "laser",
    laser: "laser",
    inkjet: "inkjet",
    inkjetter: "inkjet",
    inkjetters: "inkjet",
    affix: "affix",
    affixer: "affix",
    affixers: "affix",
  };

  const normalizedType = type.toLowerCase().trim();
  return typeMap[normalizedType] || "insert"; // Default to 'insert' if unknown
};

// Create a new machine
export const createMachine = async (
  machineData: Omit<Machine, "id" | "created_at">,
): Promise<Machine> => {
  console.log("[createMachine] Creating machine:", machineData);
  console.log("[createMachine] Capabilities object:", machineData.capabilities);

  // Transform frontend data to API format that Xano expects
  // Based on Xano's expected format:
  // - quantity should be 1 (For Loop will execute once to create one machine)
  // - speed_hr should be a string
  // - shift_capacity should be snake_case
  // - Include all expected fields with defaults
  const apiData: Record<string, any> = {
    quantity: 1, // For Loop executes this many times - we want to create 1 machine
    line: machineData.line?.toString() || "",
    type: machineData.type || "",
    speed_hr: machineData.speed_hr?.toString() || "0",
    status: machineData.status || "available",
    facilities_id: machineData.facilities_id || 0,
    paper_size: "",
    shift_capacity: machineData.shiftCapacity?.toString() || "",
    jobs_id: 0,
    pockets: 0,
    details: machineData.capabilities || {},
  };

  // Add process_type_key if provided
  if (machineData.process_type_key) {
    apiData.process_type_key = machineData.process_type_key;
  }

  console.log(
    "[createMachine] Request body:",
    JSON.stringify(apiData, null, 2),
  );
  console.log("[createMachine] Request body (parsed):", apiData);

  const result = await apiFetch<any>("/machines", {
    method: "POST",
    body: JSON.stringify(apiData),
  });
  console.log("[createMachine] Response:", result);

  // Xano returns machines1 (from For Loop) - it might be an array or single object
  // Extract the machine data from the response
  let machineResult: any;
  if (result.machines1) {
    // If machines1 is an array, take the first element (since quantity=1)
    machineResult = Array.isArray(result.machines1)
      ? result.machines1[0]
      : result.machines1;
  } else {
    // Fallback to result itself if machines1 doesn't exist
    machineResult = result;
  }

  // Transform API response to frontend format
  return {
    ...machineResult,
    line: machineResult.line
      ? typeof machineResult.line === "number"
        ? machineResult.line
        : parseInt(machineResult.line)
      : 0,
    capabilities: machineResult.details || machineResult.capabilities || {},
    speed_hr: machineResult.speed_hr
      ? typeof machineResult.speed_hr === "number"
        ? machineResult.speed_hr
        : parseFloat(machineResult.speed_hr)
      : 0,
    process_type_key:
      machineResult.process_type_key || inferProcessTypeKey(machineResult.type),
  };
};

// Update an existing machine
export const updateMachine = async (
  machineId: number,
  machineData: Partial<Machine>,
): Promise<Machine> => {
  console.log(
    "[updateMachine] Updating machine:",
    machineId,
    "with data:",
    machineData,
  );
  console.log("[updateMachine] Capabilities object:", machineData.capabilities);

  // Transform frontend data to API format
  const apiData: any = { ...machineData };
  if (machineData.line !== undefined) {
    apiData.name = machineData.line.toString();
  }
  if (machineData.capabilities !== undefined) {
    apiData.details = machineData.capabilities;
  }

  console.log(
    "[updateMachine] Request body:",
    JSON.stringify(apiData, null, 2),
  );
  const result = await apiFetch<any>(`/machines/${machineId}`, {
    method: "PATCH",
    body: JSON.stringify(apiData),
  });
  console.log("[updateMachine] Response:", result);

  // Transform API response to frontend format
  return {
    ...result,
    line: result.name ? parseInt(result.name) : result.line || 0,
    capabilities: result.details || result.capabilities || {},
    speed_hr: result.speed_hr ? parseInt(result.speed_hr) : 0,
    process_type_key:
      result.process_type_key || inferProcessTypeKey(result.type),
  };
};

// Delete a machine
export const deleteMachine = async (machineId: number): Promise<void> => {
  console.log("[deleteMachine] Deleting machine:", machineId);
  await apiFetch<void>(`/machines/${machineId}`, {
    method: "DELETE",
  });
};

// Get all jobs
export const getJobs = async (facilitiesId?: number): Promise<Job[]> => {
  console.log(
    "[getJobs] Called with facilitiesId:",
    facilitiesId,
    "Type:",
    typeof facilitiesId,
  );

  const params = new URLSearchParams();

  if (facilitiesId !== undefined && facilitiesId !== null) {
    params.append("facilities_id", facilitiesId.toString());
    console.log("[getJobs] Added facilities_id to params:", facilitiesId);
  } else {
    console.log("[getJobs] No facilities_id added (was undefined or null)");
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/jobs?${queryString}` : "/jobs";
  const fullUrl = `${JOBS_BASE_URL}${endpoint}`;

  console.log("[getJobs] Full URL:", fullUrl);
  console.log("[getJobs] Endpoint:", endpoint);

  return apiFetch<Job[]>(
    endpoint,
    {
      method: "GET",
    },
    "jobs",
  );
};

// Update a job
export const updateJob = async (
  jobId: number,
  jobData: Partial<Job>,
): Promise<Job> => {
  return apiFetch<Job>(
    `/jobs/${jobId}`,
    {
      method: "PATCH",
      body: JSON.stringify(jobData),
    },
    "jobs",
  );
};

// Delete a job
export const deleteJob = async (jobId: number): Promise<void> => {
  await apiFetch<void>(
    `/jobs/${jobId}`,
    {
      method: "DELETE",
    },
    "jobs",
  );
};

// Batch create multiple jobs
// Since Xano doesn't have a /batch endpoint, we'll make individual POST requests in chunks
export const batchCreateJobs = async (
  jobs: Partial<Job>[],
  onProgress?: (completed: number, total: number) => void,
): Promise<{
  success: Job[];
  failures: { job: Partial<Job>; error: string }[];
}> => {
  const CHUNK_SIZE = 25; // Process 25 jobs at a time to avoid overwhelming the API
  const success: Job[] = [];
  const failures: { job: Partial<Job>; error: string }[] = [];

  for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
    const chunk = jobs.slice(i, i + CHUNK_SIZE);

    const chunkResults = await Promise.allSettled(
      chunk.map(async (job) => {
        try {
          console.log(
            `[batchCreateJobs] Creating job with clients_id:`,
            job.clients_id,
          );
          const createdJob = await apiFetch<Job>(
            "/jobs",
            {
              method: "POST",
              body: JSON.stringify(job),
            },
            "jobs",
          );
          console.log(`[batchCreateJobs] Created job response:`, {
            id: createdJob.id,
            job_number: createdJob.job_number,
            clients_id: createdJob.clients_id,
            client: createdJob.client,
            sub_client: createdJob.sub_client,
          });
          return createdJob;
        } catch (error) {
          throw {
            job,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    chunkResults.forEach((result) => {
      if (result.status === "fulfilled") {
        success.push(result.value);
      } else {
        const failureData = result.reason as {
          job: Partial<Job>;
          error: string;
        };
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
  endDate?: number,
): Promise<ProductionEntry[]> => {
  const params = new URLSearchParams();

  if (facilitiesId !== undefined && facilitiesId !== null) {
    params.append("facilities_id", facilitiesId.toString());
  }

  if (startDate !== undefined && startDate !== null) {
    params.append("start_date", startDate.toString());
  }

  if (endDate !== undefined && endDate !== null) {
    params.append("end_date", endDate.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/production_entry?${queryString}`
    : "/production_entry";

  console.log("[getProductionEntries] Fetching from:", endpoint);
  const result = await apiFetch<ProductionEntry[]>(
    endpoint,
    {
      method: "GET",
    },
    "jobs",
  );
  console.log(
    "[getProductionEntries] Received",
    result.length,
    "entries:",
    result,
  );
  return result;
};

// Add a new production entry
export const addProductionEntry = async (
  data: Omit<ProductionEntry, "id" | "created_at" | "updated_at">,
): Promise<ProductionEntry> => {
  console.log("[addProductionEntry] Submitting entry:", data);
  const result = await apiFetch<ProductionEntry>(
    "/production_entry",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "jobs",
  );
  console.log("[addProductionEntry] Response:", result);
  return result;
};

// Update an existing production entry
export const updateProductionEntry = async (
  production_entry_id: number,
  data: Partial<ProductionEntry>,
): Promise<ProductionEntry> => {
  console.log(
    "[updateProductionEntry] Updating entry:",
    production_entry_id,
    "with data:",
    data,
  );
  const result = await apiFetch<ProductionEntry>(
    `/production_entry/${production_entry_id}`,
    {
      method: "PATCH",
      body: JSON.stringify(data),
    },
    "jobs",
  );
  console.log("[updateProductionEntry] Response:", result);
  return result;
};

// Delete a production entry
export const deleteProductionEntry = async (
  production_entry_id: number,
): Promise<void> => {
  await apiFetch<void>(
    `/production_entry/${production_entry_id}`,
    {
      method: "DELETE",
    },
    "jobs",
  );
};

// Batch create multiple production entries
// Since Xano doesn't have a /batch endpoint, we'll make individual POST requests in parallel
export const batchCreateProductionEntries = async (
  entries: Omit<ProductionEntry, "id" | "created_at" | "updated_at">[],
): Promise<ProductionEntry[]> => {
  // Create all entries in parallel for much faster performance
  const createdEntries = await Promise.all(
    entries.map((entry) => addProductionEntry(entry)),
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
  endDate?: number,
): Promise<JobCostEntry[]> => {
  const params = new URLSearchParams();

  if (facilitiesId !== undefined && facilitiesId !== null) {
    params.append("facilities_id", facilitiesId.toString());
  }

  if (startDate !== undefined && startDate !== null) {
    params.append("start_date", startDate.toString());
  }

  if (endDate !== undefined && endDate !== null) {
    params.append("end_date", endDate.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/job_cost_entry?${queryString}`
    : "/job_cost_entry";

  console.log("[getJobCostEntries] Fetching from:", endpoint);
  const result = await apiFetch<JobCostEntry[]>(
    endpoint,
    {
      method: "GET",
    },
    "jobs",
  );
  console.log(
    "[getJobCostEntries] Received",
    result.length,
    "entries:",
    result,
  );
  return result;
};

// Add a new job cost entry
export const addJobCostEntry = async (
  data: Omit<JobCostEntry, "id" | "created_at" | "updated_at">,
): Promise<JobCostEntry> => {
  console.log("[addJobCostEntry] Submitting entry:", data);
  const result = await apiFetch<JobCostEntry>(
    "/job_cost_entry",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "jobs",
  );
  console.log("[addJobCostEntry] Response:", result);
  return result;
};

// Update an existing job cost entry
export const updateJobCostEntry = async (
  id: number,
  data: Partial<Omit<JobCostEntry, "id" | "created_at" | "updated_at">>,
): Promise<JobCostEntry> => {
  console.log("[updateJobCostEntry] Updating entry:", id, "with data:", data);
  const result = await apiFetch<JobCostEntry>(
    `/job_cost_entry/${id}`,
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "jobs",
  );
  console.log("[updateJobCostEntry] Response:", result);
  return result;
};

// Delete a job cost entry
export const deleteJobCostEntry = async (id: number): Promise<void> => {
  console.log("[deleteJobCostEntry] Deleting entry:", id);
  await apiFetch<void>(
    `/job_cost_entry/${id}`,
    {
      method: "DELETE",
    },
    "jobs",
  );
  console.log("[deleteJobCostEntry] Entry deleted successfully");
};

// Batch create multiple job cost entries
// Since Xano doesn't have a /batch endpoint, we'll make individual POST requests in parallel
export const batchCreateJobCostEntries = async (
  entries: Omit<JobCostEntry, "id" | "created_at" | "updated_at">[],
): Promise<JobCostEntry[]> => {
  console.log(
    "[batchCreateJobCostEntries] Creating",
    entries.length,
    "entries in parallel",
  );
  // Create all entries in parallel for much faster performance
  const createdEntries = await Promise.all(
    entries.map((entry) => addJobCostEntry(entry)),
  );
  console.log(
    "[batchCreateJobCostEntries] Successfully created",
    createdEntries.length,
    "entries",
  );
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
  jobIds: number[],
): Promise<{
  success: number;
  failures: { jobId: number; error: string }[];
}> => {
  const failures: { jobId: number; error: string }[] = [];
  let successCount = 0;

  // Delete jobs in parallel for better performance
  const results = await Promise.allSettled(
    jobIds.map(async (jobId) => {
      try {
        await deleteJob(jobId);
        return jobId;
      } catch (error) {
        throw {
          jobId,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      successCount++;
    } else {
      const failureData = result.reason as { jobId: number; error: string };
      failures.push(failureData);
    }
  });

  console.log(
    `[bulkDeleteJobs] Deleted ${successCount} of ${jobIds.length} jobs`,
  );
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
  updates: Partial<Job>,
): Promise<{
  success: Job[];
  failures: { jobId: number; error: string }[];
}> => {
  const failures: { jobId: number; error: string }[] = [];
  const success: Job[] = [];

  // Update jobs in parallel for better performance
  const results = await Promise.allSettled(
    jobIds.map(async (jobId) => {
      try {
        const updatedJob = await updateJob(jobId, updates);
        return updatedJob;
      } catch (error) {
        throw {
          jobId,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  results.forEach((result) => {
    if (result.status === "fulfilled") {
      success.push(result.value);
    } else {
      const failureData = result.reason as { jobId: number; error: string };
      failures.push(failureData);
    }
  });

  console.log(
    `[bulkUpdateJobs] Updated ${success.length} of ${jobIds.length} jobs`,
  );
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
export const getMachineVariables = async (
  processType: string,
): Promise<any[]> => {
  console.log(
    "[getMachineVariables] Fetching variables for process type:",
    processType,
  );

  const params = new URLSearchParams();
  params.append("process_type", processType);

  const endpoint = `/machine_variables?${params.toString()}`;

  const result = await apiFetch<any[]>(endpoint, {
    method: "GET",
  });

  console.log("[getMachineVariables] Response:", result);
  return result;
};

/**
 * Get all machine variables (for wizard configuration)
 * @returns Array of machine variable definitions
 */
export const getAllMachineVariables = async (): Promise<any[]> => {
  console.log("[getAllMachineVariables] Fetching all machine variables");

  const result = await apiFetch<any[]>("/machine_variables", {
    method: "GET",
  });

  console.log("[getAllMachineVariables] Response:", result);
  return result;
};

/**
 * Get machine variables by ID
 * @param machineVariablesId - The ID of the machine variables record
 * @returns Machine variables configuration
 */
export const getMachineVariablesById = async (
  machineVariablesId: number,
): Promise<any> => {
  console.log(
    "[getMachineVariablesById] Fetching machine variables by ID:",
    machineVariablesId,
  );

  const result = await apiFetch<any>(
    `/machine_variables/${machineVariablesId}`,
    {
      method: "GET",
    },
  );

  console.log("[getMachineVariablesById] Response:", result);
  return result;
};

/**
 * Update machine variables using PATCH
 * @param machineVariablesId - The ID of the machine variables record
 * @param variables - Object containing form fields and their values
 * @returns Updated machine variables
 */
export const updateMachineVariables = async (
  machineVariablesId: number,
  variables: Record<string, any>,
): Promise<any> => {
  console.log("[updateMachineVariables] Updating machine variables:", {
    machineVariablesId,
    variables,
    endpoint: `/machine_variables/${machineVariablesId}`,
    fullUrl: `${API_BASE_URL}/machine_variables/${machineVariablesId}`,
  });

  try {
    const requestBody = {
      machine_variables_id: machineVariablesId,
      variables: variables,
    };

    console.log(
      "[updateMachineVariables] Request body:",
      JSON.stringify(requestBody, null, 2),
    );

    const result = await apiFetch<any>(
      `/machine_variables/${machineVariablesId}`,
      {
        method: "PATCH",
        body: JSON.stringify(requestBody),
      },
    );

    console.log("[updateMachineVariables] Response:", result);
    return result;
  } catch (error: any) {
    console.error("[updateMachineVariables] Error details:", {
      machineVariablesId,
      endpoint: `/machine_variables/${machineVariablesId}`,
      fullUrl: `${API_BASE_URL}/machine_variables/${machineVariablesId}`,
      error: error.message,
      errorObject: error,
    });
    throw error;
  }
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
  facilitiesId?: number,
): Promise<JobCostEntry | null> => {
  try {
    console.log(
      "[syncJobCostEntryFromRequirements] Starting sync for job:",
      jobId,
    );

    // Parse requirements if it's a string
    let requirementsArray: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (typeof requirements === "string") {
      try {
        requirementsArray = JSON.parse(requirements);
      } catch (e) {
        console.error(
          "[syncJobCostEntryFromRequirements] Failed to parse requirements:",
          e,
        );
        return null;
      }
    } else {
      requirementsArray = requirements;
    }

    // Calculate average cost from requirements
    const averageCost = calculateAverageCostFromRequirements(requirementsArray);

    if (averageCost === 0) {
      console.log(
        "[syncJobCostEntryFromRequirements] No valid price_per_m found in requirements",
      );
      return null;
    }

    // Convert start date to timestamp if it's a string
    let dateTimestamp: number;
    if (typeof startDate === "string") {
      dateTimestamp = new Date(startDate).getTime();
    } else {
      dateTimestamp = startDate;
    }

    console.log(
      "[syncJobCostEntryFromRequirements] Calculated average cost:",
      averageCost,
    );

    // Check if a job_cost_entry already exists for this job and date range
    // We'll look for entries within a day of the start date to avoid duplicates
    const dayStart = dateTimestamp;
    const dayEnd = dateTimestamp + 24 * 60 * 60 * 1000;

    try {
      const existingEntries = await getJobCostEntries(
        facilitiesId,
        dayStart,
        dayEnd,
      );
      const existingEntry = existingEntries.find(
        (entry) => entry.job === jobId,
      );

      if (existingEntry) {
        // Update existing entry
        console.log(
          "[syncJobCostEntryFromRequirements] Updating existing entry:",
          existingEntry.id,
        );
        const updated = await updateJobCostEntry(existingEntry.id, {
          actual_cost_per_m: averageCost,
          notes: existingEntry.notes || "Auto-synced from requirements",
        });
        console.log(
          "[syncJobCostEntryFromRequirements] Entry updated successfully",
        );
        return updated;
      }
    } catch {
      // If fetching existing entries fails, continue to create new one
      console.log(
        "[syncJobCostEntryFromRequirements] Could not fetch existing entries, will create new",
      );
    }

    // Create new entry
    const newEntry = await addJobCostEntry({
      job: jobId,
      date: dateTimestamp,
      actual_cost_per_m: averageCost,
      notes: "Auto-synced from requirements",
      facilities_id: facilitiesId,
    });

    console.log(
      "[syncJobCostEntryFromRequirements] New entry created:",
      newEntry.id,
    );
    return newEntry;
  } catch (error) {
    console.error(
      "[syncJobCostEntryFromRequirements] Error syncing job cost entry:",
      error,
    );
    // Don't throw - we don't want to fail job creation/update if cost entry sync fails
    return null;
  }
};

// ============================================================================
// Machine Rules API Functions
// ============================================================================

/**
 * Get all machine rules with optional filters
 * @param processTypeKey - Filter by process type (e.g., 'insert', 'fold')
 * @param machineId - Filter by specific machine ID
 * @param active - Filter by active status
 * @returns Array of machine rules
 */
export const getMachineRules = async (
  processTypeKey?: string,
  machineId?: number,
  active?: boolean,
): Promise<MachineRule[]> => {
  const params = new URLSearchParams();

  if (processTypeKey) {
    params.append("process_type_key", processTypeKey);
  }

  if (machineId !== undefined && machineId !== null) {
    params.append("machine_id", machineId.toString());
  }

  if (active !== undefined) {
    params.append("active", active.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString
    ? `/machine_rules?${queryString}`
    : "/machine_rules";

  console.log("[getMachineRules] Fetching rules from:", endpoint);
  const result = await apiFetch<MachineRule[]>(endpoint, {
    method: "GET",
  });
  console.log("[getMachineRules] Received", result.length, "rules");
  return result;
};

/**
 * Get a single machine rule by ID
 * @param ruleId - The rule ID
 * @returns Machine rule
 */
export const getMachineRule = async (ruleId: number): Promise<MachineRule> => {
  console.log("[getMachineRule] Fetching rule:", ruleId);
  return apiFetch<MachineRule>(`/machine_rules/${ruleId}`, {
    method: "GET",
  });
};

/**
 * Create a new machine rule
 * @param ruleData - The rule data (without id, created_at, updated_at)
 * @returns Created machine rule
 */
export const createMachineRule = async (
  ruleData: Omit<MachineRule, "id" | "created_at" | "updated_at">,
): Promise<MachineRule> => {
  console.log("[createMachineRule] Creating rule:", ruleData);
  const result = await apiFetch<MachineRule>("/machine_rules", {
    method: "POST",
    body: JSON.stringify(ruleData),
  });
  console.log("[createMachineRule] Rule created with ID:", result.id);
  return result;
};

/**
 * Update an existing machine rule
 * @param ruleId - The rule ID
 * @param ruleData - Partial rule data to update
 * @returns Updated machine rule
 */
export const updateMachineRule = async (
  ruleId: number,
  ruleData: Partial<Omit<MachineRule, "id" | "created_at" | "updated_at">>,
): Promise<MachineRule> => {
  console.log(
    "[updateMachineRule] Updating rule:",
    ruleId,
    "with data:",
    ruleData,
  );
  const result = await apiFetch<MachineRule>(`/machine_rules/${ruleId}`, {
    method: "PATCH",
    body: JSON.stringify(ruleData),
  });
  console.log("[updateMachineRule] Rule updated successfully");
  return result;
};

/**
 * Delete a machine rule
 * @param ruleId - The rule ID
 */
export const deleteMachineRule = async (ruleId: number): Promise<void> => {
  console.log("[deleteMachineRule] Deleting rule:", ruleId);
  await apiFetch<void>(`/machine_rules/${ruleId}`, {
    method: "DELETE",
  });
  console.log("[deleteMachineRule] Rule deleted successfully");
};

// ============================================================================
// Variable Combinations API Functions
// ============================================================================

/**
 * Get all variable combinations (groups) - used for displaying groups in machine wizard
 * @returns Array of variable combinations with rule_name used as group name
 */
export const getAllVariableCombinations = async (): Promise<any[]> => {
  console.log("[getAllVariableCombinations] Fetching all variable combinations groups");
  
  const result = await apiFetch<any[]>("/variable_combinations/groups", {
    method: "GET",
  });
  
  console.log(
    "[getAllVariableCombinations] Received",
    result.length,
    "variable combinations groups",
  );
  return result;
};

/**
 * Get variable combinations (rules) by machine_variables_id
 * @param machineVariablesId - The machine variables ID
 * @returns Array of variable combinations
 */
export const getVariableCombinations = async (
  machineVariablesId: number,
): Promise<any[]> => {
  console.log(
    "[getVariableCombinations] Fetching variable combinations for machine_variables_id:",
    machineVariablesId,
  );
  
  const params = new URLSearchParams();
  params.append("machine_variables_id", machineVariablesId.toString());
  
  const endpoint = `/variable_combinations?${params.toString()}`;
  
  const result = await apiFetch<any[]>(endpoint, {
    method: "GET",
  });
  
  console.log(
    "[getVariableCombinations] Received",
    result.length,
    "variable combinations",
  );
  return result;
};

/**
 * Create a variable combination (rule) for machine variables
 * @param ruleData - The rule data with rule_name, conditions, fixed_rate, and speed_modifier
 * @returns Created variable combination
 */
export const createVariableCombination = async (ruleData: {
  rule_name: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string | number;
    logicalOperator?: string;
  }>;
  fixed_rate: number;
  speed_modifier: number;
  people_required: number;
  notes: string;
  machine_variables_id: number;
}): Promise<any> => {
  console.log("[createVariableCombination] Creating variable combination:", ruleData);
  const result = await apiFetch<any>("/variable_combinations", {
    method: "POST",
    body: JSON.stringify(ruleData),
  });
  console.log("[createVariableCombination] Variable combination created:", result);
  return result;
};

/**
 * Delete a variable combination (rule) by ID
 * @param variableCombinationId - The variable combination ID
 */
export const deleteVariableCombination = async (
  variableCombinationId: number,
): Promise<void> => {
  console.log(
    "[deleteVariableCombination] Deleting variable combination:",
    variableCombinationId,
  );
  await apiFetch<void>(`/variable_combinations/${variableCombinationId}`, {
    method: "DELETE",
  });
  console.log("[deleteVariableCombination] Variable combination deleted successfully");
};

// ============================================================================
// Job Edit Logs API Functions
// ============================================================================

/**
 * Get job edit logs, optionally filtered by job ID
 * @param jobsId - Optional job ID to filter logs by
 * @returns Array of job edit logs
 */
export const getJobEditLogs = async (jobsId?: number): Promise<any[]> => {
  const params = new URLSearchParams();
  if (jobsId !== undefined && jobsId !== null) {
    params.append("jobs_id", jobsId.toString());
  }
  
  const queryString = params.toString();
  const endpoint = queryString
    ? `/job_edit_logs?${queryString}`
    : "/job_edit_logs";
  
  console.log("[getJobEditLogs] Fetching job edit logs", jobsId ? `for job ${jobsId}` : "for all jobs");
  const result = await apiFetch<any[]>(endpoint, {
    method: "GET",
  }, "jobs");
  console.log("[getJobEditLogs] Received", result.length, "edit logs");
  return result;
};

// ============================================================================
// Job Templates API Functions
// ============================================================================

/**
 * Get job templates for a specific client
 * @param clientsId - The client ID to filter templates by
 * @returns Array of job templates
 */
export const getJobTemplates = async (clientsId?: number): Promise<any[]> => {
  console.log("[getJobTemplates] Fetching job templates", clientsId ? `for client ${clientsId}` : "for all clients");
  const token = getToken();
  const url = new URL("https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/job_templates");
  
  if (clientsId) {
    url.searchParams.append("clients_id", clientsId.toString());
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[getJobTemplates] Error:", errorData);
    throw new Error(`Failed to fetch job templates: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log("[getJobTemplates] Received", Array.isArray(result) ? result.length : 1, "template(s)");
  return Array.isArray(result) ? result : [result];
};

/**
 * Create a new job template
 * @param templateData - The template data with clients_id and template object
 * @returns Created job template
 */
export const createJobTemplate = async (templateData: {
  clients_id: number;
  template: Record<string, any>;
}): Promise<any> => {
  console.log("[createJobTemplate] Creating job template:", templateData);
  const token = getToken();
  
  const response = await fetch("https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/job_templates", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(templateData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[createJobTemplate] Error:", errorData);
    throw new Error(`Failed to create job template: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log("[createJobTemplate] Template created:", result);
  return result;
};

/**
 * Update an existing job template
 * @param templateData - The template data with job_templates_id and template object
 * @returns Updated job template
 */
export const updateJobTemplate = async (templateData: {
  job_templates_id: number;
  template: Record<string, any>;
}): Promise<any> => {
  console.log("[updateJobTemplate] Updating job template:", templateData);
  const token = getToken();
  
  const response = await fetch("https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/job_templates", {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(templateData),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[updateJobTemplate] Error:", errorData);
    throw new Error(`Failed to update job template: ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  console.log("[updateJobTemplate] Template updated:", result);
  return result;
};

/**
 * Delete a job template
 * @param jobTemplatesId - The job template ID to delete
 */
export const deleteJobTemplate = async (jobTemplatesId: number): Promise<void> => {
  console.log("[deleteJobTemplate] Deleting job template:", jobTemplatesId);
  const token = getToken();
  
  const response = await fetch("https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/job_templates", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ job_templates_id: jobTemplatesId }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error("[deleteJobTemplate] Error:", errorData);
    throw new Error(`Failed to delete job template: ${JSON.stringify(errorData)}`);
  }

  console.log("[deleteJobTemplate] Template deleted successfully");
};
