"use client";

import { ProcessTypeSummary, formatQuantity, TimeRange } from "@/lib/projectionUtils";
import { ChevronRight, ChevronDown } from "lucide-react";
import { SizeField } from "@/lib/sizeFieldUtils";

interface ProcessTypeSummaryRowProps {
  summary: ProcessTypeSummary;
  timeRanges: TimeRange[];
  showNotes: boolean;
  isExpanded: boolean;
  hasBreakdowns: boolean;
  onToggleExpand: () => void;
  isFacilitySummary?: boolean;
  facilityName?: string;
  expandCollapseAllButton?: React.ReactNode;
  onCategoryClick?: (processType: string, timeRangeLabel?: string) => void;
  onSizeFieldClick?: (processType: string, fieldName: string, fieldValue: string) => void;
  isCategoryFilterActive?: boolean;
  visibleStaticColumnKeys?: string[];
  isColumnVisible?: (key: string) => boolean;
  sizeFields?: SizeField[]; // New prop for size fields
  activeSizeFilter?: { fieldName: string; fieldValue: string } | null; // Active size filter to avoid duplicates
}

// Default column keys if not provided (for backward compatibility)
const DEFAULT_STATIC_COLUMNS = [
  "job_number",
  "facility",
  "sub_client",
  "processes",
  "description",
  "quantity",
];

export function ProcessTypeSummaryRow({
  summary,
  timeRanges,
  showNotes,
  isExpanded,
  hasBreakdowns,
  onToggleExpand,
  isFacilitySummary = false,
  facilityName,
  expandCollapseAllButton,
  onCategoryClick,
  onSizeFieldClick,
  isCategoryFilterActive = false,
  visibleStaticColumnKeys,
  isColumnVisible,
  sizeFields = [],
  activeSizeFilter = null,
}: ProcessTypeSummaryRowProps) {
  const displayValue = summary.grandTotal;
  const formattedTotal = formatQuantity(Math.round(displayValue));

  // Determine which static columns are visible (excluding checkbox, start_date, due_date)
  const staticColumnsToRender = visibleStaticColumnKeys && isColumnVisible
    ? visibleStaticColumnKeys.filter(key =>
        isColumnVisible(key) &&
        !["checkbox", "start_date", "due_date"].includes(key)
      )
    : DEFAULT_STATIC_COLUMNS;

  // Calculate colSpan for start/end date columns
  const startDateVisible = isColumnVisible ? isColumnVisible("start_date") : true;
  const dueDateVisible = isColumnVisible ? isColumnVisible("due_date") : true;
  const dateColSpan = (startDateVisible ? 1 : 0) + (dueDateVisible ? 1 : 0);

  // Create display label
  const displayLabel = isFacilitySummary && facilityName
    ? `${summary.processType} (${facilityName})`
    : summary.processType;

  return (
    <tr 
      className={`font-semibold text-sm border-b border-blue-200 ${
        isCategoryFilterActive ? "bg-blue-200" : "bg-blue-50"
      } ${onCategoryClick ? "cursor-pointer hover:bg-blue-100" : ""}`}
      onClick={(e) => {
        // Don't trigger category click when clicking expand/collapse button or size fields
        if ((e.target as HTMLElement).closest('button') || 
            (e.target as HTMLElement).closest('.size-field')) {
          return;
        }
        onCategoryClick?.(summary.processType);
      }}
    >
      {/* Checkbox column */}
      <th className="px-2 py-2 w-12">
        {expandCollapseAllButton && (
          <div onClick={(e) => e.stopPropagation()}>
            {expandCollapseAllButton}
          </div>
        )}
      </th>
      {/* Dynamic empty cells for visible static columns */}
      {staticColumnsToRender.map((colKey) => (
        <th key={colKey} className="px-2 py-2"></th>
      ))}
      {/* Start & End columns - Dropdown icon (far left), size fields, and process type name */}
      <th colSpan={dateColSpan > 0 ? dateColSpan : 1} className="px-2 py-2 text-left">
        <div className="flex items-center gap-2">
          {/* Expand/collapse button - always visible on far left if there are breakdowns or size fields */}
          {(hasBreakdowns || sizeFields.length > 0) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="p-1 hover:bg-blue-200 rounded transition-colors flex-shrink-0"
              title={isExpanded ? "Collapse breakdown" : "Expand breakdown"}
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-gray-700" />
              ) : (
                <ChevronRight className="w-4 h-4 text-gray-700" />
              )}
            </button>
          )}

          {/* Size fields - displayed horizontally after dropdown icon, only when expanded */}
          {isExpanded && sizeFields.length > 0 && (() => {
            // Collect all unique size values and track which fields have each value
            const valueToFields = new Map<string, SizeField[]>();
            
            sizeFields.forEach((sizeField) => {
              sizeField.values.forEach((value) => {
                if (!valueToFields.has(value)) {
                  valueToFields.set(value, []);
                }
                valueToFields.get(value)!.push(sizeField);
              });
            });
            
            // Determine which values to show
            const valuesToShow: Array<{ value: string; fields: SizeField[]; isActive: boolean }> = [];
            
            if (activeSizeFilter && activeSizeFilter.fieldValue) {
              // When a filter is active:
              // 1. Show all OTHER fields that have the same size value (highlighted)
              const filteredValue = activeSizeFilter.fieldValue;
              const filteredFieldName = activeSizeFilter.fieldName;
              
              // Find all fields that have this value but are NOT the filtered field
              const fieldsWithFilteredValue = (valueToFields.get(filteredValue) || []).filter(field => {
                // Exclude the exact field being filtered
                if (field.name === filteredFieldName) return false;
                // For composite fields, check if they contain the filtered field name
                if (field.name.startsWith("COMPOSITE_")) {
                  const compositeName = field.name.replace("COMPOSITE_", "");
                  return !compositeName.includes(filteredFieldName);
                }
                // For regular fields being filtered as part of composite
                if (filteredFieldName?.startsWith("COMPOSITE_")) {
                  const compositeParts = filteredFieldName.replace("COMPOSITE_", "").split("_");
                  return !compositeParts.includes(field.name);
                }
                return true;
              });
              
              // If other fields have the same value, show it (highlighted)
              if (fieldsWithFilteredValue.length > 0) {
                valuesToShow.push({
                  value: filteredValue,
                  fields: fieldsWithFilteredValue,
                  isActive: true,
                });
              }
              
              // 2. Show all other size values (not the filtered one)
              valueToFields.forEach((fields, value) => {
                if (value !== filteredValue) {
                  valuesToShow.push({
                    value,
                    fields,
                    isActive: false,
                  });
                }
              });
            } else {
              // No active filter - show all unique values
              valueToFields.forEach((fields, value) => {
                valuesToShow.push({
                  value,
                  fields,
                  isActive: false,
                });
              });
            }
            
            return (
              <div className="flex items-center gap-1 flex-wrap mr-2">
                {valuesToShow.map(({ value, fields, isActive }) => {
                  // Find the primary field (prefer non-composite, or first one)
                  const primaryField = fields.find(f => !f.isComposite) || fields[0];
                  
                  return (
                    <button
                      key={`size-${value}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSizeFieldClick?.(summary.processType, primaryField.name, value);
                      }}
                      className={`size-field px-2 py-1 text-xs border rounded transition-colors ${
                        isActive
                          ? "bg-blue-500 text-white border-blue-600 font-semibold"
                          : "bg-white border-blue-300 hover:bg-blue-100 hover:border-blue-400"
                      }`}
                      title={`Filter by size: ${value}${fields.length > 1 ? ` (${fields.map(f => f.label).join(", ")})` : ` (${primaryField.label})`}`}
                    >
                      <span className={isActive ? "text-white" : "text-gray-800 font-semibold"}>{value}</span>
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Process type label */}
          <span className="text-gray-800 font-semibold">{displayLabel}</span>
        </div>
      </th>
      {/* Time period totals */}
      {timeRanges.map((range, index) => {
        const periodValue = summary.weeklyTotals.get(range.label) || 0;
        const formattedValue = formatQuantity(Math.round(periodValue));

        return (
          <th
            key={range.label}
            className={`px-2 py-2 text-center text-xs font-semibold ${
              index % 2 === 0 ? "bg-blue-100" : "bg-blue-50"
            } ${onCategoryClick ? "cursor-pointer hover:bg-blue-200" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onCategoryClick?.(summary.processType, range.label);
            }}
          >
            {formattedValue}
          </th>
        );
      })}
      {/* Grand total */}
      <th className="px-2 py-2 text-center text-gray-800 font-semibold">
        {formattedTotal}
      </th>
      {/* Empty notes column if visible */}
      {showNotes && <th className="px-2 py-2"></th>}
    </tr>
  );
}
