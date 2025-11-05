'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

export default function ProjectionsPage() {
  const [granularity, setGranularity] = useState<Granularity>('weekly');
  const [startDate, setStartDate] = useState<Date>(getStartOfWeek());
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    if (isProfileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isProfileMenuOpen]);

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="text-2xl font-bold text-[var(--primary-blue)]">JETSON</div>
              <div className="text-xl font-semibold text-[var(--dark-blue)]">Capacity Planning</div>
            </div>

            <nav className="flex gap-2">
              <Link
                href="/dashboard"
                className="px-4 py-2 rounded-lg font-medium transition-colors text-[var(--text-dark)] hover:bg-gray-100"
              >
                Jobs
              </Link>
              <Link
                href="/machines"
                className="px-4 py-2 rounded-lg font-medium transition-colors text-[var(--text-dark)] hover:bg-gray-100"
              >
                Machines
              </Link>
              <Link
                href="/projections"
                className="px-4 py-2 rounded-lg font-medium transition-colors bg-[var(--primary-blue)] text-white"
              >
                Projections
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              {user?.admin && (
                <button
                  onClick={() => router.push('/signup')}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                >
                  Create User
                </button>
              )}

              {/* Profile Menu */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label="Profile menu"
                >
                  <div className="w-9 h-9 rounded-full bg-[var(--primary-blue)] flex items-center justify-center text-white font-semibold">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <svg
                    className={`w-4 h-4 text-[var(--text-light)] transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50">
                    <div className="px-4 py-3 border-b border-[var(--border)]">
                      <div className="text-sm text-[var(--text-light)]">Logged in as</div>
                      <div className="text-sm font-medium text-[var(--text-dark)] truncate">{user?.email}</div>
                      {user?.admin && (
                        <span className="inline-block mt-1 text-xs text-blue-600 font-semibold">Admin</span>
                      )}
                    </div>
                    <button
                      onClick={logout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

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
            <div className="text-red-600">Error loading projections: {error}</div>
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
    </>
  );
}
