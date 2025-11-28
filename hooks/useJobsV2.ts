"use client";

import { useMemo, useState, useEffect } from "react";
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
 * Fetch a single page of jobs
 */
async function fetchPage(
  params: UseJobsV2Params,
  page: number,
): Promise<{ jobs: ParsedJob[]; pagination: any }> {
  const response = await getJobsV2({
    ...params,
    page,
  });

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

/**
 * Fetch all pages of jobs (legacy - for backwards compatibility)
 */
async function fetchAllJobs(
  params: UseJobsV2Params,
): Promise<{ jobs: ParsedJob[]; pagination: any }> {
  const allJobs: ParsedJob[] = [];
  let currentPage = params.page || 1;
  let hasMore = true;
  let lastPagination: any = null;

  while (hasMore) {
    const result = await fetchPage(params, currentPage);
    allJobs.push(...result.jobs);
    lastPagination = result.pagination;

    // Check if there are more pages
    hasMore = result.pagination.nextPage !== null;
    if (hasMore) {
      currentPage = result.pagination.nextPage;
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

  // State to track accumulated jobs from all pages
  const [allJobs, setAllJobs] = useState<ParsedJob[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Create params object for the fetcher (page 1 only for initial fetch)
  const fetcherParams: UseJobsV2Params = {
    facilities_id,
    page: 1, // Always fetch page 1 first
    per_page,
    search,
    fetchAll: false, // Don't use fetchAll - we'll handle it manually
  };

  // Create a unique key for SWR caching (page 1 only)
  const key = JSON.stringify({
    jobsV2: true,
    ...fetcherParams,
    page: 1,
  });

  // Fetch page 1 immediately using SWR
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

  // Reset accumulated jobs when params change
  useEffect(() => {
    setAllJobs([]);
    setIsLoadingMore(false);
  }, [facilities_id, per_page, search]);

  // Update accumulated jobs when page 1 loads
  useEffect(() => {
    if (data?.jobs && data.jobs.length > 0) {
      setAllJobs(data.jobs);
    }
  }, [data?.jobs]);

  // Fetch remaining pages in the background if fetchAll is true
  useEffect(() => {
    if (!fetchAll || !data?.pagination?.nextPage || isLoading || isLoadingMore) {
      return;
    }

    // Track if we've already started fetching to prevent duplicate fetches
    let isFetching = false;

    // Fetch remaining pages in the background
    const fetchRemainingPages = async () => {
      if (isFetching) return;
      isFetching = true;
      setIsLoadingMore(true);

      const accumulatedJobs = [...(data.jobs || [])];
      let currentPage = data.pagination.nextPage;

      try {
        while (currentPage !== null) {
          const result = await fetchPage(fetcherParams, currentPage);

          // Avoid duplicates by checking job IDs
          const existingIds = new Set(accumulatedJobs.map((j) => j.id));
          const newJobs = result.jobs.filter((j) => !existingIds.has(j.id));
          accumulatedJobs.push(...newJobs);

          currentPage = result.pagination.nextPage;

          // Update state incrementally so UI updates as pages load
          setAllJobs([...accumulatedJobs]);
        }
      } catch (err) {
        console.error("[useJobsV2] Error fetching remaining pages:", err);
      } finally {
        setIsLoadingMore(false);
        isFetching = false;
      }
    };

    fetchRemainingPages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAll, data?.pagination?.nextPage, data?.jobs?.length, isLoading]);

  // Parse jobs data with memoization
  const jobs = useMemo(() => {
    // If fetchAll is true, use accumulated jobs, otherwise use page 1 data
    return fetchAll ? allJobs : (data?.jobs ?? []);
  }, [fetchAll, allJobs, data?.jobs]);

  const pagination = useMemo(() => data?.pagination ?? null, [data]);

  return {
    jobs,
    isLoading: isLoading && allJobs.length === 0, // Only show loading if we have no jobs yet
    error: error?.message ?? null,
    pagination,
    refetch: async () => {
      setAllJobs([]); // Reset accumulated jobs
      await mutate();
    },
  };
};

