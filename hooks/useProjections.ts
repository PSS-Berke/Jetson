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
  insert: { jobs: number; pieces: number };
  sort: { jobs: number; pieces: number };
  inkjet: { jobs: number; pieces: number };
  labelApply: { jobs: number; pieces: number };
  fold: { jobs: number; pieces: number };
  laser: { jobs: number; pieces: number };
  hpPress: { jobs: number; pieces: number };
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
  totalRevenue: number;
  totalJobsInTimeframe: number;
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
    insert: { jobs: 0, pieces: 0 },
    sort: { jobs: 0, pieces: 0 },
    inkjet: { jobs: 0, pieces: 0 },
    labelApply: { jobs: 0, pieces: 0 },
    fold: { jobs: 0, pieces: 0 },
    laser: { jobs: 0, pieces: 0 },
    hpPress: { jobs: 0, pieces: 0 },
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

    // Count each unique job once per process type and add its quantity
    processTypesInJob.forEach((processType) => {
      const key = `${job.id}-${processType}`;
      if (!countedJobs.has(key)) {
        countedJobs.add(key);
        const jobQuantity = projection.totalQuantity;

        // Increment the appropriate counter
        switch (processType) {
          case 'insert':
            counts.insert.jobs++;
            counts.insert.pieces += jobQuantity;
            break;
          case 'sort':
            counts.sort.jobs++;
            counts.sort.pieces += jobQuantity;
            break;
          case 'inkjet':
          case 'ij': // Support legacy value
          case 'ink jet':
            counts.inkjet.jobs++;
            counts.inkjet.pieces += jobQuantity;
            break;
          case 'label/apply':
          case 'l/a': // Support legacy value
          case 'label/affix':
            counts.labelApply.jobs++;
            counts.labelApply.pieces += jobQuantity;
            break;
          case 'fold':
            counts.fold.jobs++;
            counts.fold.pieces += jobQuantity;
            break;
          case 'laser':
            counts.laser.jobs++;
            counts.laser.pieces += jobQuantity;
            break;
          case 'hp press':
            counts.hpPress.jobs++;
            counts.hpPress.pieces += jobQuantity;
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
          insert: { jobs: 0, pieces: 0 },
          sort: { jobs: 0, pieces: 0 },
          inkjet: { jobs: 0, pieces: 0 },
          labelApply: { jobs: 0, pieces: 0 },
          fold: { jobs: 0, pieces: 0 },
          laser: { jobs: 0, pieces: 0 },
          hpPress: { jobs: 0, pieces: 0 },
        },
        totalRevenue: 0,
        totalJobsInTimeframe: 0,
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

    // Filter by process types from requirements
    if (filters.serviceTypes.length > 0) {
      filteredProjections = filteredProjections.filter(p => {
        // Check if any requirement has a matching process type
        if (p.job.requirements && p.job.requirements.length > 0) {
          return p.job.requirements.some(req =>
            req.process_type && filters.serviceTypes.includes(req.process_type)
          );
        }
        return false;
      });
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

    // Calculate total revenue proportionally based on what portion of each job falls within the timeframe
    console.log(`[Total Revenue] Starting calculation for ${filteredProjections.length} filtered jobs`);
    const totalRevenue = filteredProjections.reduce((total, projection) => {
      const job = projection.job;
      const jobBilling = parseFloat(job.total_billing || '0');

      // Calculate what percentage of the job falls within the timeframe
      const totalJobQuantity = job.quantity || 0;
      if (totalJobQuantity === 0) {
        console.log(`[Total Revenue] Job ${job.job_number}: skipping (quantity is 0)`);
        return total;
      }

      // Use the same proportion as quantity distribution
      const portionInTimeframe = projection.totalQuantity / totalJobQuantity;
      const proportionalRevenue = jobBilling * portionInTimeframe;

      console.log(`[Total Revenue] Job ${job.job_number}: total_billing=$${jobBilling.toFixed(2)}, portion=${(portionInTimeframe * 100).toFixed(1)}%, proportional_revenue=$${proportionalRevenue.toFixed(2)}`);
      return total + proportionalRevenue;
    }, 0);
    console.log(`[Total Revenue] Final total: $${totalRevenue.toFixed(2)} from ${filteredProjections.length} jobs`);

    // Calculate total jobs with activity in timeframe
    const totalJobsInTimeframe = new Set(
      filteredProjections
        .filter(p => p.totalQuantity > 0)
        .map(p => p.job.id)
    ).size;
    console.log(`[Total Jobs] ${totalJobsInTimeframe} jobs have activity in the selected timeframe (out of ${filteredProjections.length} total)`);

    return {
      timeRanges,
      weekRanges: timeRanges as WeekRange[], // For backwards compatibility
      jobProjections,
      serviceSummaries,
      grandTotals,
      filteredJobProjections: filteredProjections,
      processTypeCounts,
      totalRevenue,
      totalJobsInTimeframe,
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
