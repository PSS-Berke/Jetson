import { useMemo, useState, useEffect } from 'react';
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
import { getProductionEntries } from '@/lib/api';
import { aggregateProductionByJob } from '@/lib/productionUtils';
import type { Granularity } from '@/app/components/GranularityToggle';
import type { ProductionEntry } from '@/types';

/**
 * Calculate revenue from requirements.price_per_m if available, otherwise use total_billing
 */
function getJobRevenue(job: ParsedJob): number {
  // Check if job has parsed requirements with price_per_m
  if (job.requirements && Array.isArray(job.requirements) && job.requirements.length > 0) {
    const revenue = job.requirements.reduce((total, req) => {
      const pricePerMStr = req.price_per_m;
      const isValidPrice = pricePerMStr && pricePerMStr !== 'undefined' && pricePerMStr !== 'null';
      const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
      return total + ((job.quantity / 1000) * pricePerM);
    }, 0);
    
    // Add add-on charges if available
    const addOnCharges = parseFloat(job.add_on_charges || '0');
    return revenue + addOnCharges;
  }
  
  // Fallback to total_billing
  return parseFloat(job.total_billing || '0');
}

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
  scheduleFilter?: 'all' | 'confirmed' | 'soft';
  filterMode?: 'and' | 'or';
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
  // Fetch both jobs and production entries in parallel
  const { jobs, isLoading, error, refetch: refetchJobs } = useJobs(filters.facility);
  const granularity = filters.granularity || 'weekly';

  // Fetch production entries to adjust projections (in parallel with jobs)
  const [productionEntries, setProductionEntries] = useState<ProductionEntry[]>([]);
  const [productionLoading, setProductionLoading] = useState(false);

  useEffect(() => {
    const fetchProduction = async () => {
      setProductionLoading(true);
      try {
        const entries = await getProductionEntries(filters.facility || undefined);
        setProductionEntries(entries);
      } catch (err) {
        // Silently handle error - production tracking is optional
        // Backend may not be set up yet with production_entries table
        console.log('[useProjections] Production data not available (backend not configured yet)');
        setProductionEntries([]);
      } finally {
        setProductionLoading(false);
      }
    };

    fetchProduction();
  }, [filters.facility]);

  // 1. Time ranges - only recalculates when granularity or startDate changes
  const timeRanges = useMemo<TimeRange[]>(() => {
    switch (granularity) {
      case 'monthly':
        return generateMonthRanges(startDate, 6);
      case 'quarterly':
        return generateQuarterRanges(startDate, 6);
      case 'weekly':
      default:
        return generateWeekRanges(startDate);
    }
  }, [granularity, startDate]);

  // 2. Production aggregation - only recalculates when productionEntries changes
  const actualQuantitiesByJob = useMemo(() => {
    const aggregated = aggregateProductionByJob(productionEntries);
    console.log('[useProjections] Actual quantities by job:', Object.fromEntries(aggregated));
    return aggregated;
  }, [productionEntries]);

  // 3. Job projections - only recalculates when jobs or timeRanges change
  const adjustedJobProjections = useMemo<JobProjection[]>(() => {
    if (!jobs || jobs.length === 0) {
      return [];
    }

    // Calculate projections for all jobs using generic function
    const jobProjections = calculateGenericJobProjections(jobs, timeRanges);

    // Adjust projections based on actual production
    return jobProjections.map((projection) => {
      const actualData = actualQuantitiesByJob.get(projection.job.id);
      const actualQuantity = actualData?.total || 0;

      if (actualQuantity === 0) {
        return projection;
      }

      const remainingQuantity = Math.max(0, (projection.job.quantity || 0) - actualQuantity);

      if (remainingQuantity === 0) {
        const zeroedQuantities = new Map<string, number>();
        projection.weeklyQuantities.forEach((_, key) => {
          zeroedQuantities.set(key, 0);
        });
        return {
          ...projection,
          weeklyQuantities: zeroedQuantities,
          totalQuantity: 0,
        };
      }

      const originalTotal = projection.totalQuantity;
      if (originalTotal === 0) {
        return projection;
      }

      const adjustmentFactor = remainingQuantity / projection.job.quantity;
      const adjustedWeeklyQuantities = new Map<string, number>();
      let adjustedTotal = 0;

      projection.weeklyQuantities.forEach((qty, key) => {
        const adjustedQty = Math.round(qty * adjustmentFactor);
        adjustedWeeklyQuantities.set(key, adjustedQty);
        adjustedTotal += adjustedQty;
      });

      console.log(
        `[useProjections] Job ${projection.job.job_number}: original=${projection.job.quantity}, actual=${actualQuantity}, remaining=${remainingQuantity}, adjusted_total=${adjustedTotal}`
      );

      return {
        ...projection,
        weeklyQuantities: adjustedWeeklyQuantities,
        totalQuantity: adjustedTotal,
      };
    });
  }, [jobs, timeRanges, actualQuantitiesByJob]);

  // 4. Filtered projections - only recalculates when filters or adjustedJobProjections change
  const filteredProjections = useMemo<JobProjection[]>(() => {
    if (adjustedJobProjections.length === 0) {
      return [];
    }

    // Determine which filters are active
    const hasClientFilter = filters.clients.length > 0;
    const hasServiceTypeFilter = filters.serviceTypes.length > 0;
    const hasSearchFilter = filters.searchQuery.trim().length > 0;
    const hasScheduleFilter = filters.scheduleFilter && filters.scheduleFilter !== 'all';
    const filterMode = filters.filterMode || 'and';

    if (filterMode === 'or') {
      return adjustedJobProjections.filter(p => {
        if (!hasClientFilter && !hasServiceTypeFilter && !hasSearchFilter && !hasScheduleFilter) {
          return true;
        }

        const matchesClient = hasClientFilter && filters.clients.includes(p.job.client?.id);
        const matchesServiceType = hasServiceTypeFilter && (
          p.job.requirements && p.job.requirements.length > 0 &&
          p.job.requirements.some(req =>
            req.process_type && filters.serviceTypes.includes(req.process_type)
          )
        );
        const matchesSearch = hasSearchFilter && (() => {
          const query = filters.searchQuery.toLowerCase();
          return (
            p.job.job_number.toString().includes(query) ||
            p.job.client?.name.toLowerCase().includes(query) ||
            p.job.description?.toLowerCase().includes(query)
          );
        })();
        const matchesSchedule = hasScheduleFilter && (() => {
          const isConfirmed = (p.job as any).confirmed === true || (p.job as any).confirmed === 1;
          return filters.scheduleFilter === 'confirmed' ? isConfirmed : !isConfirmed;
        })();

        return matchesClient || matchesServiceType || matchesSearch || matchesSchedule;
      });
    } else {
      let result = adjustedJobProjections;

      if (hasClientFilter) {
        result = result.filter(p => filters.clients.includes(p.job.client?.id));
      }

      if (hasServiceTypeFilter) {
        result = result.filter(p => {
          if (p.job.requirements && p.job.requirements.length > 0) {
            return p.job.requirements.some(req =>
              req.process_type && filters.serviceTypes.includes(req.process_type)
            );
          }
          return false;
        });
      }

      if (hasSearchFilter) {
        const query = filters.searchQuery.toLowerCase();
        result = result.filter(p => {
          const job = p.job;
          return (
            job.job_number.toString().includes(query) ||
            job.client?.name.toLowerCase().includes(query) ||
            job.description?.toLowerCase().includes(query)
          );
        });
      }

      if (hasScheduleFilter) {
        result = result.filter(p => {
          const isConfirmed = (p.job as any).confirmed === true || (p.job as any).confirmed === 1;
          if (filters.scheduleFilter === 'confirmed') {
            return isConfirmed;
          } else if (filters.scheduleFilter === 'soft') {
            return !isConfirmed;
          }
          return true;
        });
      }

      return result;
    }
  }, [adjustedJobProjections, filters]);

  // 5. Service summaries and grand totals - only recalculates when filteredProjections or timeRanges change
  const { serviceSummaries, grandTotals } = useMemo(() => {
    const summaries = calculateGenericServiceTypeSummaries(filteredProjections, timeRanges);
    const totals = calculateGenericGrandTotals(summaries, timeRanges);
    return { serviceSummaries: summaries, grandTotals: totals };
  }, [filteredProjections, timeRanges]);

  // 6. Process type counts - only recalculates when filteredProjections change
  const processTypeCounts = useMemo(() => {
    return calculateProcessTypeCounts(filteredProjections);
  }, [filteredProjections]);

  // 7. Revenue and job counts - only recalculates when filteredProjections change
  const { totalRevenue, totalJobsInTimeframe } = useMemo(() => {
    console.log(`[Total Revenue] Starting calculation for ${filteredProjections.length} filtered jobs`);
    const revenue = filteredProjections.reduce((total, projection) => {
      const job = projection.job;
      const jobBilling = getJobRevenue(job);
      const totalJobQuantity = job.quantity || 0;

      if (totalJobQuantity === 0) {
        console.log(`[Total Revenue] Job ${job.job_number}: skipping (quantity is 0)`);
        return total;
      }

      const portionInTimeframe = projection.totalQuantity / totalJobQuantity;
      const proportionalRevenue = jobBilling * portionInTimeframe;

      console.log(`[Total Revenue] Job ${job.job_number}: revenue=$${jobBilling.toFixed(2)}, portion=${(portionInTimeframe * 100).toFixed(1)}%, proportional_revenue=$${proportionalRevenue.toFixed(2)}`);
      return total + proportionalRevenue;
    }, 0);
    console.log(`[Total Revenue] Final total: $${revenue.toFixed(2)} from ${filteredProjections.length} jobs`);

    const jobsCount = new Set(
      filteredProjections
        .filter(p => p.totalQuantity > 0)
        .map(p => p.job.id)
    ).size;
    console.log(`[Total Jobs] ${jobsCount} jobs have activity in the selected timeframe (out of ${filteredProjections.length} total)`);

    return { totalRevenue: revenue, totalJobsInTimeframe: jobsCount };
  }, [filteredProjections]);

  // 8. Combine everything - this is cheap now, just object creation
  const projectionsData = useMemo<ProjectionsData>(() => {
    if (!jobs || jobs.length === 0) {
      return {
        timeRanges,
        weekRanges: timeRanges as WeekRange[],
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

    return {
      timeRanges,
      weekRanges: timeRanges as WeekRange[],
      jobProjections: adjustedJobProjections,
      serviceSummaries,
      grandTotals,
      filteredJobProjections: filteredProjections,
      processTypeCounts,
      totalRevenue,
      totalJobsInTimeframe,
    };
  }, [
    jobs,
    timeRanges,
    adjustedJobProjections,
    serviceSummaries,
    grandTotals,
    filteredProjections,
    processTypeCounts,
    totalRevenue,
    totalJobsInTimeframe,
  ]);

  // Refetch function that refetches both jobs and production in parallel
  const refetch = async () => {
    await Promise.all([
      refetchJobs(),
      (async () => {
        setProductionLoading(true);
        try {
          const entries = await getProductionEntries(filters.facility || undefined);
          setProductionEntries(entries);
        } catch (err) {
          console.log('[useProjections] Production data not available (backend not configured yet)');
          setProductionEntries([]);
        } finally {
          setProductionLoading(false);
        }
      })(),
    ]);
  };

  return {
    ...projectionsData,
    isLoading: isLoading || productionLoading,
    error,
    refetch,
  };
}

export type { WeekRange, JobProjection, ServiceTypeSummary, TimeRange };
