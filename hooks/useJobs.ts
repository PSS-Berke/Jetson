'use client';

import { useState, useEffect } from 'react';
import { getJobs } from '@/lib/api';

export interface Job {
  id: number;
  created_at: number;
  job_number: number;
  service_type: string;
  quantity: number;
  description: string;
  start_date: number;
  due_date: number;
  client: string; // JSON string: {"id": 2, "name": "grocery store"}
  machines: string; // JSON string: [{"id": 1, "line": 1}, {"id": 2, "line": 2}]
}

export interface ParsedJob extends Omit<Job, 'client' | 'machines'> {
  client: { id: number; name: string };
  machines: { id: number; line: number }[];
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
      return {
        ...job,
        client: JSON.parse(job.client),
        machines: JSON.parse(job.machines),
      };
    } catch (e) {
      console.error('Failed to parse job data:', e);
      return {
        ...job,
        client: { id: 0, name: 'Unknown' },
        machines: [],
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
