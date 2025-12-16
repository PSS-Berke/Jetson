"use client";

import React from "react";
import type { ProductionComparison } from "@/types";
import { ProductionColumnConfig, SortField } from "./columnConfig";
import { getVarianceStatus } from "@/lib/productionUtils";

// Context for header rendering
export interface HeaderRenderContext {
  sortField: SortField | null;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
  isBatchMode: boolean;
  dataDisplayMode: "pieces" | "revenue";
}

// Context for cell rendering
export interface CellRenderContext {
  comparison: ProductionComparison;
  dataDisplayMode: "pieces" | "revenue";
  isBatchMode: boolean;
  isEditing: boolean;
  editValue: string;
  saving: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onStartEdit: (comparison: ProductionComparison, e: React.MouseEvent) => void;
  onEditInputChange: (value: string) => void;
  onSaveEdit: (comparison: ProductionComparison) => void;
  onKeyDown: (e: React.KeyboardEvent, comparison: ProductionComparison) => void;
  calculateRevenue: (pieces: number, job: ProductionComparison["job"]) => number;
  formatDisplayValue: (pieces: number, job: ProductionComparison["job"]) => string;
}

// Sort icon component
const SortIcon = ({
  field,
  currentField,
  direction,
}: {
  field: SortField;
  currentField: SortField | null;
  direction: "asc" | "desc";
}) => {
  if (currentField !== field) return <span className="text-gray-400">⇅</span>;
  return <span>{direction === "asc" ? "↑" : "↓"}</span>;
};

// Render a single header cell
export function renderColumnHeader(
  config: ProductionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  const { sortField, sortDirection, onSort, isBatchMode, dataDisplayMode } = context;
  const displayLabel = dataDisplayMode === "revenue" ? "Revenue" : "Pieces";

  const getSortableClass = () =>
    !isBatchMode && config.sortable
      ? "cursor-pointer hover:bg-gray-100"
      : "";

  const handleClick = () => {
    if (!isBatchMode && config.sortable && config.sortField) {
      onSort(config.sortField);
    }
  };

  const alignClass = config.align === "center"
    ? "text-center justify-center"
    : config.align === "right"
    ? "text-right justify-end"
    : "text-left";

  switch (config.key) {
    case "job_number":
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className="flex items-center gap-2">
            {config.label}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );

    case "version":
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className="flex items-center justify-center gap-2">
            {config.label}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );

    case "projected":
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className="flex items-center justify-end gap-2">
            Projected {displayLabel}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );

    case "actual":
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className="flex items-center justify-end gap-2">
            {isBatchMode ? "Current" : "Actual"} {displayLabel}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );

    case "variance":
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className="flex items-center justify-end gap-2">
            {config.label}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );

    case "variance_pct":
      return (
        <th
          key={config.key}
          className="px-2 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider"
        >
          {config.label}
        </th>
      );

    case "status":
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className="flex items-center justify-center gap-2">
            {config.label}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );

    default:
      return (
        <th
          key={config.key}
          onClick={handleClick}
          className={`px-2 py-2 ${alignClass} text-xs font-medium text-gray-700 uppercase tracking-wider ${getSortableClass()}`}
        >
          <div className={`flex items-center gap-2 ${alignClass}`}>
            {config.label}
            {!isBatchMode && config.sortable && config.sortField && (
              <SortIcon field={config.sortField} currentField={sortField} direction={sortDirection} />
            )}
          </div>
        </th>
      );
  }
}

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

// Render a single cell
export function renderCell(
  config: ProductionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  const {
    comparison,
    dataDisplayMode,
    isBatchMode,
    isEditing,
    editValue,
    saving,
    inputRef,
    onStartEdit,
    onEditInputChange,
    onSaveEdit,
    onKeyDown,
    calculateRevenue,
    formatDisplayValue,
  } = context;

  switch (config.key) {
    case "job_number":
      const jobNum = comparison.job.job_number;
      const truncatedJobNum = jobNum.length > 7 ? jobNum.slice(0, 7) + "…" : jobNum;
      return (
        <td
          key={config.key}
          className="px-2 py-2 whitespace-nowrap text-xs font-medium text-gray-900"
          title={jobNum}
        >
          {truncatedJobNum}
        </td>
      );

    case "version":
      const versionNum = (comparison.job as any).version || 1;
      const versionName = versionNum === 1 ? "v1" : `v${versionNum}`;
      return (
        <td
          key={config.key}
          className="px-2 py-2 whitespace-nowrap text-xs text-center text-gray-600"
        >
          {versionName}
        </td>
      );

    case "status":
      const scheduleType = (comparison.job as any).schedule_type as string | undefined;
      const statusLower = (scheduleType || "soft schedule").toLowerCase();
      let statusClass: string;
      let displayLabel: string;
      if (statusLower.includes("hard")) {
        statusClass = "bg-green-100 text-green-800";
        displayLabel = "Hard";
      } else if (statusLower.includes("cancel")) {
        statusClass = "bg-red-100 text-red-800";
        displayLabel = "Cancelled";
      } else if (statusLower.includes("complete")) {
        statusClass = "bg-purple-100 text-purple-800";
        displayLabel = "Completed";
      } else if (statusLower.includes("projected")) {
        statusClass = "bg-blue-100 text-blue-800";
        displayLabel = "Projected";
      } else {
        statusClass = "bg-yellow-100 text-yellow-800";
        displayLabel = "Soft";
      }
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center">
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}
            title={scheduleType || "Soft Schedule"}
          >
            {displayLabel}
          </span>
        </td>
      );

    case "facility":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-gray-600">
          {comparison.job.facility?.name || "Unknown"}
        </td>
      );

    case "client":
      const clientName = comparison.job.client?.name || "Unknown";
      const truncatedClient = clientName.length > 7 ? clientName.slice(0, 7) + "…" : clientName;
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-gray-600" title={clientName}>
          {truncatedClient}
        </td>
      );

    case "sub_client":
      const subClientName = comparison.job.sub_client || "-";
      const truncatedSubClient = subClientName.length > 7 ? subClientName.slice(0, 7) + "…" : subClientName;
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-gray-600" title={subClientName}>
          {truncatedSubClient}
        </td>
      );

    case "description":
      return (
        <td key={config.key} className="px-2 py-2 text-xs text-gray-900 max-w-[200px] truncate">
          {comparison.job.description || "N/A"}
        </td>
      );

    case "quantity":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-gray-900">
          {comparison.job.quantity.toLocaleString()}
        </td>
      );

    case "start_date":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center text-gray-600">
          {comparison.job.start_date
            ? new Date(comparison.job.start_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "N/A"}
        </td>
      );

    case "due_date":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center text-gray-600">
          {comparison.job.due_date
            ? new Date(comparison.job.due_date).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "N/A"}
        </td>
      );

    case "updated_at":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-center text-gray-600">
          {comparison.last_updated_at
            ? new Date(comparison.last_updated_at).toLocaleDateString("en-US", {
                month: "numeric",
                day: "numeric",
                year: "2-digit",
              })
            : "-"}
        </td>
      );

    case "projected":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-gray-900 text-right">
          {formatDisplayValue(comparison.projected_quantity, comparison.job)}
        </td>
      );

    case "actual":
      return (
        <td
          key={config.key}
          className={`px-2 py-2 whitespace-nowrap text-xs text-right font-semibold ${
            comparison.actual_quantity > 0 ? "text-blue-600" : "text-gray-900"
          }`}
          onClick={(e) => !isEditing && !isBatchMode && onStartEdit(comparison, e)}
        >
          {isEditing && !isBatchMode ? (
            <input
              ref={inputRef}
              type="text"
              value={
                editValue
                  ? dataDisplayMode === "revenue"
                    ? `$${calculateRevenue(parseInt(editValue), comparison.job).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : parseInt(editValue).toLocaleString()
                  : ""
              }
              onChange={(e) => onEditInputChange(e.target.value)}
              onBlur={() => onSaveEdit(comparison)}
              onKeyDown={(e) => onKeyDown(e, comparison)}
              className="w-full px-2 py-1 border border-blue-500 rounded text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={saving}
            />
          ) : (
            <span
              className={!isBatchMode ? "cursor-text hover:bg-blue-50 px-2 py-1 rounded" : ""}
            >
              {formatDisplayValue(comparison.actual_quantity, comparison.job)}
            </span>
          )}
        </td>
      );

    case "variance":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-right">
          <span className={comparison.variance >= 0 ? "text-green-600" : "text-red-600"}>
            {comparison.variance >= 0 ? "+" : ""}
            {dataDisplayMode === "revenue"
              ? `$${calculateRevenue(comparison.variance, comparison.job).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              : comparison.variance.toLocaleString()}
          </span>
        </td>
      );

    case "variance_pct":
      return (
        <td key={config.key} className="px-2 py-2 whitespace-nowrap text-xs text-right">
          <span
            className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
              comparison.variance_percentage
            )}`}
          >
            {comparison.variance_percentage >= 0 ? "+" : ""}
            {comparison.variance_percentage.toFixed(1)}%
          </span>
        </td>
      );

    default:
      return null;
  }
}

// Helper to get column count (useful for colspan calculations)
export function calculateColumnCount(
  orderedColumns: { config: ProductionColumnConfig; isVisible: boolean }[]
): number {
  return orderedColumns.filter((col) => col.isVisible).length;
}
