'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMachines } from '@/hooks/useMachines';
import AddJobModal from '../components/AddJobModal';
import FacilityToggle from '../components/FacilityToggle';
import PageHeader from '../components/PageHeader';
import Link from 'next/link';

const machineTypes = [
  {
    name: 'Inserters',
    description: 'High-speed insertion machines',
    path: '/machines/inserters'
  },
  {
    name: 'Folders',
    description: 'Document folding equipment',
    path: '/machines/folders'
  },
  {
    name: 'HP Press',
    description: 'High-performance printing press',
    path: '/machines/hp-press'
  },
  {
    name: 'Inkjetters',
    description: 'Inkjet printing systems',
    path: '/machines/inkjetters'
  },
  {
    name: 'Affixers',
    description: 'Label and stamp affixing machines',
    path: '/machines/affixers'
  }
];

export default function Machines() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterFacility, setFilterFacility] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const { user, isLoading: userLoading } = useUser();
  const { machines, isLoading: machinesLoading, error: machinesError } = useMachines(filterStatus, filterFacility || undefined);
  const { logout } = useAuth();

  const handleFacilityChange = (facility: number | null) => {
    setFilterFacility(facility);
  };

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
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
        currentPage="machines"
        user={user}
        onAddJobClick={() => setIsModalOpen(true)}
        showAddJobButton={true}
        onLogout={logout}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">
              {filterFacility === null ? 'Machine Types' : 'Production Lines'}
            </h2>
            <FacilityToggle
              currentFacility={filterFacility}
              onFacilityChange={handleFacilityChange}
              showAll={true}
            />
          </div>
        </div>

        {filterFacility === null ? (
          // Machine Type Tiles - shown when "All" is selected
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {machineTypes.map((machine) => (
              <Link
                key={machine.name}
                href={machine.path}
                className="group"
              >
                <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 hover:shadow-md hover:border-[var(--primary-blue)] transition-all duration-200 cursor-pointer h-full">
                  <div className="flex flex-col items-center text-center">
                    <h3 className="text-xl font-semibold text-[var(--dark-blue)] mb-2">
                      {machine.name}
                    </h3>
                    <p className="text-[var(--text-light)] text-sm">
                      {machine.description}
                    </p>
                    <div className="mt-4 text-[var(--primary-blue)] font-medium group-hover:translate-x-1 transition-transform duration-200">
                      View Machines →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          // Table View - shown when a specific facility is selected
          <>
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
                <div className="text-[var(--text-light)]">Loading machines...</div>
              </div>
            ) : machines.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-[var(--text-light)] text-lg">No machines found</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
                  <thead className="bg-gray-50">
                    <tr>
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
                        Max Size
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                        Pockets
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
                    {machines.map(machine => {
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
                        <tr key={machine.id} className="hover:bg-gray-50 transition-colors">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                            {machine.max_size || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                            {machine.pockets || 'N/A'}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>

      {/* Add Job Modal */}
      <AddJobModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
