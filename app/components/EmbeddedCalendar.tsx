'use client';

import { useState, useMemo } from 'react';
import { useMachines } from '@/hooks/useMachines';
import { useCalendarJobs } from '@/hooks/useCalendarJobs';
import { useMachineCapacity } from '@/hooks/useMachineCapacity';
import { CalendarViewType } from '@/types/calendar';
import { getMonthRange, getWeekRange } from '@/lib/dateUtils';
import CalendarView from './CalendarView';

interface EmbeddedCalendarProps {
  startDate?: Date;
  selectedFacility?: number | null;
  selectedClients?: number[];
  selectedServiceTypes?: string[];
  height?: number;
}

export default function EmbeddedCalendar({
  startDate,
  selectedFacility,
  selectedClients = [],
  selectedServiceTypes = [],
  height = 500,
}: EmbeddedCalendarProps) {
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentDate, setCurrentDate] = useState(startDate || new Date());

  // Get date range based on view type
  const dateRange = useMemo(() => {
    switch (viewType) {
      case 'month':
        return getMonthRange(currentDate);
      case 'week':
        return getWeekRange(currentDate);
      default:
        return getMonthRange(currentDate);
    }
  }, [viewType, currentDate]);

  // Fetch data
  const { machines, isLoading: machinesLoading } = useMachines();

  const { filteredJobs, events, isLoading: jobsLoading } = useCalendarJobs({
    machines,
    facilityId: selectedFacility,
    startDate: dateRange.start,
    endDate: dateRange.end,
    selectedMachines: [], // Use all machines for embedded view
    selectedClients: selectedClients,
    selectedServiceTypes: selectedServiceTypes,
  });

  const { dailySummaries, overallUtilization } = useMachineCapacity({
    jobs: filteredJobs,
    machines,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const isLoading = machinesLoading || jobsLoading;

  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
  };

  const handlePreviousPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setDate(currentDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const handleNextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewType === 'month') {
      newDate.setMonth(currentDate.getMonth() + 1);
    } else {
      newDate.setDate(currentDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const formatCurrentPeriod = () => {
    if (viewType === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      return `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-bold text-[var(--dark-blue)]">Calendar View</h3>

            {/* Navigation Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPeriod}
                className="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                aria-label="Previous period"
              >
                <svg className="w-5 h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="px-3 py-1 bg-white rounded text-sm font-semibold text-[var(--text-dark)] min-w-[180px] text-center">
                {formatCurrentPeriod()}
              </div>
              <button
                onClick={handleNextPeriod}
                className="px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                aria-label="Next period"
              >
                <svg className="w-5 h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <button
                onClick={handleToday}
                className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium hover:bg-blue-100 transition-colors ml-2"
              >
                Today
              </button>
            </div>

            {/* Overall Utilization Badge */}
            <div className="px-3 py-1 bg-blue-50 rounded-lg">
              <span className="text-xs text-[var(--text-light)]">Utilization: </span>
              <span className="text-sm font-bold text-[var(--primary-blue)]">
                {overallUtilization}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View Toggle */}
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-1">
              <button
                onClick={() => setViewType('month')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  viewType === 'month'
                    ? 'bg-[var(--primary-blue)] text-white shadow-sm'
                    : 'text-[var(--text-dark)] hover:bg-gray-100'
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setViewType('week')}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  viewType === 'week'
                    ? 'bg-[var(--primary-blue)] text-white shadow-sm'
                    : 'text-[var(--text-dark)] hover:bg-gray-100'
                }`}
              >
                Week
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex items-center justify-center" style={{ height: `${height}px` }}>
            <div className="text-[var(--text-light)]">Loading calendar...</div>
          </div>
        ) : (
          <div style={{ height: `${height}px` }}>
            <CalendarView
              events={events}
              dailySummaries={dailySummaries}
              viewType={viewType}
              displayMode="overlay"
              onDateClick={() => {}} // No modal in embedded view
              onNavigate={handleNavigate}
              compactMode={true}
            />
          </div>
        )}
      </div>
    </div>
  );
}
