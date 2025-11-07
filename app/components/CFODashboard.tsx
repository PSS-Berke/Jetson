import React, { useMemo } from 'react';
import { Job } from '@/types';
import { ParsedJob } from '@/hooks/useJobs';
import { TimeRange } from '@/hooks/useProjections';
import {
  calculateCFOSummaryMetrics,
  calculateRevenueByPeriod,
  calculateRevenueByClient,
  calculateRevenueByProcessType,
  calculateRevenueTrend,
  comparePeriods,
} from '@/lib/cfoUtils';
import CFOSummaryCards from './CFOSummaryCards';
import CFORevenueChart from './CFORevenueChart';
import CFOClientAnalysis from './CFOClientAnalysis';
import CFOServiceMix from './CFOServiceMix';
import CFOPeriodComparison from './CFOPeriodComparison';
import InlineJobCostEntry from './InlineJobCostEntry';

interface CFODashboardProps {
  // Current period data
  jobs: (Job | ParsedJob)[];
  timeRanges: TimeRange[];
  totalRevenue: number;
  capacityUtilization?: number;

  // Optional: Previous period data for comparison
  previousPeriodJobs?: (Job | ParsedJob)[];
  previousTimeRanges?: TimeRange[];

  // Period labels
  periodLabel?: string;
  previousPeriodLabel?: string;

  // Date range for cost tracking
  startDate?: number;
  endDate?: number;
  facilitiesId?: number;

  // PDF export props
  granularity?: 'weekly' | 'monthly' | 'quarterly';
  selectedClients?: string[];
  selectedServiceTypes?: string[];
  searchQuery?: string;
  filterMode?: 'AND' | 'OR';
  printRef?: React.RefObject<HTMLDivElement | null>;
}

export default function CFODashboard({
  jobs,
  timeRanges,
  totalRevenue,
  capacityUtilization,
  previousPeriodJobs,
  previousTimeRanges,
  periodLabel,
  previousPeriodLabel,
  startDate,
  endDate,
  facilitiesId,
  // granularity = 'monthly',
  // selectedClients = [],
  // selectedServiceTypes = [],
  // searchQuery = '',
  // filterMode = 'AND',
  // printRef,
}: CFODashboardProps) {
  // Calculate all metrics
  const metrics = useMemo(() => {
    return calculateCFOSummaryMetrics(jobs, capacityUtilization);
  }, [jobs, capacityUtilization]);

  // Calculate revenue trend if previous period data is available
  const revenueTrend = useMemo(() => {
    if (previousPeriodJobs && previousPeriodJobs.length > 0) {
      return calculateRevenueTrend(jobs, previousPeriodJobs);
    }
    return undefined;
  }, [jobs, previousPeriodJobs]);

  // Calculate revenue by period
  const revenueByPeriod = useMemo(() => {
    return calculateRevenueByPeriod(jobs, timeRanges);
  }, [jobs, timeRanges]);

  // Calculate previous period revenue if available
  const previousRevenueByPeriod = useMemo(() => {
    if (previousPeriodJobs && previousTimeRanges) {
      return calculateRevenueByPeriod(previousPeriodJobs, previousTimeRanges);
    }
    return undefined;
  }, [previousPeriodJobs, previousTimeRanges]);

  // Calculate client analysis
  const clientRevenues = useMemo(() => {
    return calculateRevenueByClient(jobs);
  }, [jobs]);

  // Calculate process mix (by process type from requirements)
  const serviceRevenues = useMemo(() => {
    return calculateRevenueByProcessType(jobs);
  }, [jobs]);

  // Calculate period comparison
  const periodComparisons = useMemo(() => {
    if (previousPeriodJobs && previousPeriodJobs.length > 0) {
      return comparePeriods(jobs, previousPeriodJobs);
    }
    return [];
  }, [jobs, previousPeriodJobs]);

  // Handle empty state
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 max-w-2xl mx-auto">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-gray-800 font-semibold text-lg mb-2">No Data Available</div>
          <div className="text-gray-600">
            Adjust your filters or date range to see financial insights.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary Cards - Top Priority */}
      <section>
        <CFOSummaryCards metrics={metrics} revenueTrend={revenueTrend} />
      </section>

      {/* Inline Job Cost Entry - Directly Below Summary Cards */}
      {startDate && endDate && (
        <section>
          <InlineJobCostEntry
            jobs={jobs as ParsedJob[]}
            startDate={startDate}
            endDate={endDate}
            facilitiesId={facilitiesId}
            onSuccess={() => {
              console.log('[CFODashboard] Cost entries saved successfully');
              // TODO: Refresh job cost data
            }}
          />
        </section>
      )}

      {/* Revenue Trend Chart - Primary Visualization */}
      <section>
        <CFORevenueChart
          currentPeriodData={revenueByPeriod}
          previousPeriodData={previousRevenueByPeriod}
          title="Revenue Trend"
        />
      </section>

      {/* Client and Service Analysis - Side by Side on Desktop */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CFOClientAnalysis clientData={clientRevenues} topN={10} />
        <CFOServiceMix serviceData={serviceRevenues} />
      </section>

      {/* Period Comparison - If Previous Data Available */}
      {periodComparisons.length > 0 && (
        <section>
          <CFOPeriodComparison
            comparisons={periodComparisons}
            currentPeriodLabel={periodLabel}
            previousPeriodLabel={previousPeriodLabel}
          />
        </section>
      )}

      {/* Additional Insights Section */}
      <section className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Clients */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-700 font-medium mb-1">Total Clients</div>
            <div className="text-2xl font-bold text-blue-900">{clientRevenues.length}</div>
            <div className="text-xs text-blue-600 mt-1">Active in this period</div>
          </div>

          {/* Top Client Contribution */}
          {clientRevenues.length > 0 && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-700 font-medium mb-1">Top Client</div>
              <div className="text-2xl font-bold text-purple-900 truncate" title={clientRevenues[0].clientName}>
                {clientRevenues[0].clientName}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                {clientRevenues[0].jobCount} jobs, {clientRevenues[0].percentageOfTotal.toFixed(1)}% of revenue
              </div>
            </div>
          )}

          {/* Process Types */}
          {serviceRevenues.length > 0 && (
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="text-sm text-green-700 font-medium mb-1">Primary Process</div>
              <div className="text-2xl font-bold text-green-900 truncate" title={serviceRevenues[0].serviceType}>
                {serviceRevenues[0].serviceType}
              </div>
              <div className="text-xs text-green-600 mt-1">
                {serviceRevenues[0].percentageOfTotal.toFixed(1)}% of total revenue
              </div>
            </div>
          )}

          {/* Revenue per Job */}
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-sm text-yellow-700 font-medium mb-1">Revenue per Job</div>
            <div className="text-2xl font-bold text-yellow-900">
              ${(totalRevenue / jobs.length).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-yellow-600 mt-1">Average job value</div>
          </div>

          {/* Total Pieces */}
          <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="text-sm text-indigo-700 font-medium mb-1">Total Volume</div>
            <div className="text-2xl font-bold text-indigo-900">
              {jobs.reduce((sum, job) => sum + job.quantity, 0).toLocaleString()}
            </div>
            <div className="text-xs text-indigo-600 mt-1">Pieces projected</div>
          </div>

          {/* Revenue Growth (if available) */}
          {revenueTrend && (
            <div className={`p-4 rounded-lg border ${
              revenueTrend.percentChange > 0
                ? 'bg-green-50 border-green-200'
                : revenueTrend.percentChange < 0
                ? 'bg-red-50 border-red-200'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <div className={`text-sm font-medium mb-1 ${
                revenueTrend.percentChange > 0
                  ? 'text-green-700'
                  : revenueTrend.percentChange < 0
                  ? 'text-red-700'
                  : 'text-gray-700'
              }`}>
                Period Growth
              </div>
              <div className={`text-2xl font-bold ${
                revenueTrend.percentChange > 0
                  ? 'text-green-900'
                  : revenueTrend.percentChange < 0
                  ? 'text-red-900'
                  : 'text-gray-900'
              }`}>
                {revenueTrend.percentChange > 0 ? '+' : ''}{revenueTrend.percentChange.toFixed(1)}%
              </div>
              <div className={`text-xs mt-1 ${
                revenueTrend.percentChange > 0
                  ? 'text-green-600'
                  : revenueTrend.percentChange < 0
                  ? 'text-red-600'
                  : 'text-gray-600'
              }`}>
                vs previous period
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Print-friendly Note */}
      <div className="text-center text-sm text-gray-500 no-print">
        💡 Tip: Use your browser&apos;s print function to generate a PDF report of this financial analysis
      </div>
    </div>
  );
}
