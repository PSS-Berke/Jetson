'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMachines } from '@/hooks/useMachines';
import FacilityToggle from '../../components/FacilityToggle';
import PageHeader from '../../components/PageHeader';
import Link from 'next/link';
import type { Machine } from '@/types';
import { getProcessTypeConfig } from '@/lib/processTypeConfig';

// Dynamically import modals - only loaded when opened
const AddJobModal = dynamic(() => import('../../components/AddJobModal'), {
  ssr: false,
});

const EditMachineModal = dynamic(() => import('../../components/EditMachineModal'), {
  ssr: false,
});

export default function Inkjetters() {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
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

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Filter machines to only show inkjetters
  const inkjetters = machines.filter(machine =>
    machine.type.toLowerCase().includes('inkjet')
  );

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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/machines" className="text-[var(--primary-blue)] hover:underline">
                Machines
              </Link>
            </li>
            <li className="text-[var(--text-light)]">/</li>
            <li className="text-[var(--text-dark)] font-medium">Inkjetters</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Inkjet Machines</h2>
            <FacilityToggle
              currentFacility={filterFacility}
              onFacilityChange={handleFacilityChange}
              showAll={true}
            />
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex gap-2 mb-6 justify-between items-center">
          <div className="flex gap-2">
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
        </div>

        {/* Machines Table */}
        {machinesError ? (
          <div className="text-center py-12">
            <div className="text-red-600">Error loading machines: {machinesError}</div>
          </div>
        ) : machinesLoading ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)]">Loading inkjetters...</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Print Coverage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Paper Sizes
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
                {inkjetters.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-[var(--text-light)]">
                      No inkjetters found
                    </td>
                  </tr>
                ) : (
                  inkjetters.map(machine => (
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
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[machine.status]}`}>
                          {statusLabels[machine.status]}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                        {renderCapabilityValue(machine, 'supported_print_coverages')}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                        {renderCapabilityValue(machine, 'supported_paper_sizes')}
                      </td>
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
                  ))
                )}
              </tbody>
            </table>
          </div>
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
    </>
  );
}
