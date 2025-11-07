import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  differenceInDays,
  addDays,
  addMonths,
  isWithinInterval,
  parseISO,
  fromUnixTime,
  getUnixTime,
  getQuarter,
  startOfQuarter,
  endOfQuarter
} from 'date-fns';

/**
 * Format a Unix timestamp to a readable date string
 */
export const formatDate = (timestamp: number, formatString: string = 'MMM dd, yyyy'): string => {
  return format(fromUnixTime(timestamp), formatString);
};

/**
 * Format a Date object to a readable string
 */
export const formatDateObject = (date: Date, formatString: string = 'MMM dd, yyyy'): string => {
  return format(date, formatString);
};

/**
 * Get start and end of month for a given date
 */
export const getMonthRange = (date: Date = new Date()): { start: Date; end: Date } => {
  return {
    start: startOfMonth(date),
    end: endOfMonth(date)
  };
};

/**
 * Get start and end of week for a given date
 */
export const getWeekRange = (date: Date = new Date()): { start: Date; end: Date } => {
  return {
    start: startOfWeek(date),
    end: endOfWeek(date)
  };
};

/**
 * Get a 30-day range starting from the Sunday of the week containing the given date
 */
export const get30DayRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // 0 = Sunday
  const end = addDays(start, 29); // 30 days total (0-29)
  return {
    start,
    end
  };
};

/**
 * Get start and end of day for a given date
 */
export const getDayRange = (date: Date = new Date()): { start: Date; end: Date } => {
  return {
    start: startOfDay(date),
    end: endOfDay(date)
  };
};

/**
 * Get all days between two dates (inclusive)
 */
export const getDaysBetween = (startDate: Date, endDate: Date): Date[] => {
  return eachDayOfInterval({ start: startDate, end: endDate });
};

/**
 * Calculate number of days between two dates
 */
export const calculateDaysDifference = (startDate: Date, endDate: Date): number => {
  return differenceInDays(endDate, startDate) + 1; // +1 to include both start and end dates
};

/**
 * Convert Unix timestamp to Date object
 * Handles both seconds and milliseconds timestamps
 */
export const timestampToDate = (timestamp: number): Date => {
  // If timestamp is in milliseconds (> 10 digits), use directly
  // If timestamp is in seconds (≤ 10 digits), convert to milliseconds
  if (timestamp > 9999999999) {
    // Milliseconds timestamp
    return new Date(timestamp);
  } else {
    // Seconds timestamp
    return fromUnixTime(timestamp);
  }
};

/**
 * Convert Date object to Unix timestamp
 */
export const dateToTimestamp = (date: Date): number => {
  return getUnixTime(date);
};

/**
 * Check if a date falls within a date range
 */
export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  return isWithinInterval(date, { start: startDate, end: endDate });
};

/**
 * Get shift time ranges for a given date
 */
export interface ShiftTime {
  name: '1st' | '2nd';
  start: Date;
  end: Date;
  hours: number;
}

export const getShiftTimes = (date: Date): ShiftTime[] => {
  const baseDate = startOfDay(date);

  return [
    {
      name: '1st',
      start: addDays(baseDate, 0).setHours(8, 0, 0, 0) as unknown as Date,
      end: addDays(baseDate, 0).setHours(16, 0, 0, 0) as unknown as Date,
      hours: 8
    },
    {
      name: '2nd',
      start: addDays(baseDate, 0).setHours(16, 0, 0, 0) as unknown as Date,
      end: addDays(baseDate, 1).setHours(0, 0, 0, 0) as unknown as Date,
      hours: 8
    }
  ];
};

/**
 * Get total available hours per day (2 shifts × 8 hours)
 */
export const HOURS_PER_SHIFT = 8;
export const SHIFTS_PER_DAY = 2;
export const TOTAL_HOURS_PER_DAY = HOURS_PER_SHIFT * SHIFTS_PER_DAY; // 16 hours

/**
 * Format date for display in calendar
 */
export const formatCalendarDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Parse calendar date string to Date object
 */
export const parseCalendarDate = (dateString: string): Date => {
  return parseISO(dateString);
};

/**
 * Get date key for grouping (YYYY-MM-DD format)
 */
export const getDateKey = (date: Date): string => {
  return format(startOfDay(date), 'yyyy-MM-dd');
};

/**
 * Check if two dates are the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return getDateKey(date1) === getDateKey(date2);
};

/**
 * Get start and end of quarter for a given date
 */
export const getQuarterRange = (date: Date = new Date()): { start: Date; end: Date } => {
  return {
    start: startOfQuarter(date),
    end: endOfQuarter(date)
  };
};

/**
 * Get quarter label (e.g., "Q1 2025")
 */
export const getQuarterLabel = (date: Date): string => {
  const quarter = getQuarter(date);
  const year = format(date, 'yyyy');
  return `Q${quarter} ${year}`;
};

/**
 * Generate consecutive month ranges starting from a given date
 */
export interface MonthRange {
  monthNumber: number;
  startDate: Date;
  endDate: Date;
  label: string;
}

export const generateMonthRanges = (startDate: Date, count: number = 3): MonthRange[] => {
  const ranges: MonthRange[] = [];

  for (let i = 0; i < count; i++) {
    const monthStart = startOfMonth(addMonths(startDate, i));
    const monthEnd = endOfMonth(addMonths(startDate, i));

    ranges.push({
      monthNumber: i + 1,
      startDate: monthStart,
      endDate: monthEnd,
      label: format(monthStart, 'MMM yyyy') // e.g., "Jan 2025"
    });
  }

  return ranges;
};

/**
 * Generate consecutive quarter ranges starting from a given date
 */
export interface QuarterRange {
  quarterNumber: number;
  startDate: Date;
  endDate: Date;
  label: string;
}

export const generateQuarterRanges = (startDate: Date, count: number = 4): QuarterRange[] => {
  const ranges: QuarterRange[] = [];

  for (let i = 0; i < count; i++) {
    const quarterStart = startOfQuarter(addMonths(startDate, i * 3));
    const quarterEnd = endOfQuarter(addMonths(startDate, i * 3));

    ranges.push({
      quarterNumber: i + 1,
      startDate: quarterStart,
      endDate: quarterEnd,
      label: getQuarterLabel(quarterStart)
    });
  }

  return ranges;
};

/**
 * Get full range spanning 4 quarters starting from a given date
 * This is useful for fetching all jobs needed for quarterly view
 */
export const getQuarterlyViewRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const firstQuarterStart = startOfQuarter(date);
  const lastQuarterEnd = endOfQuarter(addMonths(firstQuarterStart, 9)); // 3 months * 3 = 9 months ahead
  return {
    start: firstQuarterStart,
    end: lastQuarterEnd
  };
};

/**
 * Get full range spanning 5 weeks starting from a given date
 * This is useful for fetching all jobs needed for weekly view
 */
export const getWeeklyViewRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const firstWeekStart = startOfWeek(date);
  const lastWeekEnd = endOfWeek(addDays(firstWeekStart, 28)); // 7 days * 4 = 28 days ahead (5 weeks total)
  return {
    start: firstWeekStart,
    end: lastWeekEnd
  };
};
