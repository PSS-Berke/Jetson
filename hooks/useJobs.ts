'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { getJobs } from '@/lib/api';

// Re-export Job from api for consistency
import type { Job } from '@/lib/api';

export type { Job };

export interface ParsedRequirement {
  process_type: string; // Required
  price_per_m?: string;
  // Legacy field - kept for backward compatibility
  shifts_id?: number;
  // All other fields are dynamic based on process type
  [key: string]: string | number | undefined;
}

export interface ParsedJob extends Omit<Job, 'client' | 'sub_client' | 'machines' | 'requirements'> {
  client: { id: number; name: string };
  sub_client?: { id: number; name: string } | null;
  machines: { id: number; line: number }[];
  requirements: ParsedRequirement[];
  daily_split?: number[][]; // 2D array: weeks x days (Mon-Sun)
}

interface UseJobsReturn {
  jobs: ParsedJob[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Job parsing logic extracted for reuse
const parseJob = (job: Job): ParsedJob => {
    try {
      // Parse requirements - handle multiple formats
      let parsedRequirements: ParsedRequirement[] = [];

      if (job.requirements && job.requirements !== '{}' && job.requirements !== '') {
        try {
          // Check if it's already an array (newer format)
          if (Array.isArray(job.requirements)) {
            parsedRequirements = job.requirements;
          }
          // Try parsing as a simple JSON array string
          else if (typeof job.requirements === 'string' && job.requirements.trim().startsWith('[')) {
            parsedRequirements = JSON.parse(job.requirements);
          }
          // Handle the old nested format with escaped JSON strings
          else if (typeof job.requirements === 'string') {
            const reqString = job.requirements.slice(1, -1); // Remove { and }
            const matches = reqString.match(/"\{[^}]+\}"/g);

            if (matches) {
              parsedRequirements = matches.map((match: string) => {
                try {
                  // Remove the outer quotes and parse the JSON
                  const cleaned = match.slice(1, -1).replace(/\\/g, '');
                  const parsed = JSON.parse(cleaned);
                  return parsed;
                } catch {
                  return null;
                }
              }).filter(Boolean);
            }
          }
        } catch (error) {
          parsedRequirements = [];
        }
      }

      // Parse daily_split if it exists
      let parsedDailySplit: number[][] | undefined = undefined;
      if ((job as any).daily_split) {
        try {
          if (typeof (job as any).daily_split === 'string') {
            parsedDailySplit = JSON.parse((job as any).daily_split);
          } else if (Array.isArray((job as any).daily_split)) {
            parsedDailySplit = (job as any).daily_split;
          }
        } catch (error) {
          // Silently fail
        }
      }

      // Parse sub_client if it exists
      let parsedSubClient: { id: number; name: string } | null = null;
      if (job.sub_client) {
        try {
          if (typeof job.sub_client === 'string') {
            parsedSubClient = JSON.parse(job.sub_client);
          } else if (typeof job.sub_client === 'object') {
            parsedSubClient = job.sub_client as { id: number; name: string };
          }
        } catch {
          // Silently fail
        }
      }

      return {
        ...job,
        client: JSON.parse(job.client),
        sub_client: parsedSubClient,
        machines: JSON.parse(job.machines),
        requirements: parsedRequirements,
        daily_split: parsedDailySplit,
      };
    } catch (e) {
      return {
        ...job,
        client: { id: 0, name: 'Unknown' },
        sub_client: null,
        machines: [],
        requirements: [],
      };
    }
  };

// SWR fetcher function
const fetcher = async (facilityId?: number | null) => {
  const facilityParam = facilityId !== undefined && facilityId !== null ? facilityId : undefined;
  const data = await getJobs(facilityParam);
  return data.map(parseJob);
};

export const useJobs = (facilityId?: number | null): UseJobsReturn => {
  // Create a unique key for SWR caching based on facilityId
  const key = facilityId !== null && facilityId !== undefined
    ? ['jobs', facilityId]
    : ['jobs', 'all'];

  // Use SWR for data fetching with caching
  const { data, error, isLoading, mutate } = useSWR(
    key,
    () => fetcher(facilityId),
    {
      revalidateOnFocus: false, // Don't refetch on window focus
      dedupingInterval: 10000, // Dedupe requests within 10 seconds
      revalidateOnReconnect: true, // Refetch when reconnecting
      shouldRetryOnError: false, // Disable retries to avoid flooding console
      errorRetryCount: 0,
      onError: (err) => {
        console.error('[useJobs] Error fetching jobs:', err?.message || err);
      }
    }
  );

  // Parse jobs data with memoization
  const jobs = useMemo(() => data ?? [], [data]);

  return {
    jobs,
    isLoading,
    error: error?.message ?? null,
    refetch: async () => {
      await mutate();
    },
  };
};
