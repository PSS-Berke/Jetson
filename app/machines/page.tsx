'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMachines } from '@/hooks/useMachines';
import AddJobModal from '../components/AddJobModal';
import FacilityToggle from '../components/FacilityToggle';

export default function Machines() {
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFacility, setFilterFacility] = useState<number | null>(null); // Default to All
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const { machines, isLoading: machinesLoading, error: machinesError } = useMachines(filterStatus, filterFacility || undefined);
  const { logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
  };

  const handleFacilityChange = (facility: number | null) => {
    setFilterFacility(facility);
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
                className="px-4 py-2 rounded-lg font-medium transition-colors bg-[var(--primary-blue)] text-white"
              >
                Machines
              </Link>
              <Link
                href="/projections"
                className="px-4 py-2 rounded-lg font-medium transition-colors text-[var(--text-dark)] hover:bg-gray-100"
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
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors border border-blue-200 flex items-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Job
              </button>

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
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-[var(--border)]">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Production Lines</h2>
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
      </main>

      {/* Add Job Modal */}
      <AddJobModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
