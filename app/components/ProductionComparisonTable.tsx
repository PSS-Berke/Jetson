"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { getVarianceStatus } from "@/lib/productionUtils";
import {
  addProductionEntry,
  deleteProductionEntry,
  getProductionEntries,
} from "@/lib/api";
import type { ProductionComparison } from "@/types";
import type { ProductionEntry } from "@/types";
import { useColumnSettings } from "./ProductionComparisonTable/useColumnSettings";
import ColumnSettingsPopover from "./ProductionComparisonTable/ColumnSettingsPopover";
import {
  renderColumnHeader,
  renderCell,
  HeaderRenderContext,
  CellRenderContext,
} from "./ProductionComparisonTable/columnRenderers";
import { SortField, getColumnByKey } from "./ProductionComparisonTable/columnConfig";
import Pagination from "./Pagination";

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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [editingCell, setEditingCell] = useState<{
    jobId: number;
    entryId: number | null;
  } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Column settings hook
  const {
    columnSettings,
    isColumnVisible,
    toggleColumnVisibility,
    setColumnOrder,
    resetToDefaults,
    getOrderedColumns,
  } = useColumnSettings();

  // Get ordered columns for rendering
  const orderedColumns = useMemo(() => getOrderedColumns(), [getOrderedColumns]);

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
      case "version":
        aValue = (a.job as any).version || 1;
        bValue = (b.job as any).version || 1;
        break;
      case "job_name":
        aValue = a.job.job_name.toLowerCase();
        bValue = b.job.job_name.toLowerCase();
        break;
      case "facility":
        aValue = a.job.facility?.name.toLowerCase() || "";
        bValue = b.job.facility?.name.toLowerCase() || "";
        break;
      case "client":
        aValue = a.job.client?.name.toLowerCase() || "";
        bValue = b.job.client?.name.toLowerCase() || "";
        break;
      case "sub_client":
        aValue = (a.job.sub_client || "").toLowerCase();
        bValue = (b.job.sub_client || "").toLowerCase();
        break;
      case "description":
        aValue = (a.job.description || "").toLowerCase();
        bValue = (b.job.description || "").toLowerCase();
        break;
      case "quantity":
        aValue = a.job.quantity;
        bValue = b.job.quantity;
        break;
      case "start_date":
        aValue = a.job.start_date || 0;
        bValue = b.job.start_date || 0;
        break;
      case "due_date":
        aValue = a.job.due_date || 0;
        bValue = b.job.due_date || 0;
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
      case "status":
        // Sort by status priority: hard schedule > soft schedule > projected > completed > cancelled
        const getStatusPriority = (job: any): number => {
          const scheduleType = (job.schedule_type || "soft schedule").toLowerCase();
          if (scheduleType.includes("hard")) return 1;
          if (scheduleType.includes("soft")) return 2;
          if (scheduleType.includes("projected")) return 3;
          if (scheduleType.includes("complete")) return 4;
          if (scheduleType.includes("cancel")) return 5;
          return 2; // default to soft schedule
        };
        aValue = getStatusPriority(a.job);
        bValue = getStatusPriority(b.job);
        break;
      default:
        aValue = a.job.job_number;
        bValue = b.job.job_number;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination logic - support "All" option with itemsPerPage === -1
  const paginatedComparisons = itemsPerPage === -1
    ? sortedComparisons
    : sortedComparisons.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
      );

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

  // Create header render context
  const headerContext: HeaderRenderContext = {
    sortField,
    sortDirection,
    onSort: handleSort,
    isBatchMode,
    dataDisplayMode,
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
          {!isBatchMode && (
            <ColumnSettingsPopover
              columnOrder={columnSettings.order}
              hiddenColumns={columnSettings.hidden}
              onToggleColumn={toggleColumnVisibility}
              onReorderColumns={setColumnOrder}
              onResetToDefaults={resetToDefaults}
            />
          )}
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
              {orderedColumns.map((col) => {
                if (!col.isVisible) return null;
                // Skip variance columns in batch mode
                if (isBatchMode && (col.config.key === "variance" || col.config.key === "variance_pct")) {
                  return null;
                }
                return renderColumnHeader(col.config, headerContext);
              })}
              {isBatchMode && (
                <>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Add Amount
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Set Total
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                    New Total
                  </th>
                  <th className="px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Notes
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

              // Create cell render context for this row
              const cellContext: CellRenderContext = {
                comparison,
                dataDisplayMode,
                isBatchMode,
                isEditing,
                editValue,
                saving,
                inputRef,
                onStartEdit: handleStartEdit,
                onEditInputChange: handleEditInputChange,
                onSaveEdit: handleSaveEdit,
                onKeyDown: handleKeyDown,
                calculateRevenue,
                formatDisplayValue,
              };

              return (
                <tr
                  key={comparison.job.id}
                  className={`${isBatchMode ? "" : "hover:bg-gray-50 cursor-pointer"}`}
                  onClick={() =>
                    !isEditing && !isBatchMode && onEdit && onEdit(comparison)
                  }
                >
                  {orderedColumns.map((col) => {
                    if (!col.isVisible) return null;
                    // Skip variance columns in batch mode
                    if (isBatchMode && (col.config.key === "variance" || col.config.key === "variance_pct")) {
                      return null;
                    }
                    return renderCell(col.config, cellContext);
                  })}
                  {isBatchMode && (
                    <>
                      <td className="px-2 py-2 whitespace-nowrap">
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
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
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
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        />
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-xs text-right">
                        <span
                          className={`font-semibold ${hasInput ? "text-blue-600" : "text-gray-400"}`}
                        >
                          {newTotal.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap">
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
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        />
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
                {isColumnVisible("facility") && (
                  <div className="text-xs text-gray-500 mt-1">
                    {comparison.job.facility?.name || "Unknown"}
                  </div>
                )}
                {(isColumnVisible("client") || isColumnVisible("sub_client")) && (
                  <div className="text-xs text-gray-500 mt-1">
                    {isColumnVisible("client") && (comparison.job.client?.name || "Unknown")}
                    {isColumnVisible("sub_client") && comparison.job.sub_client && ` / ${comparison.job.sub_client}`}
                  </div>
                )}
                {isColumnVisible("description") && comparison.job.description && (
                  <div className="text-xs text-gray-600 mt-1 truncate">
                    {comparison.job.description}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {isColumnVisible("quantity") && `Qty: ${comparison.job.quantity.toLocaleString()}`}
                  {isColumnVisible("updated_at") && ` | Modified: ${
                    comparison.last_updated_at
                      ? new Date(comparison.last_updated_at).toLocaleDateString("en-US", {
                          month: "numeric",
                          day: "numeric",
                          year: "2-digit",
                        })
                      : "-"
                  }`}
                </div>
              </div>
              {isColumnVisible("variance_pct") && (
                <span
                  className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                    comparison.variance_percentage,
                  )}`}
                >
                  {comparison.variance_percentage >= 0 ? "+" : ""}
                  {comparison.variance_percentage.toFixed(1)}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              {isColumnVisible("projected") && (
                <div>
                  <span className="text-gray-500">Projected:</span>
                  <span className="ml-2 font-medium">
                    {formatDisplayValue(
                      comparison.projected_quantity,
                      comparison.job,
                    )}
                  </span>
                </div>
              )}
              {isColumnVisible("actual") && (
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
              )}
              {isColumnVisible("variance") && (
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
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      <Pagination
        currentPage={currentPage}
        totalItems={sortedComparisons.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
        onItemsPerPageChange={handleItemsPerPageChange}
      />
    </div>
  );
}
