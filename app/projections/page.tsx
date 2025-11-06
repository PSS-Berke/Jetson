'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useProjections, type ProjectionFilters } from '@/hooks/useProjections';
import { getStartOfWeek } from '@/lib/projectionUtils';
import { startOfMonth, startOfQuarter } from 'date-fns';
import ProjectionFiltersComponent from '../components/ProjectionFilters';
import ProjectionsTable from '../components/ProjectionsTable';
import FacilityToggle from '../components/FacilityToggle';
import GranularityToggle, { type Granularity } from '../components/GranularityToggle';
import EmbeddedCalendar from '../components/EmbeddedCalendar';
import PageHeader from '../components/PageHeader';
import AddJobModal from '../components/AddJobModal';
import Pagination from '../components/Pagination';

type ViewMode = 'table' | 'calendar';

export default function ProjectionsPage() {
  const [granularity, setGranularity] = useState<Granularity>('weekly');
  const [startDate, setStartDate] = useState<Date>(getStartOfWeek());
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();

  const filters: ProjectionFilters = {
    facility: selectedFacility,
    clients: selectedClients,
    serviceTypes: selectedServiceTypes,
    searchQuery,
    granularity,
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
              {granularity === 'weekly' ? '5-Week' : granularity === 'monthly' ? '3-Month' : '4-Quarter'} Projections
            </h2>
            <FacilityToggle
              currentFacility={selectedFacility}
              onFacilityChange={setSelectedFacility}
            />
          </div>
          <GranularityToggle
            currentGranularity={granularity}
            onGranularityChange={handleGranularityChange}
          />
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)] overflow-x-auto">
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
        </div>

        {/* Filters */}
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
        />

        {/* Content */}
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
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredJobProjections.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                />
              </>
            )}

            {/* Calendar View */}
            {viewMode === 'calendar' && (
              <div className="space-y-4">
                {/* Process Type Legend */}
                <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--dark-blue)] mb-3">Process Type Colors</h3>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#3B82F6' }}></div>
                      <span className="text-sm text-[var(--text-light)]">Insert</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#10B981' }}></div>
                      <span className="text-sm text-[var(--text-light)]">Sort</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#F59E0B' }}></div>
                      <span className="text-sm text-[var(--text-light)]">Inkjet</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#8B5CF6' }}></div>
                      <span className="text-sm text-[var(--text-light)]">Label/Apply</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#EC4899' }}></div>
                      <span className="text-sm text-[var(--text-light)]">Fold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#EF4444' }}></div>
                      <span className="text-sm text-[var(--text-light)]">Laser</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded border border-gray-200" style={{ backgroundColor: '#14B8A6' }}></div>
                      <span className="text-sm text-[var(--text-light)]">HP Press</span>
                    </div>
                  </div>
                </div>

                {/* Calendar */}
                <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6">
                  <EmbeddedCalendar
                    startDate={startDate}
                    selectedFacility={selectedFacility}
                    selectedClients={selectedClients}
                    selectedServiceTypes={selectedServiceTypes}
                    height={800}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
      />
    </>
  );
}
