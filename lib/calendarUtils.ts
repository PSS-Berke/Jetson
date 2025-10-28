import { ParsedJob } from '@/hooks/useJobs';
import {
  CalendarEvent,
  DailySummary,
  DayBreakdown,
  JobDayDetail,
  MachineDayDetail,
  MachineCapacityData,
  MachineCapacityDay,
  Machine,
  JobMachineAllocation,
  MachineJobAllocation
} from '@/types/calendar';
import {
  timestampToDate,
  getDaysBetween,
  getDateKey,
  TOTAL_HOURS_PER_DAY
} from './dateUtils';
import {
  calculateMultiMachineTimeEstimate,
  distributeHoursAcrossMachines,
  distributeHoursAcrossDays,
  calculateDailyRevenue,
  calculateDailyPieces,
  calculateDailyMachineCapacity,
  calculateUtilizationPercent,
  getUtilizationColor,
  getUtilizationColorVar
} from './capacityUtils';

/**
 * Transform jobs into calendar events
 */
export const transformJobsToEvents = (
  jobs: ParsedJob[],
  machines: Machine[]
): CalendarEvent[] => {
  return jobs.map(job => {
    const startDate = timestampToDate(job.start_date);
    const endDate = timestampToDate(job.due_date);

    // Get machines for this job
    const jobMachines = machines.filter(m =>
      job.machines.some(jm => jm.id === m.id)
    );

    // Calculate time estimate if not provided
    const timeEstimate = job.time_estimate ||
      calculateMultiMachineTimeEstimate(job.quantity, jobMachines);

    const dailyPieces = calculateDailyPieces(job.quantity, job.start_date, job.due_date);
    const dailyRevenue = calculateDailyRevenue(job.total_billing, job.start_date, job.due_date);

    return {
      id: job.id,
      title: `${job.job_number} - ${job.client.name}`,
      start: startDate,
      end: endDate,
      job,
      dailyPieces,
      dailyRevenue,
      utilizationPercent: 0, // Will be calculated separately
      color: getJobColor(job),
      allDay: true
    };
  });
};

/**
 * Calculate daily summaries for calendar display
 */
export const calculateDailySummaries = (
  jobs: ParsedJob[],
  machines: Machine[],
  startDate: Date,
  endDate: Date
): Map<string, DailySummary> => {
  const summaries = new Map<string, DailySummary>();
  const days = getDaysBetween(startDate, endDate);

  // Initialize all days
  days.forEach(day => {
    const dateKey = getDateKey(day);
    summaries.set(dateKey, {
      date: day,
      dateKey,
      totalPieces: 0,
      totalRevenue: 0,
      utilizationPercent: 0,
      jobCount: 0,
      machineCount: 0
    });
  });

  // Accumulate data from jobs
  jobs.forEach(job => {
    const jobStart = timestampToDate(job.start_date);
    const jobEnd = timestampToDate(job.due_date);
    const jobDays = getDaysBetween(jobStart, jobEnd);

    const dailyPieces = calculateDailyPieces(job.quantity, job.start_date, job.due_date);
    const dailyRevenue = calculateDailyRevenue(job.total_billing, job.start_date, job.due_date);

    jobDays.forEach(day => {
      const dateKey = getDateKey(day);
      const summary = summaries.get(dateKey);
      if (summary) {
        summary.totalPieces += dailyPieces;
        summary.totalRevenue += dailyRevenue;
        summary.jobCount += 1;
      }
    });
  });

  return summaries;
};

/**
 * Calculate machine capacity data over a date range
 */
export const calculateMachineCapacities = (
  jobs: ParsedJob[],
  machines: Machine[],
  startDate: Date,
  endDate: Date
): Map<number, MachineCapacityData> => {
  const capacityData = new Map<number, MachineCapacityData>();

  machines.forEach(machine => {
    const dailyCapacity = new Map<string, MachineCapacityDay>();
    const days = getDaysBetween(startDate, endDate);

    // Initialize each day for this machine
    days.forEach(day => {
      const dateKey = getDateKey(day);
      dailyCapacity.set(dateKey, {
        date: day,
        dateKey,
        allocatedHours: 0,
        availableHours: calculateDailyMachineCapacity(machine),
        utilizationPercent: 0,
        jobs: [],
        color: 'var(--success)'
      });
    });

    // Calculate allocated hours from jobs
    jobs.forEach(job => {
      // Check if this job uses this machine
      const jobUsesMachine = job.machines.some(jm => jm.id === machine.id);
      if (!jobUsesMachine) return;

      const jobMachines = machines.filter(m =>
        job.machines.some(jm => jm.id === m.id)
      );

      // Calculate time estimate
      const timeEstimate = job.time_estimate ||
        calculateMultiMachineTimeEstimate(job.quantity, jobMachines);

      // Distribute hours across machines
      const hoursPerMachine = distributeHoursAcrossMachines(timeEstimate, jobMachines);
      const machineHours = hoursPerMachine.get(machine.id) || 0;

      // Distribute across days
      const hoursPerDay = distributeHoursAcrossDays(
        machineHours,
        job.start_date,
        job.due_date
      );

      // Add to daily capacity
      hoursPerDay.forEach((hours, dateKey) => {
        const dayData = dailyCapacity.get(dateKey);
        if (dayData) {
          dayData.allocatedHours += hours;
          dayData.jobs.push({
            jobNumber: job.job_number,
            jobName: job.job_name,
            clientName: job.client.name,
            hours
          });
        }
      });
    });

    // Calculate utilization percentages and colors
    let totalUtilization = 0;
    let peakUtilization = 0;
    let peakDate: string | null = null;

    dailyCapacity.forEach((dayData, dateKey) => {
      dayData.utilizationPercent = calculateUtilizationPercent(
        dayData.allocatedHours,
        dayData.availableHours
      );
      dayData.color = getUtilizationColorVar(dayData.utilizationPercent);

      totalUtilization += dayData.utilizationPercent;

      if (dayData.utilizationPercent > peakUtilization) {
        peakUtilization = dayData.utilizationPercent;
        peakDate = dateKey;
      }
    });

    const averageUtilization = totalUtilization / dailyCapacity.size;

    capacityData.set(machine.id, {
      machine,
      dailyCapacity,
      totalUtilization,
      averageUtilization: Math.round(averageUtilization),
      peakUtilization,
      peakDate
    });
  });

  return capacityData;
};

/**
 * Get detailed breakdown for a specific day
 */
export const getDayBreakdown = (
  date: Date,
  jobs: ParsedJob[],
  machines: Machine[]
): DayBreakdown => {
  const dateKey = getDateKey(date);
  const jobDetails: JobDayDetail[] = [];
  const machineDetails = new Map<number, MachineDayDetail>();

  // Initialize machine details
  machines.forEach(machine => {
    machineDetails.set(machine.id, {
      machine,
      totalHoursAllocated: 0,
      availableHours: calculateDailyMachineCapacity(machine),
      utilizationPercent: 0,
      jobs: [],
      shift1Hours: 0,
      shift2Hours: 0,
      color: 'var(--success)',
      status: machine.status
    });
  });

  let totalPieces = 0;
  let totalRevenue = 0;

  // Process each job that falls on this date
  jobs.forEach(job => {
    const jobStart = timestampToDate(job.start_date);
    const jobEnd = timestampToDate(job.due_date);
    const jobDays = getDaysBetween(jobStart, jobEnd);

    // Check if job is active on this date
    const isActiveOnDate = jobDays.some(d => getDateKey(d) === dateKey);
    if (!isActiveOnDate) return;

    const jobMachines = machines.filter(m =>
      job.machines.some(jm => jm.id === m.id)
    );

    const timeEstimate = job.time_estimate ||
      calculateMultiMachineTimeEstimate(job.quantity, jobMachines);

    const hoursPerMachine = distributeHoursAcrossMachines(timeEstimate, jobMachines);
    const hoursPerDay = distributeHoursAcrossDays(timeEstimate, job.start_date, job.due_date);
    const hoursThisDay = hoursPerDay.get(dateKey) || 0;

    const piecesThisDay = calculateDailyPieces(job.quantity, job.start_date, job.due_date);
    const revenueThisDay = calculateDailyRevenue(job.total_billing, job.start_date, job.due_date);

    totalPieces += piecesThisDay;
    totalRevenue += revenueThisDay;

    // Build machine allocations for this job
    const machineAllocations: JobMachineAllocation[] = [];
    job.machines.forEach(jm => {
      const hours = hoursPerMachine.get(jm.id) || 0;
      const dailyHours = hours / jobDays.length;

      machineAllocations.push({
        machineId: jm.id,
        machineLine: jm.line,
        hoursAllocated: dailyHours
      });

      // Update machine details
      const machineDetail = machineDetails.get(jm.id);
      if (machineDetail) {
        machineDetail.totalHoursAllocated += dailyHours;
        machineDetail.jobs.push({
          jobNumber: job.job_number,
          jobName: job.job_name,
          clientName: job.client.name,
          hours: dailyHours
        });

        // For simplicity, distribute equally across shifts
        machineDetail.shift1Hours += dailyHours / 2;
        machineDetail.shift2Hours += dailyHours / 2;
      }
    });

    jobDetails.push({
      job,
      piecesThisDay,
      revenueThisDay,
      hoursThisDay,
      shifts: ['both'], // Simplified - could be enhanced based on requirements
      machines: machineAllocations
    });
  });

  // Calculate utilization for each machine
  const machineDetailsArray: MachineDayDetail[] = [];
  let totalAllocated = 0;
  let totalAvailable = 0;

  machineDetails.forEach(detail => {
    detail.utilizationPercent = calculateUtilizationPercent(
      detail.totalHoursAllocated,
      detail.availableHours
    );
    detail.color = getUtilizationColorVar(detail.utilizationPercent);

    totalAllocated += detail.totalHoursAllocated;
    totalAvailable += detail.availableHours;

    machineDetailsArray.push(detail);
  });

  const overallUtilization = calculateUtilizationPercent(totalAllocated, totalAvailable);
  const shift1Utilization = calculateUtilizationPercent(totalAllocated / 2, totalAvailable / 2);
  const shift2Utilization = calculateUtilizationPercent(totalAllocated / 2, totalAvailable / 2);

  return {
    date,
    dateKey,
    totalPieces,
    totalRevenue,
    jobs: jobDetails,
    machines: machineDetailsArray,
    overallUtilization,
    shift1Utilization,
    shift2Utilization
  };
};

/**
 * Get a color for a job based on various factors
 */
export const getJobColor = (job: ParsedJob): string => {
  // Could be enhanced with different color schemes
  // For now, return a default color
  return 'var(--primary-blue)';
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

/**
 * Format large numbers for display
 */
export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
};
