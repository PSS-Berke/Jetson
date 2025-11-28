"use client";

import { useMemo } from "react";
import useSWR from "swr";
import { getJobs } from "@/lib/api";

// Re-export Job from api for consistency
import type { Job } from "@/lib/api";

export type { Job };

export interface ParsedRequirement {
  process_type: string; // Required
  price_per_m?: string;
  // Legacy field - kept for backward compatibility
  shifts_id?: number;
  // All other fields are dynamic based on process type
  [key: string]: string | number | undefined;
}

export interface ParsedJob
  extends Omit<Job, "client" | "sub_client" | "machines" | "requirements"> {
  client: { id: number; name: string };
  facility: { id: number; name: string } | null;
  sub_client?: string; // Sub-client name as a plain string
  machines: { id: number; line: string }[];
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
export const parseJob = (job: Job): ParsedJob => {
  try {
    // Parse requirements - handle multiple formats
    let parsedRequirements: ParsedRequirement[] = [];

    if (
      job.requirements &&
      job.requirements !== "{}" &&
      job.requirements !== ""
    ) {
      try {
        // Check if it's already an array (newer format)
        if (Array.isArray(job.requirements)) {
          parsedRequirements = job.requirements;
        }
        // Try parsing as a simple JSON array string
        else if (typeof job.requirements === "string") {
          const trimmed = job.requirements.trim();
          
          // Try parsing as JSON array first
          if (trimmed.startsWith("[")) {
            try {
              parsedRequirements = JSON.parse(trimmed);
            } catch (parseError) {
              console.warn(
                `[parseJob] Failed to parse requirements as JSON array for job ${job.job_number}:`,
                parseError,
                "Raw value:",
                trimmed.substring(0, 100),
              );
            }
          }
          // Try parsing as single JSON object (wrap in array)
          else if (trimmed.startsWith("{")) {
            try {
              const parsed = JSON.parse(trimmed);
              parsedRequirements = Array.isArray(parsed) ? parsed : [parsed];
            } catch (parseError) {
              console.warn(
                `[parseJob] Failed to parse requirements as JSON object for job ${job.job_number}:`,
                parseError,
                "Raw value:",
                trimmed.substring(0, 100),
              );
            }
          }
          // Handle the old nested format with escaped JSON strings
          else {
            const reqString = trimmed.slice(1, -1); // Remove { and }
            const matches = reqString.match(/"\{[^}]+\}"/g);

            if (matches) {
              parsedRequirements = matches
                .map((match: string) => {
                  try {
                    // Remove the outer quotes and parse the JSON
                    const cleaned = match.slice(1, -1).replace(/\\/g, "");
                    const parsed = JSON.parse(cleaned);
                    return parsed;
                  } catch {
                    return null;
                  }
                })
                .filter(Boolean);
            }
          }
        }
      } catch (error) {
        console.error(
          `[parseJob] Error parsing requirements for job ${job.job_number}:`,
          error,
          "Raw requirements:",
          typeof job.requirements === "string"
            ? job.requirements.substring(0, 200)
            : job.requirements,
        );
        parsedRequirements = [];
      }
    }

    // Parse daily_split if it exists
    let parsedDailySplit: number[][] | undefined = undefined;
    if ((job as any).daily_split) {
      try {
        if (typeof (job as any).daily_split === "string") {
          parsedDailySplit = JSON.parse((job as any).daily_split);
        } else if (Array.isArray((job as any).daily_split)) {
          parsedDailySplit = (job as any).daily_split;
        }
      } catch (error) {
        // Silently fail
      }
    }

    // Parse sub_client if it exists - keep as string
    let parsedSubClient: string | undefined = undefined;

    if (job.sub_client) {
      try {
        if (typeof job.sub_client === "string") {
          // Check if it's a JSON string that needs to be parsed
          const trimmed = job.sub_client.trim();

          if (trimmed.startsWith('{')) {
            // It's a JSON object string, extract the name property
            const parsed = JSON.parse(trimmed);
            // Only use the name if it's not null/undefined/empty
            if (parsed.name && parsed.name !== null && parsed.name !== "null") {
              parsedSubClient = parsed.name;
            }
            // Otherwise leave parsedSubClient as undefined (will display as "-")
          } else {
            // It's already a plain string, use it directly
            parsedSubClient = trimmed;
          }
        } else if (typeof job.sub_client === "object" && job.sub_client !== null) {
          // It's already an object, extract the name
          const name = (job.sub_client as any).name;
          if (name && name !== null && name !== "null") {
            parsedSubClient = name;
          }
        }
      } catch (err) {
        // If parsing fails, leave it undefined
        console.warn(`[parseJob] Failed to parse sub_client for job ${job.job_number}:`, job.sub_client, err);
      }
    }

    // Parse client field with better error handling
    let parsedClient: { id: number; name: string };
    try {
      if (!job.client || job.client === "" || job.client === "null") {
        console.warn(
          `[parseJob] Job ${job.job_number} has empty/null client field. clients_id: ${job.clients_id}`,
        );
        parsedClient = { id: job.clients_id || 0, name: "Unknown" };
      } else if (typeof job.client === "string") {
        parsedClient = JSON.parse(job.client);
      } else {
        parsedClient = job.client as { id: number; name: string };
      }
    } catch (clientError) {
      console.error(
        `[parseJob] Failed to parse client for job ${job.job_number}:`,
        {
          error: clientError,
          client_value: job.client,
          clients_id: job.clients_id,
        },
      );
      parsedClient = { id: job.clients_id || 0, name: "Unknown" };
    }

    // Parse machines first to potentially infer facility
    const parsedMachines = JSON.parse(job.machines);

    // Parse facility field based on facilities_id
    // The API might return facilities_id as a number or as an object (similar to client)
    let parsedFacility: { id: number; name: string } | null = null;

    // Check if facilities_id is an object (like client field) or a number
    if (job.facilities_id !== undefined && job.facilities_id !== null && job.facilities_id !== 0) {
      // If it's already an object with id and name, use it directly
      if (typeof job.facilities_id === 'object' && 'id' in job.facilities_id) {
        const facilityObj = job.facilities_id as any;
        parsedFacility = { id: facilityObj.id, name: facilityObj.name || "Unknown" };
      } else {
        // It's a number, map it to the facility name
        const facilityId = typeof job.facilities_id === 'number' ? job.facilities_id : parseInt(String(job.facilities_id));
        const facilityName = facilityId === 1 ? "Bolingbrook" : facilityId === 2 ? "Lemont" : "Unknown";
        parsedFacility = { id: facilityId, name: facilityName };
      }
    } else {
      // If job doesn't have facilities_id, default to Bolingbrook (ID 1)
      console.warn(`[parseJob] Job ${job.job_number} has no facilities_id, defaulting to Bolingbrook`);
      parsedFacility = { id: 1, name: "Bolingbrook" };
    }

    return {
      ...job,
      client: parsedClient,
      facility: parsedFacility,
      sub_client: parsedSubClient,
      machines: parsedMachines,
      requirements: parsedRequirements,
      daily_split: parsedDailySplit,
    };
  } catch (e) {
    console.error(
      `[parseJob] Critical error parsing job ${job.job_number}:`,
      e,
    );

    // Try to set facility even in error case
    let fallbackFacility: { id: number; name: string } | null = null;
    if (job.facilities_id) {
      if (typeof job.facilities_id === 'object' && 'id' in job.facilities_id) {
        const facilityObj = job.facilities_id as any;
        fallbackFacility = { id: facilityObj.id, name: facilityObj.name || "Unknown" };
      } else {
        const facilityId = typeof job.facilities_id === 'number' ? job.facilities_id : parseInt(String(job.facilities_id));
        const facilityName = facilityId === 1 ? "Bolingbrook" : facilityId === 2 ? "Lemont" : "Unknown";
        fallbackFacility = { id: facilityId, name: facilityName };
      }
    } else {
      fallbackFacility = { id: 1, name: "Bolingbrook" };
    }

    return {
      ...job,
      client: { id: job.clients_id || 0, name: "Unknown" },
      facility: fallbackFacility,
      sub_client: undefined,
      machines: [],
      requirements: [],
    };
  }
};

// SWR fetcher function
const fetcher = async (facilityId?: number | null) => {
  const facilityParam =
    facilityId !== undefined && facilityId !== null ? facilityId : undefined;
  const data = await getJobs(facilityParam);
  return data.map(parseJob);
};

export const useJobs = (facilityId?: number | null): UseJobsReturn => {
  // Create a unique key for SWR caching based on facilityId
  const key =
    facilityId !== null && facilityId !== undefined
      ? ["jobs", facilityId]
      : ["jobs", "all"];

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
        console.error("[useJobs] Error fetching jobs:", err?.message || err);
      },
    },
  );

  // Parse jobs data with memoization
  const jobs = useMemo(() => data ?? [], [data]);

  return {
    jobs,
    isLoading,
    error: error?.message ?? null,
    refetch: async () => {
     // await mutate();
    },
  };
};
