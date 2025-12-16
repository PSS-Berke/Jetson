"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Lock, Unlock, ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import ScheduleOptionsCheckboxes from "./ScheduleOptionsCheckboxes";
import {
  ScheduleOptions,
  JobScheduleConfig,
  DEFAULT_SCHEDULE_OPTIONS,
  getEffectiveScheduleForWeek,
  weekHasOverrides,
  getActiveOptionsSummary,
} from "@/lib/scheduleTypes";

export interface SplitResultItem {
  Date: string;
  CalendarDayInWeek: number;
  CalendarWeek: number;
  Quantity: number;
}

interface QuantitySplitEditorProps {
  splitResults: SplitResultItem[];
  lockedWeeks: Record<number, boolean>; // weekNumber -> isLocked
  totalQuantity: number;
  onSplitChange: (newSplitResults: SplitResultItem[]) => void;
  onLockedWeeksChange: (newLockedWeeks: Record<number, boolean>) => void;
  readOnly?: boolean;
  // New schedule options props
  scheduleConfig?: JobScheduleConfig;
  onScheduleConfigChange?: (config: JobScheduleConfig) => void;
  showScheduleOptions?: boolean;
}

interface BackwardRedistributeWarningProps {
  isOpen: boolean;
  weekNumber: number;
  proposedTotal: number;
  currentTotal: number;
  difference: number;
  unlockedWeeksBefore: number[];
  onConfirm: () => void;
  onCancel: () => void;
}

function BackwardRedistributeWarning({
  isOpen,
  weekNumber,
  proposedTotal,
  difference,
  unlockedWeeksBefore,
  onConfirm,
  onCancel,
}: BackwardRedistributeWarningProps) {
  if (!isOpen) return null;

  const perWeekAdjustment = unlockedWeeksBefore.length > 0
    ? Math.floor(Math.abs(difference) / unlockedWeeksBefore.length)
    : 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative z-10">
        <h3 className="text-lg font-bold text-[var(--dark-blue)] mb-3">
          Redistribute Backward?
        </h3>
        <p className="text-[var(--text-dark)] mb-4">
          Week {weekNumber} is the last unlocked week. To set it to{" "}
          <strong>{proposedTotal.toLocaleString()}</strong>, the difference of{" "}
          <strong className={difference > 0 ? "text-red-600" : "text-green-600"}>
            {difference > 0 ? "+" : ""}{difference.toLocaleString()}
          </strong>{" "}
          needs to be redistributed to earlier weeks.
        </p>
        {unlockedWeeksBefore.length > 0 ? (
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-[var(--text-dark)] mb-2">
              The following unlocked weeks will be adjusted:
            </p>
            <ul className="text-sm text-[var(--text-light)]">
              {unlockedWeeksBefore.map((w) => (
                <li key={w}>
                  • Week {w}: {difference > 0 ? "-" : "+"}{perWeekAdjustment.toLocaleString()}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-700">
              All other weeks are locked. Please unlock at least one week to redistribute.
            </p>
          </div>
        )}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          {unlockedWeeksBefore.length > 0 && (
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              Redistribute
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function QuantitySplitEditor({
  splitResults,
  lockedWeeks,
  totalQuantity,
  onSplitChange,
  onLockedWeeksChange,
  readOnly = false,
  scheduleConfig,
  onScheduleConfigChange,
  showScheduleOptions = false,
}: QuantitySplitEditorProps) {
  // State for backward redistribution warning
  const [showBackwardWarning, setShowBackwardWarning] = useState(false);
  const [pendingWeekChange, setPendingWeekChange] = useState<{
    weekNumber: number;
    newTotal: number;
    oldTotal: number;
  } | null>(null);

  // State for expanded week options
  const [expandedWeekOptions, setExpandedWeekOptions] = useState<Record<number, boolean>>({});

  // Group results by week
  const groupedByWeek = useMemo(() => {
    const grouped = splitResults.reduce((acc, item) => {
      if (!acc[item.CalendarWeek]) {
        acc[item.CalendarWeek] = [];
      }
      acc[item.CalendarWeek].push(item);
      return acc;
    }, {} as Record<number, SplitResultItem[]>);

    // Sort days within each week
    Object.keys(grouped).forEach((week) => {
      grouped[parseInt(week)].sort((a, b) => a.CalendarDayInWeek - b.CalendarDayInWeek);
    });

    return grouped;
  }, [splitResults]);

  // Get sorted week numbers
  const sortedWeeks = useMemo(() => {
    return Object.keys(groupedByWeek)
      .map(Number)
      .sort((a, b) => a - b);
  }, [groupedByWeek]);

  // Calculate week totals
  const weekTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    sortedWeeks.forEach((week) => {
      totals[week] = groupedByWeek[week].reduce((sum, item) => sum + item.Quantity, 0);
    });
    return totals;
  }, [groupedByWeek, sortedWeeks]);

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return Object.values(weekTotals).reduce((sum, t) => sum + t, 0);
  }, [weekTotals]);

  const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Toggle lock for a week
  const handleToggleLock = useCallback((weekNumber: number) => {
    if (readOnly) return;
    const newLockedWeeks = { ...lockedWeeks };
    newLockedWeeks[weekNumber] = !newLockedWeeks[weekNumber];
    onLockedWeeksChange(newLockedWeeks);
  }, [lockedWeeks, onLockedWeeksChange, readOnly]);

  // Toggle week options expansion
  const toggleWeekOptions = useCallback((weekNumber: number) => {
    setExpandedWeekOptions((prev) => ({
      ...prev,
      [weekNumber]: !prev[weekNumber],
    }));
  }, []);

  // Handle week schedule options change
  const handleWeekScheduleChange = useCallback((weekNumber: number, options: ScheduleOptions) => {
    if (!scheduleConfig || !onScheduleConfigChange) return;

    const newConfig: JobScheduleConfig = {
      ...scheduleConfig,
      weekOverrides: {
        ...scheduleConfig.weekOverrides,
        [weekNumber]: {
          weekNumber,
          useJobDefaults: false,
          options,
        },
      },
    };
    onScheduleConfigChange(newConfig);
  }, [scheduleConfig, onScheduleConfigChange]);

  // Handle toggle "use job defaults" for a week
  const handleToggleUseJobDefaults = useCallback((weekNumber: number, useDefaults: boolean) => {
    if (!scheduleConfig || !onScheduleConfigChange) return;

    if (useDefaults) {
      // Remove the override
      const newOverrides = { ...scheduleConfig.weekOverrides };
      delete newOverrides[weekNumber];
      onScheduleConfigChange({
        ...scheduleConfig,
        weekOverrides: newOverrides,
      });
    } else {
      // Create an override with job defaults as starting point
      onScheduleConfigChange({
        ...scheduleConfig,
        weekOverrides: {
          ...scheduleConfig.weekOverrides,
          [weekNumber]: {
            weekNumber,
            useJobDefaults: false,
            options: { ...scheduleConfig.jobDefaults },
          },
        },
      });
    }
  }, [scheduleConfig, onScheduleConfigChange]);

  // Handle daily quantity change
  const handleDayQuantityChange = useCallback((
    date: string,
    calendarDayInWeek: number,
    calendarWeek: number,
    newValue: string
  ) => {
    if (readOnly) return;

    const cleanedValue = newValue.replace(/,/g, "");
    const newQuantity = parseInt(cleanedValue) || 0;

    // Find the item and calculate the old week total
    const oldWeekTotal = weekTotals[calendarWeek];
    const oldItem = splitResults.find(
      (item) => item.Date === date && item.CalendarDayInWeek === calendarDayInWeek
    );
    const oldDayQuantity = oldItem?.Quantity || 0;
    const newWeekTotal = oldWeekTotal - oldDayQuantity + newQuantity;

    // Update the day value
    let newSplitResults = splitResults.map((item) =>
      item.Date === date && item.CalendarDayInWeek === calendarDayInWeek
        ? { ...item, Quantity: newQuantity }
        : item
    );

    // Lock the week
    const newLockedWeeks = { ...lockedWeeks, [calendarWeek]: true };
    onLockedWeeksChange(newLockedWeeks);

    // Calculate difference and redistribute to unlocked weeks after
    const difference = totalQuantity - (grandTotal - oldWeekTotal + newWeekTotal);

    if (difference !== 0) {
      const unlockedWeeksAfter = sortedWeeks.filter(
        (w) => w > calendarWeek && !newLockedWeeks[w]
      );

      if (unlockedWeeksAfter.length > 0) {
        newSplitResults = redistributeToWeeks(
          newSplitResults,
          unlockedWeeksAfter,
          difference,
          groupedByWeek
        );
      } else {
        // Check for unlocked weeks before
        const unlockedWeeksBefore = sortedWeeks.filter(
          (w) => w < calendarWeek && !newLockedWeeks[w]
        );

        if (unlockedWeeksBefore.length > 0) {
          // Show backward redistribution warning
          setPendingWeekChange({
            weekNumber: calendarWeek,
            newTotal: newWeekTotal,
            oldTotal: oldWeekTotal,
          });
          setShowBackwardWarning(true);
          // For now, just update without redistribution - user will confirm
        }
      }
    }

    onSplitChange(newSplitResults);
  }, [splitResults, weekTotals, lockedWeeks, totalQuantity, grandTotal, sortedWeeks, groupedByWeek, onSplitChange, onLockedWeeksChange, readOnly]);

  // Handle week total change (clicking on blue total)
  const handleWeekTotalChange = useCallback((weekNumber: number, newValue: string) => {
    if (readOnly) return;

    const cleanedValue = newValue.replace(/,/g, "");
    const newTotal = parseInt(cleanedValue) || 0;
    const oldTotal = weekTotals[weekNumber];
    const weekDifference = newTotal - oldTotal;

    if (weekDifference === 0) return;

    // Lock this week
    const newLockedWeeks = { ...lockedWeeks, [weekNumber]: true };
    onLockedWeeksChange(newLockedWeeks);

    // Redistribute daily values within this week to match new total
    const weekDays = groupedByWeek[weekNumber];

    // Determine which days to distribute to:
    // Use weekdays (Mon-Fri, CalendarDayInWeek 1-5) by default
    // Only include Sat (6) or Sun (7) if they already have quantity > 0
    const weekdaysOnly = weekDays.filter((d) => d.CalendarDayInWeek >= 1 && d.CalendarDayInWeek <= 5);
    const weekendDaysWithQuantity = weekDays.filter((d) =>
      (d.CalendarDayInWeek === 6 || d.CalendarDayInWeek === 7) && d.Quantity > 0
    );

    // Combine weekdays + any weekend days that have quantity
    let daysToDistribute = [...weekdaysOnly, ...weekendDaysWithQuantity];

    // If no weekdays exist (edge case), fall back to all days
    if (daysToDistribute.length === 0) {
      daysToDistribute = weekDays;
    }

    // Sort by CalendarDayInWeek to ensure consistent ordering
    daysToDistribute.sort((a, b) => a.CalendarDayInWeek - b.CalendarDayInWeek);

    const baseAmount = Math.floor(newTotal / daysToDistribute.length);
    const remainder = newTotal % daysToDistribute.length;

    // Create a set of dates that should receive the distribution
    const datesToDistribute = new Set(daysToDistribute.map(d => d.Date));

    let newSplitResults = splitResults.map((item) => {
      if (item.CalendarWeek !== weekNumber) return item;

      // If this day is not in our distribution list, keep it at 0
      if (!datesToDistribute.has(item.Date)) {
        return { ...item, Quantity: 0 };
      }

      // Find the index of this day within daysToDistribute for remainder calculation
      const dayIndex = daysToDistribute.findIndex(
        (d) => d.Date === item.Date
      );

      // Distribute remainder to first days
      const extraAmount = dayIndex < remainder ? 1 : 0;
      return { ...item, Quantity: baseAmount + extraAmount };
    });

    // Calculate job-level difference and redistribute to other weeks
    const jobDifference = totalQuantity - (grandTotal + weekDifference);

    if (jobDifference !== 0) {
      const unlockedWeeksAfter = sortedWeeks.filter(
        (w) => w > weekNumber && !newLockedWeeks[w]
      );

      if (unlockedWeeksAfter.length > 0) {
        newSplitResults = redistributeToWeeks(
          newSplitResults,
          unlockedWeeksAfter,
          jobDifference,
          groupedByWeek
        );
        onSplitChange(newSplitResults);
      } else {
        // Check for unlocked weeks before
        const unlockedWeeksBefore = sortedWeeks.filter(
          (w) => w < weekNumber && !newLockedWeeks[w]
        );

        if (unlockedWeeksBefore.length > 0) {
          // Show backward redistribution warning
          setPendingWeekChange({
            weekNumber,
            newTotal,
            oldTotal,
          });
          setShowBackwardWarning(true);
          // Update split results with intra-week redistribution only for now
          onSplitChange(newSplitResults);
        } else {
          // No unlocked weeks at all - just apply the change
          onSplitChange(newSplitResults);
        }
      }
    } else {
      onSplitChange(newSplitResults);
    }
  }, [splitResults, weekTotals, lockedWeeks, totalQuantity, grandTotal, sortedWeeks, groupedByWeek, onSplitChange, onLockedWeeksChange, readOnly]);

  // Redistribute quantity to specified weeks
  const redistributeToWeeks = (
    currentSplitResults: SplitResultItem[],
    targetWeeks: number[],
    difference: number,
    grouped: Record<number, SplitResultItem[]>
  ): SplitResultItem[] => {
    if (targetWeeks.length === 0 || difference === 0) return currentSplitResults;

    // Calculate how much each week should get
    const perWeekAdjustment = Math.floor(difference / targetWeeks.length);
    const weekRemainder = Math.abs(difference) % targetWeeks.length;

    let newResults = [...currentSplitResults];

    targetWeeks.forEach((week, weekIdx) => {
      const weekDays = grouped[week];
      if (!weekDays || weekDays.length === 0) return;

      // Calculate this week's adjustment (add remainder to first weeks)
      let thisWeekAdjustment = perWeekAdjustment;
      if (weekIdx < weekRemainder) {
        thisWeekAdjustment += difference > 0 ? 1 : -1;
      }

      // Get current week total
      const currentWeekTotal = newResults
        .filter((item) => item.CalendarWeek === week)
        .reduce((sum, item) => sum + item.Quantity, 0);

      const newWeekTotal = Math.max(0, currentWeekTotal + thisWeekAdjustment);

      // Redistribute within this week
      // Use weekdays (Mon-Fri, CalendarDayInWeek 1-5) by default
      // Only include Sat (6) or Sun (7) if they already have quantity > 0
      const weekdaysOnly = weekDays.filter((d) => d.CalendarDayInWeek >= 1 && d.CalendarDayInWeek <= 5);
      const weekendDaysWithQuantity = weekDays.filter((d) => {
        const current = newResults.find(
          (r) => r.Date === d.Date && r.CalendarDayInWeek === d.CalendarDayInWeek
        );
        return (d.CalendarDayInWeek === 6 || d.CalendarDayInWeek === 7) && (current?.Quantity || 0) > 0;
      });

      // Combine weekdays + any weekend days that have quantity
      let daysToDistribute = [...weekdaysOnly, ...weekendDaysWithQuantity];

      // If no weekdays exist (edge case), fall back to all days
      if (daysToDistribute.length === 0) {
        daysToDistribute = weekDays;
      }

      // Sort by CalendarDayInWeek to ensure consistent ordering
      daysToDistribute.sort((a, b) => a.CalendarDayInWeek - b.CalendarDayInWeek);

      const baseAmount = Math.floor(newWeekTotal / daysToDistribute.length);
      const dayRemainder = newWeekTotal % daysToDistribute.length;

      // Create a set of dates that should receive the distribution
      const datesToDistribute = new Set(daysToDistribute.map(d => d.Date));

      newResults = newResults.map((item) => {
        if (item.CalendarWeek !== week) return item;

        // If this day is not in our distribution list, keep it at 0
        if (!datesToDistribute.has(item.Date)) {
          return { ...item, Quantity: 0 };
        }

        const dayIndex = daysToDistribute.findIndex(
          (d) => d.Date === item.Date
        );

        const extraAmount = dayIndex < dayRemainder ? 1 : 0;
        return { ...item, Quantity: baseAmount + extraAmount };
      });
    });

    return newResults;
  };

  // Handle backward redistribution confirmation
  const handleBackwardConfirm = useCallback(() => {
    if (!pendingWeekChange) return;

    const { weekNumber, newTotal, oldTotal } = pendingWeekChange;
    const weekDifference = newTotal - oldTotal;
    const jobDifference = -(weekDifference); // Opposite sign - we need to remove from other weeks

    const unlockedWeeksBefore = sortedWeeks.filter(
      (w) => w < weekNumber && !lockedWeeks[w]
    );

    if (unlockedWeeksBefore.length > 0) {
      const newSplitResults = redistributeToWeeks(
        splitResults,
        unlockedWeeksBefore,
        jobDifference,
        groupedByWeek
      );
      onSplitChange(newSplitResults);
    }

    setShowBackwardWarning(false);
    setPendingWeekChange(null);
  }, [pendingWeekChange, sortedWeeks, lockedWeeks, splitResults, groupedByWeek, onSplitChange]);

  // Handle backward redistribution cancel
  const handleBackwardCancel = useCallback(() => {
    setShowBackwardWarning(false);
    setPendingWeekChange(null);
  }, []);

  // Calculate difference for display
  const displayDifference = grandTotal - totalQuantity;

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-blue-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-[var(--text-dark)]">
          Calculated Quantity Split
        </h4>
        <div
          className={`text-sm font-semibold ${
            displayDifference === 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          Total: {grandTotal.toLocaleString()} / {totalQuantity.toLocaleString()}
          {displayDifference !== 0 && (
            <span className="ml-1">
              ({displayDifference > 0 ? "+" : ""}
              {displayDifference.toLocaleString()})
            </span>
          )}
        </div>
      </div>

      {/* Week cards */}
      <div className="space-y-3">
        {sortedWeeks.map((week) => {
          const weekData = groupedByWeek[week];
          const weekTotal = weekTotals[week];
          const startDate = weekData[0]?.Date || "";
          const endDate = weekData[weekData.length - 1]?.Date || "";
          const isLocked = lockedWeeks[week] || false;
          const isOptionsExpanded = expandedWeekOptions[week] || false;
          const hasOverrides = scheduleConfig ? weekHasOverrides(scheduleConfig, week) : false;
          const effectiveOptions = scheduleConfig
            ? getEffectiveScheduleForWeek(scheduleConfig, week)
            : DEFAULT_SCHEDULE_OPTIONS;
          const optionsSummary = getActiveOptionsSummary(effectiveOptions);

          return (
            <div
              key={week}
              className={`bg-white border rounded-lg p-3 ${
                isLocked ? "border-blue-300 bg-blue-50/50" : "border-[var(--border)]"
              }`}
            >
              {/* Week header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text-dark)]">
                    Week {week}
                  </span>
                  <span className="text-sm text-[var(--text-light)]">
                    ({startDate} to {endDate})
                  </span>
                  {/* Schedule options indicator */}
                  {showScheduleOptions && scheduleConfig && (
                    <button
                      type="button"
                      onClick={() => toggleWeekOptions(week)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
                        hasOverrides
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-gray-100 text-[var(--text-light)] hover:bg-gray-200"
                      }`}
                      title={hasOverrides ? "Custom schedule options" : "Using job defaults"}
                    >
                      <Settings2 className="w-3 h-3" />
                      {hasOverrides ? "Custom" : "Default"}
                      {isOptionsExpanded ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Lock toggle */}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleToggleLock(week)}
                      className={`p-1 rounded transition-colors ${
                        isLocked
                          ? "text-blue-600 hover:bg-blue-100"
                          : "text-gray-400 hover:bg-gray-100"
                      }`}
                      title={isLocked ? "Unlock week" : "Lock week"}
                    >
                      {isLocked ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <Unlock className="w-4 h-4" />
                      )}
                    </button>
                  )}
                  {/* Week total - editable input */}
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium text-[var(--text-light)]">
                      Total:
                    </span>
                    {readOnly ? (
                      <span className="font-semibold text-[var(--primary-blue)]">
                        {weekTotal.toLocaleString()}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={weekTotal.toLocaleString()}
                        onChange={(e) => handleWeekTotalChange(week, e.target.value)}
                        className={`w-28 px-2 py-1 text-right font-semibold rounded border focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] ${
                          isLocked
                            ? "text-[var(--primary-blue)] bg-blue-50 border-blue-300"
                            : "text-[var(--primary-blue)] bg-white border-[var(--border)]"
                        }`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Schedule options dropdown */}
              {showScheduleOptions && scheduleConfig && isOptionsExpanded && (
                <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-[var(--text-light)] uppercase tracking-wide">
                      Week Schedule Options
                    </span>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!hasOverrides}
                        onChange={(e) => handleToggleUseJobDefaults(week, e.target.checked)}
                        disabled={readOnly}
                        className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
                      />
                      <span className="text-xs text-[var(--text-dark)]">Use job defaults</span>
                    </label>
                  </div>
                  {hasOverrides ? (
                    <ScheduleOptionsCheckboxes
                      options={effectiveOptions}
                      onChange={(options) => handleWeekScheduleChange(week, options)}
                      compact
                      disabled={readOnly}
                    />
                  ) : (
                    <div className="text-xs text-[var(--text-light)] italic">
                      Using job defaults: {optionsSummary}
                    </div>
                  )}
                </div>
              )}

              {/* Active options summary (when collapsed) */}
              {showScheduleOptions && scheduleConfig && !isOptionsExpanded && optionsSummary !== "None" && (
                <div className="mb-2 text-xs text-[var(--text-light)]">
                  <span className="font-medium">Schedule:</span> {optionsSummary}
                  {hasOverrides && <span className="ml-1 text-amber-600">(custom)</span>}
                </div>
              )}

              {/* Daily inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-sm">
                {weekData.map((item) => (
                  <div key={`${item.Date}-${item.CalendarDayInWeek}`} className="flex flex-col gap-1">
                    <label className="text-xs text-[var(--text-light)]">
                      {dayNames[item.CalendarDayInWeek]}:
                    </label>
                    {readOnly ? (
                      <span className="px-2 py-1 text-[var(--text-dark)]">
                        {item.Quantity.toLocaleString()}
                      </span>
                    ) : (
                      <input
                        type="text"
                        value={item.Quantity.toLocaleString()}
                        onChange={(e) =>
                          handleDayQuantityChange(
                            item.Date,
                            item.CalendarDayInWeek,
                            item.CalendarWeek,
                            e.target.value
                          )
                        }
                        className={`w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] text-sm ${
                          isLocked ? "bg-blue-50/50 border-blue-200" : "bg-white border-[var(--border)]"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Backward redistribution warning */}
      <BackwardRedistributeWarning
        isOpen={showBackwardWarning}
        weekNumber={pendingWeekChange?.weekNumber || 0}
        proposedTotal={pendingWeekChange?.newTotal || 0}
        currentTotal={pendingWeekChange?.oldTotal || 0}
        difference={pendingWeekChange ? pendingWeekChange.newTotal - pendingWeekChange.oldTotal : 0}
        unlockedWeeksBefore={sortedWeeks.filter(
          (w) => w < (pendingWeekChange?.weekNumber || 0) && !lockedWeeks[w]
        )}
        onConfirm={handleBackwardConfirm}
        onCancel={handleBackwardCancel}
      />
    </div>
  );
}
