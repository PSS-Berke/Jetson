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
  isWithinInterval,
  parseISO,
  fromUnixTime,
  getUnixTime
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
 */
export const timestampToDate = (timestamp: number): Date => {
  return fromUnixTime(timestamp);
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
