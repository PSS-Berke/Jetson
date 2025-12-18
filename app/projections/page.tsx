"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import { useProjections, type ProjectionFilters } from "@/hooks/useProjections";
import { getStartOfWeek } from "@/lib/projectionUtils";
import { startOfMonth, startOfQuarter, format } from "date-fns";
import {
  calculateCFOSummaryMetrics,
  calculateRevenueByClient,
  calculateRevenueByServiceType,
} from "@/lib/cfoUtils";
import { useReactToPrint } from "react-to-print";
import ProjectionFiltersComponent from "../components/ProjectionFilters";
import ProjectionsTable from "../components/ProjectionsTable";
import RevenueProjectionsTable from "../components/RevenueProjectionsTable";
import FacilityToggle from "../components/FacilityToggle";
import GranularityToggle, {
  type Granularity,
} from "../components/GranularityToggle";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import ProjectionsPDFHeader from "../components/ProjectionsPDFHeader";
import ProjectionsPDFSummary from "../components/ProjectionsPDFSummary";
import ProjectionsPDFTable from "../components/ProjectionsPDFTable";
import FinancialsPDFHeader from "../components/FinancialsPDFHeader";
import FinancialsPDFSummary from "../components/FinancialsPDFSummary";
import FinancialsPDFTables from "../components/FinancialsPDFTables";
import CFODashboard from "../components/CFODashboard";
import ProjectionsLoading from "../components/ProjectionsLoading";

// Dynamically import calendar and modals - only loaded when needed
const EmbeddedCalendar = dynamic(
  () => import("../components/EmbeddedCalendar"),
  {
    loading: () => (
      <div className="text-center py-12 text-[var(--text-light)]">
        Loading calendar...
      </div>
    ),
    ssr: false,
  },
);

const AddJobModal = dynamic(() => import("../components/AddJobModal"), {
  ssr: false,
});

const BulkJobUploadModal = dynamic(
  () => import("../components/BulkJobUploadModal"),
  {
    ssr: false,
  },
);

type ViewMode = "table" | "calendar" | "financials" | "revenue-table";

export default function ProjectionsPage() {
  const [granularity, setGranularity] = useState<Granularity>("week");
  const [startDate, setStartDate] = useState<Date>(getStartOfWeek());
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [scheduleFilter, setScheduleFilter] = useState<
    "all" | "confirmed" | "soft"
  >("all");
  const [filterMode, setFilterMode] = useState<"and" | "or">("and");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filterViewMode, setFilterViewMode] = useState<"simple" | "advanced">(
    "simple",
  );
  const [mobileViewMode, setMobileViewMode] = useState<"cards" | "table">(
    "cards",
  );
  const [globalTimeScrollIndex, setGlobalTimeScrollIndex] = useState(0);
  const [showExpandedProcesses, setShowExpandedProcesses] = useState(false);
  const [showOnlyInDateRange, setShowOnlyInDateRange] = useState(true);
  const [showNotes, setShowNotes] = useState(false);
  const [groupByFacility, setGroupByFacility] = useState(false);
  const [versionGroupingEnabled, setVersionGroupingEnabled] = useState(true);
  const [financialsSubView, setFinancialsSubView] = useState<"dashboard" | "revenue-table">("dashboard");
  const [dynamicFieldFilters, setDynamicFieldFilters] = useState<import("@/types").DynamicFieldFilter[]>([]);
  const [dynamicFieldFilterLogic, setDynamicFieldFilterLogic] = useState<"and" | "or">("and");

  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();

  // Debounce search query to avoid triggering API calls on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300); // 300ms debounce delay

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // PDF export refs
  const printRef = useRef<HTMLDivElement>(null);
  const financialsPrintRef = useRef<HTMLDivElement>(null);

  const filters: ProjectionFilters = {
    facility: selectedFacility,
    clients: selectedClients,
    serviceTypes: selectedServiceTypes,
    searchQuery: debouncedSearchQuery, // Use debounced value for API calls
    granularity,
    scheduleFilter,
    filterMode,
    showOnlyInDateRange,
    groupByFacility,
    dynamicFieldFilters,
    dynamicFieldFilterLogic,
  };

  const {
    timeRanges,
    jobProjections,
    serviceSummaries,
    processTypeSummaries,
    grandTotals,
    filteredJobProjections,
    processTypeCounts,
    totalRevenue,
    totalJobsInTimeframe,
    totalJobsFromAPI,
    lastModifiedByJob,
    isLoading,
    isServiceTypeLoadLoading,
    serviceTypeLoadData,
    error,
    refetch,
  } = useProjections(startDate, filters);

  console.log("[DEBUG] ProjectionsPage - startDate:", startDate);
  console.log("[DEBUG] ProjectionsPage - timeRanges:", timeRanges);
  console.log(
    "[DEBUG] ProjectionsPage - processTypeCounts received:",
    processTypeCounts,
  );
  console.log(
    "[DEBUG] ProjectionsPage - filteredJobProjections count:",
    filteredJobProjections.length,
  );
  console.log("[DEBUG] ProjectionsPage - totalRevenue:", totalRevenue);

  // Calculate paginated job projections from filtered results
  const paginatedJobProjections = itemsPerPage === -1
    ? filteredJobProjections  // Show all filtered items
    : filteredJobProjections.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      );

  // Reset to page 1 when filters change to avoid showing empty/invalid pages
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedClients,
    selectedServiceTypes,
    debouncedSearchQuery, // Use debounced value to avoid resetting on every keystroke
    selectedFacility,
    filterMode,
    scheduleFilter,
    dynamicFieldFilters,
    dynamicFieldFilterLogic,
  ]);

  // Automatically show all items when filtering by service type or dynamic field filters
  useEffect(() => {
    if (selectedServiceTypes.length > 0 || (dynamicFieldFilters && dynamicFieldFilters.length > 0)) {
      setItemsPerPage(-1); // Show all when filters are active
    }
  }, [selectedServiceTypes, dynamicFieldFilters]);

  // Handle granularity change and adjust start date accordingly
  const handleGranularityChange = (newGranularity: Granularity) => {
    setGranularity(newGranularity);
    setCurrentPage(1); // Reset to first page when granularity changes

    // Adjust start date to align with the new granularity
    switch (newGranularity) {
      case "month":
        setStartDate(startOfMonth(new Date()));
        break;
      case "quarter":
        setStartDate(startOfQuarter(new Date()));
        break;
      case "week":
      default:
        setStartDate(getStartOfWeek());
        break;
    }
  };

  // Map granularity to calendar view type
  const mapGranularityToViewType = (
    gran: Granularity,
  ): "month" | "week" | "day" | "quarter" => {
    switch (gran) {
      case "week":
        return "week";
      case "month":
        return "month";
      case "quarter":
        return "quarter"; // Show custom quarter view
      default:
        return "month";
    }
  };

  // PDF print handler for projections
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Projections_Report_${format(startDate, "yyyy-MM-dd")}`,
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

  // PDF print handler for financials
  const handleFinancialsPrint = useReactToPrint({
    contentRef: financialsPrintRef,
    documentTitle: `Financial_Analysis_${format(startDate, "yyyy-MM-dd")}`,
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
        .pdf-tables {
          page-break-inside: avoid;
        }
      }
    `,
  });

  // Calculate data for financials PDF export
  const financialsData = useMemo(() => {
    const jobs = filteredJobProjections.map((p) => p.job);
    const summary = calculateCFOSummaryMetrics(jobs);
    const topClients = calculateRevenueByClient(jobs).slice(0, 10);
    const serviceTypes = calculateRevenueByServiceType(jobs);

    // Calculate additional metrics
    const totalClients = new Set(jobs.map((j) => j.clients_id)).size;
    const primaryProcessType = serviceTypes[0]?.serviceType || "N/A";
    const revenuePerJob = jobs.length > 0 ? totalRevenue / jobs.length : 0;

    return {
      summary,
      topClients,
      serviceTypes,
      totalClients,
      primaryProcessType,
      revenuePerJob,
    };
  }, [filteredJobProjections, totalRevenue]);

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        currentPage="projections"
        user={user}
        showAddJobButton={true}
        onAddJobClick={() => setIsModalOpen(true)}
        onLogout={logout}
      />

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page Title */}
        <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)] mb-4 no-print">
          {granularity === "week"
            ? "5-Week"
            : granularity === "month"
              ? "3-Month"
              : "4-Quarter"}{" "}
          Projections
        </h2>

        {/* Toggles */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 no-print">
          <div className="flex items-center gap-3 order-2 sm:order-1">
            <FacilityToggle
              currentFacility={selectedFacility}
              onFacilityChange={setSelectedFacility}
            />
          </div>
          <div className="flex items-center gap-3 order-1 sm:order-2">
            <GranularityToggle
              currentGranularity={granularity}
              onGranularityChange={handleGranularityChange}
            />
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex justify-between items-center mb-6 border-b border-[var(--border)] no-print">
          <div className="flex gap-2 overflow-x-auto">
            <button
              onClick={() => setViewMode("table")}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
                viewMode === "table"
                  ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                  : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
                viewMode === "calendar"
                  ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                  : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
              }`}
            >
              Calendar View
            </button>
            <button
              onClick={() => setViewMode("financials")}
              className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
                viewMode === "financials"
                  ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                  : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
              }`}
            >
              Financials
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="no-print">
          <ProjectionFiltersComponent
            jobs={jobProjections.map((p) => p.job)}
            startDate={startDate}
            onStartDateChange={setStartDate}
            selectedClients={selectedClients}
            onClientsChange={setSelectedClients}
            selectedServiceTypes={selectedServiceTypes}
            onServiceTypesChange={setSelectedServiceTypes}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            granularity={granularity}
            scheduleFilter={scheduleFilter}
            onScheduleFilterChange={setScheduleFilter}
            filterMode={filterMode}
            onFilterModeChange={setFilterMode}
            filterViewMode={filterViewMode}
            onFilterViewModeChange={setFilterViewMode}
            mobileViewMode={mobileViewMode}
            onMobileViewModeChange={setMobileViewMode}
            showExpandedProcesses={showExpandedProcesses}
            onShowExpandedProcessesChange={setShowExpandedProcesses}
            showOnlyInDateRange={showOnlyInDateRange}
            onDateRangeToggleChange={setShowOnlyInDateRange}
            onExportPDF={
              viewMode === "financials" ? handleFinancialsPrint : handlePrint
            }
            onBulkUpload={() => setIsBulkUploadOpen(true)}
            showNotes={showNotes}
            onShowNotesChange={setShowNotes}
            groupByFacility={groupByFacility}
            onGroupByFacilityChange={setGroupByFacility}
            dynamicFieldFilters={dynamicFieldFilters}
            onDynamicFieldFiltersChange={setDynamicFieldFilters}
            dynamicFieldFilterLogic={dynamicFieldFilterLogic}
            onDynamicFieldFilterLogicChange={setDynamicFieldFilterLogic}
            facilitiesId={selectedFacility}
            versionGroupingEnabled={versionGroupingEnabled}
            onVersionGroupingChange={setVersionGroupingEnabled}
          />
        </div>

        {/* Content */}
        <div>
          {error ? (
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
                <div className="text-red-800 font-semibold text-lg mb-2">
                  Error Loading Projections
                </div>
                <div className="text-red-600 mb-4">{error}</div>
                <div className="text-sm text-red-700 mb-4">
                  This may be caused by corrupted data in the database. Check
                  the browser console for detailed error information, or check
                  your Xano backend logs for the /jobs endpoint.
                </div>
                <button
                  onClick={refetch}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : isLoading ? (
            <ProjectionsLoading />
          ) : (
            <>
              {/* Table View */}
              {viewMode === "table" && (
                <>
                  {/* Loading indicator for service type load - fixed height to prevent layout shift */}
                  <div className="mb-4 h-12 flex items-center justify-center">
                    {isServiceTypeLoadLoading && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex items-center space-x-3">
                        <div className="relative w-5 h-5">
                          <div 
                            className="absolute inset-0 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" 
                          />
                        </div>
                        <span className="text-sm text-blue-700 font-medium">
                          Loading service type data for selected timeframe...
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Projections Table */}
                  <ProjectionsTable
                    timeRanges={timeRanges}
                    jobProjections={paginatedJobProjections}
                    serviceSummaries={serviceSummaries}
                    processTypeSummaries={processTypeSummaries}
                    grandTotals={grandTotals}
                    onRefresh={refetch}
                    mobileViewMode={mobileViewMode}
                    globalTimeScrollIndex={globalTimeScrollIndex}
                    onGlobalTimeScrollIndexChange={setGlobalTimeScrollIndex}
                    showExpandedProcesses={showExpandedProcesses}
                    showNotes={showNotes}
                    onShowNotesChange={setShowNotes}
                    granularity={granularity}
                    fullFilteredProjections={jobProjections}
                    lastModifiedByJob={lastModifiedByJob}
                    versionGroupingEnabled={versionGroupingEnabled}
                    serviceTypeLoadData={serviceTypeLoadData}
                  />

                  {/* Pagination */}
                  <div className="no-print">
                    <Pagination
                      currentPage={currentPage}
                      totalItems={filteredJobProjections.length}
                      totalUnfilteredItems={jobProjections.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={setItemsPerPage}
                    />
                  </div>
                </>
              )}

              {/* Calendar View */}
              {viewMode === "calendar" && (
                <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6">
                  <EmbeddedCalendar
                    startDate={startDate}
                    selectedFacility={selectedFacility}
                    selectedServiceTypes={selectedServiceTypes}
                    searchQuery={searchQuery}
                    scheduleFilter={scheduleFilter}
                    filterMode={filterMode}
                    height={800}
                    viewType={mapGranularityToViewType(granularity)}
                  />
                </div>
              )}

              {/* Financials View */}
              {viewMode === "financials" && (
                <>
                  {/* Sub-tabs for Financials View */}
                  <div className="flex gap-2 mb-6 border-b border-[var(--border)]">
                    <button
                      onClick={() => setFinancialsSubView("dashboard")}
                      className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                        financialsSubView === "dashboard"
                          ? "text-green-700 border-b-2 border-green-600"
                          : "text-[var(--text-light)] hover:text-green-700"
                      }`}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => setFinancialsSubView("revenue-table")}
                      className={`px-4 py-2 text-sm font-medium transition-colors relative whitespace-nowrap ${
                        financialsSubView === "revenue-table"
                          ? "text-green-700 border-b-2 border-green-600"
                          : "text-[var(--text-light)] hover:text-green-700"
                      }`}
                    >
                      Revenue Table
                    </button>
                  </div>

                  {/* Dashboard Sub-view */}
                  {financialsSubView === "dashboard" && (
                    <CFODashboard
                      jobs={filteredJobProjections.map((p) => p.job)}
                      timeRanges={timeRanges}
                      totalRevenue={totalRevenue}
                      periodLabel={`Current ${granularity === "week" ? "6 Weeks" : granularity === "month" ? "6 Months" : "6 Quarters"}`}
                      previousPeriodLabel={`Previous ${granularity === "week" ? "6 Weeks" : granularity === "month" ? "6 Months" : "6 Quarters"}`}
                      startDate={startDate.getTime()}
                      endDate={
                        timeRanges.length > 0
                          ? timeRanges[timeRanges.length - 1].endDate.getTime()
                          : startDate.getTime()
                      }
                      facilitiesId={selectedFacility || undefined}
                      granularity={granularity}
                      selectedServiceTypes={selectedServiceTypes}
                      searchQuery={searchQuery}
                      filterMode={filterMode.toUpperCase() as "AND" | "OR"}
                      printRef={financialsPrintRef}
                    />
                  )}

                  {/* Revenue Table Sub-view */}
                  {financialsSubView === "revenue-table" && (
                    <>
                      <RevenueProjectionsTable
                        timeRanges={timeRanges}
                        jobProjections={paginatedJobProjections}
                        serviceSummaries={serviceSummaries}
                        processTypeSummaries={processTypeSummaries}
                        grandTotals={{
                          weeklyRevenues: (() => {
                            const revenueMap = new Map<string, number>();
                            filteredJobProjections.forEach((projection) => {
                              projection.weeklyRevenues.forEach((revenue, label) => {
                                revenueMap.set(label, (revenueMap.get(label) || 0) + revenue);
                              });
                            });
                            return revenueMap;
                          })(),
                          grandRevenue: totalRevenue,
                        }}
                        onRefresh={refetch}
                        mobileViewMode={mobileViewMode}
                        globalTimeScrollIndex={globalTimeScrollIndex}
                        onGlobalTimeScrollIndexChange={setGlobalTimeScrollIndex}
                        showExpandedProcesses={showExpandedProcesses}
                        showNotes={showNotes}
                        onShowNotesChange={setShowNotes}
                      />

                      {/* Pagination */}
                      <div className="no-print mt-4">
                        <Pagination
                          currentPage={currentPage}
                          totalItems={filteredJobProjections.length}
                          totalUnfilteredItems={jobProjections.length}
                          itemsPerPage={itemsPerPage}
                          onPageChange={setCurrentPage}
                          onItemsPerPageChange={setItemsPerPage}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </main>

      {/* Hidden PDF Export Content - Projections */}
      <div className="hidden">
        <div ref={printRef} className="p-8 bg-white">
          <ProjectionsPDFHeader
            startDate={startDate}
            granularity={granularity}
            facility={selectedFacility}
            selectedServiceTypes={selectedServiceTypes}
            searchQuery={searchQuery}
            scheduleFilter={scheduleFilter}
            filterMode={filterMode.toUpperCase() as "AND" | "OR"}
          />
          <ProjectionsPDFSummary
            totalJobs={totalJobsInTimeframe}
            totalRevenue={totalRevenue}
            totalQuantity={grandTotals.grandTotal}
            serviceTypeCount={serviceSummaries.length}
            averagePerPeriod={Math.round(
              grandTotals.grandTotal / timeRanges.length,
            )}
            granularity={granularity}
            processTypeCounts={processTypeCounts}
            serviceSummaries={serviceSummaries}
          />
          <ProjectionsPDFTable
            timeRanges={timeRanges}
            jobProjections={filteredJobProjections}
            serviceSummaries={serviceSummaries}
            grandTotals={grandTotals}
          />
        </div>
      </div>

      {/* Hidden PDF Export Content - Financials */}
      <div className="hidden">
        <div ref={financialsPrintRef} className="p-8 bg-white">
          <FinancialsPDFHeader
            dateRange={{
              start: startDate,
              end:
                timeRanges.length > 0
                  ? timeRanges[timeRanges.length - 1].endDate
                  : startDate,
            }}
            granularity={granularity}
            facility={selectedFacility}
            selectedServiceTypes={selectedServiceTypes}
            searchQuery={searchQuery}
            filterMode={filterMode.toUpperCase() as "AND" | "OR"}
          />
          <FinancialsPDFSummary
            summary={financialsData.summary}
            totalClients={financialsData.totalClients}
            primaryProcessType={financialsData.primaryProcessType}
            revenuePerJob={financialsData.revenuePerJob}
          />
          <FinancialsPDFTables
            topClients={financialsData.topClients}
            serviceTypes={financialsData.serviceTypes}
          />
        </div>
      </div>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
      />

      {/* Bulk Job Upload Modal */}
      <BulkJobUploadModal
        isOpen={isBulkUploadOpen}
        onClose={() => setIsBulkUploadOpen(false)}
        onSuccess={refetch}
      />
    </>
  );
}
