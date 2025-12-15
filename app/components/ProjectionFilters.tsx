"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { ParsedJob } from "@/hooks/useJobs";
import { getStartOfWeek } from "@/lib/projectionUtils";
import { startOfMonth, startOfQuarter } from "date-fns";
import type { Granularity } from "./GranularityToggle";
import DateRangePicker, { type DateRange } from "./DateRangePicker";
import {
  Filter,
  SlidersHorizontal,
  LayoutGrid,
  Table2,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";
import ProcessViewToggle from "./ProcessViewToggle";
import DynamicFieldFilter from "./DynamicFieldFilter";
import { getProcessTypeOptions } from "@/lib/processTypeConfig";
import DataHealthPopup from "./DataHealthPopup";

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
  granularity: Granularity;
  scheduleFilter: "all" | "confirmed" | "soft";
  onScheduleFilterChange: (filter: "all" | "confirmed" | "soft") => void;
  filterMode: "and" | "or";
  onFilterModeChange: (mode: "and" | "or") => void;
  filterViewMode: "simple" | "advanced";
  onFilterViewModeChange: (mode: "simple" | "advanced") => void;
  showExpandedProcesses?: boolean;
  onShowExpandedProcessesChange?: (show: boolean) => void;
  mobileViewMode?: "cards" | "table";
  onMobileViewModeChange?: (mode: "cards" | "table") => void;
  showOnlyInDateRange: boolean;
  onDateRangeToggleChange: (value: boolean) => void;
  onExportPDF?: () => void;
  onBulkUpload?: () => void;
  showNotes?: boolean;
  onShowNotesChange?: (show: boolean) => void;
  groupByFacility?: boolean;
  onGroupByFacilityChange?: (groupByFacility: boolean) => void;
  dynamicFieldFilters?: import("@/types").DynamicFieldFilter[];
  onDynamicFieldFiltersChange?: (filters: import("@/types").DynamicFieldFilter[]) => void;
  dynamicFieldFilterLogic?: "and" | "or";
  onDynamicFieldFilterLogicChange?: (logic: "and" | "or") => void;
  facilitiesId?: number | null;
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
  granularity,
  scheduleFilter,
  onScheduleFilterChange,
  filterMode,
  onFilterModeChange,
  filterViewMode,
  onFilterViewModeChange,
  showExpandedProcesses = true,
  onShowExpandedProcessesChange,
  mobileViewMode = "cards",
  onMobileViewModeChange,
  showOnlyInDateRange,
  onDateRangeToggleChange,
  onExportPDF,
  onBulkUpload,
  showNotes = false,
  onShowNotesChange,
  groupByFacility = false,
  onGroupByFacilityChange,
  dynamicFieldFilters = [],
  onDynamicFieldFiltersChange,
  dynamicFieldFilterLogic = "and",
  onDynamicFieldFilterLogicChange,
  facilitiesId,
}: ProjectionFiltersProps) {
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const clientDropdownRef = useRef<HTMLDivElement>(null);
  const serviceDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClientDropdownOpen(false);
      }
      if (
        serviceDropdownRef.current &&
        !serviceDropdownRef.current.contains(event.target as Node)
      ) {
        setIsServiceDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Extract unique clients from jobs
  const clients = useMemo(() => {
    const clientMap = new Map<number, { id: number; name: string }>();
    jobs.forEach((job) => {
      if (job.client) {
        clientMap.set(job.client.id, job.client);
      }
    });
    return Array.from(clientMap.values()).sort((a, b) => {
      const nameA = a.name || "";
      const nameB = b.name || "";
      return nameA.localeCompare(nameB);
    });
  }, [jobs]);

  const handleClientToggle = (clientId: number) => {
    if (selectedClients.includes(clientId)) {
      onClientsChange(selectedClients.filter((id) => id !== clientId));
    } else {
      onClientsChange([...selectedClients, clientId]);
    }
  };

  // Get process types from configuration (same as Dynamic Field filter)
  const serviceTypes = useMemo(() => {
    const deprecatedTypes = ['9-12 in+', 'sort', 'insert +', 'insert+', '13+ in+', '13+'];

    return getProcessTypeOptions()
      .filter((opt) => {
        const normalizedValue = opt.value.toLowerCase().trim();

        // Exclude Capability Bucket
        if (opt.value === "Capability Bucket") return false;

        // Exclude deprecated types
        if (deprecatedTypes.some(dep => dep.toLowerCase() === normalizedValue)) {
          return false;
        }

        return true;
      })
      .map((opt) => opt.label)
      .sort();
  }, []);

  const handleServiceTypeToggle = (serviceType: string) => {
    if (selectedServiceTypes.includes(serviceType)) {
      onServiceTypesChange(
        selectedServiceTypes.filter((t) => t !== serviceType),
      );
    } else {
      onServiceTypesChange([...selectedServiceTypes, serviceType]);
    }
  };

  const handlePrevious = () => {
    const newDate = new Date(startDate);
    switch (granularity) {
      case "month":
        newDate.setMonth(newDate.getMonth() - 1);
        break;
      case "quarter":
        newDate.setMonth(newDate.getMonth() - 3);
        break;
      case "week":
      default:
        newDate.setDate(newDate.getDate() - 7);
        break;
    }
    onStartDateChange(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(startDate);
    switch (granularity) {
      case "month":
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case "quarter":
        newDate.setMonth(newDate.getMonth() + 3);
        break;
      case "week":
      default:
        newDate.setDate(newDate.getDate() + 7);
        break;
    }
    onStartDateChange(newDate);
  };

  const handleToday = () => {
    switch (granularity) {
      case "month":
        onStartDateChange(startOfMonth(new Date()));
        break;
      case "quarter":
        onStartDateChange(startOfQuarter(new Date()));
        break;
      case "week":
      default:
        onStartDateChange(getStartOfWeek());
        break;
    }
  };

  // Calculate the end date for the date range picker
  const getEndDate = () => {
    const endDate = new Date(startDate);
    let days = 0;
    switch (granularity) {
      case "month":
        days = 90; // ~3 months
        break;
      case "quarter":
        days = 365; // ~4 quarters
        break;
      case "week":
      default:
        days = 34; // 5 weeks
        break;
    }
    endDate.setDate(endDate.getDate() + days);
    return endDate;
  };

  // Handle date range change from picker
  const handleDateRangeChange = (range: DateRange) => {
    onStartDateChange(range.start);
  };

  const getPeriodLabel = () => {
    switch (granularity) {
      case "month":
        return "Month Range";
      case "quarter":
        return "Quarter Range";
      case "week":
      default:
        return "Week Range";
    }
  };

  const getTodayButtonLabel = () => {
    switch (granularity) {
      case "month":
        return "This Month";
      case "quarter":
        return "This Quarter";
      case "week":
      default:
        return "This Week";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-3 sm:p-4 mb-6">
      <div className="flex flex-col gap-3">
        {/* First Row */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
          {/* Simple/Advanced View Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => onFilterViewModeChange("simple")}
              className={`p-2 rounded-md transition-all ${
                filterViewMode === "simple"
                  ? "bg-white text-[var(--dark-blue)] shadow-sm"
                  : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
              }`}
              title="Simple filtering view"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={() => onFilterViewModeChange("advanced")}
              className={`p-2 rounded-md transition-all ${
                filterViewMode === "advanced"
                  ? "bg-white text-[var(--primary-blue)] shadow-sm"
                  : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
              }`}
              title="Advanced filtering view"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Match All/Any Toggle - Only visible in advanced mode */}
          {filterViewMode === "advanced" && (
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onFilterModeChange("and")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  filterMode === "and"
                    ? "bg-white text-[var(--dark-blue)] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
                title="Jobs must match ALL active filters"
              >
                Match All
              </button>
              <button
                onClick={() => onFilterModeChange("or")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  filterMode === "or"
                    ? "bg-white text-[var(--primary-blue)] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
                title="Jobs can match ANY active filter"
              >
                Match Any
              </button>
            </div>
          )}

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

          {/* Clients Filter - Advanced mode only on first row */}
          {filterViewMode === "advanced" && (
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isClientDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50 max-h-64 overflow-y-auto">
                  {clients.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[var(--text-light)]">
                      No clients found
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onClientsChange([])}
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Clear All
                      </button>
                      <div className="border-t border-[var(--border)] my-1"></div>
                      {clients.map((client) => (
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
                          <span className="text-sm text-[var(--text-dark)]">
                            {client.name}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Process Type Filter - Advanced mode only on first row */}
          {filterViewMode === "advanced" && (
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
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {isServiceDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50 max-h-64 overflow-y-auto">
                  {serviceTypes.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-[var(--text-light)]">
                      No process types found
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onServiceTypesChange([])}
                        className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        Clear All
                      </button>
                      <div className="border-t border-[var(--border)] my-1"></div>
                      {serviceTypes.map((serviceType) => (
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
                          <span className="text-sm text-[var(--text-dark)]">
                            {serviceType}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Date Range Selector - Only on first row in simple mode */}
          {filterViewMode === "simple" && (
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={handleToday}
                className="px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs sm:text-sm font-medium hover:bg-blue-100 transition-colors whitespace-nowrap flex-shrink-0"
              >
                {getTodayButtonLabel()}
              </button>
              <button
                onClick={handlePrevious}
                className="p-1.5 sm:px-2 sm:py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label={`Previous ${granularity === "week" ? "week" : granularity === "month" ? "month" : "quarter"}`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-dark)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <DateRangePicker
                dateRange={{ start: startDate, end: getEndDate() }}
                onDateRangeChange={handleDateRangeChange}
              />
              <button
                onClick={handleNext}
                className="p-1.5 sm:px-2 sm:py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label={`Next ${granularity === "week" ? "week" : granularity === "month" ? "month" : "quarter"}`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-dark)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Second Row - Date Range and Toggle in advanced mode */}
        {filterViewMode === "advanced" && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
            {/* Date Range Selector - On second row in advanced mode */}
            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
              <button
                onClick={handleToday}
                className="px-2 sm:px-3 py-1 bg-blue-50 text-blue-700 rounded text-xs sm:text-sm font-medium hover:bg-blue-100 transition-colors whitespace-nowrap flex-shrink-0"
              >
                {getTodayButtonLabel()}
              </button>
              <button
                onClick={handlePrevious}
                className="p-1.5 sm:px-2 sm:py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label={`Previous ${granularity === "week" ? "week" : granularity === "month" ? "month" : "quarter"}`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-dark)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <DateRangePicker
                dateRange={{ start: startDate, end: getEndDate() }}
                onDateRangeChange={handleDateRangeChange}
              />
              <button
                onClick={handleNext}
                className="p-1.5 sm:px-2 sm:py-1 rounded hover:bg-gray-100 transition-colors flex-shrink-0"
                aria-label={`Next ${granularity === "week" ? "week" : granularity === "month" ? "month" : "quarter"}`}
              >
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-dark)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Date Range Filter Toggle - Advanced Mode */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => onDateRangeToggleChange(true)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  showOnlyInDateRange
                    ? "bg-white text-[var(--primary-blue)] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
              >
                Date Range Only
              </button>
              <button
                onClick={() => onDateRangeToggleChange(false)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  !showOnlyInDateRange
                    ? "bg-white text-[var(--dark-blue)] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
              >
                All Jobs
              </button>
            </div>
          </div>
        )}

        {/* Third Row - Advanced Filters Only */}
        {filterViewMode === "advanced" && (
          <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
            {/* Schedule Filter Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onScheduleFilterChange("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  scheduleFilter === "all"
                    ? "bg-white text-[var(--dark-blue)] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
              >
                All
              </button>
              <button
                onClick={() => onScheduleFilterChange("confirmed")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  scheduleFilter === "confirmed"
                    ? "bg-white text-[#EF3340] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
              >
                Hard
              </button>
              <button
                onClick={() => onScheduleFilterChange("soft")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  scheduleFilter === "soft"
                    ? "bg-white text-[#2E3192] shadow-sm"
                    : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                }`}
              >
                Soft
              </button>
            </div>

            {/* Group by Facility Toggle */}
            {onGroupByFacilityChange && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onGroupByFacilityChange(false)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    !groupByFacility
                      ? "bg-white text-[var(--primary-blue)] shadow-sm"
                      : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                  }`}
                >
                  Combined
                </button>
                <button
                  onClick={() => onGroupByFacilityChange(true)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    groupByFacility
                      ? "bg-white text-purple-600 shadow-sm"
                      : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                  }`}
                >
                  By Facility
                </button>
              </div>
            )}

            {/* Process Expansion Toggle */}
            {onShowExpandedProcessesChange && (
              <ProcessViewToggle
                showExpanded={showExpandedProcesses}
                onToggle={onShowExpandedProcessesChange}
              />
            )}

            {/* Mobile View Toggle (Cards vs Table) - Only visible on mobile */}
            {onMobileViewModeChange && (
              <div className="flex md:hidden items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onMobileViewModeChange("cards")}
                  className={`p-2 rounded-md transition-all ${
                    mobileViewMode === "cards"
                      ? "bg-white text-[var(--dark-blue)] shadow-sm"
                      : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                  }`}
                  title="Card view (mobile)"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onMobileViewModeChange("table")}
                  className={`p-2 rounded-md transition-all ${
                    mobileViewMode === "table"
                      ? "bg-white text-[var(--primary-blue)] shadow-sm"
                      : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
                  }`}
                  title="Table view (mobile)"
                >
                  <Table2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}


        {/* Dynamic Field Filters - Advanced Mode Only */}
        {filterViewMode === "advanced" && onDynamicFieldFiltersChange && onDynamicFieldFilterLogicChange && (
          <div className="w-full">
            <DynamicFieldFilter
              filters={dynamicFieldFilters}
              onChange={onDynamicFieldFiltersChange}
              filterLogic={dynamicFieldFilterLogic}
              onFilterLogicChange={onDynamicFieldFilterLogicChange}
              jobs={jobs}
            />
          </div>
        )}

        {/* Fourth Row - View Notes, Bulk Upload, Data Health & Export PDF (Advanced Mode Only) */}
        {filterViewMode === "advanced" && (
          <div className="flex gap-3 justify-start">
            {onShowNotesChange && (
              <button
                onClick={() => onShowNotesChange(!showNotes)}
                className={`px-6 py-2 rounded-lg font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${
                  showNotes
                    ? "bg-[var(--primary-blue)] text-white hover:bg-[var(--dark-blue)]"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                {showNotes ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide Notes
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    View Notes
                  </>
                )}
              </button>
            )}
            {onBulkUpload && (
              <button
                onClick={onBulkUpload}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Add Bulk Jobs
              </button>
            )}
            <DataHealthPopup facilitiesId={facilitiesId ?? null} />
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm whitespace-nowrap"
              >
                Export PDF
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
