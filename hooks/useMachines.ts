'use client';

import { useState, useEffect } from 'react';
import { getMachines } from '@/lib/api';

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
}

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
