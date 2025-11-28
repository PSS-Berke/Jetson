import Cookies from "js-cookie";
import type {
  Machine,
  MachineStatus,
  MachineCapabilityValue,
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
      console.log("[apiFetch] Raw error response:", {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText,
        endpoint: endpoint,
      });
      try {
        error = JSON.parse(errorText);
        // If error is an empty object or has no useful info, add status info
        if (Object.keys(error).length === 0 || (!error.message && !error.error && !error.detail)) {
          error = {
            message: `HTTP ${response.status}: ${response.statusText}`,
            status: response.status,
            statusText: response.statusText,
            rawResponse: errorText,
          };
        }
      } catch {
        error = {
          message: errorText || `HTTP ${response.status}: ${response.statusText}`,
          status: response.status,
          statusText: response.statusText,
        };
      }
    } catch {
      error = {
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
        statusText: response.statusText,
      };
    }

    // Suppress error logging for endpoints that may not be configured yet
    const isProductionEndpoint = endpoint.includes("/production_entry");
    const isJobCostEndpoint = endpoint.includes("/job_cost_entry");
    const isMachineRulesEndpoint = endpoint.includes("/machine_rules");
    const isMachineGroupsEndpoint = endpoint.includes("/machine_groups");
    const isVariableCombinationsEndpoint = endpoint.includes("/variable_combinations");
    const isMachineVariablesEndpoint = endpoint.includes("/machine_variables");
    const isCapabilityBucketsEndpoint = endpoint.includes("/capability_buckets");

    // Log error details for debugging (unless it's an expected endpoint error)
    if (
      !isProductionEndpoint &&
      !isJobCostEndpoint &&
      !isMachineRulesEndpoint &&
      !isMachineGroupsEndpoint &&
      !isVariableCombinationsEndpoint &&
      !isMachineVariablesEndpoint &&
      !isCapabilityBucketsEndpoint
    ) {
      console.error("[API Error]", {
        endpoint,
        baseType,
        fullUrl: `${baseType === "auth" ? AUTH_BASE_URL : baseType === "jobs" ? JOBS_BASE_URL : API_BASE_URL}${endpoint}`,
        status: response.status,
        statusText: response.statusText,
        error,
        errorMessage: error.message || error.error || error.detail || 'No error message',
        errorString: JSON.stringify(error, null, 2),
        rawErrorText: errorText,
        requestBody: options.body || 'No request body',
        requestMethod: options.method || 'GET',
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

// Update current user
export const updateUser = async (
  userData: Partial<User>,
): Promise<User> => {
  const data = await apiFetch<User>(
    "/auth/me",
    {
      method: "PATCH",
      body: JSON.stringify(userData),
    },
    "auth",
  );

  return data;
};

// Update notes color
export const updateNotesColor = async (color: string): Promise<void> => {
  await apiFetch<void>(
    "/notes_color",
    {
      method: "PUT",
      body: JSON.stringify({ color }),
    },
    "jobs",
  );
};

// Job Notes API
export interface JobNote {
  id?: number;
  created_at?: string;
  jobs_id: number[];
  notes: string;
  color?: string;
  email?: string;
  name?: string;

  // Cell-level note fields (optional for backward compatibility)
  is_cell_note?: boolean;
  cell_job_id?: number;
  cell_period_key?: string;        // e.g., "weekly:1693008000:1693612800"
  cell_period_label?: string;      // e.g., "8/25", "Nov '24"
  cell_granularity?: "weekly" | "monthly" | "quarterly";
}

// Get all job notes
export const getJobNotes = async (): Promise<JobNote[]> => {
  const data = await apiFetch<JobNote[]>(
    "/job_notes",
    {
      method: "GET",
    },
    "jobs",
  );
  return data;
};

// Create job note
export const createJobNote = async (
  jobNote: {
    jobs_id: number[];
    notes: string;
    is_cell_note?: boolean;
    cell_job_id?: number;
    cell_period_key?: string;
    cell_period_label?: string;
    cell_granularity?: "weekly" | "monthly" | "quarterly";
  },
): Promise<JobNote> => {
  const data = await apiFetch<JobNote>(
    "/job_notes",
    {
      method: "POST",
      body: JSON.stringify(jobNote),
    },
    "jobs",
  );
  return data;
};

// Update job note
export const updateJobNote = async (
  jobNoteId: number,
  jobNote: {
    jobs_id: number[];
    notes: string;
    is_cell_note?: boolean;
    cell_job_id?: number;
    cell_period_key?: string;
    cell_period_label?: string;
    cell_granularity?: "weekly" | "monthly" | "quarterly";
  },
): Promise<JobNote> => {
  const data = await apiFetch<JobNote>(
    `/job_notes/${jobNoteId}`,
    {
      method: "PUT",
      body: JSON.stringify(jobNote),
    },
    "jobs",
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

/**
 * Helper function to parse capabilities - handle both JSON strings and objects
 * Standardized to always return a valid capabilities object
 */
const parseCapabilities = (capabilities: any): Record<string, any> => {
  // Handle null/undefined
  if (!capabilities) {
    return {};
  }

  // If it's already an object (and not an array), return it
  if (typeof capabilities === 'object' && !Array.isArray(capabilities)) {
    return capabilities;
  }

  // If it's a string, try to parse it as JSON
  if (typeof capabilities === 'string') {
    // Handle empty string
    if (capabilities.trim() === '') {
      return {};
    }

    try {
      const parsed = JSON.parse(capabilities);
      // Only return if it's a valid object (not array, null, etc.)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('[parseCapabilities] Failed to parse capabilities as JSON:', {
        capabilities,
        error: e,
      });
    }
  }

  // Fallback for any other type
  console.warn('[parseCapabilities] Unexpected capabilities type:', {
    type: typeof capabilities,
    value: capabilities,
  });
  return {};
};

/**
 * Map URL machine type to API type format
 * URL types: inserters, folders, hp-press, inkjetters, affixers
 * API types: inserts, folders, hp press, inkjetters, affixers
 */
const mapMachineTypeToAPI = (type?: string): string | undefined => {
  if (!type) return undefined;
  
  const typeMap: Record<string, string> = {
    inserters: "inserts",
    folders: "folders",
    "hp-press": "hp press",
    inkjetters: "inkjetters",
    affixers: "affixers",
    // Also handle direct API types
    inserts: "inserts",
    "hp press": "hp press",
  };
  
  return typeMap[type.toLowerCase()] || undefined;
};

// Get all machines
export const getMachines = async (
  status?: string,
  facilitiesId?: number,
  type?: string,
): Promise<Machine[]> => {
  // Build query parameters - API expects GET with query params
  // NOTE: We removed type filtering from the API call because Xano has inconsistent
  // capitalization (e.g., "Insert" vs "insert"). We'll filter client-side instead.
  const params = new URLSearchParams();

  // Only append status parameter if it has a valid value
  if (status && status.trim() !== "" && status !== "undefined" && status !== "null") {
    params.append("status", status.trim());
  }

  // Only append facilities_id parameter if it has a valid value
  if (facilitiesId !== undefined && facilitiesId !== null && facilitiesId > 0 && !isNaN(facilitiesId)) {
    params.append("facilities_id", facilitiesId.toString());
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/machines?${queryString}` : "/machines";

  console.log("[getMachines] Fetching machines with endpoint:", endpoint, {
    status,
    facilitiesId,
    type,
  });

  const data = await apiFetch<any[]>(endpoint, {
    method: "GET",
  });

  // Transform API response to match Machine interface
  const transformedMachines = data.map((machine) => {
    // Normalize process_type_key (handle capitalization and extra text)
    const normalizeProcessTypeKey = (key: string | undefined): string => {
      if (!key) return "";
      const normalized = key.toLowerCase().trim();

      // Map common variations to standard keys
      if (normalized.includes("insert")) return "insert";
      if (normalized.includes("fold")) return "fold";
      if (normalized.includes("affix") || normalized.includes("glue")) return "affix";
      if (normalized.includes("ink") || normalized.includes("jet")) return "inkjet";
      if (normalized.includes("laser") || normalized.includes("hp") || normalized.includes("press")) return "hpPress";
      if (normalized.includes("data")) return "data";

      return normalized;
    };

    // Normalize status (convert "Offline" to "offline", etc.)
    const normalizeStatus = (status: string): MachineStatus => {
      const normalized = status.toLowerCase().trim();
      if (normalized === "offline") {
        return "available"; // Map offline to available for now
      }
      if (
        normalized === "running" ||
        normalized === "available" ||
        normalized === "avalible" ||
        normalized === "maintenance"
      ) {
        return normalized as MachineStatus;
      }
      return "available"; // Default fallback
    };

    // Parse line - keep as string (can be alphanumeric like "a1", "fm1", etc.)
    const parseLine = (line: string | number | undefined): string => {
      if (typeof line === "string") return line;
      if (typeof line === "number") return String(line);
      return "";
    };

    // Parse speed_hr - handle string numbers
    const parseSpeedHr = (speed: string | number | undefined): number => {
      if (typeof speed === "number") return speed;
      if (typeof speed === "string") {
        const parsed = parseFloat(speed);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    // Parse shift_capacity - handle both snake_case and camelCase
    const parseShiftCapacity = (
      capacity: string | number | undefined,
    ): number | undefined => {
      if (capacity === undefined || capacity === null || capacity === "") {
        return undefined;
      }
      if (typeof capacity === "number") return capacity;
      if (typeof capacity === "string") {
        const parsed = parseFloat(capacity);
        return isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    };

    return {
      ...machine,
      line: parseLine(machine.line),
      capabilities: parseCapabilities(machine.capabilities),
      speed_hr: parseSpeedHr(machine.speed_hr),
      shiftCapacity:
        parseShiftCapacity(machine.shift_capacity) ||
        parseShiftCapacity(machine.shiftCapacity),
      status: normalizeStatus(machine.status || "available"),
      // Normalize process_type_key to handle capitalization and extra text
      process_type_key: normalizeProcessTypeKey(machine.process_type_key) ||
        inferProcessTypeKey(machine.type),
    };
  });

  // Apply client-side type filtering if specified
  if (type) {
    const normalizedFilterType = type.toLowerCase().trim();
    return transformedMachines.filter((machine) => {
      const machineType = machine.type?.toLowerCase() || "";
      const processTypeKey = machine.process_type_key?.toLowerCase() || "";

      // Map filter type to what we should match against
      if (normalizedFilterType === "inserters" || normalizedFilterType === "insert") {
        return machineType.includes("insert") || processTypeKey === "insert";
      }
      if (normalizedFilterType === "folders" || normalizedFilterType === "fold") {
        return machineType.includes("fold") || processTypeKey === "fold";
      }
      if (normalizedFilterType === "hp-press" || normalizedFilterType === "hppress") {
        return machineType.includes("hp") || machineType.includes("press") || processTypeKey === "hppress";
      }
      if (normalizedFilterType === "inkjetters" || normalizedFilterType === "inkjet") {
        return machineType.includes("inkjet") || processTypeKey === "inkjet";
      }
      if (normalizedFilterType === "affixers" || normalizedFilterType === "affix") {
        return machineType.includes("affix") || processTypeKey === "affix";
      }

      // Default: try to match type directly
      return machineType.includes(normalizedFilterType) || processTypeKey === normalizedFilterType;
    });
  }

  return transformedMachines;
};

// Helper function to infer process_type_key from machine type
// NOTE: This should only be used as a fallback. New code should explicitly set process_type_key.
const inferProcessTypeKey = (type: string): string => {
  const typeMap: { [key: string]: string } = {
    insert: "insert",
    inserter: "insert",
    inserters: "insert",
    folder: "fold",
    folders: "fold",
    fold: "fold",
    "hp press": "hpPress", // Changed from "laser" to "hpPress" for consistency
    laser: "hpPress",
    inkjet: "inkjet",
    inkjetter: "inkjet",
    inkjetters: "inkjet",
    affix: "affix",
    affixer: "affix",
    affixers: "affix",
  };

  const normalizedType = type.toLowerCase().trim();
  const inferredKey = typeMap[normalizedType] || "insert";

  // Log when inference is used to help debug mapping issues
  console.log(`[inferProcessTypeKey] Inferring process type from machine type "${type}" -> "${inferredKey}"`);

  return inferredKey;
};

// Create a new machine
export const createMachine = async (
  machineData: Omit<Machine, "id" | "created_at">,
): Promise<Machine> => {
  console.log("[createMachine] Creating machine:", machineData);
  console.log("[createMachine] Capabilities object:", machineData.capabilities);

  // Extract paper_size and pockets from capabilities if they exist
  const capabilities: Record<string, MachineCapabilityValue> = 
    (machineData.capabilities && typeof machineData.capabilities === 'object' && !Array.isArray(machineData.capabilities))
      ? machineData.capabilities as Record<string, MachineCapabilityValue>
      : {};
  const paper_size = capabilities.paper_size 
    ? String(capabilities.paper_size) 
    : capabilities.supported_paper_sizes 
      ? (Array.isArray(capabilities.supported_paper_sizes) 
          ? capabilities.supported_paper_sizes[0] 
          : String(capabilities.supported_paper_sizes))
      : "";
  const pockets = capabilities.pockets 
    ? Number(capabilities.pockets) 
    : capabilities.max_pockets 
      ? Number(capabilities.max_pockets) 
      : 0;

  // Get designation - prefer explicit designation, otherwise try to extract from name
  let designation = "";
  if ((machineData as any).designation) {
    designation = String((machineData as any).designation);
  } else if ((machineData as any).name) {
    // Try to extract designation from name (e.g., "Machine Name fm1" -> "fm1")
    const nameParts = String((machineData as any).name).split(" ");
    if (nameParts.length > 1) {
      const lastPart = nameParts[nameParts.length - 1];
      // Check if last part looks like a designation (alphanumeric, typically short)
      if (/^[a-zA-Z0-9]+$/.test(lastPart) && lastPart.length <= 10) {
        designation = lastPart;
      }
    }
  }

  // Determine type field - use provided type, or derive from name/process_type_key
  let type = machineData.type || "";
  if (!type && (machineData as any).name) {
    // Use name as type, or derive from process_type_key
    const processTypeKey = machineData.process_type_key || "";
    if (processTypeKey && typeof processTypeKey === 'string') {
      // Map process_type_key to a display name
      const typeMap: { [key: string]: string } = {
        insert: "Inserter",
        fold: "Folder",
        laser: "HP Press",
        hppress: "HP Press", // Added to handle hpPress key
        inkjet: "Inkjetter",
        affix: "Affixer",
      };
      type = typeMap[processTypeKey.toLowerCase()] || String((machineData as any).name);
      console.log(`[createMachine] Derived type "${type}" from process_type_key "${processTypeKey}"`);
    } else {
      type = String((machineData as any).name);
    }
  }

  // Transform frontend data to API format that Xano expects
  // Based on Xano's expected format:
  // - quantity should be 1 (For Loop will execute once to create one machine)
  // - speed_hr should be a string
  // - shift_capacity should be snake_case
  // - Include all expected fields with defaults
  const apiData: Record<string, any> = {
    quantity: 1, // For Loop executes this many times - we want to create 1 machine
    line: machineData.line?.toString() || "",
    name: machineData.name || "",
    type: type,
    speed_hr: machineData.speed_hr?.toString() || "0",
    status: machineData.status || "available",
    facilities_id: machineData.facilities_id || 0,
    paper_size: paper_size,
    shift_capacity: machineData.shiftCapacity?.toString() || "",
    jobs_id: 0,
    pockets: pockets,
    capabilities: machineData.capabilities || {}, // Standardized: only use capabilities field
    people_per_process: machineData.people_per_process || 1,
    designation: designation,
  };

  // Add machine_category if provided
  if (machineData.machine_category) {
    apiData.machine_category = machineData.machine_category;
  }

  // Add machine_group_id if provided
  if (machineData.machine_group_id !== undefined && machineData.machine_group_id !== null) {
    apiData.machine_group_id = machineData.machine_group_id;
  }

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

  console.log("[createMachine] Extracted machineResult:", machineResult);
  console.log("[createMachine] machineResult.capabilities:", machineResult.capabilities);

  // Parse capabilities from response - prefer capabilities field
  const parsedCapabilities = parseCapabilities(machineResult.capabilities);

  // Transform API response to frontend format
  const createdMachine: Machine = {
    ...machineResult,
    line: machineResult.line
      ? typeof machineResult.line === "string"
        ? machineResult.line
        : String(machineResult.line)
      : "",
    capabilities: parsedCapabilities,
    speed_hr: machineResult.speed_hr
      ? typeof machineResult.speed_hr === "number"
        ? machineResult.speed_hr
        : parseFloat(machineResult.speed_hr)
      : 0,
    process_type_key:
      machineResult.process_type_key || inferProcessTypeKey(machineResult.type),
  };

  console.log("[createMachine] Created machine with capabilities:", createdMachine.capabilities);
  return createdMachine;
};

// Create multiple machines using line_list format
export const createMachinesBulk = async (bulkData: {
  quantity: number;
  line_list: string[];
  name: string;
  designation: string;
  facilities_id: number;
  process_type_key: string;
  machine_category?: string;
  capabilities: Record<string, MachineCapabilityValue>;
  status?: MachineStatus;
  variable_combination_id?: number;
  details?: Record<string, any>;
}): Promise<Machine[]> => {
  console.log("[createMachinesBulk] Creating machines in bulk:", bulkData);

  // Extract paper_size and pockets from capabilities if they exist
  const capabilities: Record<string, MachineCapabilityValue> = 
    (bulkData.capabilities && typeof bulkData.capabilities === 'object' && !Array.isArray(bulkData.capabilities))
      ? bulkData.capabilities as Record<string, MachineCapabilityValue>
      : {};
  const paper_size = capabilities.paper_size 
    ? String(capabilities.paper_size) 
    : capabilities.supported_paper_sizes 
      ? (Array.isArray(capabilities.supported_paper_sizes) 
          ? capabilities.supported_paper_sizes[0] 
          : String(capabilities.supported_paper_sizes))
      : "";
  const pockets = capabilities.pockets 
    ? Number(capabilities.pockets) 
    : capabilities.max_pockets 
      ? Number(capabilities.max_pockets) 
      : 0;

  // Determine type field - derive from process_type_key
  let type = "";
  const processTypeKey = bulkData.process_type_key || "";
  if (processTypeKey && typeof processTypeKey === 'string') {
    const typeMap: { [key: string]: string } = {
      insert: "Inserter",
      fold: "Folder",
      laser: "HP Press",
      hppress: "HP Press",
      inkjet: "Inkjetter",
      affix: "Affixer",
    };
    type = typeMap[processTypeKey.toLowerCase()] || bulkData.name;
  } else {
    type = bulkData.name;
  }

  // Transform to API format
  const apiData: Record<string, any> = {
    quantity: bulkData.quantity,
    line_list: bulkData.line_list,
    name: bulkData.name || "",
    type: type,
    status: bulkData.status || "available",
    facilities_id: bulkData.facilities_id || 0,
    designation: bulkData.designation || "",
    capabilities: bulkData.capabilities || {},
    process_type_key: bulkData.process_type_key || "",
    machine_category: bulkData.machine_category || "",
    details: bulkData.details || {},
    paper_size: paper_size,
    pockets: pockets,
    speed_hr: "0",
    shift_capacity: "",
    people_per_process: 1,
  };

  // Add variable_combination_id if provided (for machine groups)
  if (bulkData.variable_combination_id !== undefined && bulkData.variable_combination_id !== null) {
    apiData.variable_combination_id = bulkData.variable_combination_id;
  }

  console.log("[createMachinesBulk] Request body:", JSON.stringify(apiData, null, 2));

  const result = await apiFetch<any>("/machines", {
    method: "POST",
    body: JSON.stringify(apiData),
  });
  console.log("[createMachinesBulk] Response:", result);

  // Parse response - Xano may return machines1 array or similar
  let machinesResult: any[] = [];
  if (result.machines1) {
    machinesResult = Array.isArray(result.machines1) ? result.machines1 : [result.machines1];
  } else if (Array.isArray(result)) {
    machinesResult = result;
  } else if (result) {
    machinesResult = [result];
  }

  // Transform API response to frontend format
  const createdMachines: Machine[] = machinesResult.map((machineResult: any) => {
    const parsedCapabilities = parseCapabilities(machineResult.capabilities);
    return {
      ...machineResult,
      line: machineResult.line
        ? typeof machineResult.line === "string"
          ? machineResult.line
          : String(machineResult.line)
        : "",
      capabilities: parsedCapabilities,
      speed_hr: machineResult.speed_hr
        ? typeof machineResult.speed_hr === "number"
          ? machineResult.speed_hr
          : parseFloat(machineResult.speed_hr)
        : 0,
      process_type_key:
        machineResult.process_type_key || inferProcessTypeKey(machineResult.type),
    };
  });

  console.log("[createMachinesBulk] Created machines:", createdMachines);
  return createdMachines;
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
  // API expects: machines_id, line, type, status, facilities_id, name, capabilities, process_type_key, designation
  const apiData: any = {
    machines_id: machineId,
    line: machineData.line !== undefined ? String(machineData.line) : "",
    type: machineData.type || "",
    status: machineData.status || "",
    facilities_id: machineData.facilities_id || 0,
    name: machineData.name || "",
    capabilities: machineData.capabilities || {},
    process_type_key: machineData.process_type_key || "",
    designation: machineData.designation || "",
  };
  
  // Include speed_hr and shiftCapacity if provided
  if (machineData.speed_hr !== undefined) {
    apiData.speed_hr = machineData.speed_hr;
  }
  if (machineData.shiftCapacity !== undefined) {
    apiData.shiftCapacity = machineData.shiftCapacity;
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
    line: result.name ? String(result.name) : (result.line ? String(result.line) : ""),
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

// ============================================================================
// Jobs V2 API (Paginated with time_split)
// ============================================================================

/**
 * Time split data structure for jobs v2 API
 */
export interface TimeSplit {
  id: number;
  daily: Array<{
    date: string; // Format: "YYYY-MM-DD"
    quantity: number;
    year: number;
  }>;
  weekly: Array<{
    week_start: string; // Format: "YYYY-MM-DD"
    year: number;
    quantity: number;
  }>;
  monthly: Array<{
    month_start: string; // Format: "YYYY-MM-DD"
    year: number;
    quantity: number;
  }>;
  quarterly: Array<{
    quarter: number; // 1-4
    year: number;
    quantity: number;
  }>;
}

/**
 * Job with time_split data from v2 API
 */
export interface JobV2 extends Omit<Job, "machines_id"> {
  machines_id: number[]; // Array instead of string
  time_split: TimeSplit | null;
  sub_client_id?: number;
  schedule_type?: string;
  sub_client?: string;
  facility?: string;
  client?: string;
}

/**
 * Paginated response from jobs v2 API
 */
export interface JobsV2Response {
  itemsReceived: number;
  curPage: number;
  nextPage: number | null;
  prevPage: number | null;
  offset: number;
  perPage: number;
  items: JobV2[];
}

/**
 * Parameters for jobs v2 API request
 */
export interface GetJobsV2Params {
  facilities_id?: number; // 0, 1, or 2 (0 = all facilities)
  page?: number;
  per_page?: number;
  search?: string;
}

/**
 * Get jobs with pagination and time_split data (v2 API)
 * @param params - Query parameters for filtering and pagination
 * @returns Paginated response with jobs and time_split data
 */
export const getJobsV2 = async (
  params: GetJobsV2Params = {},
): Promise<JobsV2Response> => {
  const {
    facilities_id = 0,
    page = 1,
    per_page = 15,
    search = "",
  } = params;

  console.log("[getJobsV2] Fetching jobs with params:", {
    facilities_id,
    page,
    per_page,
    search,
  });

  // Build query parameters
  const queryParams = new URLSearchParams();
  queryParams.append("facilities_id", facilities_id.toString());
  queryParams.append("page", page.toString());
  queryParams.append("per_page", per_page.toString());
  if (search) {
    queryParams.append("search", search);
  }

  const endpoint = `/jobs/v2?${queryParams.toString()}`;
  const fullUrl = `${JOBS_BASE_URL}${endpoint}`;

  console.log("[getJobsV2] Full URL:", fullUrl);
  console.log("[getJobsV2] Endpoint:", endpoint);

  return apiFetch<JobsV2Response>(
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
            `[batchCreateJobs] Creating job:`,
            {
              job_number: job.job_number,
              clients_id: job.clients_id,
              facilities_id: job.facilities_id,
              quantity: job.quantity,
              start_date: job.start_date,
              due_date: job.due_date,
              fullJobData: job,
            }
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
          console.error(`[batchCreateJobs] Failed to create job:`, {
            jobNumber: job.job_number,
            clientsId: job.clients_id,
            facilitiesId: job.facilities_id,
            jobData: JSON.stringify(job, null, 2),
            error: error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorDetails: JSON.stringify(error, null, 2),
            errorStack: error instanceof Error ? error.stack : undefined,
          });
          throw {
            job,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      }),
    );

    chunkResults.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        success.push(result.value);
      } else {
        const failureData = result.reason as {
          job: Partial<Job>;
          error: string;
        };
        console.log(`[batchCreateJobs] Job ${i + idx + 1} failed:`, {
          jobNumber: failureData.job.job_number,
          error: failureData.error,
          reason: result.reason
        });
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
 * Get process type color from database
 * Falls back to gray if not found
 * @param processTypeKey - The process type key (e.g., 'insert', 'fold')
 * @param allVariables - Optional cached array of all machine variables to avoid extra API call
 * @returns Hex color code
 */
export const getProcessTypeColor = async (
  processTypeKey: string,
  allVariables?: any[],
): Promise<string> => {
  try {
    const variables = allVariables || (await getAllMachineVariables());
    const processType = variables.find((v) => v.type === processTypeKey);
    return processType?.color || "#6B7280"; // Gray fallback
  } catch (error) {
    console.error("[getProcessTypeColor] Error fetching color:", error);
    return "#6B7280"; // Gray fallback
  }
};

/**
 * Get process type label from database
 * Falls back to capitalized type key if not found
 * @param processTypeKey - The process type key (e.g., 'insert', 'fold')
 * @param allVariables - Optional cached array of all machine variables to avoid extra API call
 * @returns Display label
 */
export const getProcessTypeLabel = async (
  processTypeKey: string,
  allVariables?: any[],
): Promise<string> => {
  try {
    const variables = allVariables || (await getAllMachineVariables());
    const processType = variables.find((v) => v.type === processTypeKey);
    return (
      processType?.label ||
      processTypeKey.charAt(0).toUpperCase() + processTypeKey.slice(1)
    );
  } catch (error) {
    console.error("[getProcessTypeLabel] Error fetching label:", error);
    return processTypeKey.charAt(0).toUpperCase() + processTypeKey.slice(1);
  }
};

/**
 * Get all process type colors as a map
 * Useful for batch operations to avoid multiple API calls
 * @returns Record of process type key to color
 */
export const getAllProcessTypeColors = async (): Promise<
  Record<string, string>
> => {
  try {
    const variables = await getAllMachineVariables();
    const colorMap: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.type && v.color) {
        colorMap[v.type] = v.color;
      }
    });
    return colorMap;
  } catch (error) {
    console.error("[getAllProcessTypeColors] Error:", error);
    return {};
  }
};

/**
 * Get all process type labels as a map
 * Useful for batch operations to avoid multiple API calls
 * @returns Record of process type key to label
 */
export const getAllProcessTypeLabels = async (): Promise<
  Record<string, string>
> => {
  try {
    const variables = await getAllMachineVariables();
    const labelMap: Record<string, string> = {};
    variables.forEach((v) => {
      if (v.type) {
        labelMap[v.type] =
          v.label || v.type.charAt(0).toUpperCase() + v.type.slice(1);
      }
    });
    return labelMap;
  } catch (error) {
    console.error("[getAllProcessTypeLabels] Error:", error);
    return {};
  }
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

  try {
    const result = await apiFetch<MachineRule[]>(endpoint, {
      method: "GET",
    });
    console.log("[getMachineRules] Received", result.length, "rules");
    return result;
  } catch (error) {
    // If endpoint is not configured, return empty array
    console.log("[getMachineRules] Endpoint not available, returning empty array");
    return [];
  }
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

  try {
    const result = await apiFetch<any[]>("/variable_combinations/groups", {
      method: "GET",
    });

    console.log(
      "[getAllVariableCombinations] Received",
      result.length,
      "variable combinations groups",
    );
    return result;
  } catch (error) {
    console.log(
      "[getAllVariableCombinations] Endpoint not available or error occurred, returning empty array",
    );
    return [];
  }
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

  try {
    // Try fetching without filter first (some Xano endpoints don't support filtering)
    const endpoint = `/variable_combinations`;

    const result = await apiFetch<any[]>(endpoint, {
      method: "GET",
    });

    // Filter client-side by machine_variables_id
    const filtered = result.filter((combo: any) =>
      combo.machine_variables_id === machineVariablesId
    );

    console.log(
      "[getVariableCombinations] Received",
      result.length,
      "variable combinations,",
      filtered.length,
      "match machine_variables_id",
      machineVariablesId,
    );
    return filtered;
  } catch (error) {
    console.log(
      "[getVariableCombinations] Endpoint not available or error occurred, returning empty array",
    );
    return [];
  }
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
 * Create a new machine group (variable combination marked as a group)
 * @param groupData - The group data including name, description, and process type
 * @returns The created group with its ID
 */
export const createMachineGroup = async (groupData: {
  rule_name: string;
  description?: string;
  process_type?: string;
  is_grouped: boolean;
}): Promise<any> => {
  console.log("[createMachineGroup] Creating machine group:", groupData);
  const result = await apiFetch<any>("/variable_combinations", {
    method: "POST",
    body: JSON.stringify(groupData),
  });
  console.log("[createMachineGroup] Machine group created:", result);
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

// ============================================================================
// Capability Buckets API Functions
// ============================================================================

/**
 * Capability Bucket interface
 */
export interface CapabilityBucket {
  id: number;
  created_at: string;
  name: string;
  capabilities: Record<string, any>;
}

/**
 * Get all capability buckets
 * @returns Array of capability buckets
 */
export const getCapabilityBuckets = async (): Promise<CapabilityBucket[]> => {
  console.log("[getCapabilityBuckets] Fetching capability buckets");
  const result = await apiFetch<CapabilityBucket[]>("/capability_buckets", {
    method: "GET",
  });
  console.log("[getCapabilityBuckets] Received", result.length, "capability buckets");
  return result;
};

/**
 * Create a new capability bucket
 * @param bucketData - The capability bucket data with name and capabilities
 * @returns Created capability bucket
 */
export const createCapabilityBucket = async (bucketData: {
  name: string;
  capabilities: Record<string, any>;
}): Promise<CapabilityBucket> => {
  console.log("[createCapabilityBucket] Creating capability bucket:", bucketData);
  const result = await apiFetch<CapabilityBucket>("/capability_buckets", {
    method: "POST",
    body: JSON.stringify(bucketData),
  });
  console.log("[createCapabilityBucket] Capability bucket created:", result);
  return result;
};

/**
 * Update an existing capability bucket
 * @param bucketId - The capability bucket ID
 * @param bucketData - The updated capability bucket data
 * @returns Updated capability bucket
 */
export const updateCapabilityBucket = async (
  bucketId: number,
  bucketData: {
    name: string;
    capabilities: Record<string, any>;
  },
): Promise<CapabilityBucket> => {
  console.log("[updateCapabilityBucket] Updating capability bucket:", bucketId, bucketData);
  const result = await apiFetch<CapabilityBucket>(`/capability_buckets/${bucketId}`, {
    method: "PUT",
    body: JSON.stringify(bucketData),
  });
  console.log("[updateCapabilityBucket] Capability bucket updated:", result);
  return result;
};

/**
 * Delete a capability bucket
 * @param bucketId - The capability bucket ID
 */
export const deleteCapabilityBucket = async (bucketId: number): Promise<void> => {
  console.log("[deleteCapabilityBucket] Deleting capability bucket:", bucketId);
  await apiFetch<void>(`/capability_buckets/${bucketId}`, {
    method: "DELETE",
  });
  console.log("[deleteCapabilityBucket] Capability bucket deleted successfully");
};
