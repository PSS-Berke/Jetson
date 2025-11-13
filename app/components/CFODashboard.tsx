import React, { useMemo, useState } from "react";
import { Job } from "@/types";
import { ParsedJob } from "@/hooks/useJobs";
import { TimeRange } from "@/hooks/useProjections";
import {
  calculateCFOSummaryMetrics,
  calculateRevenueByPeriod,
  calculateRevenueByClient,
  calculateRevenueByProcessType,
  calculateRevenueTrend,
  comparePeriods,
  identifyJobsAtRisk,
  calculateProfitMargin,
  getLowMarginJobs,
  detectJobClustering,
} from "@/lib/cfoUtils";
import CFOSummaryCards from "./CFOSummaryCards";
import CFORevenueChart from "./CFORevenueChart";
import CFOClientAnalysis from "./CFOClientAnalysis";
import CFOServiceMix from "./CFOServiceMix";
import CFOPeriodComparison from "./CFOPeriodComparison";
import InlineJobCostEntry from "./InlineJobCostEntry";
import AlertDetailsModal from "./AlertDetailsModal";

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
  granularity?: "weekly" | "monthly" | "quarterly";
  selectedClients?: string[];
  selectedServiceTypes?: string[];
  searchQuery?: string;
  filterMode?: "AND" | "OR";
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

  // Modal state
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    jobs: ParsedJob[];
    type:
      | "jobs-at-risk"
      | "client-concentration"
      | "process-concentration"
      | "total-clients"
      | "top-client"
      | "primary-process"
      | "revenue-per-job"
      | "total-volume"
      | "period-growth"
      | "profit-margin"
      | "job-clustering";
    additionalData?: {
      clientName?: string;
      processType?: string;
      concentration?: number;
      revenueAtRisk?: number;
      profitMargin?: number;
      periodLabel?: string;
    };
  }>({
    isOpen: false,
    title: "",
    description: "",
    jobs: [],
    type: "jobs-at-risk",
  });

  // Modal handlers
  const openModal = (
    title: string,
    description: string,
    jobs: ParsedJob[],
    type:
      | "jobs-at-risk"
      | "client-concentration"
      | "process-concentration"
      | "total-clients"
      | "top-client"
      | "primary-process"
      | "revenue-per-job"
      | "total-volume"
      | "period-growth"
      | "profit-margin"
      | "job-clustering",
    additionalData?: {
      clientName?: string;
      processType?: string;
      concentration?: number;
      revenueAtRisk?: number;
      profitMargin?: number;
      periodLabel?: string;
    },
  ) => {
    setModalState({
      isOpen: true,
      title,
      description,
      jobs,
      type,
      additionalData,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: "",
      description: "",
      jobs: [],
      type: "jobs-at-risk",
    });
  };

  // Calculate jobs at risk for modal
  const atRiskData = useMemo(() => {
    return identifyJobsAtRisk(jobs);
  }, [jobs]);

  // Calculate jobs by client for modal
  const getJobsByClient = (clientName: string): ParsedJob[] => {
    return jobs.filter((job) => {
      const parsedJob = job as ParsedJob;
      const client = parsedJob.client;
      if (typeof client === "string") return client === clientName;
      return client?.name === clientName;
    }) as ParsedJob[];
  };

  // Calculate jobs by process type for modal
  const getJobsByProcessType = (processType: string): ParsedJob[] => {
    return jobs.filter((job) => {
      const parsedJob = job as ParsedJob;
      const requirements = parsedJob.requirements;
      if (typeof requirements === "string" || !Array.isArray(requirements))
        return false;
      const primaryProcess = requirements.find(
        (req: { process_type?: string }) => req.process_type,
      );
      return primaryProcess?.process_type === processType;
    }) as ParsedJob[];
  };

  // Calculate profit margin for insight card
  const profitMargin = useMemo(() => {
    return calculateProfitMargin(jobs);
  }, [jobs]);

  // Calculate low margin jobs for alert
  const lowMarginData = useMemo(() => {
    return getLowMarginJobs(jobs, 10); // 10% threshold
  }, [jobs]);

  // Detect job clustering for alert
  const clusteringData = useMemo(() => {
    return detectJobClustering(jobs, timeRanges, 0.3); // 30% threshold
  }, [jobs, timeRanges]);

  // Handle empty state
  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-12 max-w-2xl mx-auto">
          <div className="text-6xl mb-4">📊</div>
          <div className="text-gray-800 font-semibold text-lg mb-2">
            No Data Available
          </div>
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
              console.log("[CFODashboard] Cost entries saved successfully");
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
          title="Trends Over Time"
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

      {/* Key Insights & Alerts Section */}
      <section className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Key Insights & Alerts
        </h3>

        {/* Alerts Section */}
        <div className="space-y-3 mb-6">
          {/* Critical Alerts */}
          {metrics.jobsAtRisk && metrics.jobsAtRisk > 0 && (
            <div
              onClick={() =>
                openModal(
                  "Jobs At Risk",
                  `${metrics.jobsAtRisk || 0} job${(metrics.jobsAtRisk || 0) > 1 ? "s are" : " is"} at risk with ${metrics.revenueAtRisk ? `$${metrics.revenueAtRisk.toLocaleString()}` : "$0"} in revenue at stake. These jobs need immediate attention.`,
                  atRiskData.jobs as ParsedJob[],
                  "jobs-at-risk",
                  { revenueAtRisk: atRiskData.totalRevenue },
                )
              }
              className="p-4 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
            >
              <div className="flex items-start">
                <span className="text-red-600 font-bold mr-2">⚠</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-900">
                    Jobs At Risk
                  </p>
                  <p className="text-sm text-red-700 mt-1">
                    {metrics.jobsAtRisk} job
                    {metrics.jobsAtRisk > 1 ? "s are" : " is"} at risk with{" "}
                    {metrics.revenueAtRisk
                      ? `$${metrics.revenueAtRisk.toLocaleString()}`
                      : "$0"}{" "}
                    in revenue at stake. Review profit margins and costs.
                  </p>
                </div>
                <span className="text-red-400 text-xs ml-2">
                  Click for details →
                </span>
              </div>
            </div>
          )}

          {/* High Client Concentration */}
          {(() => {
            const highRiskClients = clientRevenues.filter(
              (c) => c.percentageOfTotal >= 20,
            );
            const top3Concentration = clientRevenues
              .slice(0, 3)
              .reduce((sum, c) => sum + c.percentageOfTotal, 0);
            if (highRiskClients.length > 0) {
              const highRiskJobs = highRiskClients.flatMap((client) =>
                getJobsByClient(client.clientName),
              );
              return (
                <div
                  onClick={() =>
                    openModal(
                      "High Client Concentration Risk",
                      `${highRiskClients.length} client${highRiskClients.length > 1 ? "s" : ""} represent${highRiskClients.length === 1 ? "s" : ""} ≥20% of revenue each. Top 3 clients = ${top3Concentration.toFixed(1)}% of total revenue.`,
                      highRiskJobs,
                      "client-concentration",
                      { concentration: top3Concentration },
                    )
                  }
                  className="p-4 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-start">
                    <span className="text-red-600 font-bold mr-2">⚠</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900">
                        High Client Concentration Risk
                      </p>
                      <p className="text-sm text-red-700 mt-1">
                        {highRiskClients.length} client
                        {highRiskClients.length > 1 ? "s" : ""} represent
                        {highRiskClients.length === 1 ? "s" : ""} ≥20% of
                        revenue each. Top 3 clients ={" "}
                        {top3Concentration.toFixed(1)}% of total revenue.
                        Diversify client base to reduce dependency.
                      </p>
                    </div>
                    <span className="text-red-400 text-xs ml-2">
                      Click for details →
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Moderate Client Concentration */}
          {(() => {
            const highRiskClients = clientRevenues.filter(
              (c) => c.percentageOfTotal >= 20,
            ).length;
            const moderateRiskClients = clientRevenues.filter(
              (c) => c.percentageOfTotal >= 10 && c.percentageOfTotal < 20,
            );
            if (moderateRiskClients.length > 0 && highRiskClients === 0) {
              const moderateRiskJobs = moderateRiskClients.flatMap((client) =>
                getJobsByClient(client.clientName),
              );
              const totalConcentration = moderateRiskClients.reduce(
                (sum, c) => sum + c.percentageOfTotal,
                0,
              );
              return (
                <div
                  onClick={() =>
                    openModal(
                      "Moderate Client Concentration",
                      `${moderateRiskClients.length} client${moderateRiskClients.length > 1 ? "s" : ""} represent${moderateRiskClients.length === 1 ? "s" : ""} 10-20% of revenue each.`,
                      moderateRiskJobs,
                      "client-concentration",
                      { concentration: totalConcentration },
                    )
                  }
                  className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
                >
                  <div className="flex items-start">
                    <span className="text-yellow-600 font-bold mr-2">⚡</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-900">
                        Moderate Client Concentration
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {moderateRiskClients.length} client
                        {moderateRiskClients.length > 1 ? "s" : ""} represent
                        {moderateRiskClients.length === 1 ? "s" : ""} 10-20% of
                        revenue. Monitor and consider diversification.
                      </p>
                    </div>
                    <span className="text-yellow-400 text-xs ml-2">
                      Click for details →
                    </span>
                  </div>
                </div>
              );
            }
            return null;
          })()}

          {/* Process Diversification Insight */}
          {serviceRevenues.length > 0 &&
            serviceRevenues[0].percentageOfTotal > 50 &&
            (() => {
              const primaryProcess = serviceRevenues[0];
              const processJobs = getJobsByProcessType(
                primaryProcess.serviceType,
              );
              return (
                <div
                  onClick={() =>
                    openModal(
                      "Process Concentration",
                      `${primaryProcess.serviceType} represents ${primaryProcess.percentageOfTotal.toFixed(1)}% of revenue. Consider process diversification to reduce dependency.`,
                      processJobs,
                      "process-concentration",
                      {
                        processType: primaryProcess.serviceType,
                        concentration: primaryProcess.percentageOfTotal,
                      },
                    )
                  }
                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-start">
                    <span className="text-blue-600 font-bold mr-2">ℹ</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        Process Concentration
                      </p>
                      <p className="text-sm text-blue-700 mt-1">
                        {primaryProcess.serviceType} represents{" "}
                        {primaryProcess.percentageOfTotal.toFixed(1)}% of
                        revenue. Consider process diversification to reduce
                        dependency.
                      </p>
                    </div>
                    <span className="text-blue-400 text-xs ml-2">
                      Click for details →
                    </span>
                  </div>
                </div>
              );
            })()}

          {/* Job Clustering Risk Alert */}
          {clusteringData.clusteredPeriods.length > 0 &&
            (() => {
              const topCluster = clusteringData.clusteredPeriods[0];
              const percentageText = (
                topCluster.percentageOfTotal * 100
              ).toFixed(0);
              return (
                <div
                  onClick={() =>
                    openModal(
                      "Job Clustering Risk",
                      `${topCluster.jobCount} jobs (${percentageText}% of total) are clustered in ${topCluster.period.label}, creating delivery bottleneck risk.`,
                      topCluster.jobs as ParsedJob[],
                      "job-clustering",
                      { periodLabel: topCluster.period.label },
                    )
                  }
                  className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg cursor-pointer hover:bg-yellow-100 transition-colors"
                >
                  <div className="flex items-start">
                    <span className="text-yellow-600 font-bold mr-2">⚠</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-yellow-900">
                        Job Clustering Risk
                      </p>
                      <p className="text-sm text-yellow-700 mt-1">
                        {topCluster.jobCount} jobs ({percentageText}% of total)
                        are clustered in {topCluster.period.label}. Negotiate
                        due date extensions or add temporary capacity to avoid
                        delays.
                      </p>
                    </div>
                    <span className="text-yellow-400 text-xs ml-2">
                      Click for details →
                    </span>
                  </div>
                </div>
              );
            })()}
        </div>

        {/* Insights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Clients */}
          <div
            onClick={() =>
              openModal(
                "All Active Clients",
                `${clientRevenues.length} client${clientRevenues.length !== 1 ? "s" : ""} contributed to revenue in this period.`,
                jobs as ParsedJob[],
                "total-clients",
              )
            }
            className="p-4 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-blue-700 font-medium mb-1">
                  Total Clients
                </div>
                <div className="text-2xl font-bold text-blue-900">
                  {clientRevenues.length}
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Active in this period
                </div>
              </div>
              <span className="text-blue-400 text-xs ml-2">→</span>
            </div>
          </div>

          {/* Top Client Contribution */}
          {clientRevenues.length > 0 && (
            <div
              onClick={() =>
                openModal(
                  `Top Client: ${clientRevenues[0].clientName}`,
                  `${clientRevenues[0].clientName} is your top client with ${clientRevenues[0].jobCount} job${clientRevenues[0].jobCount !== 1 ? "s" : ""} and ${clientRevenues[0].percentageOfTotal.toFixed(1)}% of total revenue.`,
                  getJobsByClient(clientRevenues[0].clientName),
                  "top-client",
                  { clientName: clientRevenues[0].clientName },
                )
              }
              className="p-4 bg-purple-50 rounded-lg border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm text-purple-700 font-medium mb-1">
                    Top Client
                  </div>
                  <div
                    className="text-2xl font-bold text-purple-900 truncate"
                    title={clientRevenues[0].clientName}
                  >
                    {clientRevenues[0].clientName}
                  </div>
                  <div className="text-xs text-purple-600 mt-1">
                    {clientRevenues[0].jobCount} jobs,{" "}
                    {clientRevenues[0].percentageOfTotal.toFixed(1)}% of revenue
                  </div>
                </div>
                <span className="text-purple-400 text-xs ml-2">→</span>
              </div>
            </div>
          )}

          {/* Process Types */}
          {serviceRevenues.length > 0 && (
            <div
              onClick={() =>
                openModal(
                  `Primary Process: ${serviceRevenues[0].serviceType}`,
                  `${serviceRevenues[0].serviceType} is your primary process type, generating ${serviceRevenues[0].percentageOfTotal.toFixed(1)}% of total revenue.`,
                  getJobsByProcessType(serviceRevenues[0].serviceType),
                  "primary-process",
                  { processType: serviceRevenues[0].serviceType },
                )
              }
              className="p-4 bg-green-50 rounded-lg border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm text-green-700 font-medium mb-1">
                    Primary Process
                  </div>
                  <div
                    className="text-2xl font-bold text-green-900 truncate"
                    title={serviceRevenues[0].serviceType}
                  >
                    {serviceRevenues[0].serviceType}
                  </div>
                  <div className="text-xs text-green-600 mt-1">
                    {serviceRevenues[0].percentageOfTotal.toFixed(1)}% of total
                    revenue
                  </div>
                </div>
                <span className="text-green-400 text-xs ml-2">→</span>
              </div>
            </div>
          )}

          {/* Revenue per Job */}
          <div
            onClick={() =>
              openModal(
                "Revenue per Job Analysis",
                `Average revenue per job is $${(totalRevenue / jobs.length).toLocaleString(undefined, { maximumFractionDigits: 0 })} across ${jobs.length} job${jobs.length !== 1 ? "s" : ""}.`,
                jobs as ParsedJob[],
                "revenue-per-job",
              )
            }
            className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-yellow-700 font-medium mb-1">
                  Revenue per Job
                </div>
                <div className="text-2xl font-bold text-yellow-900">
                  $
                  {(totalRevenue / jobs.length).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </div>
                <div className="text-xs text-yellow-600 mt-1">
                  Average job value
                </div>
              </div>
              <span className="text-yellow-400 text-xs ml-2">→</span>
            </div>
          </div>

          {/* Total Pieces */}
          <div
            onClick={() =>
              openModal(
                "Total Volume Analysis",
                `${jobs.reduce((sum, job) => sum + job.quantity, 0).toLocaleString()} total pieces across ${jobs.length} job${jobs.length !== 1 ? "s" : ""}.`,
                jobs as ParsedJob[],
                "total-volume",
              )
            }
            className="p-4 bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="text-sm text-indigo-700 font-medium mb-1">
                  Total Volume
                </div>
                <div className="text-2xl font-bold text-indigo-900">
                  {jobs
                    .reduce((sum, job) => sum + job.quantity, 0)
                    .toLocaleString()}
                </div>
                <div className="text-xs text-indigo-600 mt-1">
                  Pieces projected
                </div>
              </div>
              <span className="text-indigo-400 text-xs ml-2">→</span>
            </div>
          </div>

          {/* Revenue Growth (if available) */}
          {revenueTrend && (
            <div
              onClick={() =>
                openModal(
                  "Period Growth Details",
                  `Revenue ${revenueTrend.percentChange > 0 ? "increased" : revenueTrend.percentChange < 0 ? "decreased" : "stayed flat"} by ${Math.abs(revenueTrend.percentChange).toFixed(1)}% compared to the previous period.`,
                  jobs as ParsedJob[],
                  "period-growth",
                )
              }
              className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                revenueTrend.percentChange > 0
                  ? "bg-green-50 border-green-200 hover:bg-green-100"
                  : revenueTrend.percentChange < 0
                    ? "bg-red-50 border-red-200 hover:bg-red-100"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium mb-1 ${
                      revenueTrend.percentChange > 0
                        ? "text-green-700"
                        : revenueTrend.percentChange < 0
                          ? "text-red-700"
                          : "text-gray-700"
                    }`}
                  >
                    Period Growth
                  </div>
                  <div
                    className={`text-2xl font-bold ${
                      revenueTrend.percentChange > 0
                        ? "text-green-900"
                        : revenueTrend.percentChange < 0
                          ? "text-red-900"
                          : "text-gray-900"
                    }`}
                  >
                    {revenueTrend.percentChange > 0 ? "+" : ""}
                    {revenueTrend.percentChange.toFixed(1)}%
                  </div>
                  <div
                    className={`text-xs mt-1 ${
                      revenueTrend.percentChange > 0
                        ? "text-green-600"
                        : revenueTrend.percentChange < 0
                          ? "text-red-600"
                          : "text-gray-600"
                    }`}
                  >
                    vs previous period
                  </div>
                </div>
                <span
                  className={`text-xs ml-2 ${
                    revenueTrend.percentChange > 0
                      ? "text-green-400"
                      : revenueTrend.percentChange < 0
                        ? "text-red-400"
                        : "text-gray-400"
                  }`}
                >
                  →
                </span>
              </div>
            </div>
          )}

          {/* Profit Margin Health */}
          <div
            onClick={() =>
              openModal(
                "Profit Margin Health",
                `Overall profit margin is ${profitMargin.toFixed(1)}% across all jobs. ${lowMarginData.jobs.length > 0 ? `${lowMarginData.jobs.length} job${lowMarginData.jobs.length !== 1 ? "s have" : " has"} margins below 10%.` : "All jobs have healthy margins."}`,
                lowMarginData.jobs.length > 0
                  ? (lowMarginData.jobs as ParsedJob[])
                  : (jobs as ParsedJob[]),
                "profit-margin",
                { profitMargin },
              )
            }
            className={`p-4 rounded-lg border cursor-pointer transition-colors ${
              profitMargin >= 25
                ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
                : profitMargin >= 15
                  ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                  : "bg-rose-50 border-rose-200 hover:bg-rose-100"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div
                  className={`text-sm font-medium mb-1 ${
                    profitMargin >= 25
                      ? "text-emerald-700"
                      : profitMargin >= 15
                        ? "text-amber-700"
                        : "text-rose-700"
                  }`}
                >
                  Profit Margin
                </div>
                <div
                  className={`text-2xl font-bold ${
                    profitMargin >= 25
                      ? "text-emerald-900"
                      : profitMargin >= 15
                        ? "text-amber-900"
                        : "text-rose-900"
                  }`}
                >
                  {profitMargin.toFixed(1)}%
                </div>
                <div
                  className={`text-xs mt-1 ${
                    profitMargin >= 25
                      ? "text-emerald-600"
                      : profitMargin >= 15
                        ? "text-amber-600"
                        : "text-rose-600"
                  }`}
                >
                  {profitMargin >= 25
                    ? "Healthy margins"
                    : profitMargin >= 15
                      ? "Moderate margins"
                      : "Low margins - review pricing"}
                </div>
              </div>
              <span
                className={`text-xs ml-2 ${
                  profitMargin >= 25
                    ? "text-emerald-400"
                    : profitMargin >= 15
                      ? "text-amber-400"
                      : "text-rose-400"
                }`}
              >
                →
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Print-friendly Note */}
      <div className="text-center text-sm text-gray-500 no-print">
        Tip: Use your browser&apos;s print function to generate a PDF report of
        this financial analysis
      </div>

      {/* Alert Details Modal */}
      <AlertDetailsModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        description={modalState.description}
        jobs={modalState.jobs}
        type={modalState.type}
        additionalData={modalState.additionalData}
      />
    </div>
  );
}
