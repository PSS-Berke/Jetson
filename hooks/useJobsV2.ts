"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { getJobsV2, type JobV2 } from "@/lib/api";
import { parseJob, type ParsedJob } from "./useJobs";

interface UseJobsV2Params {
  facilities_id?: number; // 0, 1, or 2 (0 = all facilities)
  page?: number;
  per_page?: number;
  search?: string;
  fetchAll?: boolean; // If true, fetch all pages
}

interface UseJobsV2Return {
  jobs: ParsedJob[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  pagination: {
    itemsReceived: number;
    curPage: number;
    nextPage: number | null;
    prevPage: number | null;
    offset: number;
    perPage: number;
  } | null;
}

/**
 * Convert JobV2 to ParsedJob format
 * This handles the time_split data and converts machines_id array to machines array
 */
function convertJobV2ToParsedJob(jobV2: JobV2): ParsedJob {
  // Convert machines_id array to machines array format
  const machines = (jobV2.machines_id || []).map((id) => ({
    id,
    line: "", // Line info not available in v2 API
  }));

  // Create a base job object compatible with Job type
  const baseJob = {
    ...jobV2,
    machines_id: JSON.stringify(machines), // Convert back to string for compatibility
    machines: JSON.stringify(machines), // Also set machines field
  };

  // Parse the job using the existing parseJob function
  const parsed = parseJob(baseJob as any);

  // Attach time_split data if available
  if (jobV2.time_split) {
    (parsed as any).time_split = jobV2.time_split;
  }

  return parsed;
}

/**
 * Fetch all pages of jobs
 */
async function fetchAllJobs(
  params: UseJobsV2Params,
): Promise<{ jobs: ParsedJob[]; pagination: any }> {
  const allJobs: ParsedJob[] = [];
  let currentPage = params.page || 1;
  let hasMore = true;
  let lastPagination: any = null;

  while (hasMore) {
    const response = await getJobsV2({
      ...params,
      page: currentPage,
    });

    // Convert and add jobs
    const parsedJobs = response.items.map(convertJobV2ToParsedJob);
    allJobs.push(...parsedJobs);

    lastPagination = {
      itemsReceived: response.itemsReceived,
      curPage: response.curPage,
      nextPage: response.nextPage,
      prevPage: response.prevPage,
      offset: response.offset,
      perPage: response.perPage,
    };

    // Check if there are more pages
    hasMore = response.nextPage !== null;
    if (hasMore) {
      currentPage = response.nextPage;
    }
  }

  return { jobs: allJobs, pagination: lastPagination };
}

// SWR fetcher function
// When using array keys, SWR passes the entire key array as the first argument
const fetcher = async ([_key, params]: [string, UseJobsV2Params]) => {
  if (!params) {
    throw new Error("Params are required");
  }
  
  if (params.fetchAll) {
    // Fetch all pages
    const result = await fetchAllJobs(params);
    return result;
  } else {
    // Fetch single page
    const response = await getJobsV2(params);
    const parsedJobs = response.items.map(convertJobV2ToParsedJob);
    return {
      jobs: parsedJobs,
      pagination: {
        itemsReceived: response.itemsReceived,
        curPage: response.curPage,
        nextPage: response.nextPage,
        prevPage: response.prevPage,
        offset: response.offset,
        perPage: response.perPage,
      },
    };
  }
};

export const useJobsV2 = (params: UseJobsV2Params = {}): UseJobsV2Return => {
  const {
    facilities_id = 0,
    page = 1,
    per_page = 15,
    search = "",
    fetchAll = true, // Default to fetching all for projections
  } = params;

  // Create params object for the fetcher
  const fetcherParams: UseJobsV2Params = {
    facilities_id,
    page,
    per_page,
    search,
    fetchAll,
  };

  // Create a unique key for SWR caching
  const key = JSON.stringify({
    jobsV2: true,
    ...fetcherParams,
    page: fetchAll ? "all" : page, // Use "all" in key when fetching all pages
  });

  // Use SWR for data fetching with caching
  // Pass params as second element of array key so fetcher can access them
  const { data, error, isLoading, mutate } = useSWR(
    [key, fetcherParams],
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      revalidateOnReconnect: true,
      shouldRetryOnError: false,
      errorRetryCount: 0,
      onError: (err) => {
        console.error("[useJobsV2] Error fetching jobs:", err?.message || err);
      },
    },
  );

  // Parse jobs data with memoization
  const jobs = useMemo(() => data?.jobs ?? [], [data]);
  const pagination = useMemo(() => data?.pagination ?? null, [data]);

  return {
    jobs,
    isLoading,
    error: error?.message ?? null,
    pagination,
    refetch: async () => {
      await mutate();
    },
  };
};

