'use client';

import { useState, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useProjections, type ProjectionFilters } from '@/hooks/useProjections';
import { getStartOfWeek } from '@/lib/projectionUtils';
import { startOfMonth, startOfQuarter, format } from 'date-fns';
import {
  calculateCFOSummaryMetrics,
  calculateRevenueByClient,
  calculateRevenueByServiceType,
  comparePeriods,
} from '@/lib/cfoUtils';
import { useReactToPrint } from 'react-to-print';
import ProjectionFiltersComponent from '../components/ProjectionFilters';
import ProjectionsTable from '../components/ProjectionsTable';
import FacilityToggle from '../components/FacilityToggle';
import GranularityToggle, { type Granularity } from '../components/GranularityToggle';
import PageHeader from '../components/PageHeader';
import Pagination from '../components/Pagination';
import ProjectionsPDFHeader from '../components/ProjectionsPDFHeader';
import ProjectionsPDFSummary from '../components/ProjectionsPDFSummary';
import ProjectionsPDFTable from '../components/ProjectionsPDFTable';
import FinancialsPDFHeader from '../components/FinancialsPDFHeader';
import FinancialsPDFSummary from '../components/FinancialsPDFSummary';
import FinancialsPDFTables from '../components/FinancialsPDFTables';
import CFODashboard from '../components/CFODashboard';

// Dynamically import calendar and modals - only loaded when needed
const EmbeddedCalendar = dynamic(() => import('../components/EmbeddedCalendar'), {
  loading: () => <div className="text-center py-12 text-[var(--text-light)]">Loading calendar...</div>,
  ssr: false,
});

const AddJobModal = dynamic(() => import('../components/AddJobModal'), {
  ssr: false,
});

type ViewMode = 'table' | 'calendar' | 'financials';

export default function ProjectionsPage() {
  const [granularity, setGranularity] = useState<Granularity>('weekly');
  const [startDate, setStartDate] = useState<Date>(getStartOfWeek());
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState<'all' | 'confirmed' | 'soft'>('all');
  const [filterMode, setFilterMode] = useState<'and' | 'or'>('and');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();

  // PDF export refs
  const printRef = useRef<HTMLDivElement>(null);
  const financialsPrintRef = useRef<HTMLDivElement>(null);

  const filters: ProjectionFilters = {
    facility: selectedFacility,
    clients: selectedClients,
    serviceTypes: selectedServiceTypes,
    searchQuery,
    granularity,
    scheduleFilter,
    filterMode,
  };

  const {
    timeRanges,
    jobProjections,
    serviceSummaries,
    grandTotals,
    filteredJobProjections,
    processTypeCounts,
    totalRevenue,
    totalJobsInTimeframe,
    isLoading,
    error,
    refetch,
  } = useProjections(startDate, filters);

  console.log('[DEBUG] ProjectionsPage - processTypeCounts received:', processTypeCounts);
  console.log('[DEBUG] ProjectionsPage - filteredJobProjections count:', filteredJobProjections.length);

  // Calculate paginated job projections
  const indexOfLastJob = currentPage * itemsPerPage;
  const indexOfFirstJob = indexOfLastJob - itemsPerPage;
  const paginatedJobProjections = filteredJobProjections.slice(indexOfFirstJob, indexOfLastJob);

  // Handle granularity change and adjust start date accordingly
  const handleGranularityChange = (newGranularity: Granularity) => {
    setGranularity(newGranularity);
    setCurrentPage(1); // Reset to first page when granularity changes

    // Adjust start date to align with the new granularity
    switch (newGranularity) {
      case 'monthly':
        setStartDate(startOfMonth(new Date()));
        break;
      case 'quarterly':
        setStartDate(startOfQuarter(new Date()));
        break;
      case 'weekly':
      default:
        setStartDate(getStartOfWeek());
        break;
    }
  };

  // Map granularity to calendar view type
  const mapGranularityToViewType = (gran: Granularity): 'month' | 'week' | 'day' | 'quarterly' => {
    switch (gran) {
      case 'weekly':
        return 'week';
      case 'monthly':
        return 'month';
      case 'quarterly':
        return 'quarterly'; // Show custom quarterly view
      default:
        return 'month';
    }
  };

  // Get client names for PDF header
  const selectedClientNames = useMemo(() => {
    return jobProjections
      .filter(proj => proj.job.client && selectedClients.includes(proj.job.client.id))
      .map(proj => proj.job.client?.name || 'Unknown')
      .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
  }, [jobProjections, selectedClients]);

  // PDF print handler for projections
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Projections_Report_${format(startDate, 'yyyy-MM-dd')}`,
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
    documentTitle: `Financial_Analysis_${format(startDate, 'yyyy-MM-dd')}`,
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
    const jobs = filteredJobProjections.map(p => p.job);
    const summary = calculateCFOSummaryMetrics(jobs);
    const topClients = calculateRevenueByClient(jobs).slice(0, 10);
    const serviceTypes = calculateRevenueByServiceType(jobs);

    // Calculate additional metrics
    const totalClients = new Set(jobs.map(j => j.clients_id)).size;
    const primaryProcessType = serviceTypes[0]?.serviceType || 'N/A';
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 no-print">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
              {granularity === 'weekly' ? '5-Week' : granularity === 'monthly' ? '3-Month' : '4-Quarter'} Projections
            </h2>
            <FacilityToggle
              currentFacility={selectedFacility}
              onFacilityChange={setSelectedFacility}
            />
          </div>
          <div className="flex items-center gap-3">
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
            onClick={() => setViewMode('table')}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              viewMode === 'table'
                ? 'text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]'
                : 'text-[var(--text-light)] hover:text-[var(--dark-blue)]'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              viewMode === 'calendar'
                ? 'text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]'
                : 'text-[var(--text-light)] hover:text-[var(--dark-blue)]'
            }`}
          >
            Calendar View
          </button>
          <button
            onClick={() => setViewMode('financials')}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              viewMode === 'financials'
                ? 'text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]'
                : 'text-[var(--text-light)] hover:text-[var(--dark-blue)]'
            }`}
          >
            Financials
          </button>
          </div>
          <button
            onClick={viewMode === 'financials' ? handleFinancialsPrint : handlePrint}
            className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm whitespace-nowrap ml-4"
          >
            Export PDF
          </button>
        </div>

        {/* Filters */}
        <div className="no-print">
          <ProjectionFiltersComponent
            jobs={jobProjections.map(p => p.job)}
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
          />
        </div>

        {/* Content */}
        <div>
        {error ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
              <div className="text-red-800 font-semibold text-lg mb-2">Error Loading Projections</div>
              <div className="text-red-600 mb-4">{error}</div>
              <div className="text-sm text-red-700 mb-4">
                This may be caused by corrupted data in the database. Check the browser console for detailed error information,
                or check your Xano backend logs for the /jobs endpoint.
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
          <div className="text-center py-12">
            <div className="text-[var(--text-light)]">Loading projections...</div>
          </div>
        ) : (
          <>
            {/* Table View */}
            {viewMode === 'table' && (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Jobs</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {totalJobsInTimeframe}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Revenue</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Quantity</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {grandTotals.grandTotal.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Service Types</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {serviceSummaries.length}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">
                      Avg per {granularity === 'weekly' ? 'Week' : granularity === 'monthly' ? 'Month' : 'Quarter'}
                    </div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {Math.round(grandTotals.grandTotal / timeRanges.length).toLocaleString()}
                    </div>
                  </div>

                  {/* Service Type Tiles */}
                  {serviceSummaries.filter(summary => summary.serviceType.toLowerCase() !== 'insert').map(summary => (
                    <div key={summary.serviceType} className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                      <div className="text-sm text-[var(--text-light)]">{summary.serviceType}</div>
                      <div className="text-2xl font-bold text-[var(--dark-blue)]">
                        {summary.grandTotal.toLocaleString()} pcs
                      </div>
                      <div className="text-sm text-[var(--text-light)] mt-1">
                        {summary.jobCount} jobs
                      </div>
                    </div>
                  ))}

                  {/* Process Type Tiles */}
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Insert</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.insert.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.insert.jobs} jobs
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Sort</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.sort.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.sort.jobs} jobs
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Inkjet</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.inkjet.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.inkjet.jobs} jobs
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Label/Apply</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.labelApply.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.labelApply.jobs} jobs
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Fold</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.fold.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.fold.jobs} jobs
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total Laser</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.laser.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.laser.jobs} jobs
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                    <div className="text-sm text-[var(--text-light)]">Total HP Press</div>
                    <div className="text-2xl font-bold text-[var(--dark-blue)]">
                      {processTypeCounts.hpPress.pieces.toLocaleString()} pcs
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      {processTypeCounts.hpPress.jobs} jobs
                    </div>
                  </div>
                </div>

                {/* Projections Table */}
                <ProjectionsTable
                  timeRanges={timeRanges}
                  jobProjections={paginatedJobProjections}
                  serviceSummaries={serviceSummaries}
                  grandTotals={grandTotals}
                  onRefresh={refetch}
                />

                {/* Pagination */}
                <div className="no-print">
                  <Pagination
                    currentPage={currentPage}
                    totalItems={filteredJobProjections.length}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                    onItemsPerPageChange={setItemsPerPage}
                  />
                </div>
              </>
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6">
                <EmbeddedCalendar
                  startDate={startDate}
                  selectedFacility={selectedFacility}
                  selectedClients={selectedClients}
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
            {viewMode === 'financials' && (
              <CFODashboard
                jobs={filteredJobProjections.map(p => p.job)}
                timeRanges={timeRanges}
                totalRevenue={totalRevenue}
                periodLabel={`Current ${granularity === 'weekly' ? '6 Weeks' : granularity === 'monthly' ? '6 Months' : '6 Quarters'}`}
                previousPeriodLabel={`Previous ${granularity === 'weekly' ? '6 Weeks' : granularity === 'monthly' ? '6 Months' : '6 Quarters'}`}
                startDate={startDate.getTime()}
                endDate={timeRanges.length > 0 ? timeRanges[timeRanges.length - 1].endDate.getTime() : startDate.getTime()}
                facilitiesId={selectedFacility || undefined}
                granularity={granularity}
                selectedClients={selectedClientNames}
                selectedServiceTypes={selectedServiceTypes}
                searchQuery={searchQuery}
                filterMode={filterMode.toUpperCase() as 'AND' | 'OR'}
                printRef={financialsPrintRef}
              />
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
            selectedClients={selectedClientNames}
            selectedServiceTypes={selectedServiceTypes}
            searchQuery={searchQuery}
            scheduleFilter={scheduleFilter}
            filterMode={filterMode.toUpperCase() as 'AND' | 'OR'}
          />
          <ProjectionsPDFSummary
            totalJobs={totalJobsInTimeframe}
            totalRevenue={totalRevenue}
            totalQuantity={grandTotals.grandTotal}
            serviceTypeCount={serviceSummaries.length}
            averagePerPeriod={Math.round(grandTotals.grandTotal / timeRanges.length)}
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
              end: timeRanges.length > 0 ? timeRanges[timeRanges.length - 1].endDate : startDate
            }}
            granularity={granularity}
            facility={selectedFacility}
            selectedClients={selectedClientNames}
            selectedServiceTypes={selectedServiceTypes}
            searchQuery={searchQuery}
            filterMode={filterMode.toUpperCase() as 'AND' | 'OR'}
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
    </>
  );
}
