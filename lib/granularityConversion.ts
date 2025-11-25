/**
 * Granularity Conversion Utilities
 *
 * Converts between weekly_split storage format and other granularities (daily, monthly, quarterly)
 * for display and editing purposes.
 */

export type CellGranularity = "daily" | "weekly" | "monthly" | "quarterly";

export interface Period {
  startDate: Date;
  endDate: Date;
  label: string;
  quantity: number;
  isLocked?: boolean;
}

/**
 * Calculate periods between two dates based on granularity
 */
export function calculatePeriods(
  startDate: number,
  dueDate: number,
  granularity: CellGranularity
): Omit<Period, "quantity" | "isLocked">[] {
  const periods: Omit<Period, "quantity" | "isLocked">[] = [];
  const startDateObj = new Date(startDate);
  const dueDateObj = new Date(dueDate);

  if (granularity === "daily") {
    let currentDate = new Date(startDateObj);
    while (currentDate <= dueDateObj) {
      periods.push({
        startDate: new Date(currentDate),
        endDate: new Date(currentDate),
        label: `${currentDate.getMonth() + 1}/${currentDate.getDate()}`,
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } else if (granularity === "weekly") {
    let currentWeekStart = new Date(startDateObj);
    while (currentWeekStart <= dueDateObj) {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const effectiveEnd = weekEnd > dueDateObj ? dueDateObj : weekEnd;

      periods.push({
        startDate: new Date(currentWeekStart),
        endDate: effectiveEnd,
        label: `${currentWeekStart.getMonth() + 1}/${currentWeekStart.getDate()}`,
      });

      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }
  } else if (granularity === "monthly") {
    let currentMonth = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), 1);
    const dueMonth = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), 1);

    while (currentMonth <= dueMonth) {
      const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
      const effectiveStart = currentMonth < startDateObj ? startDateObj : currentMonth;
      const effectiveEnd = monthEnd > dueDateObj ? dueDateObj : monthEnd;

      periods.push({
        startDate: new Date(effectiveStart),
        endDate: new Date(effectiveEnd),
        label: new Date(currentMonth).toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
      });

      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }
  } else if (granularity === "quarterly") {
    const startQuarter = Math.floor(startDateObj.getMonth() / 3);
    const startYear = startDateObj.getFullYear();
    const dueQuarter = Math.floor(dueDateObj.getMonth() / 3);
    const dueYear = dueDateObj.getFullYear();

    let currentYear = startYear;
    let currentQuarter = startQuarter;

    while (
      currentYear < dueYear ||
      (currentYear === dueYear && currentQuarter <= dueQuarter)
    ) {
      const quarterStart = new Date(currentYear, currentQuarter * 3, 1);
      const quarterEnd = new Date(currentYear, (currentQuarter + 1) * 3, 0);
      const effectiveStart = quarterStart < startDateObj ? startDateObj : quarterStart;
      const effectiveEnd = quarterEnd > dueDateObj ? dueDateObj : quarterEnd;

      periods.push({
        startDate: new Date(effectiveStart),
        endDate: new Date(effectiveEnd),
        label: `Q${currentQuarter + 1} ${currentYear.toString().slice(-2)}`,
      });

      currentQuarter++;
      if (currentQuarter > 3) {
        currentQuarter = 0;
        currentYear++;
      }
    }
  }

  return periods;
}

/**
 * Convert weekly_split to any granularity for display
 */
export function convertWeeklyToGranularity(
  weekly_split: number[],
  locked_weeks: boolean[],
  startDate: number,
  dueDate: number,
  targetGranularity: CellGranularity
): Period[] {
  if (targetGranularity === "weekly") {
    // Return as-is with period metadata
    const weeks = calculatePeriods(startDate, dueDate, "weekly");
    return weeks.map((week, idx) => ({
      ...week,
      quantity: weekly_split[idx] || 0,
      isLocked: locked_weeks[idx] || false,
    }));
  }

  // For other granularities, we need to convert
  const weekPeriods = calculatePeriods(startDate, dueDate, "weekly");
  const targetPeriods = calculatePeriods(startDate, dueDate, targetGranularity);

  // Calculate daily quantities from weekly split
  const dailyQuantities = new Map<string, number>();

  weekPeriods.forEach((week, weekIdx) => {
    const weekQuantity = weekly_split[weekIdx] || 0;
    const daysInWeek = getDaysBetween(week.startDate, week.endDate);
    const dailyQuantity = weekQuantity / daysInWeek;

    let currentDay = normalizeToMidnight(week.startDate);
    const endDay = normalizeToMidnight(week.endDate);
    while (currentDay <= endDay) {
      const dateKey = getDateKey(currentDay);
      dailyQuantities.set(dateKey, dailyQuantity);
      currentDay.setDate(currentDay.getDate() + 1);
    }
  });

  // Aggregate daily quantities into target periods
  return targetPeriods.map((period) => {
    let periodQuantity = 0;
    let currentDay = normalizeToMidnight(period.startDate);
    const endDay = normalizeToMidnight(period.endDate);

    while (currentDay <= endDay) {
      const dateKey = getDateKey(currentDay);
      periodQuantity += dailyQuantities.get(dateKey) || 0;
      currentDay.setDate(currentDay.getDate() + 1);
    }

    // Ensure we never return NaN or negative quantities
    const finalQuantity = Math.round(periodQuantity);

    return {
      ...period,
      quantity: isNaN(finalQuantity) ? 0 : Math.max(0, finalQuantity),
      isLocked: false, // Locks don't translate to other granularities
    };
  });
}

/**
 * Convert from any granularity back to weekly_split for storage
 */
export function convertGranularityToWeekly(
  periods: Period[],
  startDate: number,
  dueDate: number,
  currentGranularity: CellGranularity,
  totalQuantity: number
): { weekly_split: number[]; locked_weeks: boolean[] } {
  if (currentGranularity === "weekly") {
    // Direct mapping
    return {
      weekly_split: periods.map((p) => p.quantity),
      locked_weeks: periods.map((p) => p.isLocked || false),
    };
  }

  // For other granularities, convert to daily then aggregate to weekly
  const weekPeriods = calculatePeriods(startDate, dueDate, "weekly");

  // Calculate daily quantities from input periods
  const dailyQuantities = new Map<string, number>();

  periods.forEach((period) => {
    const daysInPeriod = getDaysBetween(period.startDate, period.endDate);
    const dailyQuantity = period.quantity / daysInPeriod;

    let currentDay = normalizeToMidnight(period.startDate);
    const endDay = normalizeToMidnight(period.endDate);
    while (currentDay <= endDay) {
      const dateKey = getDateKey(currentDay);
      dailyQuantities.set(dateKey, dailyQuantity);
      currentDay.setDate(currentDay.getDate() + 1);
    }
  });

  // Aggregate daily quantities into weeks
  const weekly_split = weekPeriods.map((week) => {
    let weekQuantity = 0;
    let currentDay = normalizeToMidnight(week.startDate);
    const endDay = normalizeToMidnight(week.endDate);

    while (currentDay <= endDay) {
      const dateKey = getDateKey(currentDay);
      weekQuantity += dailyQuantities.get(dateKey) || 0;
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return Math.round(weekQuantity);
  });

  // Adjust for rounding errors
  const currentTotal = weekly_split.reduce((sum, val) => sum + val, 0);
  const difference = totalQuantity - currentTotal;

  if (difference !== 0 && weekly_split.length > 0) {
    // Add/subtract the difference from the last week
    weekly_split[weekly_split.length - 1] += difference;
  }

  // Locks don't translate from other granularities
  const locked_weeks = weekly_split.map(() => false);

  return { weekly_split, locked_weeks };
}

/**
 * Helper function to normalize a date to midnight local time
 */
function normalizeToMidnight(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Helper function to get date key in YYYY-MM-DD format (local time)
 */
function getDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper function to get days between two dates (inclusive)
 */
function getDaysBetween(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // +1 to make it inclusive
}

/**
 * Redistribute quantity across unlocked periods
 * Used when a period is manually edited
 */
export function redistributeQuantity(
  periods: Period[],
  editedIndex: number,
  newValue: number,
  totalQuantity: number,
  allowBackward: boolean = false
): Period[] {
  const newPeriods = [...periods];
  const oldValue = newPeriods[editedIndex].quantity;

  newPeriods[editedIndex] = {
    ...newPeriods[editedIndex],
    quantity: newValue,
    isLocked: true,
  };

  const currentTotal = newPeriods.reduce((sum, p) => sum + p.quantity, 0);
  const difference = totalQuantity - currentTotal;

  if (difference === 0) {
    return newPeriods;
  }

  // Find unlocked periods after the edited one
  let unlockedIndices = newPeriods
    .map((_, idx) => idx)
    .filter((idx) => idx > editedIndex && !newPeriods[idx].isLocked);

  // If no unlocked periods after and backward is allowed, use all unlocked periods
  if (unlockedIndices.length === 0 && allowBackward) {
    unlockedIndices = newPeriods
      .map((_, idx) => idx)
      .filter((idx) => idx !== editedIndex && !newPeriods[idx].isLocked);
  }

  if (unlockedIndices.length === 0) {
    // No unlocked periods to redistribute to
    return newPeriods;
  }

  // Distribute the difference evenly
  const baseAdjustment = Math.floor(difference / unlockedIndices.length);
  const remainder = difference % unlockedIndices.length;

  unlockedIndices.forEach((idx, position) => {
    let adjustment = baseAdjustment;
    if (position < Math.abs(remainder)) {
      adjustment += remainder > 0 ? 1 : -1;
    }
    newPeriods[idx] = {
      ...newPeriods[idx],
      quantity: Math.max(0, newPeriods[idx].quantity + adjustment),
    };
  });

  return newPeriods;
}

/**
 * Reset periods to even distribution
 */
export function resetToEvenDistribution(
  periodCount: number,
  totalQuantity: number
): { quantities: number[]; locks: boolean[] } {
  const evenQuantity = Math.floor(totalQuantity / periodCount);
  const remainder = totalQuantity % periodCount;

  const quantities = Array(periodCount)
    .fill(0)
    .map((_, idx) => (idx < remainder ? evenQuantity + 1 : evenQuantity));

  const locks = Array(periodCount).fill(false);

  return { quantities, locks };
}
