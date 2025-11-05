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

export default function ProjectionsPage() {
  const [granularity, setGranularity] = useState<Granularity>('weekly');
  const [startDate, setStartDate] = useState<Date>(getStartOfWeek());
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

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
    weekRanges,
    jobProjections,
    serviceSummaries,
    grandTotals,
    filteredJobProjections,
    processTypeCounts,
    isLoading,
    error,
    refetch,
  } = useProjections(startDate, filters);

  console.log('[DEBUG] ProjectionsPage - processTypeCounts received:', processTypeCounts);
  console.log('[DEBUG] ProjectionsPage - filteredJobProjections count:', filteredJobProjections.length);

  // Handle granularity change and adjust start date accordingly
  const handleGranularityChange = (newGranularity: Granularity) => {
    setGranularity(newGranularity);

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
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">
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
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total Jobs</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {filteredJobProjections.length}
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
              {serviceSummaries.map(summary => (
                <div key={summary.serviceType} className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                  <div className="text-sm text-[var(--text-light)]">{summary.serviceType}</div>
                  <div className="text-2xl font-bold text-[var(--dark-blue)]">
                    {summary.grandTotal.toLocaleString()}
                  </div>
                </div>
              ))}

              {/* Process Type Tiles */}
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total Inserted</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.insert}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total Sort</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.sort}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total IJ</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.ij}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total L/A</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.la}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total Fold</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.fold}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total Laser</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.laser}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4">
                <div className="text-sm text-[var(--text-light)]">Total HP Press</div>
                <div className="text-2xl font-bold text-[var(--dark-blue)]">
                  {processTypeCounts.hpPress}
                </div>
              </div>
            </div>

            {/* Projections Table */}
            <ProjectionsTable
              timeRanges={timeRanges}
              jobProjections={filteredJobProjections}
              serviceSummaries={serviceSummaries}
              grandTotals={grandTotals}
              onRefresh={refetch}
            />

            {/* Embedded Calendar */}
            <div className="mt-8">
              <EmbeddedCalendar
                startDate={startDate}
                selectedFacility={selectedFacility}
                selectedClients={selectedClients}
                selectedServiceTypes={selectedServiceTypes}
                height={550}
              />
            </div>
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
