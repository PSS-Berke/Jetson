"use client";

import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import { useJobsV2 } from "@/hooks/useJobsV2";
import { useProduction } from "@/hooks/useProduction";
import {
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  addWeeks,
  addDays,
  addMonths,
  format,
} from "date-fns";
import { useReactToPrint } from "react-to-print";
import PageHeader from "../components/PageHeader";
import FacilityToggle from "../components/FacilityToggle";
import ProductionGranularityToggle from "../components/ProductionGranularityToggle";
import ProductionComparisonTable from "../components/ProductionComparisonTable";
import ProductionCharts from "../components/ProductionCharts";
import ProductionSummaryCards from "../components/ProductionSummaryCards";
import ProductionFilters from "../components/ProductionFilters";
import ProductionPDFHeader from "../components/ProductionPDFHeader";
import ProductionPDFSummary from "../components/ProductionPDFSummary";
import ProductionPDFTable from "../components/ProductionPDFTable";
import { calculateProductionSummary } from "@/lib/productionUtils";
import { applyDynamicFieldFilters } from "@/lib/dynamicFieldFilters";
import type { ProductionComparison } from "@/types";

// Dynamically import modals - only loaded when opened
const AddJobModal = dynamic(() => import("../components/AddJobModal"), {
  ssr: false,
});

const EditProductionEntryModal = dynamic(
  () => import("../components/EditProductionEntryModal"),
  {
    ssr: false,
  },
);

const ExcelProductionUploadModal = dynamic(
  () => import("../components/ExcelProductionUploadModal"),
  {
    ssr: false,
  },
);

type GranularityType = "day" | "week" | "month";

export default function ProductionPage() {
  const [granularity, setGranularity] = useState<GranularityType>("week");
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isExcelUploadModalOpen, setIsExcelUploadModalOpen] = useState(false);
  const [selectedComparison, setSelectedComparison] =
    useState<ProductionComparison | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<"table" | "analytics">("table");

  // Filter states
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"and" | "or">("and");
  const [scheduleFilter, setScheduleFilter] = useState<
    "all" | "confirmed" | "soft"
  >("all");
  const [filterViewMode, setFilterViewMode] = useState<"simple" | "advanced">(
    "simple",
  );
  const [dataDisplayMode, setDataDisplayMode] = useState<"pieces" | "revenue">(
    "pieces",
  );
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">(
    "table",
  );
  const [dynamicFieldFilters, setDynamicFieldFilters] = useState<import("@/types").DynamicFieldFilter[]>([]);
  const [dynamicFieldFilterLogic, setDynamicFieldFilterLogic] = useState<"and" | "or">("and");
  const [showOnlyInDateRange, setShowOnlyInDateRange] = useState(true);

  // PDF export ref
  const printRef = useRef<HTMLDivElement>(null);

  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();

  // Calculate date range based on granularity
  const { startDate, endDate } = useMemo(() => {
    if (granularity === "week") {
      // Get the week for the current date
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday
      return {
        startDate: weekStart.getTime(),
        endDate: weekEnd.getTime(),
      };
    } else if (granularity === "month") {
      // Get the month for the current date
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        startDate: monthStart.getTime(),
        endDate: monthEnd.getTime(),
      };
    } else {
      // Get current day
      const dayStart = startOfDay(currentDate);
      const dayEnd = endOfDay(currentDate);
      return {
        startDate: dayStart.getTime(),
        endDate: dayEnd.getTime(),
      };
    }
  }, [granularity, currentDate]);

  // Fetch jobs and production data using v2 API with search support
  const {
    jobs,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useJobsV2({
    facilities_id: selectedFacility || 0,
    search: searchQuery.trim() || "", // Pass search to API (empty string if no search)
    fetchAll: true, // Fetch all jobs for production tracking
  });
  const {
    comparisons,
    productionEntries,
    isLoading: productionLoading,
    refetch: refetchProduction,
  } = useProduction({
    facilitiesId: selectedFacility || undefined,
    startDate,
    endDate,
    // Pass search so production comparisons are limited to API search results
    search: searchQuery.trim() || "",
  });

  const isLoading = jobsLoading || productionLoading;

  // Map process type labels to their normalized keys for comparison
  const getProcessTypeKey = (label: string): string => {
    const labelToKeyMap: Record<string, string> = {
      "Data": "data",
      "HP": "hp",
      "Laser": "laser",
      "Fold": "fold",
      "Affix with Glue": "affix",
      "Insert": "insert",
      "Ink Jet": "inkjet",
      "Labeling": "labeling",
    };
    return labelToKeyMap[label] || label.toLowerCase();
  };

  // Filter comparisons based on selected filters
  const filteredComparisons = useMemo(() => {
    return comparisons.filter((comparison) => {
      const job = comparison.job;

      // Date range filter - when showOnlyInDateRange is true, only show jobs with activity
      // Skip date range filter when searching - show all search results regardless of date range
      if (showOnlyInDateRange && !searchQuery.trim()) {
        const hasActivity = comparison.projected_quantity > 0 || comparison.actual_quantity > 0;
        if (!hasActivity) return false;
      }

      // Search is handled by API, so skip client-side search filtering
      // (API already filtered results based on searchQuery)

      // Schedule filter
      if (scheduleFilter !== "all") {
        const isConfirmed =
          (job as any).confirmed === true || (job as any).confirmed === 1;
        if (scheduleFilter === "confirmed" && !isConfirmed) return false;
        if (scheduleFilter === "soft" && isConfirmed) return false;
      }

      // Client filter
      const clientMatch =
        selectedClients.length === 0 ||
        (job.client && selectedClients.includes(job.client.id));

      // Process type filter
      const processTypeMatch =
        selectedServiceTypes.length === 0 ||
        (job.requirements &&
          job.requirements.some((req) => {
            if (!req.process_type) return false;
            // Normalize the requirement's process type
            const { normalizeProcessType } = require("@/lib/processTypeConfig");
            const normalizedReqType = normalizeProcessType(req.process_type);
            // Convert selected labels to keys and check if any match
            return selectedServiceTypes.some(
              (selectedLabel) => getProcessTypeKey(selectedLabel) === normalizedReqType
            );
          }));

      // Dynamic field filter
      const dynamicFieldMatch =
        dynamicFieldFilters.length === 0 ||
        applyDynamicFieldFilters(job, dynamicFieldFilters, dynamicFieldFilterLogic);

      // Apply filter mode (AND/OR)
      if (filterMode === "and") {
        // For AND mode: must match all active filters
        const activeFilters = [
          selectedClients.length > 0,
          selectedServiceTypes.length > 0,
          dynamicFieldFilters.length > 0,
        ];

        // If no filters are active, show all (after search)
        if (!activeFilters.some((f) => f)) return true;

        // Must match all active filters
        return (
          (!activeFilters[0] || clientMatch) &&
          (!activeFilters[1] || processTypeMatch) &&
          (!activeFilters[2] || dynamicFieldMatch)
        );
      } else {
        // For OR mode: must match at least one active filter
        const activeFilters = [
          selectedClients.length > 0,
          selectedServiceTypes.length > 0,
          dynamicFieldFilters.length > 0,
        ];

        // If no filters are active, show all (after search)
        if (!activeFilters.some((f) => f)) return true;

        // Must match at least one active filter
        return (
          (activeFilters[0] && clientMatch) ||
          (activeFilters[1] && processTypeMatch) ||
          (activeFilters[2] && dynamicFieldMatch)
        );
      }
    });
  }, [
    comparisons,
    selectedClients,
    selectedServiceTypes,
    searchQuery,
    filterMode,
    scheduleFilter,
    dynamicFieldFilters,
    dynamicFieldFilterLogic,
    showOnlyInDateRange,
  ]);

  // Handle successful batch entry
  const handleBatchEntrySuccess = async () => {
    await refetchProduction();
  };

  // Handle successful job creation
  const handleJobCreated = async () => {
    await refetchJobs();
  };

  // Handle successful production entry edit
  const handleProductionEntryEdited = async () => {
    await refetchProduction();
  };

  // Handle successful Excel upload
  const handleExcelUploadSuccess = async () => {
    await refetchProduction();
    setIsExcelUploadModalOpen(false);
  };

  // Handle clicking on a comparison row to edit
  const handleEditComparison = (comparison: ProductionComparison) => {
    setSelectedComparison(comparison);
    setIsEditModalOpen(true);
  };

  // Navigate time period
  const handlePreviousPeriod = () => {
    if (granularity === "week") {
      setCurrentDate((prev) => addWeeks(prev, -1));
    } else if (granularity === "month") {
      setCurrentDate((prev) => addMonths(prev, -1));
    } else {
      setCurrentDate((prev) => addDays(prev, -1));
    }
  };

  const handleNextPeriod = () => {
    if (granularity === "week") {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else if (granularity === "month") {
      setCurrentDate((prev) => addMonths(prev, 1));
    } else {
      setCurrentDate((prev) => addDays(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Handle custom date range selection
  const handleDateRangeChange = (range: { start: Date; end: Date }) => {
    // Set the current date to the start of the selected range
    setCurrentDate(range.start);
  };

  // Format date range for display
  const dateRangeDisplay = useMemo(() => {
    if (granularity === "week") {
      return `${format(new Date(startDate), "MMM d, yyyy")} - ${format(new Date(endDate), "MMM d, yyyy")}`;
    } else if (granularity === "month") {
      return format(new Date(startDate), "MMMM yyyy");
    } else {
      return format(new Date(startDate), "EEEE, MMMM d, yyyy");
    }
  }, [granularity, startDate, endDate]);

  // Calculate summary for PDF export
  const summary = useMemo(() => {
    return calculateProductionSummary(filteredComparisons);
  }, [filteredComparisons]);

  // Get client names for PDF header
  const selectedClientNames = useMemo(() => {
    return jobs
      .filter((job) => job.client && selectedClients.includes(job.client.id))
      .map((job) => job.client?.name || "Unknown")
      .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
  }, [jobs, selectedClients]);

  // PDF print handler
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Production_Report_${format(new Date(startDate), "yyyy-MM-dd")}`,
    onBeforePrint: () => {
      return new Promise((resolve) => {
        // Give content time to render
        setTimeout(resolve, 100);
      });
    },
    pageStyle: `
      @page {
        size: landscape;
        margin: 20mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
        .pdf-header,
        .pdf-summary,
        .pdf-table {
          page-break-inside: avoid;
        }
      }
    `,
  });

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader
        currentPage="production"
        user={user}
        onLogout={logout}
        onAddJobClick={() => setIsAddJobModalOpen(true)}
        showAddJobButton={true}
      />

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header Section with Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
              Production Tracking
            </h2>
            <FacilityToggle
              currentFacility={selectedFacility}
              onFacilityChange={setSelectedFacility}
            />
          </div>
          <div className="flex items-center gap-3">
            <ProductionGranularityToggle
              currentGranularity={granularity}
              onGranularityChange={setGranularity}
            />
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)] no-print overflow-x-auto">
          <button
            onClick={() => setActiveView("table")}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              activeView === "table"
                ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setActiveView("analytics")}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              activeView === "analytics"
                ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
            }`}
          >
            Analytics
          </button>
        </div>

        {/* Filters */}
        <ProductionFilters
          jobs={jobs}
          selectedClients={selectedClients}
          onClientsChange={setSelectedClients}
          selectedServiceTypes={selectedServiceTypes}
          onServiceTypesChange={setSelectedServiceTypes}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterMode={filterMode}
          onFilterModeChange={setFilterMode}
          scheduleFilter={scheduleFilter}
          onScheduleFilterChange={setScheduleFilter}
          filterViewMode={filterViewMode}
          onFilterViewModeChange={setFilterViewMode}
          dataDisplayMode={dataDisplayMode}
          onDataDisplayModeChange={setDataDisplayMode}
          mobileViewMode={mobileViewMode}
          onMobileViewModeChange={setMobileViewMode}
          granularity={granularity}
          dateRangeDisplay={dateRangeDisplay}
          onPreviousPeriod={handlePreviousPeriod}
          onNextPeriod={handleNextPeriod}
          onToday={handleToday}
          startDate={new Date(startDate)}
          endDate={new Date(endDate)}
          onDateRangeChange={handleDateRangeChange}
          onExportPDF={handlePrint}
          onBulkUpload={() => setIsExcelUploadModalOpen(true)}
          dynamicFieldFilters={dynamicFieldFilters}
          onDynamicFieldFiltersChange={setDynamicFieldFilters}
          dynamicFieldFilterLogic={dynamicFieldFilterLogic}
          onDynamicFieldFilterLogicChange={setDynamicFieldFilterLogic}
          showOnlyInDateRange={showOnlyInDateRange}
          onDateRangeToggleChange={setShowOnlyInDateRange}
        />

        {/* Loading State */}
        {isLoading && (
          <div className="bg-white rounded-lg shadow p-12 text-center mb-6">
            <div className="text-gray-600">Loading production data...</div>
          </div>
        )}

        {/* Content - Only show when not loading */}
        {!isLoading && (
          <>
            {/* Show helpful message if no production data and no comparisons */}
            {comparisons.length === 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  Welcome to Production Tracking
                </h3>
                <p className="text-blue-800 mb-4">
                  This page allows you to track actual production quantities and
                  compare them against projections.
                </p>
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">
                    To get started:
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-blue-800">
                    <li>
                      Make sure your backend has the{" "}
                      <code className="bg-blue-100 px-2 py-1 rounded">
                        production_entries
                      </code>{" "}
                      table configured
                    </li>
                    <li>
                      Click the &quot;Batch Entry&quot; button to enter
                      production data for jobs
                    </li>
                    <li>View analytics, charts, and performance metrics</li>
                    <li>See adjusted projections on the Projections page</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Show message when filters result in no data */}
            {comparisons.length > 0 && filteredComparisons.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  No Results Found
                </h3>
                <p className="text-yellow-800">
                  No production data matches your current filters. Try adjusting
                  your search criteria or clearing some filters.
                </p>
              </div>
            )}

            {/* Table View */}
            {activeView === "table" && filteredComparisons.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="mb-6">
                  <ProductionSummaryCards comparisons={filteredComparisons} />
                </div>

                {/* Comparison Table */}
                <div className="mb-6">
                  <ProductionComparisonTable
                    comparisons={filteredComparisons}
                    onEdit={handleEditComparison}
                    isBatchMode={isBatchMode}
                    onToggleBatchMode={() => setIsBatchMode(!isBatchMode)}
                    onBatchSave={handleBatchEntrySuccess}
                    startDate={startDate}
                    endDate={endDate}
                    facilitiesId={selectedFacility || undefined}
                    granularity={granularity}
                    dataDisplayMode={dataDisplayMode}
                  />
                </div>
              </>
            )}

            {/* Analytics View */}
            {activeView === "analytics" && filteredComparisons.length > 0 && (
              <>
                {/* Charts */}
                <div className="mb-6">
                  <ProductionCharts comparisons={filteredComparisons} />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Hidden PDF Export Content */}
      <div className="hidden">
        <div ref={printRef} className="p-8 bg-white">
          <ProductionPDFHeader
            dateRange={{ start: new Date(startDate), end: new Date(endDate) }}
            granularity={granularity}
            facility={selectedFacility}
            selectedClients={selectedClientNames}
            selectedProcessTypes={selectedServiceTypes}
            searchQuery={searchQuery}
            filterMode={filterMode.toUpperCase() as "AND" | "OR"}
          />
          <ProductionPDFSummary summary={summary} />
          <ProductionPDFTable comparisons={filteredComparisons} />
        </div>
      </div>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isAddJobModalOpen}
        onClose={() => setIsAddJobModalOpen(false)}
        onSuccess={handleJobCreated}
      />

      {/* Edit Production Entry Modal */}
      <EditProductionEntryModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleProductionEntryEdited}
        comparison={selectedComparison}
        startDate={startDate}
        endDate={endDate}
        facilitiesId={selectedFacility || undefined}
      />

      {/* Excel Upload Modal */}
      <ExcelProductionUploadModal
        isOpen={isExcelUploadModalOpen}
        onClose={() => setIsExcelUploadModalOpen(false)}
        onSuccess={handleExcelUploadSuccess}
        jobs={jobs}
        facilitiesId={selectedFacility || undefined}
        existingEntries={productionEntries}
      />
    </div>
  );
}
