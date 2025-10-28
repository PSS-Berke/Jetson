'use client';

import { type ParsedJob } from '@/hooks/useJobs';

interface JobDetailsModalProps {
  isOpen: boolean;
  job: ParsedJob | null;
  onClose: () => void;
}

export default function JobDetailsModal({ isOpen, job, onClose }: JobDetailsModalProps) {
  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)] sticky top-0 bg-white">
          <div>
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Job Details</h2>
            <p className="text-sm text-[var(--text-light)] mt-1">Job #{job.job_number}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Job Information Section */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Job Information</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Job Number</label>
                <p className="text-base text-[var(--text-dark)]">{job.job_number}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Job Name</label>
                <p className="text-base text-[var(--text-dark)]">{job.job_name || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Client</label>
                <p className="text-base text-[var(--text-dark)]">{job.client?.name || 'Unknown'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Service Type</label>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {job.service_type}
                </span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Description</label>
                <p className="text-base text-[var(--text-dark)]">{job.description || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Quantity</label>
                <p className="text-base text-[var(--text-dark)]">{job.quantity.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Timeline</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Start Date</label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.start_date ? new Date(job.start_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Due Date</label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.due_date ? new Date(job.due_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Time Estimate</label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.time_estimate ? `${job.time_estimate} hours` : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* Staff Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Assignment</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">CSR</label>
                <p className="text-base text-[var(--text-dark)]">{job.csr || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Program Cadence</label>
                <p className="text-base text-[var(--text-dark)]">{job.prgm || 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* Machines Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Assigned Machines</h3>
            {job.machines && job.machines.length > 0 ? (
              <div className="space-y-2">
                {job.machines.map((machine, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-[var(--primary-blue)]"></div>
                    <span className="text-base text-[var(--text-dark)]">Line {machine.line}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-base text-[var(--text-light)]">No machines assigned</p>
            )}
          </div>

          {/* Pricing Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Pricing</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Price per M</label>
                <p className="text-base text-[var(--text-dark)]">${parseFloat(job.price_per_m || '0').toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Extended Price</label>
                <p className="text-base text-[var(--text-dark)]">${parseFloat(job.ext_price || '0').toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Add-on Charges</label>
                <p className="text-base text-[var(--text-dark)]">${parseFloat(job.add_on_charges || '0').toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Total Billing</label>
                <p className="text-lg font-semibold text-[var(--primary-blue)]">${parseFloat(job.total_billing || '0').toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Requirements Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Requirements</h3>
            <p className="text-sm text-[var(--text-light)] text-gray-600">{job.requirements || 'No specific requirements'}</p>
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] pt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
