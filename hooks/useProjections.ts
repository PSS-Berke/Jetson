import { useMemo } from 'react';
import { useJobs, type ParsedJob } from './useJobs';
import {
  generateWeekRanges,
  calculateJobProjections,
  calculateServiceTypeSummaries,
  calculateGrandTotals,
  calculateGenericJobProjections,
  calculateGenericServiceTypeSummaries,
  calculateGenericGrandTotals,
  type WeekRange,
  type JobProjection,
  type ServiceTypeSummary,
  type TimeRange,
} from '@/lib/projectionUtils';
import { generateMonthRanges, generateQuarterRanges } from '@/lib/dateUtils';
import type { Granularity } from '@/app/components/GranularityToggle';

export interface ProcessTypeCounts {
  insert: number;
  sort: number;
  ij: number;
  la: number;
  fold: number;
  laser: number;
  hpPress: number;
}

export interface ProjectionsData {
  timeRanges: TimeRange[]; // Can be weeks, months, or quarters
  weekRanges: WeekRange[]; // Kept for backwards compatibility
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    weeklyTotals: Map<string, number>;
    grandTotal: number;
  };
  filteredJobProjections: JobProjection[];
  processTypeCounts: ProcessTypeCounts;
}

export interface ProjectionFilters {
  facility: number | null;
  clients: number[];
  serviceTypes: string[];
  searchQuery: string;
  granularity?: Granularity;
}

// Helper function to count process types from job projections
function calculateProcessTypeCounts(projections: JobProjection[]): ProcessTypeCounts {
  console.log('[DEBUG] calculateProcessTypeCounts - Total projections:', projections.length);

  const counts: ProcessTypeCounts = {
    insert: 0,
    sort: 0,
    ij: 0,
    la: 0,
    fold: 0,
    laser: 0,
    hpPress: 0,
  };

  // Track which jobs have already been counted for each process type
  const countedJobs = new Set<string>();

  projections.forEach((projection) => {
    const job = projection.job;
    console.log(`[DEBUG] Job ${job.job_number} - Requirements:`, job.requirements);

    // Get unique process types for this job
    const processTypesInJob = new Set<string>();
    job.requirements?.forEach((req) => {
      console.log(`[DEBUG] Job ${job.job_number} - Requirement:`, req, '| process_type:', req.process_type);
      if (req.process_type) {
        processTypesInJob.add(req.process_type.toLowerCase());
      }
    });

    console.log(`[DEBUG] Job ${job.job_number} - Process types found:`, Array.from(processTypesInJob));

    // Count each unique job once per process type
    processTypesInJob.forEach((processType) => {
      const key = `${job.id}-${processType}`;
      if (!countedJobs.has(key)) {
        countedJobs.add(key);

        // Increment the appropriate counter
        switch (processType) {
          case 'insert':
            counts.insert++;
            break;
          case 'sort':
            counts.sort++;
            break;
          case 'ij':
          case 'ink jet':
            counts.ij++;
            break;
          case 'l/a':
          case 'label/affix':
            counts.la++;
            break;
          case 'fold':
            counts.fold++;
            break;
          case 'laser':
            counts.laser++;
            break;
          case 'hp press':
            counts.hpPress++;
            break;
        }
      }
    });
  });

  console.log('[DEBUG] Final processTypeCounts:', counts);
  return counts;
}

export function useProjections(
  startDate: Date,
  filters: ProjectionFilters
) {
  const { jobs, isLoading, error, refetch } = useJobs(filters.facility);
  const granularity = filters.granularity || 'weekly';

  const projectionsData = useMemo<ProjectionsData>(() => {
    // Generate time ranges based on granularity
    let timeRanges: TimeRange[];
    switch (granularity) {
      case 'monthly':
        timeRanges = generateMonthRanges(startDate, 3);
        break;
      case 'quarterly':
        timeRanges = generateQuarterRanges(startDate, 4);
        break;
      case 'weekly':
      default:
        timeRanges = generateWeekRanges(startDate);
        break;
    }

    if (!jobs || jobs.length === 0) {
      return {
        timeRanges,
        weekRanges: timeRanges as WeekRange[], // For backwards compatibility
        jobProjections: [],
        serviceSummaries: [],
        grandTotals: {
          weeklyTotals: new Map(),
          grandTotal: 0,
        },
        filteredJobProjections: [],
        processTypeCounts: {
          insert: 0,
          sort: 0,
          ij: 0,
          la: 0,
          fold: 0,
          laser: 0,
          hpPress: 0,
        },
      };
    }

    // Calculate projections for all jobs using generic function
    const jobProjections = calculateGenericJobProjections(jobs, timeRanges);

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

    // Calculate summaries based on filtered projections using generic function
    const serviceSummaries = calculateGenericServiceTypeSummaries(
      filteredProjections,
      timeRanges
    );

    const grandTotals = calculateGenericGrandTotals(serviceSummaries, timeRanges);

    // Calculate process type counts from filtered projections
    const processTypeCounts = calculateProcessTypeCounts(filteredProjections);

    return {
      timeRanges,
      weekRanges: timeRanges as WeekRange[], // For backwards compatibility
      jobProjections,
      serviceSummaries,
      grandTotals,
      filteredJobProjections: filteredProjections,
      processTypeCounts,
    };
  }, [jobs, startDate, filters, granularity]);

  return {
    ...projectionsData,
    isLoading,
    error,
    refetch,
  };
}

export type { WeekRange, JobProjection, ServiceTypeSummary };
