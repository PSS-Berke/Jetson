import { useMemo, useCallback } from "react";
import useSWR from "swr";
import { getProductionEntries } from "@/lib/api";
import {
  mergeProjectionsWithActuals,
  calculateProductionSummary,
} from "@/lib/productionUtils";
import { useJobsV2 } from "./useJobsV2";
import type { ProductionEntry, ProductionComparison } from "@/types";

interface UseProductionOptions {
  facilitiesId?: number;
  startDate?: number;
  endDate?: number;
  search?: string;
}

interface UseProductionReturn {
  productionEntries: ProductionEntry[];
  comparisons: ProductionComparison[];
  summary: ReturnType<typeof calculateProductionSummary> | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// SWR fetcher for production entries
const productionFetcher = async (
  facilitiesId?: number,
  startDate?: number,
  endDate?: number,
) => {
  try {
    return await getProductionEntries(facilitiesId, startDate, endDate);
  } catch (err) {
    // Silently handle error - backend may not be configured yet
    console.log(
      "[useProduction] Production data not available (backend not configured yet)",
    );
    return [];
  }
};

/**
 * Hook for managing production tracking data
 * Fetches production entries and merges with job projections
 */
export const useProduction = (
  options: UseProductionOptions = {},
): UseProductionReturn => {
  const { facilitiesId, startDate, endDate, search } = options;

  // Fetch jobs using v2 API (includes actual_quantity from jobs table)
  const {
    jobs,
    isLoading: isLoadingJobs,
    refetch: refetchJobs,
  } = useJobsV2({
    facilities_id: facilitiesId ?? 0,
    fetchAll: true,
    // When a search term is provided, only fetch matching jobs so
    // production comparisons respect the API-level search results.
    search: search ?? "",
  });

  // Create unique SWR key for production entries
  const productionKey = useMemo(
    () => ["production", facilitiesId, startDate, endDate],
    [facilitiesId, startDate, endDate],
  );

  // Fetch production entries with SWR
  const {
    data: productionEntries,
    error: productionError,
    isLoading: isLoadingProduction,
    mutate: mutateProduction,
  } = useSWR(
    productionKey,
    () => productionFetcher(facilitiesId, startDate, endDate),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      revalidateOnReconnect: true,
      shouldRetryOnError: false, // Don't retry on error since it might not be configured
    },
  );

  // Refetch both jobs and production entries in parallel
  const refetch = useCallback(async () => {
    await Promise.all([refetchJobs(), mutateProduction()]);
  }, [refetchJobs, mutateProduction]);

  // Merge projections with actuals
  const comparisons = useMemo<ProductionComparison[]>(() => {
    if (jobs.length > 0 && startDate && endDate && productionEntries) {
      return mergeProjectionsWithActuals(
        jobs,
        productionEntries,
        startDate,
        endDate,
        search,
      );
    }
    return [];
  }, [jobs, productionEntries, startDate, endDate, search]);

  // Calculate summary statistics
  const summary = useMemo(
    () =>
      comparisons.length > 0 ? calculateProductionSummary(comparisons) : null,
    [comparisons],
  );

  // Combined loading state
  const isLoading = isLoadingJobs || isLoadingProduction;

  return {
    productionEntries: productionEntries ?? [],
    comparisons,
    summary,
    isLoading,
    error: productionError?.message ?? null,
    refetch,
  };
};
