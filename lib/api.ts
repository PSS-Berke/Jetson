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
  [key: string]: any;
}

interface AuthResponse {
  authToken: string;
  user?: User;
  [key: string]: any;
}

// Store token in cookies with fallback to localStorage
export const setToken = (token: string): void => {
  try {
    Cookies.set(TOKEN_KEY, token, { expires: 7, secure: true, sameSite: 'strict' });
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    // Ignore errors
  }
  if (typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
  }
};

// Generic fetch wrapper with automatic token attachment
const apiFetch = async (
  endpoint: string,
  options: RequestInit = {},
  useAuthBase: boolean = false
): Promise<any> => {
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
  const data: AuthResponse = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }, true);

  if (data.authToken) {
    setToken(data.authToken);
  }

  return data.user || data as any;
};

// Signup (admin creates new user)
export const signup = async (userData: SignupData): Promise<User> => {
  const data = await apiFetch('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(userData),
  }, true);

  return data;
};

// Get current user
export const getMe = async (): Promise<User> => {
  const data = await apiFetch('/auth/me', {
    method: 'GET',
  }, true);

  return data;
};

// Logout (client-side only)
export const logout = (): void => {
  removeToken();
};

// Get all machines
export const getMachines = async (status?: string, facilitiesId?: number): Promise<any[]> => {
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

  const data = await apiFetch(endpoint, {
    method: 'GET',
  });

  return data;
};

// Get all jobs
export const getJobs = async (): Promise<any[]> => {
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
