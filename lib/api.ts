import Cookies from 'js-cookie';
import type {
  Machine,
  Job,
  User,
  LoginCredentials,
  SignupData,
  AuthResponse
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
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));

    // Log error details for debugging
    console.error('[API Error]', {
      endpoint,
      status: response.status,
      error
    });

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

  return response.json();
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

  if (status && status !== '') {
    params.append('status', status);
  } else {
    params.append('status', '');
  }

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

// Get all jobs
export const getJobs = async (): Promise<Job[]> => {
  return apiFetch<Job[]>('/jobs', {
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
