import { useMemo } from 'react';
import { useJobs, type ParsedJob } from './useJobs';
import {
  generateWeekRanges,
  calculateJobProjections,
  calculateServiceTypeSummaries,
  calculateGrandTotals,
  type WeekRange,
  type JobProjection,
  type ServiceTypeSummary,
} from '@/lib/projectionUtils';

export interface ProjectionsData {
  weekRanges: WeekRange[];
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  filteredJobProjections: JobProjection[];
}

export interface ProjectionFilters {
  facility: number | null;
  clients: number[];
  serviceTypes: string[];
  searchQuery: string;
}

export function useProjections(
  startDate: Date,
  filters: ProjectionFilters
) {
  const { jobs, isLoading, error, refetch } = useJobs(filters.facility);

  const projectionsData = useMemo<ProjectionsData>(() => {
    if (!jobs || jobs.length === 0) {
      const emptyWeeks = generateWeekRanges(startDate);
      return {
        weekRanges: emptyWeeks,
        jobProjections: [],
        serviceSummaries: [],
        grandTotals: {
          weeklyTotals: new Map(),
          grandTotal: 0,
        },
        filteredJobProjections: [],
      };
    }

    // Generate week ranges
    const weekRanges = generateWeekRanges(startDate);

    // Calculate projections for all jobs
    const jobProjections = calculateJobProjections(jobs, weekRanges);

    // Apply filters
    let filteredProjections = jobProjections;

    // Filter by clients
    if (filters.clients.length > 0) {
      filteredProjections = filteredProjections.filter(p =>
        filters.clients.includes(p.job.client?.id)
      );
    }

    // Filter by service types
    if (filters.serviceTypes.length > 0) {
      filteredProjections = filteredProjections.filter(p =>
        filters.serviceTypes.includes(p.job.service_type)
      );
    }

    // Filter by search query (job number, client name, or description)
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      filteredProjections = filteredProjections.filter(p => {
        const job = p.job;
        return (
          job.job_number.toString().includes(query) ||
          job.client?.name.toLowerCase().includes(query) ||
          job.description?.toLowerCase().includes(query)
        );
      });
    }

    // Calculate summaries based on filtered projections
    const serviceSummaries = calculateServiceTypeSummaries(
      filteredProjections,
      weekRanges
    );

    const grandTotals = calculateGrandTotals(serviceSummaries, weekRanges);

    return {
      weekRanges,
      jobProjections,
      serviceSummaries,
      grandTotals,
      filteredJobProjections: filteredProjections,
    };
  }, [jobs, startDate, filters]);

  return {
    ...projectionsData,
    isLoading,
    error,
    refetch,
  };
}

export type { WeekRange, JobProjection, ServiceTypeSummary };
