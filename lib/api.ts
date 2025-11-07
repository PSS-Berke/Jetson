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

    // Suppress error logging for production_entry endpoint (backend may not be configured yet)
    const isProductionEndpoint = endpoint.includes('/production_entry');

    // Log error details for debugging (unless it's expected production endpoint error)
    if (!isProductionEndpoint) {
      console.error('[API Error]', {
        endpoint,
        status: response.status,
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

  const data = await apiFetch<Machine[]>(endpoint, {
    method: 'GET',
  });

  return data;
};

// Create a new machine
export const createMachine = async (machineData: Omit<Machine, 'id' | 'created_at'>): Promise<Machine> => {
  console.log('[createMachine] Creating machine:', machineData);
  console.log('[createMachine] Capabilities object:', machineData.capabilities);
  console.log('[createMachine] Request body:', JSON.stringify(machineData, null, 2));
  const result = await apiFetch<Machine>('/machines', {
    method: 'POST',
    body: JSON.stringify(machineData),
  });
  console.log('[createMachine] Response:', result);
  return result;
};

// Update an existing machine
export const updateMachine = async (machineId: number, machineData: Partial<Machine>): Promise<Machine> => {
  console.log('[updateMachine] Updating machine:', machineId, 'with data:', machineData);
  console.log('[updateMachine] Capabilities object:', machineData.capabilities);
  console.log('[updateMachine] Request body:', JSON.stringify(machineData, null, 2));
  const result = await apiFetch<Machine>(`/machines/${machineId}`, {
    method: 'PUT',
    body: JSON.stringify(machineData),
  });
  console.log('[updateMachine] Response:', result);
  return result;
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
