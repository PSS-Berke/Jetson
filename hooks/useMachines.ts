'use client';

import { useState, useEffect } from 'react';
import { getMachines } from '@/lib/api';
import type { Machine } from '@/types';

interface UseMachinesReturn {
  machines: Machine[];
  isLoading: boolean;
  error: string | null;
  refetch: (status?: string, facilitiesId?: number) => Promise<void>;
}

export const useMachines = (initialStatus?: string, initialFacilityId?: number): UseMachinesReturn => {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMachines = async (status?: string, facilitiesId?: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getMachines(status, facilitiesId);
      setMachines(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch machines';
      setError(errorMessage);
      setMachines([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMachines(initialStatus, initialFacilityId);
  }, [initialStatus, initialFacilityId]);

  return {
    machines,
    isLoading,
    error,
    refetch: fetchMachines,
  };
};
