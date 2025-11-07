'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import { useProduction } from '@/hooks/useProduction';
import { startOfWeek, endOfWeek, startOfDay, endOfDay, addWeeks, addDays, format } from 'date-fns';
import PageHeader from '../components/PageHeader';
import FacilityToggle from '../components/FacilityToggle';
import ProductionComparisonTable from '../components/ProductionComparisonTable';
import ProductionCharts from '../components/ProductionCharts';
import ProductionSummaryCards from '../components/ProductionSummaryCards';
import type { ProductionComparison } from '@/types';

// Dynamically import modals - only loaded when opened
const BatchProductionEntryModal = dynamic(() => import('../components/BatchProductionEntryModal'), {
  ssr: false,
});

const AddJobModal = dynamic(() => import('../components/AddJobModal'), {
  ssr: false,
});

const EditProductionEntryModal = dynamic(() => import('../components/EditProductionEntryModal'), {
  ssr: false,
});

type GranularityType = 'day' | 'week';

export default function ProductionPage() {
  const [granularity, setGranularity] = useState<GranularityType>('week');
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedComparison, setSelectedComparison] = useState<ProductionComparison | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeView, setActiveView] = useState<'table' | 'analytics'>('table');

  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();

  // Calculate date range based on granularity
  const { startDate, endDate } = useMemo(() => {
    if (granularity === 'week') {
      // Get the week for the current date
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 }); // Sunday
      return {
        startDate: weekStart.getTime(),
        endDate: weekEnd.getTime(),
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

  // Fetch jobs and production data
  const { jobs, isLoading: jobsLoading, refetch: refetchJobs } = useJobs(selectedFacility);
  const {
    comparisons,
    isLoading: productionLoading,
    refetch: refetchProduction,
  } = useProduction({
    facilitiesId: selectedFacility || undefined,
    startDate,
    endDate,
  });

  const isLoading = jobsLoading || productionLoading;

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

  // Handle clicking on a comparison row to edit
  const handleEditComparison = (comparison: ProductionComparison) => {
    setSelectedComparison(comparison);
    setIsEditModalOpen(true);
  };

  // Navigate time period
  const handlePreviousPeriod = () => {
    if (granularity === 'week') {
      setCurrentDate((prev) => addWeeks(prev, -1));
    } else {
      setCurrentDate((prev) => addDays(prev, -1));
    }
  };

  const handleNextPeriod = () => {
    if (granularity === 'week') {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addDays(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Format date range for display
  const dateRangeDisplay = useMemo(() => {
    if (granularity === 'week') {
      return `${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`;
    } else {
      return format(new Date(startDate), 'EEEE, MMMM d, yyyy');
    }
  }, [granularity, startDate, endDate]);

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

      <main className="container mx-auto px-4 py-8">
        {/* Header Section */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Production Tracking</h1>
          <p className="text-gray-600">
            Track actual production against projections and analyze performance
          </p>
        </div>

        {/* Controls Section */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Left side - Facility & Granularity */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <FacilityToggle
                currentFacility={selectedFacility}
                onFacilityChange={setSelectedFacility}
              />

              {/* Granularity Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setGranularity('day')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    granularity === 'day'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setGranularity('week')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    granularity === 'week'
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Week
                </button>
              </div>
            </div>

            {/* Right side - Date Navigation & Batch Entry */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full lg:w-auto">
              {/* Date Navigation */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviousPeriod}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleToday}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Today
                </button>
                <button
                  onClick={handleNextPeriod}
                  className="px-3 py-2 bg-white border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium"
                >
                  Next →
                </button>
              </div>

              {/* Batch Entry Button */}
              <button
                onClick={() => setIsBatchModalOpen(true)}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium text-sm w-full sm:w-auto"
              >
                + Batch Entry
              </button>
            </div>
          </div>

          {/* Date Range Display */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Viewing: <span className="font-semibold text-gray-900">{dateRangeDisplay}</span>
            </p>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)] overflow-x-auto no-print">
          <button
            onClick={() => setActiveView('table')}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              activeView === 'table'
                ? 'text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]'
                : 'text-[var(--text-light)] hover:text-[var(--dark-blue)]'
            }`}
          >
            Table View
          </button>
          <button
            onClick={() => setActiveView('analytics')}
            className={`px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-medium transition-colors relative whitespace-nowrap ${
              activeView === 'analytics'
                ? 'text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]'
                : 'text-[var(--text-light)] hover:text-[var(--dark-blue)]'
            }`}
          >
            Analytics
          </button>
        </div>

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
                  This page allows you to track actual production quantities and compare them against projections.
                </p>
                <div className="bg-white rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-900 mb-2">To get started:</h4>
                  <ol className="list-decimal list-inside space-y-2 text-blue-800">
                    <li>Make sure your backend has the <code className="bg-blue-100 px-2 py-1 rounded">production_entries</code> table configured</li>
                    <li>Click the &quot;Batch Entry&quot; button to enter production data for jobs</li>
                    <li>View analytics, charts, and performance metrics</li>
                    <li>See adjusted projections on the Projections page</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Table View */}
            {activeView === 'table' && comparisons.length > 0 && (
              <>
                {/* Summary Cards */}
                <div className="mb-6">
                  <ProductionSummaryCards comparisons={comparisons} />
                </div>

                {/* Comparison Table */}
                <div className="mb-6">
                  <ProductionComparisonTable
                    comparisons={comparisons}
                    onEdit={handleEditComparison}
                  />
                </div>
              </>
            )}

            {/* Analytics View */}
            {activeView === 'analytics' && comparisons.length > 0 && (
              <>
                {/* Charts */}
                <div className="mb-6">
                  <ProductionCharts comparisons={comparisons} />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {/* Batch Production Entry Modal */}
      <BatchProductionEntryModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSuccess={handleBatchEntrySuccess}
        jobs={jobs}
        startDate={startDate}
        endDate={endDate}
        facilitiesId={selectedFacility || undefined}
        granularity={granularity}
      />

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
    </div>
  );
}
