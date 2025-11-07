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
  JobMachineAllocation
} from '@/types/calendar';
import {
  timestampToDate,
  getDaysBetween,
  getDateKey
} from './dateUtils';
import {
  calculateMultiMachineTimeEstimate,
  distributeHoursAcrossMachines,
  distributeHoursAcrossDays,
  calculateDailyRevenue,
  calculateDailyPieces,
  calculateDailyMachineCapacity,
  calculateUtilizationPercent,
  getUtilizationColorVar
} from './capacityUtils';

/**
 * Transform jobs into calendar events aggregated by service type and date
 */
export const transformJobsToEvents = (
  jobs: ParsedJob[]
): CalendarEvent[] => {
  // Group jobs by service type and date
  const serviceTypeByDate = new Map<string, Map<string, ParsedJob[]>>();

  jobs.forEach(job => {
    const startDate = timestampToDate(job.start_date);
    const endDate = timestampToDate(job.due_date);
    const jobDays = getDaysBetween(startDate, endDate);
    const serviceType = job.service_type || 'Unknown';

    // Add job to each day it spans
    jobDays.forEach(day => {
      const dateKey = getDateKey(day);

      if (!serviceTypeByDate.has(dateKey)) {
        serviceTypeByDate.set(dateKey, new Map());
      }

      const dayServiceTypes = serviceTypeByDate.get(dateKey)!;
      if (!dayServiceTypes.has(serviceType)) {
        dayServiceTypes.set(serviceType, []);
      }

      dayServiceTypes.get(serviceType)!.push(job);
    });
  });

  // Create aggregated events
  const events: CalendarEvent[] = [];

  serviceTypeByDate.forEach((serviceTypes, dateKey) => {
    serviceTypes.forEach((jobs, serviceType) => {
      const date = new Date(dateKey);

      // Calculate aggregated quantities
      let totalPieces = 0;
      let totalRevenue = 0;

      jobs.forEach(job => {
        const dailyPieces = calculateDailyPieces(job.quantity, job.start_date, job.due_date);
        const dailyRevenue = calculateDailyRevenue(job);
        totalPieces += dailyPieces;
        totalRevenue += dailyRevenue;
      });

      events.push({
        id: `${dateKey}-${serviceType}`,
        title: `${serviceType}: ${Math.round(totalPieces).toLocaleString()} pcs`,
        start: date,
        end: date,
        serviceType,
        totalPieces,
        totalRevenue,
        jobCount: jobs.length,
        jobs,
        color: getServiceTypeColor(serviceType),
        allDay: true
      });
    });
  });

  return events;
};

/**
 * Calculate daily summaries for calendar display
 */
export const calculateDailySummaries = (
  jobs: ParsedJob[],
  _machines: Machine[],
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
      machineCount: 0,
      processTypeCounts: {
        insert: 0,
        sort: 0,
        inkjet: 0,
        labelApply: 0,
        fold: 0,
        laser: 0,
        hpPress: 0
      }
    });
  });

  // Accumulate data from jobs
  jobs.forEach(job => {
    const jobStart = timestampToDate(job.start_date);
    const jobEnd = timestampToDate(job.due_date);
    const jobDays = getDaysBetween(jobStart, jobEnd);

    const dailyPieces = calculateDailyPieces(job.quantity, job.start_date, job.due_date);
    const dailyRevenue = calculateDailyRevenue(job);

    // Get process types from requirements
    const processTypes = new Set<string>();
    job.requirements?.forEach((req) => {
      if (req.process_type) {
        processTypes.add(req.process_type.toLowerCase());
      }
    });

    console.log(`[CalendarUtils] Job ${job.job_number}: quantity=${job.quantity}, dailyPieces=${dailyPieces}, processTypes=`, Array.from(processTypes));

    jobDays.forEach(day => {
      const dateKey = getDateKey(day);
      const summary = summaries.get(dateKey);
      if (summary) {
        summary.totalPieces += dailyPieces;
        summary.totalRevenue += dailyRevenue;
        summary.jobCount += 1;

        // Add daily pieces to each process type this job uses
        processTypes.forEach(processType => {
          switch (processType) {
            case 'insert':
              summary.processTypeCounts.insert += dailyPieces;
              break;
            case 'sort':
              summary.processTypeCounts.sort += dailyPieces;
              break;
            case 'inkjet':
            case 'ij':
            case 'ink jet':
              summary.processTypeCounts.inkjet += dailyPieces;
              break;
            case 'label/apply':
            case 'l/a':
            case 'label/affix':
              summary.processTypeCounts.labelApply += dailyPieces;
              break;
            case 'fold':
              summary.processTypeCounts.fold += dailyPieces;
              break;
            case 'laser':
              summary.processTypeCounts.laser += dailyPieces;
              break;
            case 'hp press':
              summary.processTypeCounts.hpPress += dailyPieces;
              break;
          }
        });
      }
    });
  });

  console.log('[CalendarUtils] Final daily summaries:', Array.from(summaries.entries()).map(([key, val]) => ({
    date: key,
    totalPieces: val.totalPieces,
    processTypeCounts: val.processTypeCounts
  })));

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
    const revenueThisDay = calculateDailyRevenue(job);

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
 * Get a color for a service type
 */
export const getServiceTypeColor = (serviceType: string): string => {
  const colors: { [key: string]: string } = {
    'Insert': '#3B82F6',        // Blue
    'Sort': '#10B981',          // Green
    'Inkjet': '#F59E0B',        // Orange
    'IJ': '#F59E0B',            // Orange (legacy support)
    'Label/Apply': '#8B5CF6',   // Purple
    'L/A': '#8B5CF6',           // Purple (legacy support)
    'Fold': '#EC4899',          // Pink
    'Laser': '#EF4444',         // Red
    'HP Press': '#14B8A6',      // Teal
    'Unknown': '#6B7280'        // Gray
  };

  return colors[serviceType] || '#6366F1'; // Default to indigo if not found
};

/**
 * Get a color for a process type
 */
export const getProcessTypeColor = (processType: string): string => {
  const colors: { [key: string]: string } = {
    'insert': '#3B82F6',        // Blue
    'sort': '#10B981',          // Green
    'inkjet': '#F59E0B',        // Orange
    'labelApply': '#8B5CF6',    // Purple
    'fold': '#EC4899',          // Pink
    'laser': '#EF4444',         // Red
    'hpPress': '#14B8A6'        // Teal
  };

  return colors[processType] || '#6B7280'; // Default to gray if not found
};

/**
 * Get a color for a job based on various factors (legacy, kept for compatibility)
 */
export const getJobColor = (job: ParsedJob): string => {
  return getServiceTypeColor(job.service_type || 'Unknown');
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
