'use client';

import { useState } from 'react';
import { type ParsedJob } from '@/hooks/useJobs';
import { deleteJob } from '@/lib/api';
import EditJobModal from './EditJobModal';
import Toast from './Toast';

interface JobDetailsModalProps {
  isOpen: boolean;
  job: ParsedJob | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function JobDetailsModal({ isOpen, job, onClose, onRefresh }: JobDetailsModalProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [deletedJobNumber, setDeletedJobNumber] = useState<number | null>(null);

  if (!isOpen || !job) return null;

  const handleEdit = () => {
    setIsEditModalOpen(true);
  };

  const handleEditClose = () => {
    setIsEditModalOpen(false);
  };

  const handleEditSuccess = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const jobNum = job.job_number;
      const jobIdValue = job.id;

      // Validation check
      if (!jobIdValue || jobIdValue === 0) {
        throw new Error(`Invalid job ID: ${jobIdValue}`);
      }

      await deleteJob(jobIdValue);

      setShowDeleteConfirm(false);
      setDeletedJobNumber(jobNum);
      setShowDeleteToast(true);
      onClose();

      // Delay refresh to show toast
      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }
      }, 500);
    } catch (error) {
      console.error('Error deleting job:', error);
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error occurred';

      alert(`Failed to delete job #${job.job_number}.\n\nError: ${errorMessage}\n\nPlease check the console for details or contact support.`);

      // Keep the confirmation dialog open so user can try again or cancel
      // setShowDeleteConfirm(false); // Don't close on error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

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
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Facility</label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.facilities_id === 1 ? 'Bolingbrook' : job.facilities_id === 2 ? 'Lemont' : 'N/A'}
                </p>
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
            {job.parsedRequirements && job.parsedRequirements.length > 0 && job.parsedRequirements.some(req => req.price_per_m) ? (
              <div className="space-y-4">
                {job.parsedRequirements.map((req, index) => {
                  const pricePerM = parseFloat(req.price_per_m || '0');
                  const requirementTotal = (job.quantity / 1000) * pricePerM;

                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-dark)]">Requirement {index + 1}</p>
                          <p className="text-xs text-[var(--text-light)] mt-1">
                            {req.process_type} | {req.paper_size}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-[var(--text-light)]">${pricePerM.toFixed(2)}/m</p>
                          <p className="text-base font-semibold text-[var(--text-dark)]">${requirementTotal.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="border-t-2 border-[var(--primary-blue)] pt-4 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-[var(--text-dark)]">Total Job Price:</span>
                    <span className="text-2xl font-bold text-[var(--primary-blue)]">
                      ${job.parsedRequirements.reduce((total, req) => {
                        const pricePerM = parseFloat(req.price_per_m || '0');
                        return total + ((job.quantity / 1000) * pricePerM);
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-base text-[var(--text-light)]">
                <p>No pricing information available for this job.</p>
                <p className="text-xs mt-2">(This job may have been created before the new pricing structure)</p>
              </div>
            )}
          </div>

          {/* Requirements Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">Requirements Details</h3>
            {job.parsedRequirements && job.parsedRequirements.length > 0 ? (
              <div className="space-y-4">
                {job.parsedRequirements.map((req, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-[var(--dark-blue)] mb-3">Requirement {index + 1}</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Process Type</label>
                        <p className="text-base text-[var(--text-dark)]">{req.process_type || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Paper Size</label>
                        <p className="text-base text-[var(--text-dark)]">{req.paper_size || 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Pockets</label>
                        <p className="text-base text-[var(--text-dark)]">{req.pockets ?? 'N/A'}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Shift</label>
                        <p className="text-base text-[var(--text-dark)]">
                          {req.shifts_id === 1 ? 'Shift One' : req.shifts_id === 2 ? 'Shift Two' : 'N/A'}
                        </p>
                      </div>
                      {req.price_per_m && (
                        <div>
                          <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">Price (per/m)</label>
                          <p className="text-base text-[var(--text-dark)]">${parseFloat(req.price_per_m).toFixed(2)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-base text-[var(--text-light)]">No specific requirements</p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] pt-6 flex justify-between gap-3">
            <button
              onClick={handleDeleteClick}
              className="px-6 py-2 border-2 border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-50 transition-colors"
            >
              Delete Job
            </button>
            <div className="flex gap-3">
              <button
                onClick={handleEdit}
                className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Edit Job
              </button>
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div className="absolute inset-0 bg-black/50" onClick={handleDeleteCancel} />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative z-10">
            <h3 className="text-xl font-bold text-[var(--dark-blue)] mb-4">Confirm Delete</h3>
            <p className="text-[var(--text-dark)] mb-6">
              Are you sure you want to delete <strong>Job #{job.job_number}</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Job Modal */}
      <EditJobModal
        isOpen={isEditModalOpen}
        job={job}
        onClose={handleEditClose}
        onSuccess={handleEditSuccess}
      />

      {/* Delete Success Toast */}
      {showDeleteToast && deletedJobNumber && (
        <Toast
          message={`Job #${deletedJobNumber} deleted successfully!`}
          type="success"
          onClose={() => setShowDeleteToast(false)}
        />
      )}
    </div>
  );
}
