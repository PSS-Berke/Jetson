// Schedule options that can be applied at job or week level
export interface ScheduleOptions {
  run1stOT: boolean;
  run2ndOT: boolean;
  runSat1st: boolean;
  runSat1stHours: number; // 1-12 hours
  runSat2nd: boolean;
  runSat2ndHours: number;
  runSun1st: boolean;
  runSun1stHours: number;
  runSun2nd: boolean;
  runSun2ndHours: number;
  run12sAllWeekend: boolean;
}

// Per-week override - null means "use job defaults"
export interface WeekScheduleOverride {
  weekNumber: number;
  useJobDefaults: boolean; // If true, ignore options below
  options: ScheduleOptions; // Only used if useJobDefaults is false
}

// Job-level state
export interface JobScheduleConfig {
  jobDefaults: ScheduleOptions;
  weekOverrides: Record<number, WeekScheduleOverride>; // keyed by week number
}

// Default schedule options (all off)
export const DEFAULT_SCHEDULE_OPTIONS: ScheduleOptions = {
  run1stOT: false,
  run2ndOT: false,
  runSat1st: false,
  runSat1stHours: 8,
  runSat2nd: false,
  runSat2ndHours: 8,
  runSun1st: false,
  runSun1stHours: 8,
  runSun2nd: false,
  runSun2ndHours: 8,
  run12sAllWeekend: false,
};

// Default job schedule config
export const DEFAULT_JOB_SCHEDULE_CONFIG: JobScheduleConfig = {
  jobDefaults: { ...DEFAULT_SCHEDULE_OPTIONS },
  weekOverrides: {},
};

// Helper to get effective schedule for a week
export function getEffectiveScheduleForWeek(
  config: JobScheduleConfig,
  weekNumber: number
): ScheduleOptions {
  const override = config.weekOverrides[weekNumber];
  if (override && !override.useJobDefaults) {
    return override.options;
  }
  return config.jobDefaults;
}

// Helper to check if a week has custom overrides
export function weekHasOverrides(
  config: JobScheduleConfig,
  weekNumber: number
): boolean {
  const override = config.weekOverrides[weekNumber];
  return override !== undefined && !override.useJobDefaults;
}

// Helper to count active options
export function countActiveOptions(options: ScheduleOptions): number {
  let count = 0;
  if (options.run1stOT) count++;
  if (options.run2ndOT) count++;
  if (options.runSat1st) count++;
  if (options.runSat2nd) count++;
  if (options.runSun1st) count++;
  if (options.runSun2nd) count++;
  if (options.run12sAllWeekend) count++;
  return count;
}

// Helper to get summary text for active options
export function getActiveOptionsSummary(options: ScheduleOptions): string {
  const parts: string[] = [];
  if (options.run1stOT) parts.push("1st OT");
  if (options.run2ndOT) parts.push("2nd OT");
  if (options.runSat1st) parts.push(`Sat 1st (${options.runSat1stHours}h)`);
  if (options.runSat2nd) parts.push(`Sat 2nd (${options.runSat2ndHours}h)`);
  if (options.runSun1st) parts.push(`Sun 1st (${options.runSun1stHours}h)`);
  if (options.runSun2nd) parts.push(`Sun 2nd (${options.runSun2ndHours}h)`);
  if (options.run12sAllWeekend) parts.push("12s Weekend");
  return parts.length > 0 ? parts.join(", ") : "None";
}
