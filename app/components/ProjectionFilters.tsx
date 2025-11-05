'use client';

import { useState, useMemo } from 'react';
import { ParsedJob } from '@/hooks/useJobs';
import { getStartOfWeek } from '@/lib/projectionUtils';

interface ProjectionFiltersProps {
  jobs: ParsedJob[];
  startDate: Date;
  onStartDateChange: (date: Date) => void;
  selectedClients: number[];
  onClientsChange: (clients: number[]) => void;
  selectedServiceTypes: string[];
  onServiceTypesChange: (types: string[]) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function ProjectionFilters({
  jobs,
  startDate,
  onStartDateChange,
  selectedClients,
  onClientsChange,
  selectedServiceTypes,
  onServiceTypesChange,
  searchQuery,
  onSearchChange,
}: ProjectionFiltersProps) {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);

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

  // Extract unique service types
  const serviceTypes = useMemo(() => {
    const types = new Set<string>();
    jobs.forEach(job => {
      if (job.service_type) {
        types.add(job.service_type);
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

  const handlePreviousWeek = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() - 7);
    onStartDateChange(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(startDate);
    newDate.setDate(newDate.getDate() + 7);
    onStartDateChange(newDate);
  };

  const handleToday = () => {
    onStartDateChange(getStartOfWeek());
  };

  const formatDateRange = () => {
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 34); // 5 weeks = 35 days
    return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4 mb-6">
      <div className="flex flex-wrap gap-4 items-center">
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-dark)]">Week Range:</span>
          <button
            onClick={handlePreviousWeek}
            className="px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Previous week"
          >
            <svg className="w-5 h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="px-3 py-1 bg-gray-50 rounded text-sm font-medium text-[var(--text-dark)] min-w-[240px] text-center">
            {formatDateRange()}
          </div>
          <button
            onClick={handleNextWeek}
            className="px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            aria-label="Next week"
          >
            <svg className="w-5 h-5 text-[var(--text-dark)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm font-medium hover:bg-blue-100 transition-colors"
          >
            This Week
          </button>
        </div>

        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Client Filter */}
        <div className="relative">
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

        {/* Service Type Filter */}
        <div className="relative">
          <button
            onClick={() => setIsServiceDropdownOpen(!isServiceDropdownOpen)}
            className="px-4 py-2 bg-white border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-dark)] hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            Service Types
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
                <div className="px-4 py-2 text-sm text-[var(--text-light)]">No service types found</div>
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
