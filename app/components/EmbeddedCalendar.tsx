"use client";

import { useState, useMemo, useEffect } from "react";
import { useMachines } from "@/hooks/useMachines";
import { useCalendarJobs } from "@/hooks/useCalendarJobs";
import { useMachineCapacity } from "@/hooks/useMachineCapacity";
import { CalendarViewType } from "@/types/calendar";
import {
  getMonthRange,
  getWeeklyViewRange,
  getQuarterlyViewRange,
} from "@/lib/dateUtils";
import { ParsedJob } from "@/hooks/useJobs";
import CalendarView from "./CalendarView";
import QuarterlyCalendarView from "./QuarterlyCalendarView";
import WeeklyCalendarView from "./WeeklyCalendarView";
import EditJobModal from "./EditJobModal";

interface EmbeddedCalendarProps {
  startDate?: Date;
  selectedFacility?: number | null;
  selectedClients?: number[];
  selectedServiceTypes?: string[];
  searchQuery?: string;
  scheduleFilter?: "all" | "confirmed" | "soft";
  filterMode?: "and" | "or";
  height?: number;
  viewType?: CalendarViewType | "quarterly";
}

export default function EmbeddedCalendar({
  startDate,
  selectedFacility,
  selectedClients = [],
  selectedServiceTypes = [],
  searchQuery = "",
  scheduleFilter = "all",
  filterMode = "and",
  height = 500,
  viewType = "month",
}: EmbeddedCalendarProps) {
  const [currentDate, setCurrentDate] = useState(startDate || new Date());
  const [selectedJob, setSelectedJob] = useState<ParsedJob | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Sync currentDate with startDate prop when it changes
  useEffect(() => {
    if (startDate) {
      setCurrentDate(startDate);
    }
  }, [startDate]);
  console.log("selectedClients", selectedClients);
  // Get date range based on view type
  const dateRange = useMemo(() => {
    switch (viewType) {
      case "month":
        return getMonthRange(currentDate); // Show full calendar month
      case "week":
        return getWeeklyViewRange(currentDate); // Fetch 5 weeks of data
      case "quarterly":
        return getQuarterlyViewRange(currentDate); // Fetch 4 quarters of data
      default:
        return getMonthRange(currentDate);
    }
  }, [viewType, currentDate]);

  // Fetch data
  const { machines, isLoading: machinesLoading } = useMachines();

  const {
    filteredJobs,
    events,
    isLoading: jobsLoading,
  } = useCalendarJobs({
    machines,
    facilityId: selectedFacility,
    startDate: dateRange.start,
    endDate: dateRange.end,
    selectedMachines: [], // Use all machines for embedded view
    selectedClients: selectedClients,
    selectedServiceTypes: selectedServiceTypes,
    searchQuery: searchQuery,
    scheduleFilter: scheduleFilter,
    filterMode: filterMode,
  });

  const { dailySummaries } = useMachineCapacity({
    jobs: filteredJobs,
    machines,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const isLoading = machinesLoading || jobsLoading;

  const handleNavigate = (date: Date) => {
    setCurrentDate(date);
  };

  // Removed - navigation handlers not currently used
  // const handlePreviousPeriod = () => {
  //   const newDate = new Date(currentDate);
  //   if (viewType === 'month') {
  //     newDate.setMonth(currentDate.getMonth() - 1);
  //   } else {
  //     newDate.setDate(currentDate.getDate() - 7);
  //   }
  //   setCurrentDate(newDate);
  // };

  // const handleNextPeriod = () => {
  //   const newDate = new Date(currentDate);
  //   if (viewType === 'month') {
  //     newDate.setMonth(currentDate.getMonth() + 1);
  //   } else {
  //     newDate.setDate(currentDate.getDate() + 7);
  //   }
  //   setCurrentDate(newDate);
  // };

  // const handleToday = () => {
  //   setCurrentDate(new Date());
  // };

  // const formatCurrentPeriod = () => {
  //   if (viewType === 'month') {
  //     return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  //   } else {
  //     return `Week of ${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  //   }
  // };

  const handleJobClick = (job: ParsedJob) => {
    setSelectedJob(job);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedJob(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-[var(--dark-blue)]">
            Calendar View
          </h3>
        </div>
      </div>

      {/* Calendar Content */}
      <div className="p-4">
        {isLoading ? (
          <div
            className="flex items-center justify-center"
            style={{ height: `${height}px` }}
          >
            <div className="text-[var(--text-light)]">Loading calendar...</div>
          </div>
        ) : viewType === "quarterly" ? (
          <QuarterlyCalendarView
            jobs={filteredJobs}
            year={currentDate.getFullYear()}
            startDate={currentDate}
          />
        ) : viewType === "week" ? (
          <WeeklyCalendarView jobs={filteredJobs} startDate={currentDate} />
        ) : (
          <div style={{ minHeight: `${height}px`, height: "auto" }}>
            <CalendarView
              events={events}
              dailySummaries={dailySummaries}
              viewType={viewType as CalendarViewType}
              displayMode="overlay"
              onDateClick={() => {}} // No modal in embedded view
              onNavigate={handleNavigate}
              compactMode={true}
              jobs={filteredJobs}
              dateRange={dateRange}
              onJobClick={handleJobClick}
            />
          </div>
        )}
      </div>

      {/* Edit Job Modal */}
      <EditJobModal
        isOpen={isEditModalOpen}
        job={selectedJob}
        onClose={handleCloseEditModal}
        onSuccess={() => {
          handleCloseEditModal();
          // Optionally refetch data here if needed
        }}
      />
    </div>
  );
}
