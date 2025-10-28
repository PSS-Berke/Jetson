'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMachines } from '@/hooks/useMachines';
import { useCalendarJobs } from '@/hooks/useCalendarJobs';
import { useMachineCapacity } from '@/hooks/useMachineCapacity';
import { useCalendarFilters } from '@/hooks/useCalendarFilters';
import { CalendarViewType, CapacityDisplayMode } from '@/types/calendar';
import { getMonthRange, getWeekRange, getDayRange } from '@/lib/dateUtils';
import { getDayBreakdown } from '@/lib/calendarUtils';
import CalendarView from '@/app/components/CalendarView';
import ViewToggle from '@/app/components/ViewToggle';
import CalendarFilters from '@/app/components/CalendarFilters';
import MachineCapacityPanel from '@/app/components/MachineCapacityPanel';
import DayDetailsModal from '@/app/components/DayDetailsModal';

export default function CalendarPage() {
  const router = useRouter();

  // State
  const [viewType, setViewType] = useState<CalendarViewType>('month');
  const [displayMode, setDisplayMode] = useState<CapacityDisplayMode>('sidebar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get date range based on view type
  const dateRange = useMemo(() => {
    switch (viewType) {
      case 'month':
        return getMonthRange(currentDate);
      case 'week':
        return getWeekRange(currentDate);
      case 'day':
        return getDayRange(currentDate);
      default:
        return getMonthRange(currentDate);
    }
  }, [viewType, currentDate]);

  // Hooks
  const { machines, isLoading: machinesLoading } = useMachines();
  const {
    filters,
    setSelectedMachines,
    setSelectedClients,
    setSelectedServiceTypes,
    selectAllMachines,
    selectNoMachines,
    clearFilters
  } = useCalendarFilters();

  const { filteredJobs, events, isLoading: jobsLoading } = useCalendarJobs({
    machines,
    startDate: dateRange.start,
    endDate: dateRange.end,
    selectedMachines: filters.selectedMachines,
    selectedClients: filters.selectedClients,
    selectedServiceTypes: filters.selectedServiceTypes
  });

  const {
    machineCapacities,
    dailySummaries,
    overallUtilization
  } = useMachineCapacity({
    jobs: filteredJobs,
    machines,
    startDate: dateRange.start,
    endDate: dateRange.end
  });

  // Get day breakdown for modal
  const dayBreakdown = useMemo(() => {
    if (!selectedDate) return null;
    return getDayBreakdown(selectedDate, filteredJobs, machines);
  }, [selectedDate, filteredJobs, machines]);

  // Handlers
  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
  };

  const handleMachineClick = (machineId: number) => {
    const isSelected = filters.selectedMachines.includes(machineId);
    if (isSelected) {
      setSelectedMachines(filters.selectedMachines.filter(id => id !== machineId));
    } else {
      setSelectedMachines([...filters.selectedMachines, machineId]);
    }
  };

  const isLoading = machinesLoading || jobsLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-[var(--border)] sticky top-0 z-40">
        <div className="max-w-[1920px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Title and Navigation */}
            <div className="flex items-center gap-6">
              <h1 className="text-2xl font-bold text-[var(--dark-blue)]">Jobs Calendar</h1>
              <nav className="flex gap-4">
                <button
                  onClick={() => router.push('/dashboard')}
                  className="text-sm font-semibold text-[var(--text-light)] hover:text-[var(--primary-blue)]"
                >
                  Jobs
                </button>
                <span className="text-[var(--text-light)]">|</span>
                <button
                  onClick={() => router.push('/machines')}
                  className="text-sm font-semibold text-[var(--text-light)] hover:text-[var(--primary-blue)]"
                >
                  Machines
                </button>
                <span className="text-[var(--text-light)]">|</span>
                <span className="text-sm font-semibold text-[var(--primary-blue)]">
                  Calendar
                </span>
              </nav>
            </div>

            {/* View Controls */}
            <div className="flex items-center gap-4">
              {/* Overall Utilization Badge */}
              <div className="px-4 py-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-[var(--text-light)]">Overall Utilization</p>
                <p className="text-lg font-bold text-[var(--primary-blue)]">
                  {overallUtilization}%
                </p>
              </div>

              {/* View Toggle */}
              <ViewToggle
                currentView={viewType}
                onViewChange={setViewType}
              />

              {/* Display Mode Toggle */}
              <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-1">
                <button
                  onClick={() => setDisplayMode('sidebar')}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                    displayMode === 'sidebar'
                      ? 'bg-[var(--primary-blue)] text-white shadow-sm'
                      : 'text-[var(--text-dark)] hover:bg-gray-100'
                  }`}
                >
                  Sidebar
                </button>
                <button
                  onClick={() => setDisplayMode('overlay')}
                  className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                    displayMode === 'overlay'
                      ? 'bg-[var(--primary-blue)] text-white shadow-sm'
                      : 'text-[var(--text-dark)] hover:bg-gray-100'
                  }`}
                >
                  Overlay
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-[1920px] mx-auto px-6 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-blue)] mx-auto mb-4"></div>
              <p className="text-[var(--text-light)]">Loading calendar data...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Filters Sidebar */}
            <div className="col-span-3">
              <CalendarFilters
                machines={machines}
                jobs={filteredJobs}
                selectedMachines={filters.selectedMachines}
                selectedClients={filters.selectedClients}
                selectedServiceTypes={filters.selectedServiceTypes}
                onMachinesChange={setSelectedMachines}
                onClientsChange={setSelectedClients}
                onServiceTypesChange={setSelectedServiceTypes}
                onSelectAllMachines={() => selectAllMachines(machines.map(m => m.id))}
                onSelectNoMachines={selectNoMachines}
                onClearAll={clearFilters}
              />
            </div>

            {/* Calendar and Machine Panel */}
            <div className={displayMode === 'sidebar' ? 'col-span-6' : 'col-span-9'}>
              <CalendarView
                events={events}
                dailySummaries={dailySummaries}
                viewType={viewType}
                displayMode={displayMode}
                onDateClick={handleDateClick}
                onNavigate={setCurrentDate}
              />
            </div>

            {/* Machine Capacity Panel (only in sidebar mode) */}
            {displayMode === 'sidebar' && (
              <div className="col-span-3">
                <MachineCapacityPanel
                  machineCapacities={machineCapacities}
                  onMachineClick={handleMachineClick}
                  selectedMachineIds={filters.selectedMachines}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Day Details Modal */}
      <DayDetailsModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        dayBreakdown={dayBreakdown}
      />
    </div>
  );
}
