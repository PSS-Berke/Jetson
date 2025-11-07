import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { getProductionEntries } from '@/lib/api';
import { mergeProjectionsWithActuals, calculateProductionSummary } from '@/lib/productionUtils';
import { useJobs } from './useJobs';
import type { ProductionEntry, ProductionComparison } from '@/types';

interface UseProductionOptions {
  facilitiesId?: number;
  startDate?: number;
  endDate?: number;
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
const productionFetcher = async (facilitiesId?: number, startDate?: number, endDate?: number) => {
  try {
    return await getProductionEntries(facilitiesId, startDate, endDate);
  } catch (err) {
    // Silently handle error - backend may not be configured yet
    console.log('[useProduction] Production data not available (backend not configured yet)');
    return [];
  }
};

/**
 * Hook for managing production tracking data
 * Fetches production entries and merges with job projections
 */
export const useProduction = (options: UseProductionOptions = {}): UseProductionReturn => {
  const { facilitiesId, startDate, endDate } = options;

  // Fetch jobs using existing hook (now with SWR caching)
  const { jobs, isLoading: isLoadingJobs, refetch: refetchJobs } = useJobs(facilitiesId);

  // Create unique SWR key for production entries
  const productionKey = useMemo(
    () => ['production', facilitiesId, startDate, endDate],
    [facilitiesId, startDate, endDate]
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
    }
  );

  // Refetch both jobs and production entries in parallel
  const refetch = useCallback(async () => {
    await Promise.all([refetchJobs(), mutateProduction()]);
  }, [refetchJobs, mutateProduction]);

  // Merge projections with actuals
  const comparisons = useMemo<ProductionComparison[]>(() => {
    if (jobs.length > 0 && startDate && endDate && productionEntries) {
      return mergeProjectionsWithActuals(jobs, productionEntries, startDate, endDate);
    }
    return [];
  }, [jobs, productionEntries, startDate, endDate]);

  // Calculate summary statistics
  const summary = useMemo(
    () => (comparisons.length > 0 ? calculateProductionSummary(comparisons) : null),
    [comparisons]
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
