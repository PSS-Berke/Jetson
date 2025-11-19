"use client";

import { useState } from "react";
import { type ParsedJob } from "@/hooks/useJobs";
import { deleteJob } from "@/lib/api";
import { getProcessTypeConfig } from "@/lib/processTypeConfig";
import EditJobModal from "./EditJobModal";
import Toast from "./Toast";
import JobRevisionHistoryModal from "./JobRevisionHistoryModal";

interface JobDetailsModalProps {
  isOpen: boolean;
  job: ParsedJob | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export default function JobDetailsModal({
  isOpen,
  job,
  onClose,
  onRefresh,
}: JobDetailsModalProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
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
      console.error("Error deleting job:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      alert(
        `Failed to delete job #${job.job_number}.\n\nError: ${errorMessage}\n\nPlease check the console for details or contact support.`,
      );

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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border)] sticky top-0 bg-white">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
              Job Details
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-light)] mt-1">
              Job #{job.job_number}
            </p>
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
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Job Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Job Number
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.job_number}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Facility
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.facilities_id === 1
                    ? "Bolingbrook"
                    : job.facilities_id === 2
                      ? "Lemont"
                      : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Job Name
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.job_name || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Client
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.client?.name || "Unknown"}
                </p>
              </div>
              {job.sub_client && (
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Sub Client
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {job.sub_client.name}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Service Type
                </label>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {job.service_type}
                </span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Description
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.description || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Quantity
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.quantity.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Timeline
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Start Date
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.start_date
                    ? new Date(job.start_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Due Date
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.due_date
                    ? new Date(job.due_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Time Estimate
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.time_estimate ? `${job.time_estimate} hours` : "N/A"}
                </p>
              </div>
            </div>

            {/* Weekly Quantity Distribution */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(job as any).weekly_split &&
              (job as any).weekly_split.length > 0 && (
                <div className="mt-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-[var(--dark-blue)]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Weekly Quantity Distribution (
                        {(job as any).weekly_split.length}{" "}
                        {(job as any).weekly_split.length === 1
                          ? "week"
                          : "weeks"}
                        )
                      </h4>
                      <div className="text-sm font-semibold text-[var(--text-dark)]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Total:{" "}
                        {(job as any).weekly_split
                          .reduce((sum: number, qty: number) => sum + qty, 0)
                          .toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(job as any).weekly_split.map(
                        (qty: number, index: number) => (
                          <div
                            key={index}
                            className="bg-white rounded-md p-3 border border-gray-200"
                          >
                            <div className="text-xs font-medium text-[var(--text-light)] mb-1">
                              Week {index + 1}
                            </div>
                            <div className="text-base font-semibold text-[var(--text-dark)]">
                              {qty.toLocaleString()}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Staff Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Assignment
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  CSR
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.csr || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Program Cadence
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.prgm || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Pricing
            </h3>
            {job.requirements && job.requirements.length > 0 ? (
              <div className="space-y-3">
                {/* Revenue per Process */}
                {(() => {
                  // Debug logging
                  console.log("[JobDetailsModal] Job data:", {
                    jobNumber: job.job_number,
                    quantity: job.quantity,
                    total_billing: job.total_billing,
                    add_on_charges: job.add_on_charges,
                    requirements: job.requirements,
                  });

                  // Calculate total revenue from requirements
                  const requirementsTotal = job.requirements.reduce(
                    (total, req) => {
                      // Handle "undefined" string, null, undefined, and empty string
                      const pricePerMStr = req.price_per_m;
                      const isValidPrice =
                        pricePerMStr &&
                        pricePerMStr !== "undefined" &&
                        pricePerMStr !== "null";
                      const pricePerM = isValidPrice
                        ? parseFloat(pricePerMStr)
                        : 0;
                      console.log(
                        `[JobDetailsModal] Requirement ${req.process_type}: price_per_m="${req.price_per_m}", parsed=${pricePerM}`,
                      );
                      return total + (job.quantity / 1000) * pricePerM;
                    },
                    0,
                  );

                  // Get the actual total billing
                  const totalBilling = parseFloat(job.total_billing || "0");
                  const addOnCharges = parseFloat(job.add_on_charges || "0");
                  const revenueWithoutAddOns = totalBilling - addOnCharges;

                  console.log("[JobDetailsModal] Calculations:", {
                    requirementsTotal,
                    totalBilling,
                    addOnCharges,
                    revenueWithoutAddOns,
                  });

                  // If requirements don't have price_per_m but we have total_billing, distribute it
                  const shouldDistribute =
                    revenueWithoutAddOns > 0 && requirementsTotal === 0;

                  return job.requirements.map((req, index) => {
                    // Handle "undefined" string, null, undefined, and empty string
                    const pricePerMStr = req.price_per_m;
                    const isValidPrice =
                      pricePerMStr &&
                      pricePerMStr !== "undefined" &&
                      pricePerMStr !== "null";
                    const pricePerM = isValidPrice
                      ? parseFloat(pricePerMStr)
                      : 0;
                    let processRevenue = (job.quantity / 1000) * pricePerM;

                    // Distribute revenue if price_per_m is missing
                    if (shouldDistribute) {
                      // If only one requirement, give it all the revenue
                      if (job.requirements.length === 1) {
                        processRevenue = revenueWithoutAddOns;
                      } else {
                        // Distribute evenly across all requirements
                        processRevenue =
                          revenueWithoutAddOns / job.requirements.length;
                      }
                    }

                    return (
                      <div
                        key={index}
                        className="flex justify-between items-center py-2"
                      >
                        <span className="text-sm text-[var(--text-dark)]">
                          Revenue from {req.process_type}:
                        </span>
                        <span className="text-base font-semibold text-[var(--text-dark)]">
                          $
                          {processRevenue.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    );
                  });
                })()}

                {/* Add-On Charges */}
                {job.add_on_charges && parseFloat(job.add_on_charges) > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-[var(--text-dark)]">
                      Add-on Charges:
                    </span>
                    <span className="text-base font-semibold text-[var(--text-dark)]">
                      $
                      {parseFloat(job.add_on_charges).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                {/* Total Revenue */}
                <div className="flex justify-between items-center py-3 border-t-2 border-[var(--primary-blue)] mt-3">
                  <span className="text-base font-bold text-[var(--text-dark)]">
                    Total Revenue:
                  </span>
                  <span className="text-xl font-bold text-[var(--primary-blue)]">
                    $
                    {job.total_billing
                      ? parseFloat(job.total_billing).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : (
                          job.requirements.reduce((total, req) => {
                            const pricePerM = parseFloat(
                              req.price_per_m || "0",
                            );
                            return total + (job.quantity / 1000) * pricePerM;
                          }, 0) + parseFloat(job.add_on_charges || "0")
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </span>
                </div>

                {/* Revenue per Unit */}
                <div className="flex justify-between items-center py-2 bg-gray-50 rounded-lg px-4">
                  <span className="text-sm text-[var(--text-dark)]">
                    Revenue per Unit:
                  </span>
                  <span className="text-base font-semibold text-[var(--text-dark)]">
                    $
                    {job.quantity > 0
                      ? (
                          (parseFloat(job.total_billing || "0") ||
                            job.requirements.reduce((total, req) => {
                              const pricePerM = parseFloat(
                                req.price_per_m || "0",
                              );
                              return total + (job.quantity / 1000) * pricePerM;
                            }, 0) + parseFloat(job.add_on_charges || "0")) /
                          job.quantity
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })
                      : "0.0000"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-base text-[var(--text-light)]">
                <p>No requirements found for this job.</p>
              </div>
            )}
          </div>

          {/* Requirements Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Requirements Details
            </h3>
            {job.requirements && job.requirements.length > 0 ? (
              <div className="space-y-4">
                {job.requirements.map((req, index) => {
                  // Get the process type configuration
                  const processConfig = getProcessTypeConfig(req.process_type);

                  // Get all fields for this process type, excluding process_type (shown in header)
                  const fieldsToDisplay =
                    processConfig?.fields.filter(
                      (field) => field.name !== "process_type",
                    ) || [];

                  return (
                    <div key={index} className="bg-gray-50 rounded-lg p-4">
                      <h4 className="text-sm font-semibold text-[var(--dark-blue)] mb-3">
                        Requirement {index + 1}:{" "}
                        {processConfig?.label || req.process_type}
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        {fieldsToDisplay.map((fieldConfig) => {
                          const fieldValue =
                            req[fieldConfig.name as keyof typeof req];

                          // Skip if field has no value
                          if (
                            fieldValue === undefined ||
                            fieldValue === null ||
                            fieldValue === ""
                          ) {
                            return null;
                          }

                          // Format the value based on field type
                          let displayValue: string;
                          if (fieldConfig.type === "currency") {
                            displayValue = `$${parseFloat(String(fieldValue)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                          } else {
                            displayValue = String(fieldValue);
                          }

                          return (
                            <div key={fieldConfig.name}>
                              <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                                {fieldConfig.label}
                              </label>
                              <p className="text-base text-[var(--text-dark)]">
                                {displayValue}
                              </p>
                            </div>
                          );
                        })}

                        {/* Show "No additional details" if no fields to display */}
                        {fieldsToDisplay.length === 0 && (
                          <div className="col-span-2 text-sm text-[var(--text-light)] italic">
                            No additional requirement details
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-base text-[var(--text-light)]">
                No specific requirements
              </p>
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
                onClick={() => setIsRevisionHistoryOpen(true)}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
              >
                Revision History
              </button>
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
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleDeleteCancel}
          />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative z-10">
            <h3 className="text-xl font-bold text-[var(--dark-blue)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-[var(--text-dark)] mb-6">
              Are you sure you want to delete{" "}
              <strong>Job #{job.job_number}</strong>? This action cannot be
              undone.
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
                {isDeleting ? "Deleting..." : "Delete Job"}
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

      {/* Revision History Modal */}
      <JobRevisionHistoryModal
        isOpen={isRevisionHistoryOpen}
        onClose={() => setIsRevisionHistoryOpen(false)}
        jobId={job.id}
        jobNumber={job.job_number}
        jobName={job.job_name}
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
