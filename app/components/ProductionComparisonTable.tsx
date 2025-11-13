"use client";

import { useState, useRef, useEffect } from "react";
import { getVarianceStatus } from "@/lib/productionUtils";
import {
  addProductionEntry,
  deleteProductionEntry,
  getProductionEntries,
} from "@/lib/api";
import type { ProductionComparison } from "@/types";
import type { ProductionEntry } from "@/types";

interface ProductionComparisonTableProps {
  comparisons: ProductionComparison[];
  onEdit?: (comparison: ProductionComparison) => void;
  isBatchMode?: boolean;
  onToggleBatchMode?: () => void;
  onBatchSave?: () => void;
  startDate?: number;
  endDate?: number;
  facilitiesId?: number;
  granularity?: "day" | "week" | "month";
  dataDisplayMode?: "pieces" | "revenue";
}

interface BatchEntryData {
  jobId: number;
  currentActual: number;
  addAmount: string;
  setTotal: string;
  notes: string;
}

type SortField =
  | "job_number"
  | "job_name"
  | "client"
  | "date_entered"
  | "projected"
  | "actual"
  | "variance";
type SortDirection = "asc" | "desc";

export default function ProductionComparisonTable({
  comparisons,
  onEdit,
  isBatchMode = false,
  onToggleBatchMode,
  onBatchSave,
  startDate,
  endDate,
  facilitiesId,
  granularity = "week",
  dataDisplayMode = "pieces",
}: ProductionComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>("job_number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [editingCell, setEditingCell] = useState<{
    jobId: number;
    entryId: number | null;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Batch mode state
  const [batchData, setBatchData] = useState<Map<number, BatchEntryData>>(
    new Map(),
  );
  const [submitting, setSubmitting] = useState(false);

  // Helper function to calculate revenue from pieces
  const calculateRevenue = (
    pieces: number,
    job: ProductionComparison["job"],
  ): number => {
    // Simple calculation: sum all requirements' pricing * pieces
    if (!job.requirements || job.requirements.length === 0) return 0;

    const totalPricePerPiece = job.requirements.reduce((sum, req) => {
      const pricing =
        typeof req.pricing === "number"
          ? req.pricing
          : parseFloat(req.pricing || "0");
      return sum + (pricing || 0);
    }, 0);

    return pieces * totalPricePerPiece;
  };

  // Helper function to format display value based on mode
  const formatDisplayValue = (
    pieces: number,
    job: ProductionComparison["job"],
  ): string => {
    if (dataDisplayMode === "revenue") {
      const revenue = calculateRevenue(pieces, job);
      return `$${revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return pieces.toLocaleString();
  };

  // Helper function to get the display label
  const getDisplayLabel = (): string => {
    return dataDisplayMode === "revenue" ? "Revenue" : "Pieces";
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Sort comparisons
  const sortedComparisons = [...comparisons].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case "job_number":
        aValue = a.job.job_number;
        bValue = b.job.job_number;
        break;
      case "job_name":
        aValue = a.job.job_name.toLowerCase();
        bValue = b.job.job_name.toLowerCase();
        break;
      case "client":
        aValue = a.job.client?.name.toLowerCase() || "";
        bValue = b.job.client?.name.toLowerCase() || "";
        break;
      case "date_entered":
        aValue = a.last_updated_at || 0;
        bValue = b.last_updated_at || 0;
        break;
      case "projected":
        aValue = a.projected_quantity;
        bValue = b.projected_quantity;
        break;
      case "actual":
        aValue = a.actual_quantity;
        bValue = b.actual_quantity;
        break;
      case "variance":
        aValue = a.variance_percentage;
        bValue = b.variance_percentage;
        break;
      default:
        aValue = a.job.job_number;
        bValue = b.job.job_number;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedComparisons.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedComparisons = sortedComparisons.slice(startIndex, endIndex);

  // Reset to page 1 when items per page changes
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  // Start editing a cell
  const handleStartEdit = (
    comparison: ProductionComparison,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation(); // Prevent row click
    setEditingCell({
      jobId: comparison.job.id,
      entryId: comparison.entry_ids?.[0] || null,
    });
    setEditValue(comparison.actual_quantity.toString());
  };

  // Handle input change with formatting
  const handleEditInputChange = (value: string) => {
    // Remove non-digits
    const digitsOnly = value.replace(/\D/g, "");
    setEditValue(digitsOnly);
  };

  // Save the edited value
  const handleSaveEdit = async (comparison: ProductionComparison) => {
    if (saving) return;

    const newValue = parseInt(editValue);
    if (isNaN(newValue) || newValue < 0) {
      setEditingCell(null);
      return;
    }

    // If value hasn't changed, just cancel
    if (newValue === comparison.actual_quantity) {
      setEditingCell(null);
      return;
    }

    setSaving(true);
    try {
      // Delete all existing entries for this job in this period
      if (comparison.entry_ids && comparison.entry_ids.length > 0) {
        await Promise.all(
          comparison.entry_ids.map((entryId) => deleteProductionEntry(entryId)),
        );
      }

      // Create a single new entry with the new value
      const newEntry: Omit<
        ProductionEntry,
        "id" | "created_at" | "updated_at"
      > = {
        job: comparison.job.id,
        date: Date.now(),
        actual_quantity: newValue,
        facilities_id: comparison.job.facilities_id,
      };
      await addProductionEntry(newEntry);

      // Trigger refresh by calling onEdit if available
      if (onEdit) {
        onEdit(comparison);
      }
    } catch (error) {
      console.error("Error saving actual quantity:", error);
      alert("Failed to save. Please try again.");
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditValue("");
  };

  // Handle keyboard events
  const handleKeyDown = (
    e: React.KeyboardEvent,
    comparison: ProductionComparison,
  ) => {
    if (e.key === "Enter") {
      handleSaveEdit(comparison);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Initialize batch data when entering batch mode
  useEffect(() => {
    if (isBatchMode && startDate && endDate) {
      const initBatchData = async () => {
        try {
          const existingEntries = await getProductionEntries(
            facilitiesId,
            startDate,
            endDate,
          );

          // Create a map of job_id to current actual quantity
          const actualsMap = new Map<number, number>();
          existingEntries.forEach((entry) => {
            const currentActual = actualsMap.get(entry.job) || 0;
            actualsMap.set(entry.job, currentActual + entry.actual_quantity);
          });

          // Initialize batch data for all comparisons
          const newBatchData = new Map<number, BatchEntryData>();
          comparisons.forEach((comp) => {
            newBatchData.set(comp.job.id, {
              jobId: comp.job.id,
              currentActual:
                actualsMap.get(comp.job.id) || comp.actual_quantity,
              addAmount: "",
              setTotal: "",
              notes: "",
            });
          });

          setBatchData(newBatchData);
        } catch (error) {
          console.error("Error initializing batch data:", error);
        }
      };

      initBatchData();
    } else {
      // Clear batch data when exiting batch mode
      setBatchData(new Map());
    }
  }, [isBatchMode, comparisons, startDate, endDate, facilitiesId]);

  // Handle batch add amount change
  const handleBatchAddAmountChange = (jobId: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const currentData = batchData.get(jobId);
    if (currentData) {
      const newBatchData = new Map(batchData);
      // Clear setTotal when using addAmount
      newBatchData.set(jobId, {
        ...currentData,
        addAmount: digitsOnly,
        setTotal: "",
      });
      setBatchData(newBatchData);
    }
  };

  // Handle batch set total change
  const handleBatchSetTotalChange = (jobId: number, value: string) => {
    const digitsOnly = value.replace(/\D/g, "");
    const currentData = batchData.get(jobId);
    if (currentData) {
      const newBatchData = new Map(batchData);
      // Clear addAmount when using setTotal
      newBatchData.set(jobId, {
        ...currentData,
        setTotal: digitsOnly,
        addAmount: "",
      });
      setBatchData(newBatchData);
    }
  };

  // Handle batch notes change
  const handleBatchNotesChange = (jobId: number, value: string) => {
    const currentData = batchData.get(jobId);
    if (currentData) {
      const newBatchData = new Map(batchData);
      newBatchData.set(jobId, { ...currentData, notes: value });
      setBatchData(newBatchData);
    }
  };

  // Get new total for batch entry
  const getBatchNewTotal = (jobId: number): number => {
    const data = batchData.get(jobId);
    if (!data) return 0;
    if (data.addAmount) {
      return data.currentActual + parseInt(data.addAmount);
    }
    if (data.setTotal) {
      return parseInt(data.setTotal);
    }
    return data.currentActual;
  };

  // Handle batch save
  const handleBatchSave = async () => {
    setSubmitting(true);
    try {
      const jobsToUpdate: Array<{
        jobId: number;
        finalQuantity: number;
        notes?: string;
        entryIds: number[];
      }> = [];

      // Collect all jobs that need updating
      batchData.forEach((data, jobId) => {
        let finalQuantity: number | null = null;

        // Check if using Add Amount mode
        if (data.addAmount.trim() !== "") {
          const addAmount = parseInt(data.addAmount);
          finalQuantity = data.currentActual + addAmount;
        }
        // Check if using Set Total mode
        else if (data.setTotal.trim() !== "") {
          finalQuantity = parseInt(data.setTotal);
        }

        // Only add to update list if we have a valid quantity
        if (finalQuantity !== null) {
          // Find the comparison for this job to get entry IDs
          const comparison = comparisons.find((c) => c.job.id === jobId);
          const entryIds = comparison?.entry_ids || [];

          jobsToUpdate.push({
            jobId,
            finalQuantity,
            notes: data.notes || undefined,
            entryIds,
          });
        }
      });

      if (jobsToUpdate.length === 0) {
        alert("Please enter at least one production quantity");
        setSubmitting(false);
        return;
      }

      // For each job: delete old entries, then create new entry
      for (const job of jobsToUpdate) {
        // Delete all existing entries for this job in this period
        if (job.entryIds.length > 0) {
          await Promise.all(
            job.entryIds.map((entryId) => deleteProductionEntry(entryId)),
          );
        }

        // Create a single new entry with the final total
        const newEntry: Omit<
          ProductionEntry,
          "id" | "created_at" | "updated_at"
        > = {
          job: job.jobId,
          date: granularity === "week" ? startDate || Date.now() : Date.now(),
          actual_quantity: job.finalQuantity,
          notes: job.notes,
          facilities_id: facilitiesId,
        };
        await addProductionEntry(newEntry);
      }

      // Clear batch data and exit batch mode
      setBatchData(new Map());
      if (onToggleBatchMode) onToggleBatchMode();
      if (onBatchSave) onBatchSave();
    } catch (error) {
      console.error("Error saving batch entries:", error);
      alert("Failed to save batch entries. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle batch cancel
  const handleBatchCancel = () => {
    setBatchData(new Map());
    if (onToggleBatchMode) onToggleBatchMode();
  };

  // Get status class for variance
  const getStatusClass = (variance_percentage: number): string => {
    const status = getVarianceStatus(variance_percentage);
    switch (status) {
      case "ahead":
        return "text-green-700 bg-green-50";
      case "on-track":
        return "text-yellow-700 bg-yellow-50";
      case "behind":
        return "text-red-700 bg-red-50";
    }
  };

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return <span>{sortDirection === "asc" ? "↑" : "↓"}</span>;
  };

  if (comparisons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">
          No production data available for this period
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Toolbar */}
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div>
          {isBatchMode ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-600">
                Batch Entry Mode
              </span>
              <span className="text-xs text-gray-500">
                Add to current or set new total for each job
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold text-gray-700">
              Production Data
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {isBatchMode ? (
            <>
              <button
                onClick={handleBatchCancel}
                disabled={submitting}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-50 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleBatchSave}
                disabled={submitting}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {submitting ? "Saving..." : "Save All"}
              </button>
            </>
          ) : (
            <button
              onClick={onToggleBatchMode}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              + Batch Entry
            </button>
          )}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                onClick={() => !isBatchMode && handleSort("job_number")}
                className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${!isBatchMode ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                <div className="flex items-center gap-2">
                  Job # {!isBatchMode && <SortIcon field="job_number" />}
                </div>
              </th>
              <th
                onClick={() => !isBatchMode && handleSort("job_name")}
                className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${!isBatchMode ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                <div className="flex items-center gap-2">
                  Job Name {!isBatchMode && <SortIcon field="job_name" />}
                </div>
              </th>
              <th
                onClick={() => !isBatchMode && handleSort("client")}
                className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${!isBatchMode ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                <div className="flex items-center gap-2">
                  Client {!isBatchMode && <SortIcon field="client" />}
                </div>
              </th>
              <th
                onClick={() => !isBatchMode && handleSort("date_entered")}
                className={`px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider ${!isBatchMode ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                <div className="flex items-center gap-2">
                  Date Entered{" "}
                  {!isBatchMode && <SortIcon field="date_entered" />}
                </div>
              </th>
              <th
                onClick={() => !isBatchMode && handleSort("projected")}
                className={`px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider ${!isBatchMode ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                <div className="flex items-center justify-end gap-2">
                  Projected {getDisplayLabel()}{" "}
                  {!isBatchMode && <SortIcon field="projected" />}
                </div>
              </th>
              <th
                onClick={() => !isBatchMode && handleSort("actual")}
                className={`px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider ${!isBatchMode ? "cursor-pointer hover:bg-gray-100" : ""}`}
              >
                <div className="flex items-center justify-end gap-2">
                  {isBatchMode ? "Current" : "Actual"} {getDisplayLabel()}{" "}
                  {!isBatchMode && <SortIcon field="actual" />}
                </div>
              </th>
              {isBatchMode ? (
                <>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Add Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Set Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    New Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Notes
                  </th>
                </>
              ) : (
                <>
                  <th
                    onClick={() => handleSort("variance")}
                    className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex items-center justify-end gap-2">
                      Variance <SortIcon field="variance" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Variance %
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedComparisons.map((comparison) => {
              const isEditing = editingCell?.jobId === comparison.job.id;
              const batchEntry = batchData.get(comparison.job.id);
              const newTotal = getBatchNewTotal(comparison.job.id);
              const hasInput = batchEntry?.addAmount || batchEntry?.setTotal;

              return (
                <tr
                  key={comparison.job.id}
                  className={`${isBatchMode ? "" : "hover:bg-gray-50 cursor-pointer"}`}
                  onClick={() =>
                    !isEditing && !isBatchMode && onEdit && onEdit(comparison)
                  }
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {comparison.job.job_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {comparison.job.job_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {comparison.job.client?.name || "Unknown"}
                    {comparison.job.sub_client && (
                      <span className="text-gray-400">
                        {" "}
                        / {comparison.job.sub_client.name}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {comparison.last_updated_at
                      ? new Date(
                          comparison.last_updated_at,
                        ).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                    {formatDisplayValue(
                      comparison.projected_quantity,
                      comparison.job,
                    )}
                  </td>
                  <td
                    className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                      comparison.actual_quantity > 0
                        ? "text-blue-600"
                        : "text-gray-900"
                    }`}
                    onClick={(e) =>
                      !isEditing &&
                      !isBatchMode &&
                      handleStartEdit(comparison, e)
                    }
                  >
                    {isEditing && !isBatchMode ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={
                          editValue
                            ? dataDisplayMode === "revenue"
                              ? `$${calculateRevenue(parseInt(editValue), comparison.job).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : parseInt(editValue).toLocaleString()
                            : ""
                        }
                        onChange={(e) => handleEditInputChange(e.target.value)}
                        onBlur={() => handleSaveEdit(comparison)}
                        onKeyDown={(e) => handleKeyDown(e, comparison)}
                        className="w-full px-2 py-1 border border-blue-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={saving}
                      />
                    ) : (
                      <span
                        className={
                          !isBatchMode
                            ? "cursor-text hover:bg-blue-50 px-2 py-1 rounded"
                            : ""
                        }
                      >
                        {formatDisplayValue(
                          comparison.actual_quantity,
                          comparison.job,
                        )}
                      </span>
                    )}
                  </td>
                  {isBatchMode ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={
                            batchEntry?.addAmount
                              ? parseInt(batchEntry.addAmount).toLocaleString()
                              : ""
                          }
                          onChange={(e) =>
                            handleBatchAddAmountChange(
                              comparison.job.id,
                              e.target.value,
                            )
                          }
                          placeholder="Add..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={
                            batchEntry?.setTotal
                              ? parseInt(batchEntry.setTotal).toLocaleString()
                              : ""
                          }
                          onChange={(e) =>
                            handleBatchSetTotalChange(
                              comparison.job.id,
                              e.target.value,
                            )
                          }
                          placeholder="Set..."
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span
                          className={`font-semibold ${hasInput ? "text-blue-600" : "text-gray-400"}`}
                        >
                          {newTotal.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={batchEntry?.notes || ""}
                          onChange={(e) =>
                            handleBatchNotesChange(
                              comparison.job.id,
                              e.target.value,
                            )
                          }
                          placeholder="Optional notes"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span
                          className={
                            comparison.variance >= 0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {comparison.variance >= 0 ? "+" : ""}
                          {dataDisplayMode === "revenue"
                            ? `$${calculateRevenue(comparison.variance, comparison.job).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : comparison.variance.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                            comparison.variance_percentage,
                          )}`}
                        >
                          {comparison.variance_percentage >= 0 ? "+" : ""}
                          {comparison.variance_percentage.toFixed(1)}%
                        </span>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {paginatedComparisons.map((comparison) => (
          <div
            key={comparison.job.id}
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => onEdit && onEdit(comparison)}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-gray-900">
                  Job #{comparison.job.job_number}
                </div>
                <div className="text-sm text-gray-600">
                  {comparison.job.job_name}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {comparison.job.client?.name || "Unknown"}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Entered:{" "}
                  {comparison.last_updated_at
                    ? new Date(comparison.last_updated_at).toLocaleDateString()
                    : "-"}
                </div>
              </div>
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                  comparison.variance_percentage,
                )}`}
              >
                {comparison.variance_percentage >= 0 ? "+" : ""}
                {comparison.variance_percentage.toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div>
                <span className="text-gray-500">Projected:</span>
                <span className="ml-2 font-medium">
                  {formatDisplayValue(
                    comparison.projected_quantity,
                    comparison.job,
                  )}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Actual:</span>
                <span
                  className={`ml-2 font-semibold ${
                    comparison.actual_quantity > 0
                      ? "text-blue-600"
                      : "text-gray-900"
                  }`}
                >
                  {formatDisplayValue(
                    comparison.actual_quantity,
                    comparison.job,
                  )}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Variance:</span>
                <span
                  className={`ml-2 font-medium ${
                    comparison.variance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {comparison.variance >= 0 ? "+" : ""}
                  {dataDisplayMode === "revenue"
                    ? `$${calculateRevenue(comparison.variance, comparison.job).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : comparison.variance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {comparisons.length > 10 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) =>
                  handleItemsPerPageChange(Number(e.target.value))
                }
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>

            {/* Page info and navigation */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, sortedComparisons.length)} of{" "}
                {sortedComparisons.length} jobs
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
