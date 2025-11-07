'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { getMachines } from '@/lib/api';
import type { Machine } from '@/types';

interface UseMachinesReturn {
  machines: Machine[];
  isLoading: boolean;
  error: string | null;
  refetch: (status?: string, facilitiesId?: number) => Promise<void>;
}

// SWR fetcher for machines
const machinesFetcher = async (status?: string, facilitiesId?: number) => {
  return await getMachines(status, facilitiesId);
};

export const useMachines = (initialStatus?: string, initialFacilityId?: number): UseMachinesReturn => {
  // Create unique SWR key
  const key = useMemo(
    () => ['machines', initialStatus, initialFacilityId],
    [initialStatus, initialFacilityId]
  );

  // Use SWR for data fetching with caching
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => machinesFetcher(initialStatus, initialFacilityId),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      revalidateOnReconnect: true,
      shouldRetryOnError: false, // Disable retries to avoid flooding console
      errorRetryCount: 0,
      onError: (err) => {
        console.error('[useMachines] Error fetching machines:', err?.message || err);
      }
    }
  );

  const machines = useMemo(() => data ?? [], [data]);

  return {
    machines,
    isLoading,
    error: error?.message ?? null,
    refetch: async (status?: string, facilitiesId?: number) => {
      // If parameters are provided, use them; otherwise use initial values
      const newStatus = status !== undefined ? status : initialStatus;
      const newFacilityId = facilitiesId !== undefined ? facilitiesId : initialFacilityId;

      await mutate(machinesFetcher(newStatus, newFacilityId), {
        revalidate: true,
      });
    },
  };
};
