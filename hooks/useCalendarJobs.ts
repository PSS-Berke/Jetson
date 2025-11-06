'use client';

import { useState, useEffect, useMemo } from 'react';
import { useJobs, ParsedJob } from './useJobs';
import { CalendarEvent, Machine } from '@/types/calendar';
import { transformJobsToEvents } from '@/lib/calendarUtils';
import { timestampToDate, isDateInRange } from '@/lib/dateUtils';

interface UseCalendarJobsProps {
  machines: Machine[];
  startDate?: Date;
  endDate?: Date;
  selectedMachines?: number[];
  selectedClients?: number[];
  selectedServiceTypes?: string[];
}

interface UseCalendarJobsReturn {
  jobs: ParsedJob[];
  filteredJobs: ParsedJob[];
  events: CalendarEvent[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing calendar jobs with filtering and date range support
 */
export const useCalendarJobs = ({
  machines,
  startDate,
  endDate,
  selectedMachines = [],
  selectedClients = [],
  selectedServiceTypes = []
}: UseCalendarJobsProps): UseCalendarJobsReturn => {
  const { jobs, isLoading, error, refetch } = useJobs();

  // Filter jobs based on date range and other filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Filter by date range if provided
    if (startDate && endDate) {
      filtered = filtered.filter(job => {
        const jobStart = timestampToDate(job.start_date);
        const jobEnd = timestampToDate(job.due_date);

        // Check if job overlaps with the date range
        return (
          isDateInRange(jobStart, startDate, endDate) ||
          isDateInRange(jobEnd, startDate, endDate) ||
          (jobStart <= startDate && jobEnd >= endDate)
        );
      });
    }

    // Filter by selected machines
    if (selectedMachines.length > 0) {
      filtered = filtered.filter(job =>
        job.machines.some(machine => selectedMachines.includes(machine.id))
      );
    }

    // Filter by selected clients
    if (selectedClients.length > 0) {
      filtered = filtered.filter(job =>
        selectedClients.includes(job.clients_id)
      );
    }

    // Filter by selected service types
    if (selectedServiceTypes.length > 0) {
      filtered = filtered.filter(job =>
        selectedServiceTypes.includes(job.service_type)
      );
    }

    return filtered;
  }, [jobs, startDate, endDate, selectedMachines, selectedClients, selectedServiceTypes]);

  // Transform filtered jobs into calendar events
  const events = useMemo(() => {
    return transformJobsToEvents(filteredJobs);
  }, [filteredJobs]);

  return {
    jobs,
    filteredJobs,
    events,
    isLoading,
    error,
    refetch
  };
};
