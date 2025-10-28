'use client';

import { useState } from 'react';
import { Machine } from '@/types/calendar';
import { ParsedJob } from '@/hooks/useJobs';

interface CalendarFiltersProps {
  machines: Machine[];
  jobs: ParsedJob[];
  selectedMachines: number[];
  selectedClients: number[];
  selectedServiceTypes: string[];
  onMachinesChange: (machines: number[]) => void;
  onClientsChange: (clients: number[]) => void;
  onServiceTypesChange: (types: string[]) => void;
  onSelectAllMachines: () => void;
  onSelectNoMachines: () => void;
  onClearAll: () => void;
}

export default function CalendarFilters({
  machines,
  jobs,
  selectedMachines,
  selectedClients,
  selectedServiceTypes,
  onMachinesChange,
  onClientsChange,
  onServiceTypesChange,
  onSelectAllMachines,
  onSelectNoMachines,
  onClearAll
}: CalendarFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Get unique clients from jobs
  const uniqueClients = Array.from(
    new Map(jobs.map(job => [job.clients_id, job.client.name])).entries()
  ).map(([id, name]) => ({ id, name }));

  // Get unique service types from jobs
  const uniqueServiceTypes = Array.from(new Set(jobs.map(job => job.service_type)));

  const toggleMachine = (machineId: number) => {
    const newSelection = selectedMachines.includes(machineId)
      ? selectedMachines.filter(id => id !== machineId)
      : [...selectedMachines, machineId];
    onMachinesChange(newSelection);
  };

  const toggleClient = (clientId: number) => {
    const newSelection = selectedClients.includes(clientId)
      ? selectedClients.filter(id => id !== clientId)
      : [...selectedClients, clientId];
    onClientsChange(newSelection);
  };

  const toggleServiceType = (type: string) => {
    const newSelection = selectedServiceTypes.includes(type)
      ? selectedServiceTypes.filter(t => t !== type)
      : [...selectedServiceTypes, type];
    onServiceTypesChange(newSelection);
  };

  const hasActiveFilters =
    selectedMachines.length > 0 ||
    selectedClients.length > 0 ||
    selectedServiceTypes.length > 0;

  return (
    <div className="bg-white rounded-lg border border-[var(--border)] shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-[var(--dark-blue)]">Filters</h3>
          {hasActiveFilters && (
            <span className="px-2 py-1 bg-[var(--primary-blue)] text-white text-xs font-semibold rounded-full">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-sm text-[var(--accent-red)] hover:underline font-semibold"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-[var(--text-light)] hover:text-[var(--text-dark)]"
          >
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>

      {/* Filter Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Machine Filter */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-[var(--text-dark)]">
                Machines
              </label>
              <div className="flex gap-2">
                <button
                  onClick={onSelectAllMachines}
                  className="text-xs text-[var(--primary-blue)] hover:underline"
                >
                  All
                </button>
                <span className="text-xs text-[var(--text-light)]">|</span>
                <button
                  onClick={onSelectNoMachines}
                  className="text-xs text-[var(--primary-blue)] hover:underline"
                >
                  None
                </button>
              </div>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {machines.map(machine => (
                <label
                  key={machine.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedMachines.includes(machine.id)}
                    onChange={() => toggleMachine(machine.id)}
                    className="w-4 h-4 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-[var(--primary-blue)]"
                  />
                  <span className="text-sm text-[var(--text-dark)]">
                    Line {machine.line} - {machine.type}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Client Filter */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-dark)] mb-3">
              Clients
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {uniqueClients.map(client => (
                <label
                  key={client.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedClients.includes(client.id)}
                    onChange={() => toggleClient(client.id)}
                    className="w-4 h-4 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-[var(--primary-blue)]"
                  />
                  <span className="text-sm text-[var(--text-dark)]">
                    {client.name}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Service Type Filter */}
          <div>
            <label className="block text-sm font-semibold text-[var(--text-dark)] mb-3">
              Service Types
            </label>
            <div className="space-y-2">
              {uniqueServiceTypes.map(type => (
                <label
                  key={type}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceTypes.includes(type)}
                    onChange={() => toggleServiceType(type)}
                    className="w-4 h-4 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-[var(--primary-blue)]"
                  />
                  <span className="text-sm text-[var(--text-dark)] capitalize">
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
