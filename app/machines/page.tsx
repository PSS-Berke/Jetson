'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMachines } from '@/hooks/useMachines';
import AddJobModal from '../components/AddJobModal';

type MachineStatus = 'running' | 'available' | 'avalible' | 'maintenance';

interface Machine {
  id: number;
  created_at: number;
  line: number;
  type: string;
  max_size: string;
  speed_hr: string;
  status: MachineStatus;
  pockets?: number;
  shiftCapacity?: number;
  currentJob?: {
    number: string;
    name: string;
  };
}

export default function Machines() {
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterFacility, setFilterFacility] = useState<number>(1); // Default to Bolingbrook (1)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const { machines, isLoading: machinesLoading, error: machinesError } = useMachines(filterStatus, filterFacility);
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

  const handleFacilityChange = (facility: number) => {
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
                href="/calendar"
                className="px-4 py-2 rounded-lg font-medium transition-colors text-[var(--text-dark)] hover:bg-gray-100"
              >
                Calendar
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
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Production Lines</h2>

            {/* Facility Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => handleFacilityChange(1)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterFacility === 1
                    ? 'bg-[var(--primary-blue)] text-white'
                    : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
                }`}
              >
                Bolingbrook
              </button>
              <button
                onClick={() => handleFacilityChange(2)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterFacility === 2
                    ? 'bg-[var(--primary-blue)] text-white'
                    : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
                }`}
              >
                Lemont
              </button>
            </div>
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

        {/* Machine Cards Grid */}
        {machinesError ? (
          <div className="text-center py-12">
            <div className="text-red-600">Error loading machines: {machinesError}</div>
          </div>
        ) : machinesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, index) => (
              <MachineCardSkeleton key={index} />
            ))}
          </div>
        ) : machines.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)] text-lg">No machines found</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {machines.map(machine => (
              <MachineCard key={machine.id} machine={machine} />
            ))}
          </div>
        )}
      </main>

      {/* Add Job Modal */}
      <AddJobModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}

function MachineCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-5 animate-pulse">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="h-6 bg-gray-200 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </div>
        <div className="h-6 bg-gray-200 rounded w-20"></div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-12"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-8"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-200 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-20"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-200 rounded w-20 mb-2"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border)]">
        <div className="h-3 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-5 bg-gray-200 rounded w-full"></div>
      </div>
    </div>
  );
}

function MachineCard({ machine }: { machine: Machine }) {
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
    <div className={`bg-white rounded-lg shadow-sm border border-[var(--border)] p-5 hover:shadow-md transition-shadow ${
      machine.status === 'running' ? 'border-l-4 border-l-blue-500' :
      (machine.status === 'available' || machine.status === 'avalible') ? 'border-l-4 border-l-green-500' :
      'border-l-4 border-l-yellow-500'
    }`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="text-xl font-bold text-[var(--dark-blue)]">Line {machine.line}</div>
          <div className="text-sm text-[var(--text-light)]">{machine.type}</div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColors[machine.status]}`}>
          {statusLabels[machine.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs text-[var(--text-light)] uppercase">Max Size</div>
          <div className="font-semibold text-[var(--text-dark)]">{machine.max_size || 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-light)] uppercase">Pockets</div>
          <div className="font-semibold text-[var(--text-dark)]">{machine.pockets || 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-light)] uppercase">Speed</div>
          <div className="font-semibold text-[var(--text-dark)]">{machine.speed_hr ? `${machine.speed_hr}/hr` : 'N/A'}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--text-light)] uppercase">Shift Cap.</div>
          <div className="font-semibold text-[var(--text-dark)]">{machine.shiftCapacity ? machine.shiftCapacity.toLocaleString() : 'N/A'}</div>
        </div>
      </div>

      <div className="pt-4 border-t border-[var(--border)]">
        {machine.currentJob ? (
          <>
            <div className="text-xs text-[var(--text-light)] uppercase mb-1">Current Job</div>
            <div className="font-semibold text-[var(--text-dark)]">
              Job #{machine.currentJob.number} - {machine.currentJob.name}
            </div>
          </>
        ) : (machine.status === 'available' || machine.status === 'avalible') ? (
          <div className="text-[var(--success)] font-semibold">Ready for next job</div>
        ) : (
          <div className="text-[var(--text-light)] font-semibold">No active job</div>
        )}
      </div>
    </div>
  );
}
