"use client";

import { useState, useEffect } from "react";
import { getMe, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";

interface User {
  id: number;
  email: string;
  admin: boolean;
  [key: string]: any;
}

interface UseUserReturn {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useUser = (): UseUserReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = async () => {
    const token = getToken();

    if (!token) {
      setIsLoading(false);
      setUser(null);
      // Redirect to login if no token
      if (typeof window !== "undefined") {
        router.push("/login");
      }
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const userData = await getMe();
      setUser(userData);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch user";
      setError(errorMessage);
      setUser(null);
      // Note: apiFetch already handles redirect for 401/expired tokens
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    user,
    isLoading,
    error,
    refetch: fetchUser,
  };
};
