"use client";

import { useState, useEffect, FormEvent } from "react";
import {
  getProductionEntries,
  updateProductionEntry,
  addProductionEntry,
} from "@/lib/api";
import Toast from "./Toast";
import type { ProductionComparison } from "@/types";

interface EditProductionEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  comparison: ProductionComparison | null;
  startDate: number;
  endDate: number;
  facilitiesId?: number;
}

export default function EditProductionEntryModal({
  isOpen,
  onClose,
  onSuccess,
  comparison,
  startDate,
  endDate,
  facilitiesId,
}: EditProductionEntryModalProps) {
  const [actualQuantity, setActualQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [existingEntryId, setExistingEntryId] = useState<number | null>(null);

  // Calculate live variance
  const variance =
    actualQuantity && comparison
      ? parseInt(actualQuantity) - comparison.projected_quantity
      : 0;
  const variancePercentage =
    actualQuantity && comparison && comparison.projected_quantity > 0
      ? ((parseInt(actualQuantity) - comparison.projected_quantity) /
          comparison.projected_quantity) *
        100
      : 0;

  // Load existing production entry when modal opens
  useEffect(() => {
    const loadExistingEntry = async () => {
      if (isOpen && comparison) {
        try {
          // Fetch production entries for this job
          const entries = await getProductionEntries(
            facilitiesId,
            startDate,
            endDate,
          );
          const jobEntry = entries.find((e) => e.job === comparison.job.id);

          if (jobEntry) {
            setExistingEntryId(jobEntry.id);
            setActualQuantity(jobEntry.actual_quantity.toString());
            setNotes(jobEntry.notes || "");
          } else {
            // No existing entry, start fresh
            setExistingEntryId(null);
            setActualQuantity("");
            setNotes("");
          }
        } catch (error) {
          console.error(
            "[EditProductionEntryModal] Error loading entry:",
            error,
          );
          // Start fresh if we can't load
          setExistingEntryId(null);
          setActualQuantity("");
          setNotes("");
        }
      }
    };

    loadExistingEntry();
  }, [isOpen, comparison, facilitiesId, startDate, endDate]);

  // Handle quantity input with comma formatting
  const handleQuantityChange = (value: string) => {
    // Remove any non-digit characters
    const digitsOnly = value.replace(/\D/g, "");
    setActualQuantity(digitsOnly);
  };

  // Handle form submission
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!comparison) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const quantity = parseInt(actualQuantity);

      if (isNaN(quantity) || quantity < 0) {
        throw new Error("Please enter a valid quantity");
      }

      console.log("[EditProductionEntryModal] Submitting:", {
        existingEntryId,
        quantity,
        notes,
        jobId: comparison.job.id,
      });

      if (existingEntryId) {
        // Update existing entry
        console.log(
          "[EditProductionEntryModal] Updating entry",
          existingEntryId,
          "with quantity:",
          quantity,
        );
        const result = await updateProductionEntry(existingEntryId, {
          actual_quantity: quantity,
          notes: notes || undefined,
        });
        console.log("[EditProductionEntryModal] Update result:", result);
      } else {
        // Create new entry
        console.log(
          "[EditProductionEntryModal] Creating new entry for job:",
          comparison.job.id,
        );
        const result = await addProductionEntry({
          job: comparison.job.id,
          date: startDate,
          actual_quantity: quantity,
          notes: notes || undefined,
          facilities_id: facilitiesId,
        });
        console.log("[EditProductionEntryModal] Create result:", result);
      }

      // Show success and trigger callbacks
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        onClose();
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error) {
      console.error("[EditProductionEntryModal] Error submitting:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to save production entry",
      );
      setShowErrorToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (!submitting) {
      onClose();
      // Reset state after animation
      setTimeout(() => {
        setActualQuantity("");
        setNotes("");
        setExistingEntryId(null);
        setErrorMessage("");
      }, 300);
    }
  };

  if (!isOpen || !comparison) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">
            Edit Production Entry
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Job #{comparison.job.job_number} - {comparison.job.job_name}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Job Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <div>
                  <span className="text-gray-600">Client:</span>
                  <span className="ml-2 font-medium">
                    {comparison.job.client?.name || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            {/* Projected vs Actual Comparison */}
            <div className="grid grid-cols-2 gap-4">
              {/* Projected Quantity (Read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Projected Quantity
                </label>
                <div className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-700 font-semibold">
                  {comparison.projected_quantity.toLocaleString()}
                </div>
              </div>

              {/* Actual Quantity (Editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actual Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={
                    actualQuantity
                      ? parseInt(actualQuantity).toLocaleString()
                      : ""
                  }
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  placeholder="Enter actual quantity"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Live Variance Display */}
            {actualQuantity && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-700 font-medium">Variance:</span>
                    <span
                      className={`ml-2 font-bold ${variance >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {variance >= 0 ? "+" : ""}
                      {variance.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-700 font-medium">
                      Variance %:
                    </span>
                    <span
                      className={`ml-2 font-bold ${variancePercentage >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {variancePercentage >= 0 ? "+" : ""}
                      {variancePercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this production entry..."
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Saving..."
                : existingEntryId
                  ? "Update Entry"
                  : "Create Entry"}
            </button>
          </div>
        </form>
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message="Production entry saved successfully!"
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <Toast
          message={errorMessage || "Failed to save production entry"}
          type="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </div>
  );
}
