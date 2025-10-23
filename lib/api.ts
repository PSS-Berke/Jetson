import Cookies from 'js-cookie';

const AUTH_BASE_URL = 'https://xnpm-iauo-ef2d.n7e.xano.io/api:spcRzPtb';
const API_BASE_URL = 'https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb';
const TOKEN_KEY = 'auth_token';

interface LoginCredentials {
  email: string;
  password: string;
}

interface SignupData {
  email: string;
  password: string;
  admin: boolean;
}

interface User {
  id: number;
  email: string;
  admin: boolean;
  [key: string]: string | number | boolean | undefined;
}

interface AuthResponse {
  authToken: string;
  user?: User;
  [key: string]: string | number | boolean | User | undefined;
}

type MachineStatus = 'running' | 'available' | 'avalible' | 'maintenance';

interface Machine {
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

// Store token in cookies with fallback to localStorage
export const setToken = (token: string): void => {
  try {
    Cookies.set(TOKEN_KEY, token, { expires: 7, secure: true, sameSite: 'strict' });
  } catch {
    // Fallback to localStorage if cookies fail
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  }
};

// Get token from cookies with fallback to localStorage
export const getToken = (): string | null => {
  try {
    const token = Cookies.get(TOKEN_KEY);
    if (token) return token;

    // Fallback to localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  } catch {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  }
};

// Remove token from both cookies and localStorage
export const removeToken = (): void => {
  try {
    Cookies.remove(TOKEN_KEY);
  } catch {
    // Ignore errors
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
};

// Generic fetch wrapper with automatic token attachment
const apiFetch = async <T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  useAuthBase: boolean = false
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

  const baseUrl = useAuthBase ? AUTH_BASE_URL : API_BASE_URL;
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));

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
  }, true);

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
  }, true);

  return data;
};

// Get current user
export const getMe = async (): Promise<User> => {
  const data = await apiFetch<User>('/auth/me', {
    method: 'GET',
  }, true);

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
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/jobs', {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
};
