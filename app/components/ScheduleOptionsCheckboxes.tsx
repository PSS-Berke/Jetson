"use client";

import React from "react";
import { ScheduleOptions } from "@/lib/scheduleTypes";

interface ScheduleOptionsCheckboxesProps {
  options: ScheduleOptions;
  onChange: (options: ScheduleOptions) => void;
  compact?: boolean; // For week-level display (more condensed)
  disabled?: boolean;
}

export default function ScheduleOptionsCheckboxes({
  options,
  onChange,
  compact = false,
  disabled = false,
}: ScheduleOptionsCheckboxesProps) {
  const handleChange = (key: keyof ScheduleOptions, value: boolean | number) => {
    const newOptions = { ...options, [key]: value };

    // If "Run 12s All Weekend" is enabled, auto-set weekend hours to 12
    if (key === "run12sAllWeekend" && value === true) {
      newOptions.runSat1st = true;
      newOptions.runSat1stHours = 12;
      newOptions.runSat2nd = false;
      newOptions.runSun1st = true;
      newOptions.runSun1stHours = 12;
      newOptions.runSun2nd = false;
    }

    onChange(newOptions);
  };

  const handleHoursChange = (key: keyof ScheduleOptions, value: string) => {
    const numValue = parseInt(value) || 0;
    const clampedValue = Math.min(12, Math.max(1, numValue));
    handleChange(key, clampedValue);
  };

  if (compact) {
    return (
      <div className="space-y-2 text-sm">
        {/* Overtime Row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.run1stOT}
              onChange={(e) => handleChange("run1stOT", e.target.checked)}
              disabled={disabled}
              className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-[var(--text-dark)]">1st OT</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.run2ndOT}
              onChange={(e) => handleChange("run2ndOT", e.target.checked)}
              disabled={disabled}
              className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-[var(--text-dark)]">2nd OT</span>
          </label>
        </div>

        {/* Saturday Row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSat1st}
              onChange={(e) => handleChange("runSat1st", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-[var(--text-dark)]">Sat 1st</span>
            {options.runSat1st && (
              <input
                type="number"
                min="1"
                max="12"
                value={options.runSat1stHours}
                onChange={(e) => handleHoursChange("runSat1stHours", e.target.value)}
                disabled={disabled || options.run12sAllWeekend}
                className="w-12 px-1 py-0.5 text-center border border-[var(--border)] rounded text-xs focus:ring-1 focus:ring-[var(--primary-blue)]"
              />
            )}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSat2nd}
              onChange={(e) => handleChange("runSat2nd", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-[var(--text-dark)]">Sat 2nd</span>
            {options.runSat2nd && (
              <input
                type="number"
                min="1"
                max="12"
                value={options.runSat2ndHours}
                onChange={(e) => handleHoursChange("runSat2ndHours", e.target.value)}
                disabled={disabled || options.run12sAllWeekend}
                className="w-12 px-1 py-0.5 text-center border border-[var(--border)] rounded text-xs focus:ring-1 focus:ring-[var(--primary-blue)]"
              />
            )}
          </label>
        </div>

        {/* Sunday Row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSun1st}
              onChange={(e) => handleChange("runSun1st", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-[var(--text-dark)]">Sun 1st</span>
            {options.runSun1st && (
              <input
                type="number"
                min="1"
                max="12"
                value={options.runSun1stHours}
                onChange={(e) => handleHoursChange("runSun1stHours", e.target.value)}
                disabled={disabled || options.run12sAllWeekend}
                className="w-12 px-1 py-0.5 text-center border border-[var(--border)] rounded text-xs focus:ring-1 focus:ring-[var(--primary-blue)]"
              />
            )}
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSun2nd}
              onChange={(e) => handleChange("runSun2nd", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-[var(--text-dark)]">Sun 2nd</span>
            {options.runSun2nd && (
              <input
                type="number"
                min="1"
                max="12"
                value={options.runSun2ndHours}
                onChange={(e) => handleHoursChange("runSun2ndHours", e.target.value)}
                disabled={disabled || options.run12sAllWeekend}
                className="w-12 px-1 py-0.5 text-center border border-[var(--border)] rounded text-xs focus:ring-1 focus:ring-[var(--primary-blue)]"
              />
            )}
          </label>
        </div>

        {/* 12s All Weekend */}
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={options.run12sAllWeekend}
            onChange={(e) => handleChange("run12sAllWeekend", e.target.checked)}
            disabled={disabled}
            className="w-3.5 h-3.5 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
          />
          <span className="text-[var(--text-dark)]">12s All Weekend</span>
        </label>
      </div>
    );
  }

  // Full-size layout for job-level defaults
  return (
    <div className="space-y-3">
      {/* Overtime Section */}
      <div>
        <span className="text-xs font-medium text-[var(--text-light)] uppercase tracking-wide">
          Overtime
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.run1stOT}
              onChange={(e) => handleChange("run1stOT", e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-sm text-[var(--text-dark)]">Run 1st OT</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.run2ndOT}
              onChange={(e) => handleChange("run2ndOT", e.target.checked)}
              disabled={disabled}
              className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-sm text-[var(--text-dark)]">Run 2nd OT</span>
          </label>
        </div>
      </div>

      {/* Saturday Section */}
      <div>
        <span className="text-xs font-medium text-[var(--text-light)] uppercase tracking-wide">
          Saturday Shifts
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSat1st}
              onChange={(e) => handleChange("runSat1st", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-sm text-[var(--text-dark)]">Run Sat 1st</span>
            {options.runSat1st && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={options.runSat1stHours}
                  onChange={(e) => handleHoursChange("runSat1stHours", e.target.value)}
                  disabled={disabled || options.run12sAllWeekend}
                  className="w-14 px-2 py-1 text-center border border-[var(--border)] rounded text-sm focus:ring-2 focus:ring-[var(--primary-blue)]"
                />
                <span className="text-xs text-[var(--text-light)]">hrs</span>
              </div>
            )}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSat2nd}
              onChange={(e) => handleChange("runSat2nd", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-sm text-[var(--text-dark)]">Run Sat 2nd</span>
            {options.runSat2nd && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={options.runSat2ndHours}
                  onChange={(e) => handleHoursChange("runSat2ndHours", e.target.value)}
                  disabled={disabled || options.run12sAllWeekend}
                  className="w-14 px-2 py-1 text-center border border-[var(--border)] rounded text-sm focus:ring-2 focus:ring-[var(--primary-blue)]"
                />
                <span className="text-xs text-[var(--text-light)]">hrs</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* Sunday Section */}
      <div>
        <span className="text-xs font-medium text-[var(--text-light)] uppercase tracking-wide">
          Sunday Shifts
        </span>
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSun1st}
              onChange={(e) => handleChange("runSun1st", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-sm text-[var(--text-dark)]">Run Sun 1st</span>
            {options.runSun1st && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={options.runSun1stHours}
                  onChange={(e) => handleHoursChange("runSun1stHours", e.target.value)}
                  disabled={disabled || options.run12sAllWeekend}
                  className="w-14 px-2 py-1 text-center border border-[var(--border)] rounded text-sm focus:ring-2 focus:ring-[var(--primary-blue)]"
                />
                <span className="text-xs text-[var(--text-light)]">hrs</span>
              </div>
            )}
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={options.runSun2nd}
              onChange={(e) => handleChange("runSun2nd", e.target.checked)}
              disabled={disabled || options.run12sAllWeekend}
              className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
            />
            <span className="text-sm text-[var(--text-dark)]">Run Sun 2nd</span>
            {options.runSun2nd && (
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={options.runSun2ndHours}
                  onChange={(e) => handleHoursChange("runSun2ndHours", e.target.value)}
                  disabled={disabled || options.run12sAllWeekend}
                  className="w-14 px-2 py-1 text-center border border-[var(--border)] rounded text-sm focus:ring-2 focus:ring-[var(--primary-blue)]"
                />
                <span className="text-xs text-[var(--text-light)]">hrs</span>
              </div>
            )}
          </label>
        </div>
      </div>

      {/* 12s All Weekend */}
      <div className="pt-2 border-t border-[var(--border)]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={options.run12sAllWeekend}
            onChange={(e) => handleChange("run12sAllWeekend", e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
          />
          <span className="text-sm font-medium text-[var(--text-dark)]">
            Run 12s All Weekend
          </span>
          <span className="text-xs text-[var(--text-light)]">
            (Sets Sat & Sun to 12-hour shifts)
          </span>
        </label>
      </div>
    </div>
  );
}
