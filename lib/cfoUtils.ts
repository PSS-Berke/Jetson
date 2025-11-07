import { Job } from '@/types';
import { ParsedJob } from '@/hooks/useJobs';
import { TimeRange } from './projectionUtils';

// ============================================================================
// CFO UTILITY FUNCTIONS
// Financial calculations and analysis for executive decision-making
// ============================================================================

// Type guard to check if client is an object or string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getClientName(client: any): string {
  if (!client) return 'Unknown';
  if (typeof client === 'string') return client;
  if (typeof client === 'object' && 'name' in client) return client.name;
  return 'Unknown';
}

/**
 * Calculate revenue from requirements.price_per_m if available, otherwise use total_billing
 * This ensures we use the most accurate pricing data from the API
 */
function getJobRevenue(job: Job | ParsedJob): number {
  // Check if job has parsed requirements with price_per_m
  if ('requirements' in job && Array.isArray(job.requirements) && job.requirements.length > 0) {
    const parsedJob = job as ParsedJob;
    const revenue = parsedJob.requirements.reduce((total, req) => {
      const pricePerMStr = req.price_per_m;
      const isValidPrice = pricePerMStr && pricePerMStr !== 'undefined' && pricePerMStr !== 'null';
      const pricePerM = isValidPrice ? parseFloat(pricePerMStr) : 0;
      return total + ((parsedJob.quantity / 1000) * pricePerM);
    }, 0);
    
    // Add add-on charges if available
    const addOnCharges = parseFloat(job.add_on_charges || '0');
    return revenue + addOnCharges;
  }
  
  // Fallback to total_billing
  return parseFloat(job.total_billing || '0');
}

// ----------------------------------------------------------------------------
// TYPES & INTERFACES
// ----------------------------------------------------------------------------

export interface RevenueByPeriod {
  period: string;
  revenue: number;
  jobCount: number;
  quantity: number;
  profit: number;
}

export interface ClientRevenue {
  clientId: number;
  clientName: string;
  revenue: number;
  jobCount: number;
  percentageOfTotal: number;
  quantity: number;
  profit: number;
}

export interface ServiceTypeRevenue {
  serviceType: string;
  revenue: number;
  jobCount: number;
  percentageOfTotal: number;
  quantity: number;
  profit: number;
}

export interface PeriodComparison {
  metric: string;
  current: number;
  previous: number;
  change: number;
  percentChange: number;
  isPositive: boolean;
}

export interface ExecutiveAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  impact?: string;
  action?: string;
  value?: number;
}

export interface CFOSummaryMetrics {
  totalRevenue: number;
  totalJobs: number;
  totalQuantity: number;
  averageJobValue: number;
  averageJobProfit: number;
  capacityUtilization: number;
  topProfitableJobs: Array<{
    jobNumber: string;
    client: string;
    profit: number;
  }>;
  topCostPerPieceByProcess: Array<{
    processType: string;
    costPerPiece: number;
    totalPieces: number;
  }>;
  topClientConcentration: number;
  topClientName: string;
  jobsAtRisk?: number;
  revenueAtRisk?: number;
  forecastAccuracy?: number;
}

// ----------------------------------------------------------------------------
// REVENUE CALCULATIONS
// ----------------------------------------------------------------------------

/**
 * Calculate total revenue from a list of jobs
 */
export function calculateTotalRevenue(jobs: (Job | ParsedJob)[]): number {
  return jobs.reduce((sum, job) => {
    const billing = getJobRevenue(job);
    return sum + billing;
  }, 0);
}

/**
 * Calculate average job value
 */
export function calculateAverageJobValue(jobs: (Job | ParsedJob)[]): number {
  if (jobs.length === 0) return 0;
  return calculateTotalRevenue(jobs) / jobs.length;
}

/**
 * Calculate revenue by time period
 * Revenue is distributed across the production timeline (start_date to due_date)
 * proportionally based on how much of the job overlaps with each period
 * Handles TimeRange union type (WeekRange | MonthRange | QuarterRange)
 */
export function calculateRevenueByPeriod(
  jobs: (Job | ParsedJob)[],
  periods: TimeRange[]
): RevenueByPeriod[] {
  return periods.map(period => {
    const periodStart = period.startDate;
    const periodEnd = period.endDate;
    let revenue = 0;
    let quantity = 0;
    let profit = 0;
    const jobsInPeriod = new Set<number>();

    jobs.forEach(job => {
      const jobStart = new Date(job.start_date);
      const jobEnd = new Date(job.due_date);
      const jobRevenue = getJobRevenue(job);
      const jobQuantity = job.quantity;
      // Calculate profit (simplified: revenue - ext_price)
      const extPrice = parseFloat(job.ext_price || '0');
      const jobProfit = jobRevenue - extPrice;

      // Check if job overlaps with this period
      const overlapStart = jobStart > periodStart ? jobStart : periodStart;
      const overlapEnd = jobEnd < periodEnd ? jobEnd : periodEnd;

      if (overlapStart <= overlapEnd) {
        // Job overlaps with this period
        jobsInPeriod.add(job.id);

        // Calculate what portion of the job's timeline falls in this period
        const jobDurationMs = jobEnd.getTime() - jobStart.getTime();
        const overlapDurationMs = overlapEnd.getTime() - overlapStart.getTime();

        if (jobDurationMs > 0) {
          const overlapRatio = overlapDurationMs / jobDurationMs;
          // Distribute revenue, profit, and quantity proportionally to the overlap
          revenue += jobRevenue * overlapRatio;
          profit += jobProfit * overlapRatio;
          quantity += jobQuantity * overlapRatio;
        } else {
          // Job starts and ends on same day, count full revenue if it overlaps
          revenue += jobRevenue;
          profit += jobProfit;
          quantity += jobQuantity;
        }
      }
    });

    return {
      period: period.label,
      revenue,
      jobCount: jobsInPeriod.size,
      quantity: Math.round(quantity),
      profit,
    };
  });
}

/**
 * Calculate revenue by client, sorted by revenue descending
 */
export function calculateRevenueByClient(jobs: (Job | ParsedJob)[]): ClientRevenue[] {
  const totalRevenue = calculateTotalRevenue(jobs);

  // Group by client
  const clientMap = new Map<number, { name: string; revenue: number; jobCount: number; quantity: number; profit: number }>();

  jobs.forEach(job => {
    const clientId = job.clients_id;
    const clientName = getClientName(job.client);
    const revenue = getJobRevenue(job);
    // Calculate estimated cost based on ext_price (base price before add-ons)
    // Profit = revenue - ext_price - add_on_charges (simplified estimation)
    const extPrice = parseFloat(job.ext_price || '0');
    // const addOnCharges = parseFloat(job.add_on_charges || '0');
    // Simplified profit estimate: total billing minus costs (rough approximation)
    // For more accurate profit, use JobCostEntry data from jobCostUtils
    const profit = revenue - extPrice;
    const quantity = job.quantity;

    if (clientMap.has(clientId)) {
      const existing = clientMap.get(clientId)!;
      existing.revenue += revenue;
      existing.profit += profit;
      existing.jobCount += 1;
      existing.quantity += quantity;
    } else {
      clientMap.set(clientId, {
        name: clientName,
        revenue,
        profit,
        jobCount: 1,
        quantity,
      });
    }
  });

  // Convert to array and calculate percentages
  const clientRevenues: ClientRevenue[] = Array.from(clientMap.entries()).map(([clientId, data]) => ({
    clientId,
    clientName: data.name,
    revenue: data.revenue,
    jobCount: data.jobCount,
    quantity: data.quantity,
    profit: data.profit,
    percentageOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  }));

  // Sort by revenue descending
  return clientRevenues.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate revenue by service type
 */
export function calculateRevenueByServiceType(jobs: (Job | ParsedJob)[]): ServiceTypeRevenue[] {
  const totalRevenue = calculateTotalRevenue(jobs);

  // Group by service type
  const serviceMap = new Map<string, { revenue: number; jobCount: number; quantity: number; profit: number }>();

  jobs.forEach(job => {
    const serviceType = job.service_type || 'Unknown';
    const revenue = getJobRevenue(job);
    const extPrice = parseFloat(job.ext_price || '0');
    const profit = revenue - extPrice;
    const quantity = job.quantity;

    if (serviceMap.has(serviceType)) {
      const existing = serviceMap.get(serviceType)!;
      existing.revenue += revenue;
      existing.profit += profit;
      existing.jobCount += 1;
      existing.quantity += quantity;
    } else {
      serviceMap.set(serviceType, {
        revenue,
        profit,
        jobCount: 1,
        quantity,
      });
    }
  });

  // Convert to array and calculate percentages
  const serviceRevenues: ServiceTypeRevenue[] = Array.from(serviceMap.entries()).map(([serviceType, data]) => ({
    serviceType,
    revenue: data.revenue,
    jobCount: data.jobCount,
    quantity: data.quantity,
    profit: data.profit,
    percentageOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  }));

  // Sort by revenue descending
  return serviceRevenues.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate revenue by process type (from job requirements)
 * Process types: Insert, Sort, Inkjet, Label/Apply, Fold, Laser, HP Press
 */
export function calculateRevenueByProcessType(jobs: (Job | ParsedJob)[]): ServiceTypeRevenue[] {
  const totalRevenue = calculateTotalRevenue(jobs);

  // Group by process type
  const processMap = new Map<string, { revenue: number; jobCount: Set<number>; quantity: number; profit: number }>();

  jobs.forEach(job => {
    const revenue = getJobRevenue(job);
    const extPrice = parseFloat(job.ext_price || '0');
    const profit = revenue - extPrice;
    const quantity = job.quantity;

    // Get process types from requirements
    // ParsedJob has requirements as ParsedRequirement[], Job has requirements as string
    const requirements = Array.isArray(job.requirements) ? job.requirements : [];

    if (requirements.length === 0) {
      // No requirements, add to "Unknown"
      if (!processMap.has('Unknown')) {
        processMap.set('Unknown', { revenue: 0, jobCount: new Set(), quantity: 0, profit: 0 });
      }
      const existing = processMap.get('Unknown')!;
      existing.revenue += revenue;
      existing.profit += profit;
      existing.jobCount.add(job.id);
      existing.quantity += quantity;
    } else {
      // Add revenue to each process type this job requires
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requirements.forEach((req: any) => {
        const processType = req.process_type || 'Unknown';

        if (!processMap.has(processType)) {
          processMap.set(processType, { revenue: 0, jobCount: new Set(), quantity: 0, profit: 0 });
        }

        const existing = processMap.get(processType)!;
        // Add full revenue and profit to this process (job contributes to each process it uses)
        existing.revenue += revenue;
        existing.profit += profit;
        existing.jobCount.add(job.id);
        existing.quantity += quantity;
      });
    }
  });

  // Convert to array and calculate percentages
  const processRevenues: ServiceTypeRevenue[] = Array.from(processMap.entries()).map(([processType, data]) => ({
    serviceType: processType,
    revenue: data.revenue,
    jobCount: data.jobCount.size,
    quantity: data.quantity,
    profit: data.profit,
    percentageOfTotal: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
  }));

  // Sort by revenue descending
  return processRevenues.sort((a, b) => b.revenue - a.revenue);
}

/**
 * Calculate revenue trend (comparison with previous period)
 */
export function calculateRevenueTrend(
  currentJobs: (Job | ParsedJob)[],
  previousJobs: (Job | ParsedJob)[]
): { current: number; previous: number; change: number; percentChange: number } {
  const currentRevenue = calculateTotalRevenue(currentJobs);
  const previousRevenue = calculateTotalRevenue(previousJobs);
  const change = currentRevenue - previousRevenue;
  const percentChange = previousRevenue > 0 ? (change / previousRevenue) * 100 : 0;

  return {
    current: currentRevenue,
    previous: previousRevenue,
    change,
    percentChange,
  };
}

// ----------------------------------------------------------------------------
// CLIENT ANALYSIS
// ----------------------------------------------------------------------------

/**
 * Calculate top client concentration (sum of top N clients as % of total)
 */
export function calculateTopClientConcentration(jobs: (Job | ParsedJob)[], topN: number = 3): number {
  const clientRevenues = calculateRevenueByClient(jobs);
  const topClients = clientRevenues.slice(0, topN);
  const topConcentration = topClients.reduce((sum, client) => sum + client.percentageOfTotal, 0);

  return topConcentration;
}

/**
 * Get top N clients
 */
export function getTopClients(jobs: (Job | ParsedJob)[], n: number = 10): ClientRevenue[] {
  const clientRevenues = calculateRevenueByClient(jobs);
  return clientRevenues.slice(0, n);
}

/**
 * Calculate client diversification score (0-100, higher is better)
 * Based on inverse of concentration - more evenly distributed = higher score
 */
export function calculateClientDiversificationScore(jobs: (Job | ParsedJob)[]): number {
  const clientRevenues = calculateRevenueByClient(jobs);

  if (clientRevenues.length === 0) return 0;
  if (clientRevenues.length === 1) return 0; // Single client = no diversification

  // Calculate Herfindahl-Hirschman Index (HHI)
  // Sum of squared market shares (as decimals, not percentages)
  const hhi = clientRevenues.reduce((sum, client) => {
    const share = client.percentageOfTotal / 100;
    return sum + (share * share);
  }, 0);

  // Normalize HHI to 0-100 scale
  // HHI ranges from 1/n (perfectly distributed) to 1 (single client)
  // We want: perfectly distributed = 100, single client = 0
  const minHHI = 1 / clientRevenues.length;
  const normalizedScore = ((1 - hhi) / (1 - minHHI)) * 100;

  return Math.max(0, Math.min(100, normalizedScore));
}

// ----------------------------------------------------------------------------
// PERIOD COMPARISON
// ----------------------------------------------------------------------------

/**
 * Compare current period with previous period across multiple metrics
 */
export function comparePeriods(currentJobs: (Job | ParsedJob)[], previousJobs: (Job | ParsedJob)[]): PeriodComparison[] {
  const currentRevenue = calculateTotalRevenue(currentJobs);
  const previousRevenue = calculateTotalRevenue(previousJobs);
  const currentJobCount = currentJobs.length;
  const previousJobCount = previousJobs.length;
  const currentQuantity = currentJobs.reduce((sum, job) => sum + job.quantity, 0);
  const previousQuantity = previousJobs.reduce((sum, job) => sum + job.quantity, 0);
  const currentAvgValue = calculateAverageJobValue(currentJobs);
  const previousAvgValue = calculateAverageJobValue(previousJobs);

  const comparisons: PeriodComparison[] = [
    {
      metric: 'Revenue',
      current: currentRevenue,
      previous: previousRevenue,
      change: currentRevenue - previousRevenue,
      percentChange: previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0,
      isPositive: currentRevenue >= previousRevenue,
    },
    {
      metric: 'Jobs',
      current: currentJobCount,
      previous: previousJobCount,
      change: currentJobCount - previousJobCount,
      percentChange: previousJobCount > 0 ? ((currentJobCount - previousJobCount) / previousJobCount) * 100 : 0,
      isPositive: currentJobCount >= previousJobCount,
    },
    {
      metric: 'Total Pieces',
      current: currentQuantity,
      previous: previousQuantity,
      change: currentQuantity - previousQuantity,
      percentChange: previousQuantity > 0 ? ((currentQuantity - previousQuantity) / previousQuantity) * 100 : 0,
      isPositive: currentQuantity >= previousQuantity,
    },
    {
      metric: 'Avg Job Value',
      current: currentAvgValue,
      previous: previousAvgValue,
      change: currentAvgValue - previousAvgValue,
      percentChange: previousAvgValue > 0 ? ((currentAvgValue - previousAvgValue) / previousAvgValue) * 100 : 0,
      isPositive: currentAvgValue >= previousAvgValue,
    },
  ];

  return comparisons;
}

// ----------------------------------------------------------------------------
// RISK IDENTIFICATION
// ----------------------------------------------------------------------------

/**
 * Identify jobs at risk (behind schedule or due soon with tight timeline)
 */
export function identifyJobsAtRisk(jobs: (Job | ParsedJob)[]): { jobs: (Job | ParsedJob)[]; totalRevenue: number } {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const atRiskJobs = jobs.filter(job => {
    const dueDate = new Date(job.due_date);

    // Due within 3 days
    if (dueDate <= threeDaysFromNow && dueDate >= now) {
      return true;
    }

    // Behind schedule (start date in past but not started)
    const startDate = new Date(job.start_date);
    if (startDate < now && dueDate > now) {
      // Could add production tracking check here
      return true;
    }

    return false;
  });

  const totalRevenue = calculateTotalRevenue(atRiskJobs);

  return { jobs: atRiskJobs, totalRevenue };
}

/**
 * Check for client concentration risk
 */
export function checkClientConcentrationRisk(jobs: (Job | ParsedJob)[]): ExecutiveAlert | null {
  const topClientConcentration = calculateTopClientConcentration(jobs, 1);
  const clientRevenues = calculateRevenueByClient(jobs);

  if (clientRevenues.length === 0) return null;

  const topClient = clientRevenues[0];

  if (topClientConcentration > 30) {
    return {
      id: 'client-concentration-critical',
      severity: 'critical',
      title: 'High Client Concentration Risk',
      description: `${topClient.clientName} represents ${topClientConcentration.toFixed(1)}% of revenue`,
      impact: `$${topClient.revenue.toLocaleString()} at risk if client is lost`,
      action: 'Diversify client base and reduce dependency',
    };
  } else if (topClientConcentration > 20) {
    return {
      id: 'client-concentration-warning',
      severity: 'warning',
      title: 'Moderate Client Concentration',
      description: `${topClient.clientName} represents ${topClientConcentration.toFixed(1)}% of revenue`,
      impact: 'Consider diversification strategies',
      action: 'Monitor and plan for client diversification',
    };
  }

  return null;
}

/**
 * Generate executive alerts based on analysis
 */
export function generateExecutiveAlerts(
  jobs: (Job | ParsedJob)[],
  previousJobs?: (Job | ParsedJob)[],
  capacityUtilization?: number
): ExecutiveAlert[] {
  const alerts: ExecutiveAlert[] = [];

  // Client concentration risk
  const concentrationAlert = checkClientConcentrationRisk(jobs);
  if (concentrationAlert) {
    alerts.push(concentrationAlert);
  }

  // Jobs at risk
  const { jobs: atRiskJobs, totalRevenue: revenueAtRisk } = identifyJobsAtRisk(jobs);
  if (atRiskJobs.length > 0) {
    alerts.push({
      id: 'jobs-at-risk',
      severity: atRiskJobs.length > 5 ? 'critical' : 'warning',
      title: `${atRiskJobs.length} Jobs At Risk`,
      description: `${atRiskJobs.length} jobs are behind schedule or due soon`,
      impact: `$${revenueAtRisk.toLocaleString()} revenue at risk`,
      action: 'Review schedule and prioritize resources',
      value: revenueAtRisk,
    });
  }

  // Capacity utilization
  if (capacityUtilization !== undefined) {
    if (capacityUtilization > 95) {
      alerts.push({
        id: 'capacity-bottleneck',
        severity: 'critical',
        title: 'Capacity Bottleneck',
        description: `Capacity utilization at ${capacityUtilization.toFixed(1)}%`,
        impact: 'May delay jobs and impact revenue',
        action: 'Consider adding capacity or adjusting schedule',
      });
    } else if (capacityUtilization > 85) {
      alerts.push({
        id: 'capacity-high',
        severity: 'warning',
        title: 'High Capacity Utilization',
        description: `Capacity utilization at ${capacityUtilization.toFixed(1)}%`,
        impact: 'Limited flexibility for rush jobs',
        action: 'Monitor closely and plan for peak periods',
      });
    } else if (capacityUtilization < 40) {
      alerts.push({
        id: 'capacity-low',
        severity: 'warning',
        title: 'Low Capacity Utilization',
        description: `Capacity utilization at ${capacityUtilization.toFixed(1)}%`,
        impact: 'Underutilized resources',
        action: 'Increase sales efforts or adjust capacity',
      });
    }
  }

  // Revenue trend
  if (previousJobs && previousJobs.length > 0) {
    const trend = calculateRevenueTrend(jobs, previousJobs);

    if (trend.percentChange < -15) {
      alerts.push({
        id: 'revenue-decline',
        severity: 'critical',
        title: 'Significant Revenue Decline',
        description: `Revenue down ${Math.abs(trend.percentChange).toFixed(1)}% vs previous period`,
        impact: `$${Math.abs(trend.change).toLocaleString()} revenue decrease`,
        action: 'Investigate cause and implement recovery plan',
      });
    } else if (trend.percentChange < -5) {
      alerts.push({
        id: 'revenue-decline-warning',
        severity: 'warning',
        title: 'Revenue Decline',
        description: `Revenue down ${Math.abs(trend.percentChange).toFixed(1)}% vs previous period`,
        impact: 'Trending downward',
        action: 'Monitor and identify growth opportunities',
      });
    } else if (trend.percentChange > 20) {
      alerts.push({
        id: 'revenue-growth',
        severity: 'info',
        title: 'Strong Revenue Growth',
        description: `Revenue up ${trend.percentChange.toFixed(1)}% vs previous period`,
        impact: `$${trend.change.toLocaleString()} revenue increase`,
        action: 'Ensure capacity can support growth',
      });
    }
  }

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ----------------------------------------------------------------------------
// SUMMARY METRICS
// ----------------------------------------------------------------------------

/**
 * Calculate comprehensive CFO summary metrics
 */
export function calculateCFOSummaryMetrics(
  jobs: (Job | ParsedJob)[],
  capacityUtilization?: number
): CFOSummaryMetrics {
  const totalRevenue = calculateTotalRevenue(jobs);
  const totalJobs = jobs.length;
  const totalQuantity = jobs.reduce((sum, job) => sum + job.quantity, 0);
  const averageJobValue = calculateAverageJobValue(jobs);

  // Calculate total profit (simplified: revenue - ext_price)
  const totalProfit = jobs.reduce((sum, job) => {
    const revenue = getJobRevenue(job);
    const extPrice = parseFloat(job.ext_price || '0');
    return sum + (revenue - extPrice);
  }, 0);
  const averageJobProfit = totalJobs > 0 ? totalProfit / totalJobs : 0;

  // Get top 3 most profitable jobs
  const jobsWithProfit = jobs.map(job => {
    const revenue = getJobRevenue(job);
    const extPrice = parseFloat(job.ext_price || '0');
    const profit = revenue - extPrice;
    return {
      jobNumber: String(job.job_number || 'N/A'),
      client: getClientName(job.client),
      profit,
    };
  });
  
  const topProfitableJobs = jobsWithProfit
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 3);

  // Calculate average cost per piece by process type
  const processTypeMap = new Map<string, { totalCost: number; totalPieces: number }>();
  
  jobs.forEach(job => {
    const quantity = job.quantity || 0;
    
    // Get requirements/process types for this job
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requirements = (job as any).requirements;
    
    if (Array.isArray(requirements) && requirements.length > 0 && quantity > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      requirements.forEach((req: any) => {
        const processType = req.process_type || 'Unknown';
        const pricePerM = parseFloat(req.price_per_m || '0');
        
        if (pricePerM > 0) {
          if (!processTypeMap.has(processType)) {
            processTypeMap.set(processType, { totalCost: 0, totalPieces: 0 });
          }
          
          const existing = processTypeMap.get(processType)!;
          // Calculate total cost for this process: (price_per_m / 1000) * quantity
          const costForJob = (pricePerM / 1000) * quantity;
          existing.totalCost += costForJob;
          existing.totalPieces += quantity;
        }
      });
    }
  });
  
  // Convert to array and calculate cost per M (per 1000 pieces)
  const topCostPerPieceByProcess = Array.from(processTypeMap.entries())
    .map(([processType, data]) => ({
      processType,
      costPerPiece: data.totalPieces > 0 ? (data.totalCost / data.totalPieces) * 1000 : 0,
      totalPieces: data.totalPieces,
    }))
    .sort((a, b) => b.costPerPiece - a.costPerPiece)
    .slice(0, 4);

  const clientRevenues = calculateRevenueByClient(jobs);
  const topClient = clientRevenues[0];
  const topClientConcentration = topClient ? topClient.percentageOfTotal : 0;
  const topClientName = topClient ? topClient.clientName : 'N/A';

  const { jobs: atRiskJobs, totalRevenue: revenueAtRisk } = identifyJobsAtRisk(jobs);

  return {
    totalRevenue,
    totalJobs,
    totalQuantity,
    averageJobValue,
    averageJobProfit,
    capacityUtilization: capacityUtilization || 0,
    topProfitableJobs,
    topCostPerPieceByProcess,
    topClientConcentration,
    topClientName,
    jobsAtRisk: atRiskJobs.length,
    revenueAtRisk,
  };
}

// ----------------------------------------------------------------------------
// FORMATTING HELPERS
// ----------------------------------------------------------------------------

/**
 * Format currency value
 */
export function formatCurrency(value: number, compact: boolean = false): string {
  if (compact && Math.abs(value) >= 1000) {
    if (Math.abs(value) >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format number with commas
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

/**
 * Get trend indicator (↑ ↓ →)
 */
export function getTrendIndicator(percentChange: number): string {
  if (percentChange > 1) return '↑';
  if (percentChange < -1) return '↓';
  return '→';
}

/**
 * Get color for percentage change
 */
export function getChangeColor(percentChange: number, inverse: boolean = false): string {
  const isPositive = inverse ? percentChange < 0 : percentChange > 0;
  if (Math.abs(percentChange) < 1) return 'text-gray-500';
  return isPositive ? 'text-green-600' : 'text-red-600';
}

// ----------------------------------------------------------------------------
// PROFIT MARGIN ANALYSIS
// ----------------------------------------------------------------------------

/**
 * Calculate overall profit margin percentage
 */
export function calculateProfitMargin(jobs: (Job | ParsedJob)[]): number {
  if (jobs.length === 0) return 0;

  const totalRevenue = calculateTotalRevenue(jobs);
  if (totalRevenue === 0) return 0;

  const totalProfit = jobs.reduce((sum, job) => {
    const revenue = getJobRevenue(job);
    const extPrice = parseFloat(job.ext_price || '0');
    return sum + (revenue - extPrice);
  }, 0);

  return (totalProfit / totalRevenue) * 100;
}

/**
 * Get jobs with low profit margins (below threshold)
 */
export function getLowMarginJobs(
  jobs: (Job | ParsedJob)[],
  threshold: number = 10
): { jobs: (Job | ParsedJob)[]; averageMargin: number; totalRevenue: number } {
  const lowMarginJobs = jobs.filter(job => {
    const revenue = getJobRevenue(job);
    if (revenue === 0) return false;

    const extPrice = parseFloat(job.ext_price || '0');
    const profit = revenue - extPrice;
    const margin = (profit / revenue) * 100;

    return margin < threshold;
  });

  const totalRevenue = calculateTotalRevenue(lowMarginJobs);
  const averageMargin = lowMarginJobs.length > 0
    ? lowMarginJobs.reduce((sum, job) => {
        const revenue = getJobRevenue(job);
        const extPrice = parseFloat(job.ext_price || '0');
        const margin = revenue > 0 ? ((revenue - extPrice) / revenue) * 100 : 0;
        return sum + margin;
      }, 0) / lowMarginJobs.length
    : 0;

  return { jobs: lowMarginJobs, averageMargin, totalRevenue };
}

/**
 * Calculate profit margin for a specific job
 */
export function calculateJobProfitMargin(job: Job | ParsedJob): number {
  const revenue = getJobRevenue(job);
  if (revenue === 0) return 0;

  const extPrice = parseFloat(job.ext_price || '0');
  const profit = revenue - extPrice;

  return (profit / revenue) * 100;
}

// ----------------------------------------------------------------------------
// JOB CLUSTERING ANALYSIS
// ----------------------------------------------------------------------------

/**
 * Detect job clustering in time periods
 * Returns periods where >30% of jobs are clustered
 */
export function detectJobClustering(
  jobs: (Job | ParsedJob)[],
  periods: TimeRange[],
  clusterThreshold: number = 0.3
): {
  clusteredPeriods: Array<{
    period: TimeRange;
    jobCount: number;
    percentageOfTotal: number;
    jobs: (Job | ParsedJob)[];
  }>;
  totalJobs: number;
} {
  const totalJobs = jobs.length;
  if (totalJobs === 0) return { clusteredPeriods: [], totalJobs: 0 };

  const clusteredPeriods = periods
    .map(period => {
      // Find jobs that are due in this period
      const jobsInPeriod = jobs.filter(job => {
        const dueDate = new Date(job.due_date);
        return dueDate >= period.startDate && dueDate <= period.endDate;
      });

      const percentageOfTotal = jobsInPeriod.length / totalJobs;

      return {
        period,
        jobCount: jobsInPeriod.length,
        percentageOfTotal,
        jobs: jobsInPeriod,
      };
    })
    .filter(item => item.percentageOfTotal >= clusterThreshold)
    .sort((a, b) => b.percentageOfTotal - a.percentageOfTotal);

  return { clusteredPeriods, totalJobs };
}
