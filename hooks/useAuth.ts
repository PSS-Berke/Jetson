"use client";

import { useState } from "react";
import {
  login as apiLogin,
  signup as apiSignup,
  logout as apiLogout,
} from "@/lib/api";
import { useRouter } from "next/navigation";

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

interface UseAuthReturn {
  login: (credentials: LoginCredentials) => Promise<User>;
  signup: (userData: SignupData) => Promise<User>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

export const useAuth = (): UseAuthReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await apiLogin(credentials);
      router.push("/projections"); // Redirect to projections after successful login
      router.refresh(); // Refresh to update server components
      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Login failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: SignupData): Promise<User> => {
    setIsLoading(true);
    setError(null);

    try {
      const user = await apiSignup(userData);
      return user;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Signup failed";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (): void => {
    apiLogout();
    router.push("/login");
    router.refresh(); // Refresh to update server components
  };

  return {
    login,
    signup,
    logout,
    isLoading,
    error,
  };
};
