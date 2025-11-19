import { useState, useEffect } from "react";
import { getJobEditLogs } from "@/lib/api";

export interface JobEditLog {
  id: number;
  created_at: number;
  user_id: number;
  old: any;
  new: any;
  name: string;
  email: string;
}

export function useJobEditLogs(jobsId?: number) {
  const [logs, setLogs] = useState<JobEditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getJobEditLogs(jobsId);
      setLogs(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch job edit logs";
      setError(errorMessage);
      console.error("[useJobEditLogs] Error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [jobsId]);

  return {
    logs,
    isLoading,
    error,
    refetch: fetchLogs,
  };
}

