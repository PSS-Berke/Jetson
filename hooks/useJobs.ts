'use client';

import { useState, useEffect } from 'react';
import { getJobs } from '@/lib/api';

// Re-export Job from api for consistency
import type { Job } from '@/lib/api';

export type { Job };

export interface ParsedRequirement {
  pockets?: number;
  shifts_id?: number;
  paper_size?: string;
  process_type?: string;
}

export interface ParsedJob extends Omit<Job, 'client' | 'machines' | 'requirements'> {
  client: { id: number; name: string };
  machines: { id: number; line: number }[];
  requirements: ParsedRequirement[];
}

interface UseJobsReturn {
  jobs: ParsedJob[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useJobs = (): UseJobsReturn => {
  const [jobs, setJobs] = useState<ParsedJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const parseJob = (job: Job): ParsedJob => {
    try {
      // Parse requirements - the format is unusual with JSON strings as both keys and values
      let parsedRequirements: ParsedRequirement[] = [];
      if (job.requirements && job.requirements !== '{}') {
        try {
          // Remove outer braces and split by the pattern "},"{
          const reqString = job.requirements.slice(1, -1); // Remove { and }

          // Split by the pattern that separates requirements: ","
          const matches = reqString.match(/"\{[^}]+\}"/g);

          if (matches) {
            parsedRequirements = matches.map((match: string) => {
              try {
                // Remove the outer quotes and parse the JSON
                const cleaned = match.slice(1, -1).replace(/\\/g, '');
                return JSON.parse(cleaned);
              } catch {
                return null;
              }
            }).filter(Boolean);
          }
        } catch (error) {
          console.error('Failed to parse requirements:', error, job.requirements);
          parsedRequirements = [];
        }
      }

      return {
        ...job,
        client: JSON.parse(job.client),
        machines: JSON.parse(job.machines),
        requirements: parsedRequirements,
      };
    } catch (e) {
      console.error('Failed to parse job data:', e);
      return {
        ...job,
        client: { id: 0, name: 'Unknown' },
        machines: [],
        requirements: [],
      };
    }
  };

  const fetchJobs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getJobs();
      const parsedJobs = data.map(parseJob);
      setJobs(parsedJobs);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch jobs';
      setError(errorMessage);
      setJobs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return {
    jobs,
    isLoading,
    error,
    refetch: fetchJobs,
  };
};
