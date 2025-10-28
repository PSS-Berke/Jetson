import { ParsedJob } from '@/hooks/useJobs';

export interface Machine {
  id: number;
  line: number;
  type: string;
  speed_hr: string;
  status: string;
  shiftCapacity?: number;
  max_size: string;
  pockets?: number;
  currentJob?: {
    number: string;
    name: string;
  };
}

/**
 * Calendar event representing a job on the calendar
 */
export interface CalendarEvent {
  id: number;
  title: string;
  start: Date;
  end: Date;
  job: ParsedJob;
  dailyPieces: number;
  dailyRevenue: number;
  utilizationPercent: number;
  color: string;
  allDay?: boolean;
}

/**
 * Breakdown of a specific day showing all jobs, machines, and capacity
 */
export interface DayBreakdown {
  date: Date;
  dateKey: string;
  totalPieces: number;
  totalRevenue: number;
  jobs: JobDayDetail[];
  machines: MachineDayDetail[];
  overallUtilization: number;
  shift1Utilization: number;
  shift2Utilization: number;
}

/**
 * Details of how a specific job contributes to a specific day
 */
export interface JobDayDetail {
  job: ParsedJob;
  piecesThisDay: number;
  revenueThisDay: number;
  hoursThisDay: number;
  shifts: ShiftType[];
  machines: JobMachineAllocation[];
}

/**
 * How hours are allocated to a specific machine for a job on a day
 */
export interface JobMachineAllocation {
  machineId: number;
  machineLine: number;
  hoursAllocated: number;
}

/**
 * Details of a machine's utilization on a specific day
 */
export interface MachineDayDetail {
  machine: Machine;
  totalHoursAllocated: number;
  availableHours: number;
  utilizationPercent: number;
  jobs: MachineJobAllocation[];
  shift1Hours: number;
  shift2Hours: number;
  color: string;
  status: string;
}

/**
 * How a specific job contributes to a machine's workload
 */
export interface MachineJobAllocation {
  jobNumber: number;
  jobName: string;
  clientName: string;
  hours: number;
}

/**
 * Shift type
 */
export type ShiftType = '1st' | '2nd' | 'both';

/**
 * Calendar view type
 */
export type CalendarViewType = 'month' | 'week' | 'day';

/**
 * Machine capacity display mode
 */
export type CapacityDisplayMode = 'sidebar' | 'overlay';

/**
 * Filter options for calendar
 */
export interface CalendarFilters {
  selectedMachines: number[];
  selectedClients: number[];
  selectedServiceTypes: string[];
  selectedCSRs: string[];
  selectedProgramCadences: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Daily summary for calendar display
 */
export interface DailySummary {
  date: Date;
  dateKey: string;
  totalPieces: number;
  totalRevenue: number;
  utilizationPercent: number;
  jobCount: number;
  machineCount: number;
}

/**
 * Machine capacity tracking over time
 */
export interface MachineCapacityData {
  machine: Machine;
  dailyCapacity: Map<string, MachineCapacityDay>;
  totalUtilization: number;
  averageUtilization: number;
  peakUtilization: number;
  peakDate: string | null;
}

/**
 * Machine capacity for a specific day
 */
export interface MachineCapacityDay {
  date: Date;
  dateKey: string;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  jobs: MachineJobAllocation[];
  color: string;
}

/**
 * Aggregated daily totals across all machines
 */
export interface DailyTotals {
  [dateKey: string]: {
    pieces: number;
    revenue: number;
    hours: number;
    utilization: number;
  };
}

/**
 * Calendar data structure for rendering
 */
export interface CalendarData {
  events: CalendarEvent[];
  dailySummaries: Map<string, DailySummary>;
  machineCapacities: Map<number, MachineCapacityData>;
  dateRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Props for calendar components
 */
export interface CalendarComponentProps {
  viewType: CalendarViewType;
  displayMode: CapacityDisplayMode;
  filters: CalendarFilters;
  onViewChange: (view: CalendarViewType) => void;
  onDisplayModeChange: (mode: CapacityDisplayMode) => void;
  onFiltersChange: (filters: CalendarFilters) => void;
  onDateClick: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}
