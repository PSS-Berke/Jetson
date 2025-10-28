'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarFilters } from '@/types/calendar';

const STORAGE_KEY = 'calendar_filters';

interface UseCalendarFiltersReturn {
  filters: CalendarFilters;
  setSelectedMachines: (machines: number[]) => void;
  setSelectedClients: (clients: number[]) => void;
  setSelectedServiceTypes: (types: string[]) => void;
  setSelectedCSRs: (csrs: string[]) => void;
  setSelectedProgramCadences: (cadences: string[]) => void;
  setDateRange: (range: { start: Date; end: Date } | undefined) => void;
  clearFilters: () => void;
  toggleMachine: (machineId: number) => void;
  selectAllMachines: (allMachineIds: number[]) => void;
  selectNoMachines: () => void;
}

const defaultFilters: CalendarFilters = {
  selectedMachines: [],
  selectedClients: [],
  selectedServiceTypes: [],
  selectedCSRs: [],
  selectedProgramCadences: [],
  dateRange: undefined
};

/**
 * Hook for managing calendar filters with localStorage persistence
 */
export const useCalendarFilters = (): UseCalendarFiltersReturn => {
  const [filters, setFilters] = useState<CalendarFilters>(defaultFilters);

  // Load filters from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        if (parsed.dateRange) {
          parsed.dateRange = {
            start: new Date(parsed.dateRange.start),
            end: new Date(parsed.dateRange.end)
          };
        }
        setFilters(parsed);
      }
    } catch (error) {
      console.error('Error loading calendar filters:', error);
    }
  }, []);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    } catch (error) {
      console.error('Error saving calendar filters:', error);
    }
  }, [filters]);

  const setSelectedMachines = useCallback((machines: number[]) => {
    setFilters(prev => ({ ...prev, selectedMachines: machines }));
  }, []);

  const setSelectedClients = useCallback((clients: number[]) => {
    setFilters(prev => ({ ...prev, selectedClients: clients }));
  }, []);

  const setSelectedServiceTypes = useCallback((types: string[]) => {
    setFilters(prev => ({ ...prev, selectedServiceTypes: types }));
  }, []);

  const setSelectedCSRs = useCallback((csrs: string[]) => {
    setFilters(prev => ({ ...prev, selectedCSRs: csrs }));
  }, []);

  const setSelectedProgramCadences = useCallback((cadences: string[]) => {
    setFilters(prev => ({ ...prev, selectedProgramCadences: cadences }));
  }, []);

  const setDateRange = useCallback((range: { start: Date; end: Date } | undefined) => {
    setFilters(prev => ({ ...prev, dateRange: range }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing calendar filters:', error);
    }
  }, []);

  const toggleMachine = useCallback((machineId: number) => {
    setFilters(prev => {
      const machines = [...prev.selectedMachines];
      const index = machines.indexOf(machineId);
      if (index > -1) {
        machines.splice(index, 1);
      } else {
        machines.push(machineId);
      }
      return { ...prev, selectedMachines: machines };
    });
  }, []);

  const selectAllMachines = useCallback((allMachineIds: number[]) => {
    setFilters(prev => ({ ...prev, selectedMachines: allMachineIds }));
  }, []);

  const selectNoMachines = useCallback(() => {
    setFilters(prev => ({ ...prev, selectedMachines: [] }));
  }, []);

  return {
    filters,
    setSelectedMachines,
    setSelectedClients,
    setSelectedServiceTypes,
    setSelectedCSRs,
    setSelectedProgramCadences,
    setDateRange,
    clearFilters,
    toggleMachine,
    selectAllMachines,
    selectNoMachines
  };
};
