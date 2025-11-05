'use client';

import { useState, useMemo } from 'react';
import { useMachines } from '@/hooks/useMachines';
import { useCalendarJobs } from '@/hooks/useCalendarJobs';
import { useMachineCapacity } from '@/hooks/useMachineCapacity';
import { CalendarViewType } from '@/types/calendar';
import { getMonthRange, getWeekRange } from '@/lib/dateUtils';
import CalendarView from './CalendarView';
import CompactFilterDropdown from './CompactFilterDropdown';
import FacilityToggle from './FacilityToggle';

interface EmbeddedCalendarProps {
  startDate?: Date;
  filterMode: 'synced' | 'independent';
  onFilterModeChange: (mode: 'synced' | 'independent') => void;
  selectedFacility: number | null;
  selectedClients?: number[];
  selectedServiceTypes?: string[];
  independentFilters: {
    facility: number | null;
    clients: number[];
    serviceTypes: string[];
  };
  onIndependentFiltersChange: (filters: {
    facility: number | null;
    clients: number[];
    serviceTypes: string[];
  }) => void;
  height?: number;
}

export default function EmbeddedCalendar({
  startDate,
  filterMode,
  onFilterModeChange,
  selectedFacility,
  selectedClients = [],
  selectedServiceTypes = [],
  independentFilters,
  onIndependentFiltersChange,
  height = 500,
}: EmbeddedCalendarProps) {
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [currentDate, setCurrentDate] = useState(startDate || new Date());

  // Determine active filters based on mode
  const activeFilters = useMemo(() => {
    if (filterMode === 'synced') {
      return {
        facility: selectedFacility,
        clients: selectedClients,
        serviceTypes: selectedServiceTypes,
      };
    } else {
      return independentFilters;
    }
  }, [filterMode, selectedFacility, selectedClients, selectedServiceTypes, independentFilters]);

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
    startDate: dateRange.start,
    endDate: dateRange.end,
    selectedMachines: [], // Use all machines for embedded view
    selectedClients: activeFilters.clients,
    selectedServiceTypes: activeFilters.serviceTypes,
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

  // Extract unique clients and service types from jobs for filter dropdowns
  const clientOptions = useMemo(() => {
    const clientMap = new Map<number, { id: number; name: string }>();
    filteredJobs.forEach(job => {
      if (job.client) {
        clientMap.set(job.client.id, { id: job.client.id, name: job.client.name });
      }
    });
    return Array.from(clientMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredJobs]);

  const serviceTypeOptions = useMemo(() => {
    const types = new Set<string>();
    filteredJobs.forEach(job => {
      if (job.service_type) {
        types.add(job.service_type);
      }
    });
    return Array.from(types).sort().map(type => ({ id: type, name: type }));
  }, [filteredJobs]);

  const handleClearIndependentFilters = () => {
    onIndependentFiltersChange({
      facility: null,
      clients: [],
      serviceTypes: [],
    });
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
            {/* Filter Mode Toggle */}
            <button
              onClick={() => onFilterModeChange(filterMode === 'synced' ? 'independent' : 'synced')}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              title={filterMode === 'synced' ? 'Using same filters as projections' : 'Using independent calendar filters'}
            >
              {filterMode === 'synced' ? (
                <>
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-blue-700">Synced</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  <span className="text-gray-700">Independent</span>
                </>
              )}
            </button>

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

      {/* Independent Filters Bar */}
      {filterMode === 'independent' && (
        <div className="px-6 py-3 bg-gray-50 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[var(--text-dark)]">
              Calendar Filters:
            </span>

            {/* Facility Toggle */}
            <FacilityToggle
              currentFacility={independentFilters.facility}
              onFacilityChange={(facility) =>
                onIndependentFiltersChange({ ...independentFilters, facility })
              }
            />

            {/* Client Filter */}
            <CompactFilterDropdown
              label="Clients"
              options={clientOptions}
              selected={independentFilters.clients}
              onChange={(clients) =>
                onIndependentFiltersChange({ ...independentFilters, clients: clients as number[] })
              }
            />

            {/* Service Type Filter */}
            <CompactFilterDropdown
              label="Service Types"
              options={serviceTypeOptions}
              selected={independentFilters.serviceTypes}
              onChange={(serviceTypes) =>
                onIndependentFiltersChange({ ...independentFilters, serviceTypes: serviceTypes as string[] })
              }
            />

            {/* Clear Filters Button */}
            <button
              onClick={handleClearIndependentFilters}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-auto"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

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
