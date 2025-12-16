"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  JobCostComparison,
  formatCurrency,
  formatPercentage,
  formatNumber,
  getProfitTextColor,
  getProfitColorClass,
} from "@/lib/jobCostUtils";
import { getStatusDisplay, getStatusPriority } from "@/lib/columnConfig";
import { useColumnSettings } from "./JobCostComparisonTable/useColumnSettings";
import ColumnSettingsPopover from "./JobCostComparisonTable/ColumnSettingsPopover";
import { SortField, JobCostColumnConfig } from "./JobCostComparisonTable/columnConfig";

interface JobCostComparisonTableProps {
  comparisons: JobCostComparison[];
  onEdit?: (comparison: JobCostComparison) => void;
  isBatchMode?: boolean;
  onToggleBatchMode?: () => void;
  startDate?: number;
  endDate?: number;
  facilitiesId?: number;
}

type SortDirection = "asc" | "desc";

// Format date for display
function formatDate(timestamp: number | null | undefined): string {
  if (!timestamp) return "-";
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function JobCostComparisonTable({
  comparisons,
  onEdit,
  isBatchMode = false,
  onToggleBatchMode,
}: JobCostComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>("job_number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [editingCell, setEditingCell] = useState<{ jobId: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use column settings hook
  const {
    columnSettings,
    visibleColumns,
    toggleColumnVisibility,
    setColumnOrder,
    resetToDefaults,
  } = useColumnSettings();

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
  const sortedComparisons = useMemo(() => {
    return [...comparisons].sort((a, b) => {
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
        case "status":
          aValue = getStatusPriority((a.job as any).schedule_type);
          bValue = getStatusPriority((b.job as any).schedule_type);
          break;
        case "job_name":
          aValue = a.job.job_name.toLowerCase();
          bValue = b.job.job_name.toLowerCase();
          break;
        case "facility":
          aValue = a.job.facility?.name?.toLowerCase() || "";
          bValue = b.job.facility?.name?.toLowerCase() || "";
          break;
        case "client":
          aValue = a.job.client?.name?.toLowerCase() || "";
          bValue = b.job.client?.name?.toLowerCase() || "";
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
        case "updated_at":
          aValue = (a.job as any).updated_at || 0;
          bValue = (b.job as any).updated_at || 0;
          break;
        case "billing_rate":
          aValue = a.billing_rate_per_m;
          bValue = b.billing_rate_per_m;
          break;
        case "actual_cost":
          aValue = a.actual_cost_per_m || 0;
          bValue = b.actual_cost_per_m || 0;
          break;
        case "profit_margin":
          aValue = a.profit_metrics?.profit_per_m || 0;
          bValue = b.profit_metrics?.profit_per_m || 0;
          break;
        case "profit_percentage":
          aValue = a.profit_metrics?.profit_percentage || 0;
          bValue = b.profit_metrics?.profit_percentage || 0;
          break;
        case "total_profit":
          aValue = a.profit_metrics?.total_profit || 0;
          bValue = b.profit_metrics?.total_profit || 0;
          break;
        default:
          aValue = a.job.job_number;
          bValue = b.job.job_number;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [comparisons, sortField, sortDirection]);

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
  const handleStartEdit = (comparison: JobCostComparison, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCell({ jobId: comparison.job.id });
    setEditValue((comparison.actual_cost_per_m || 0).toString());
  };

  // Handle input change with decimal formatting
  const handleEditInputChange = (value: string) => {
    const validChars = value.replace(/[^\d.]/g, "");
    const parts = validChars.split(".");
    if (parts.length > 2) return;
    setEditValue(validChars);
  };

  // Save the edited value
  const handleSaveEdit = async (comparison: JobCostComparison) => {
    if (saving) return;

    const newValue = parseFloat(editValue);
    if (isNaN(newValue) || newValue < 0) {
      setEditingCell(null);
      return;
    }

    if (newValue === comparison.actual_cost_per_m) {
      setEditingCell(null);
      return;
    }

    setSaving(true);
    try {
      console.log("Saving cost entry:", {
        job: comparison.job.id,
        actual_cost_per_m: newValue,
        date: Date.now(),
      });

      if (onEdit) {
        onEdit(comparison);
      }
    } catch (error) {
      console.error("Error saving actual cost:", error);
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
  const handleKeyDown = (e: React.KeyboardEvent, comparison: JobCostComparison) => {
    if (e.key === "Enter") {
      handleSaveEdit(comparison);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Render sort icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-600 ml-1">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Render header cell based on column config
  const renderHeaderCell = (config: JobCostColumnConfig) => {
    const alignClass = config.align === "right" ? "text-right" : config.align === "center" ? "text-center" : "text-left";
    const sortable = config.sortable && config.sortField;

    return (
      <th
        key={config.key}
        className={`px-4 py-3 ${alignClass} text-xs font-medium text-gray-500 uppercase tracking-wider ${
          sortable ? "cursor-pointer hover:bg-gray-100" : ""
        }`}
        style={config.width ? { width: config.width } : undefined}
        onClick={sortable ? () => handleSort(config.sortField!) : undefined}
      >
        <div className={`flex items-center gap-1 ${config.align === "right" ? "justify-end" : config.align === "center" ? "justify-center" : ""}`}>
          {config.label}
          {sortable && renderSortIcon(config.sortField!)}
        </div>
      </th>
    );
  };

  // Render cell based on column config
  const renderCell = (config: JobCostColumnConfig, comparison: JobCostComparison) => {
    const job = comparison.job;
    const profitMetrics = comparison.profit_metrics;
    const isEditing = editingCell?.jobId === job.id;

    switch (config.key) {
      case "job_number":
        return (
          <td key={config.key} className="px-4 py-3 text-sm font-medium text-gray-900">
            {job.job_number}
          </td>
        );

      case "version":
        const version = (job as any).version || 1;
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-center text-gray-600">
            v{version}
          </td>
        );

      case "status":
        const statusDisplay = getStatusDisplay((job as any).schedule_type);
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-center">
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusDisplay.className}`}
            >
              {statusDisplay.label}
            </span>
          </td>
        );

      case "job_name":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-gray-900">
            {job.job_name}
          </td>
        );

      case "facility":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-gray-600">
            {job.facility?.name || "-"}
          </td>
        );

      case "client":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-gray-600">
            {job.client?.name || "Unknown"}
          </td>
        );

      case "sub_client":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-gray-500">
            {job.sub_client || "-"}
          </td>
        );

      case "description":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={job.description || ""}>
            {job.description || "-"}
          </td>
        );

      case "quantity":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-center text-gray-900">
            {formatNumber(job.quantity)}
          </td>
        );

      case "start_date":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-center text-gray-600">
            {formatDate(job.start_date)}
          </td>
        );

      case "due_date":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-center text-gray-600">
            {formatDate(job.due_date)}
          </td>
        );

      case "updated_at":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-center text-gray-600">
            {formatDate((job as any).updated_at)}
          </td>
        );

      case "billing_rate":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-right font-medium text-gray-900">
            {formatCurrency(comparison.billing_rate_per_m)}
          </td>
        );

      case "actual_cost":
        return (
          <td
            key={config.key}
            className="px-4 py-3 text-sm text-right cursor-pointer hover:bg-blue-50"
            onClick={(e) => !isEditing && handleStartEdit(comparison, e)}
          >
            {isEditing ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => handleEditInputChange(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, comparison)}
                onBlur={() => handleSaveEdit(comparison)}
                className="w-full px-2 py-1 border border-blue-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={saving}
              />
            ) : (
              <span
                className={
                  comparison.actual_cost_per_m === null
                    ? "text-gray-400 italic"
                    : "text-gray-900 font-medium"
                }
              >
                {comparison.actual_cost_per_m !== null
                  ? formatCurrency(comparison.actual_cost_per_m)
                  : "Click to enter"}
              </span>
            )}
          </td>
        );

      case "profit_margin":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-right">
            {profitMetrics ? (
              <span className={`font-semibold ${getProfitTextColor(profitMetrics.profit_percentage)}`}>
                {formatCurrency(profitMetrics.profit_per_m)}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
        );

      case "profit_percentage":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-right">
            {profitMetrics ? (
              <span
                className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${getProfitColorClass(profitMetrics.profit_status)}`}
              >
                {formatPercentage(profitMetrics.profit_percentage)}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
        );

      case "total_profit":
        return (
          <td key={config.key} className="px-4 py-3 text-sm text-right">
            {profitMetrics ? (
              <span className={`font-semibold ${getProfitTextColor(profitMetrics.profit_percentage)}`}>
                {formatCurrency(profitMetrics.total_profit)}
              </span>
            ) : (
              <span className="text-gray-400">—</span>
            )}
          </td>
        );

      default:
        return <td key={config.key} className="px-4 py-3 text-sm text-gray-500">-</td>;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Job Profitability Analysis
          </h3>
          <p className="text-sm text-gray-500">
            Compare billing rates with actual costs
          </p>
        </div>
        <div className="flex gap-2">
          <ColumnSettingsPopover
            columnOrder={columnSettings.order}
            hiddenColumns={columnSettings.hidden}
            onToggleColumn={toggleColumnVisibility}
            onReorderColumns={setColumnOrder}
            onResetToDefaults={resetToDefaults}
          />
          {onToggleBatchMode && (
            <button
              onClick={onToggleBatchMode}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isBatchMode
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
              }`}
            >
              {isBatchMode ? "Exit Batch Mode" : "Batch Entry"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {visibleColumns.map((config) => renderHeaderCell(config))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedComparisons.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-8 text-center text-gray-500">
                  No jobs found for the selected period.
                </td>
              </tr>
            ) : (
              paginatedComparisons.map((comparison) => (
                <tr key={comparison.job.id} className="hover:bg-gray-50 transition-colors">
                  {visibleColumns.map((config) => renderCell(config, comparison))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {paginatedComparisons.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Rows per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="text-sm text-gray-700 ml-4">
              Showing {startIndex + 1}-{Math.min(endIndex, sortedComparisons.length)} of{" "}
              {sortedComparisons.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
