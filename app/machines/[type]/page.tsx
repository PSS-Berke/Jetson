'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMachines } from '@/hooks/useMachines';
import FacilityToggle from '../../components/FacilityToggle';
import PageHeader from '../../components/PageHeader';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Machine } from '@/types';
import { getProcessTypeConfig } from '@/lib/processTypeConfig';

// Dynamically import modals - only loaded when opened
const AddJobModal = dynamic(() => import('../../components/AddJobModal'), {
  ssr: false,
});

const EditMachineModal = dynamic(() => import('../../components/EditMachineModal'), {
  ssr: false,
});

const DynamicFormBuilderModal = dynamic(() => import('../../components/DynamicFormBuilderModal'), {
  ssr: false,
});

// Machine type configurations
const machineTypeConfig: Record<string, {
  label: string;
  filterFn: (machine: Machine) => boolean;
}> = {
  'inserters': {
    label: 'Inserter Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('inserter')
  },
  'folders': {
    label: 'Folder Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('folder') || machine.type.toLowerCase().includes('fold')
  },
  'hp-press': {
    label: 'HP Press Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('hp') || machine.type.toLowerCase().includes('press')
  },
  'inkjetters': {
    label: 'Inkjet Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('inkjet')
  },
  'affixers': {
    label: 'Affixer Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('affixer') || machine.type.toLowerCase().includes('affix')
  }
};

export default function MachineTypePage() {
  const params = useParams();
  const machineType = params.type as string;
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [filterFacility, setFilterFacility] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const { user, isLoading: userLoading } = useUser();
  const { machines, isLoading: machinesLoading, error: machinesError, refetch } = useMachines(filterStatus, filterFacility || undefined);
  const { logout } = useAuth();

  const handleFacilityChange = (facility: number | null) => {
    setFilterFacility(facility);
  };

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
  };

  const handleMachineClick = (machine: Machine) => {
    setSelectedMachine(machine);
  };

  const handleMachineModalClose = () => {
    setSelectedMachine(null);
    refetch(filterStatus, filterFacility || undefined);
  };

  // Helper to render capability values
  const renderCapabilityValue = (machine: Machine, capabilityKey: string): string => {
    if (!machine.capabilities || !machine.capabilities[capabilityKey]) {
      return 'N/A';
    }

    const value = machine.capabilities[capabilityKey];

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'N/A';
    }

    return String(value);
  };

  // Get relevant capability columns for a machine
  const getCapabilityColumns = (machine: Machine): string[] => {
    const processConfig = machine.process_type_key ? getProcessTypeConfig(machine.process_type_key) : null;
    if (!processConfig) return [];

    // Get the first 2-3 most important fields (skip price_per_m)
    return processConfig.fields
      .filter(field => field.name !== 'price_per_m')
      .slice(0, 2)
      .map(field => field.name);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Get configuration for this machine type
  const config = machineTypeConfig[machineType];
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Invalid machine type</div>
      </div>
    );
  }

  // Filter machines by type
  const filteredMachines = machines.filter(config.filterFn);

  const statusColors = {
    running: 'bg-blue-100 text-blue-800 border-blue-200',
    available: 'bg-green-100 text-green-800 border-green-200',
    avalible: 'bg-green-100 text-green-800 border-green-200',
    maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  };

  const statusLabels = {
    running: 'Running',
    available: 'Available',
    avalible: 'Available',
    maintenance: 'Maintenance'
  };

  return (
    <>
      <PageHeader
        currentPage="machines"
        user={user}
        onAddJobClick={() => setIsJobModalOpen(true)}
        showAddJobButton={true}
        onLogout={logout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/machines" className="text-[var(--primary-blue)] hover:underline">
                Machines
              </Link>
            </li>
            <li className="text-[var(--text-light)]">/</li>
            <li className="text-[var(--text-dark)] font-medium capitalize">{machineType.replace('-', ' ')}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-6 border-b border-[var(--border)] gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">{config.label}</h2>
            <FacilityToggle
              currentFacility={filterFacility}
              onFacilityChange={handleFacilityChange}
              showAll={true}
            />
          </div>
          <button
            onClick={() => setIsFormBuilderOpen(true)}
            className="px-4 py-2 bg-[#E31E24] text-white rounded-lg hover:bg-[#C01A1F] transition-colors font-medium flex items-center gap-2 border-2 border-[#E31E24]"
          >
            <span className="text-lg">+</span>
            Form
          </button>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleFilterChange('')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === ''
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('running')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'running'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            Running
          </button>
          <button
            onClick={() => handleFilterChange('avalible')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'avalible'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => handleFilterChange('maintenance')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'maintenance'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            Maintenance
          </button>
        </div>

        {/* Machines Table */}
        {machinesError ? (
          <div className="text-center py-12">
            <div className="text-red-600">Error loading machines: {machinesError}</div>
          </div>
        ) : machinesLoading ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)]">Loading machines...</div>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)] text-lg">No machines found</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Facility
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Line
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Process
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Cap 1
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Cap 2
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Speed/hr
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Shift Capacity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Current Job
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {filteredMachines.map(machine => {
                    const capabilityKeys = getCapabilityColumns(machine);
                    const processConfig = machine.process_type_key ? getProcessTypeConfig(machine.process_type_key) : null;

                    return (
                      <tr
                        key={machine.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleMachineClick(machine)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                          {machine.facilities_id === 1 ? 'Bolingbrook' : machine.facilities_id === 2 ? 'Lemont' : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-dark)]">
                          Line {machine.line}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                          {machine.type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                          {processConfig ? processConfig.label : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[machine.status]}`}>
                            {statusLabels[machine.status]}
                          </span>
                        </td>
                        {capabilityKeys.map((key, idx) => {
                          const field = processConfig?.fields.find(f => f.name === key);
                          const capKey = field?.type === 'dropdown' ? `supported_${key}s` :
                                       field?.type === 'number' ? `max_${key}` : key;
                          return (
                            <td key={idx} className="px-6 py-4 text-sm text-[var(--text-dark)]">
                              {renderCapabilityValue(machine, capKey)}
                            </td>
                          );
                        })}
                        {capabilityKeys.length < 2 && (
                          <td className="px-6 py-4 text-sm text-[var(--text-dark)]">N/A</td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                          {machine.speed_hr ? `${machine.speed_hr}/hr` : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                          {machine.shiftCapacity ? machine.shiftCapacity.toLocaleString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                          {machine.currentJob ? (
                            <span>Job #{machine.currentJob.number} - {machine.currentJob.name}</span>
                          ) : (machine.status === 'available' || machine.status === 'avalible') ? (
                            <span className="text-[var(--success)]">Ready for next job</span>
                          ) : (
                            <span className="text-[var(--text-light)]">No active job</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredMachines.map(machine => {
                const processConfig = machine.process_type_key ? getProcessTypeConfig(machine.process_type_key) : null;

                return (
                  <div
                    key={machine.id}
                    className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleMachineClick(machine)}
                  >
                    {/* Machine Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-base font-semibold text-[var(--text-dark)]">
                          Line {machine.line}
                        </div>
                        <div className="text-sm text-[var(--text-light)] mt-1">
                          {machine.type} {processConfig ? `(${processConfig.label})` : ''}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[machine.status]}`}>
                        {statusLabels[machine.status]}
                      </span>
                    </div>

                    {/* Machine Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <div className="text-xs text-[var(--text-light)]">Facility</div>
                        <div className="font-medium text-[var(--text-dark)]">
                          {machine.facilities_id === 1 ? 'Bolingbrook' : machine.facilities_id === 2 ? 'Lemont' : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-light)]">Speed/hr</div>
                        <div className="font-medium text-[var(--text-dark)]">
                          {machine.speed_hr ? `${machine.speed_hr}/hr` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-light)]">Shift Capacity</div>
                        <div className="font-medium text-[var(--text-dark)]">
                          {machine.shiftCapacity ? machine.shiftCapacity.toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Current Job */}
                    <div className="border-t border-[var(--border)] pt-3">
                      <div className="text-xs text-[var(--text-light)] mb-1">Current Job</div>
                      <div className="text-sm text-[var(--text-dark)]">
                        {machine.currentJob ? (
                          <span>Job #{machine.currentJob.number} - {machine.currentJob.name}</span>
                        ) : (machine.status === 'available' || machine.status === 'avalible') ? (
                          <span className="text-[var(--success)]">Ready for next job</span>
                        ) : (
                          <span className="text-[var(--text-light)]">No active job</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <AddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} />

      {/* Edit Machine Modal */}
      <EditMachineModal
        isOpen={selectedMachine !== null}
        machine={selectedMachine}
        onClose={handleMachineModalClose}
        onSuccess={handleMachineModalClose}
      />

      {/* Dynamic Form Builder Modal */}
      <DynamicFormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
      />
    </>
  );
}

