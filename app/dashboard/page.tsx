'use client';

import { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useJobs, type ParsedJob } from '@/hooks/useJobs';
import AddJobModal from '../components/AddJobModal';
import JobDetailsModal from '../components/JobDetailsModal';
import FacilityToggle from '../components/FacilityToggle';
import PageHeader from '../components/PageHeader';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ParsedJob | null>(null);
  const [isJobDetailsOpen, setIsJobDetailsOpen] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState<number | null>(null);
  const { user, isLoading: userLoading } = useUser();
  const { jobs, isLoading: jobsLoading, error: jobsError, refetch } = useJobs(selectedFacility);
  const { logout } = useAuth();

  const handleJobClick = (job: ParsedJob) => {
    setSelectedJob(job);
    setIsJobDetailsOpen(true);
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
        currentPage="jobs"
        user={user}
        onAddJobClick={() => setIsModalOpen(true)}
        showAddJobButton={true}
        onLogout={logout}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Jobs</h2>
            <FacilityToggle
              currentFacility={selectedFacility}
              onFacilityChange={setSelectedFacility}
            />
          </div>
        </div>

        {jobsError ? (
          <div className="text-center py-12">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
              <div className="text-red-800 font-semibold text-lg mb-2">Error Loading Jobs</div>
              <div className="text-red-600 mb-4">{jobsError}</div>
              <div className="text-sm text-red-700 mb-4">
                This may be caused by corrupted data in the database. Check the browser console for detailed error information,
                or check your Xano backend logs for the /jobs endpoint.
              </div>
              <button
                onClick={refetch}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Retry
              </button>
            </div>
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
                    Total Billing
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => handleJobClick(job)}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-dark)]">
                      {job.job_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.client?.name || 'Unknown'}
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
                      {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                      {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-[var(--text-dark)]">
                      ${parseFloat(job.total_billing || '0').toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={refetch}
      />

      {/* Job Details Modal */}
      <JobDetailsModal
        isOpen={isJobDetailsOpen}
        job={selectedJob}
        onClose={() => setIsJobDetailsOpen(false)}
        onRefresh={refetch}
      />
    </>
  );
}
