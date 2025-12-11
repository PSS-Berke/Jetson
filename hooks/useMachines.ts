"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { getMachines } from "@/lib/api";
import type { Machine } from "@/types";

type MachineType = "inserter" | "folders" | "hp press" | "inkjetters" | "affixers";

interface UseMachinesReturn {
  machines: Machine[];
  isLoading: boolean;
  error: string | null;
  refetch: (status?: string, facilitiesId?: number, type?: MachineType) => Promise<void>;
}

// SWR fetcher for machines
const machinesFetcher = async (status?: string, facilitiesId?: number, type?: MachineType) => {
  return await getMachines(status, facilitiesId, type);
};

export const useMachines = (
  initialStatus?: string,
  initialFacilityId?: number,
  initialType?: MachineType,
): UseMachinesReturn => {
  // Create unique SWR key
  const key = useMemo(
    () => ["machines", initialStatus, initialFacilityId, initialType],
    [initialStatus, initialFacilityId, initialType],
  );

  // Use SWR for data fetching with caching
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => machinesFetcher(initialStatus, initialFacilityId, initialType),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      revalidateOnReconnect: true,
      shouldRetryOnError: false, // Disable retries to avoid flooding console
      errorRetryCount: 0,
      onError: (err) => {
        console.error(
          "[useMachines] Error fetching machines:",
          err?.message || err,
        );
      },
    },
  );

  const machines = useMemo(() => data ?? [], [data]);

  return {
    machines,
    isLoading,
    error: error?.message ?? null,
    refetch: async (status?: string, facilitiesId?: number, type?: MachineType) => {
      // If parameters are provided, use them; otherwise use initial values
      const newStatus = status !== undefined ? status : initialStatus;
      const newFacilityId =
        facilitiesId !== undefined ? facilitiesId : initialFacilityId;
      const newType = type !== undefined ? type : initialType;

      await mutate(machinesFetcher(newStatus, newFacilityId, newType), {
        revalidate: true,
      });
    },
  };
};
