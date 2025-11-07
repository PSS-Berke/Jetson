'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import DateRangePicker, { type DateRange } from './DateRangePicker';

type GranularityType = 'day' | 'week' | 'month';

interface ProductionFiltersProps {
  jobs: ParsedJob[];
  selectedClients: number[];
  onClientsChange: (clients: number[]) => void;
  selectedServiceTypes: string[];
  onServiceTypesChange: (types: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterMode: 'and' | 'or';
  onFilterModeChange: (mode: 'and' | 'or') => void;
  granularity: GranularityType;
  dateRangeDisplay: string;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onToday: () => void;
  startDate: Date;
  endDate: Date;
  onDateRangeChange?: (range: DateRange) => void;
}

export default function ProductionFilters({
  jobs,
  selectedClients,
  onClientsChange,
  selectedServiceTypes,
  onServiceTypesChange,
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  granularity,
  dateRangeDisplay,
  onPreviousPeriod,
  onNextPeriod,
  onToday,
  startDate,
  endDate,
  onDateRangeChange,
}: ProductionFiltersProps) {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target as Node)) {
        setIsClientDropdownOpen(false);
      }
      if (serviceDropdownRef.current && !serviceDropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Extract unique clients from jobs
  const clients = useMemo(() => {
    const clientMap = new Map<number, { id: number; name: string }>();
    jobs.forEach(job => {
      if (job.client) {
        clientMap.set(job.client.id, job.client);
      }
    });
    return Array.from(clientMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [jobs]);

  // Map legacy process type names to new full names
  const normalizeProcessType = (processType: string): string => {
    const mapping: Record<string, string> = {
      'IJ': 'Inkjet',
      'L/A': 'Label/Apply',
    };
    return mapping[processType] || processType;
  };

  // Extract unique process types from requirements and normalize them
  const serviceTypes = useMemo(() => {
    const types = new Set<string>();
    jobs.forEach(job => {
      if (job.requirements && job.requirements.length > 0) {
        job.requirements.forEach(req => {
          if (req.process_type) {
            types.add(normalizeProcessType(req.process_type));
          }
        });
      }
    });
    return Array.from(types).sort();
  }, [jobs]);

  const handleClientToggle = (clientId: number) => {
    if (selectedClients.includes(clientId)) {
      onClientsChange(selectedClients.filter(id => id !== clientId));
    } else {
      onClientsChange([...selectedClients, clientId]);
    }
  };

  const handleServiceTypeToggle = (serviceType: string) => {
    if (selectedServiceTypes.includes(serviceType)) {
      onServiceTypesChange(selectedServiceTypes.filter(t => t !== serviceType));
    } else {
      onServiceTypesChange([...selectedServiceTypes, serviceType]);
    }
  };

  const getPeriodLabel = () => {
    if (granularity === 'day') return 'Day Range';
    if (granularity === 'month') return 'Month Range';
    return 'Week Range';
  };

  const getTodayButtonLabel = () => {
    if (granularity === 'day') return 'Today';
    if (granularity === 'month') return 'This Month';
    return 'This Week';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-3 sm:p-4 mb-6">
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
        {/* Filter Mode Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onFilterModeChange('and')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              filterMode === 'and'
                ? 'bg-white text-[var(--dark-blue)] shadow-sm'
                : 'text-[var(--text-light)] hover:text-[var(--text-dark)]'
            }`}
            title="Jobs must match ALL active filters"
          >
            Match All
          </button>
          <button
            onClick={() => onFilterModeChange('or')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
              filterMode === 'or'
                ? 'bg-white text-[var(--primary-blue)] shadow-sm'
                : 'text-[var(--text-light)] hover:text-[var(--text-dark)]'
            }`}
            title="Jobs can match ANY active filter"
          >
            Match Any
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <span className="text-xs sm:text-sm font-medium text-[var(--text-dark)] whitespace-nowrap">{getPeriodLabel()}:</span>
          <button
            onClick={onPreviousPeriod}
            className="p-1.5 sm:px-2 sm:py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label={`Previous ${granularity === 'day' ? 'day' : granularity === 'month' ? 'month' : 'week'}`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <DateRangePicker
            dateRange={{ start: startDate, end: endDate }}
            onDateRangeChange={onDateRangeChange || (() => {})}
          />
          <button
            onClick={onNextPeriod}
            className="p-1.5 sm:px-2 sm:py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
            aria-label={`Next ${granularity === 'day' ? 'day' : granularity === 'month' ? 'month' : 'week'}`}
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={onToday}
            className="px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs sm:text-sm font-medium hover:bg-blue-100 transition-colors whitespace-nowrap flex-shrink-0"
          >
            {getTodayButtonLabel()}
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-full sm:min-w-[200px]">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Client Filter */}
        <div className="relative" ref={clientDropdownRef}>
          <button
            onClick={() => setIsClientDropdownOpen(!isClientDropdownOpen)}
            className="px-4 py-2 bg-white border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-dark)] hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Clients
            {selectedClients.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {selectedClients.length}
              </span>
            )}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isClientDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50 max-h-64 overflow-y-auto">
              {clients.length === 0 ? (
                <div className="px-4 py-2 text-sm text-[var(--text-light)]">No clients found</div>
              ) : (
                <>
                  <button
                    onClick={() => onClientsChange([])}
                    className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Clear All
                  </button>
                  <div className="border-t border-[var(--border)] my-1"></div>
                  {clients.map(client => (
                    <label
                      key={client.id}
                      className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(client.id)}
                        onChange={() => handleClientToggle(client.id)}
                        className="mr-2"
                      />
                      <span className="text-sm text-[var(--text-dark)]">{client.name}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Process Type Filter */}
        <div className="relative" ref={serviceDropdownRef}>
          <button
            onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
            className="px-4 py-2 bg-white border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-dark)] hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Process Types
            {selectedServiceTypes.length > 0 && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                {selectedServiceTypes.length}
              </span>
            )}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isServiceDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50 max-h-64 overflow-y-auto">
              {serviceTypes.length === 0 ? (
                <div className="px-4 py-2 text-sm text-[var(--text-light)]">No process types found</div>
              ) : (
                <>
                  <button
                    onClick={() => onServiceTypesChange([])}
                    className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Clear All
                  </button>
                  <div className="border-t border-[var(--border)] my-1"></div>
                  {serviceTypes.map(serviceType => (
                    <label
                      key={serviceType}
                      className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedServiceTypes.includes(serviceType)}
                        onChange={() => handleServiceTypeToggle(serviceType)}
                        className="mr-2"
                      />
                      <span className="text-sm text-[var(--text-dark)]">{serviceType}</span>
                    </label>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
