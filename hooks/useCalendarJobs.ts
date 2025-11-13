"use client";

import { useState, useEffect, useMemo } from "react";
import { useJobs, ParsedJob } from "./useJobs";
import { CalendarEvent, Machine } from "@/types/calendar";
import { transformJobsToEvents } from "@/lib/calendarUtils";
import { timestampToDate, isDateInRange } from "@/lib/dateUtils";

interface UseCalendarJobsProps {
  machines: Machine[];
  facilityId?: number | null;
  startDate?: Date;
  endDate?: Date;
  selectedMachines?: number[];
  selectedClients?: number[];
  selectedServiceTypes?: string[];
  searchQuery?: string;
  scheduleFilter?: "all" | "confirmed" | "soft";
  filterMode?: "and" | "or";
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
  facilityId,
  startDate,
  endDate,
  selectedMachines = [],
  selectedClients = [],
  selectedServiceTypes = [],
  searchQuery = "",
  scheduleFilter = "all",
  filterMode = "and",
}: UseCalendarJobsProps): UseCalendarJobsReturn => {
  const { jobs, isLoading, error, refetch } = useJobs(facilityId);

  // Filter jobs based on date range and other filters
  const filteredJobs = useMemo(() => {
    let filtered = jobs;

    // Filter by date range if provided
    if (startDate && endDate) {
      filtered = filtered.filter((job) => {
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
      filtered = filtered.filter((job) =>
        job.machines.some((machine) => selectedMachines.includes(machine.id)),
      );
    }

    // Apply remaining filters using the same logic as useProjections
    // Determine which filters are active
    const hasClientFilter = selectedClients.length > 0;
    const hasServiceTypeFilter = selectedServiceTypes.length > 0;
    const hasSearchFilter = searchQuery.trim().length > 0;
    const hasScheduleFilter = scheduleFilter && scheduleFilter !== "all";

    if (filterMode === "or") {
      // OR mode: job matches if it matches ANY of the selected filter values
      filtered = filtered.filter((job) => {
        // If no filters are active, show all jobs
        if (
          !hasClientFilter &&
          !hasServiceTypeFilter &&
          !hasSearchFilter &&
          !hasScheduleFilter
        ) {
          return true;
        }

        // Check if matches any selected client
        const matchesClient =
          hasClientFilter && selectedClients.includes(job.client?.id);

        // Check if matches any selected service type (from requirements)
        const matchesServiceType =
          hasServiceTypeFilter &&
          job.requirements &&
          job.requirements.length > 0 &&
          job.requirements.some(
            (req) =>
              req.process_type &&
              selectedServiceTypes.includes(req.process_type),
          );

        // Check if matches search query
        const matchesSearch =
          hasSearchFilter &&
          (() => {
            const query = searchQuery.toLowerCase();
            return (
              job.job_number.toString().includes(query) ||
              job.client?.name.toLowerCase().includes(query) ||
              job.description?.toLowerCase().includes(query)
            );
          })();

        // Check if matches schedule filter
        const matchesSchedule =
          hasScheduleFilter &&
          (() => {
            const isConfirmed =
              (job as any).confirmed === true || (job as any).confirmed === 1;
            return scheduleFilter === "confirmed" ? isConfirmed : !isConfirmed;
          })();

        // Return true if matches ANY active filter
        return (
          matchesClient ||
          matchesServiceType ||
          matchesSearch ||
          matchesSchedule
        );
      });
    } else {
      // AND mode: job must pass ALL active filters

      // Filter by clients
      if (hasClientFilter) {
        filtered = filtered.filter((job) =>
          selectedClients.includes(job.client?.id),
        );
      }

      // Filter by process types from requirements
      if (hasServiceTypeFilter) {
        filtered = filtered.filter((job) => {
          // Check if any requirement has a matching process type
          if (job.requirements && job.requirements.length > 0) {
            return job.requirements.some(
              (req) =>
                req.process_type &&
                selectedServiceTypes.includes(req.process_type),
            );
          }
          return false;
        });
      }

      // Filter by search query (job number, client name, or description)
      if (hasSearchFilter) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter((job) => {
          return (
            job.job_number.toString().includes(query) ||
            job.client?.name.toLowerCase().includes(query) ||
            job.description?.toLowerCase().includes(query)
          );
        });
      }

      // Filter by schedule type (confirmed/soft)
      if (hasScheduleFilter) {
        filtered = filtered.filter((job) => {
          const isConfirmed =
            (job as any).confirmed === true || (job as any).confirmed === 1;
          if (scheduleFilter === "confirmed") {
            return isConfirmed;
          } else if (scheduleFilter === "soft") {
            return !isConfirmed;
          }
          return true;
        });
      }
    }

    return filtered;
  }, [
    jobs,
    startDate,
    endDate,
    selectedMachines,
    selectedClients,
    selectedServiceTypes,
    searchQuery,
    scheduleFilter,
    filterMode,
  ]);

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
    refetch,
  };
};
