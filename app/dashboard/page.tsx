'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useJobs } from '@/hooks/useJobs';
import AddJobModal from '../components/AddJobModal';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const { jobs, isLoading: jobsLoading, error: jobsError } = useJobs();
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
                className="px-4 py-2 rounded-lg font-medium transition-colors bg-[var(--primary-blue)] text-white"
              >
                Dashboard
              </Link>
              <Link
                href="/machines"
                className="px-4 py-2 rounded-lg font-medium transition-colors text-[var(--text-dark)] hover:bg-gray-100"
              >
                Machines
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Jobs</h2>
        </div>

        {jobsError ? (
          <div className="text-center py-12">
            <div className="text-red-600">Error loading jobs: {jobsError}</div>
          </div>
        ) : jobsLoading ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)]">Loading jobs...</div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)] text-lg">No jobs found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Job #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Service Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Start Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                    Machines
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-dark)]">
                      {job.job_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                        {job.service_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.quantity.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                      {job.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {new Date(job.start_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {new Date(job.due_date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.machines.map((m) => `Line ${m.line}`).join(', ')}
                    </td>
                  </tr>
                ))}
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
