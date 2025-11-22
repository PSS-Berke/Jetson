"use client";

import { useState } from "react";
import { useJobEditLogs } from "@/hooks/useJobEditLogs";
import { format } from "date-fns";

export default function JobRevisionHistory() {
  const { logs, isLoading, error, refetch } = useJobEditLogs();
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--text-light)]">Loading revision history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="text-red-800 font-semibold text-lg mb-2">
            Error Loading Revision History
          </div>
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={refetch}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-[var(--text-light)]">No revision history found.</div>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return format(new Date(timestamp), "MMM d, yyyy HH:mm:ss");
  };

  const toggleExpand = (logId: number) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const normalizeValue = (value: any): any => {
    // Try to parse JSON strings for comparison
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const getFieldChanges = (oldData: any, newData: any) => {
    const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
    
    // Get all unique keys from both objects
    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    allKeys.forEach((key) => {
      // Skip id field
      if (key === "id") {
        return;
      }

      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      // Normalize values for comparison (parse JSON strings)
      const normalizedOld = normalizeValue(oldValue);
      const normalizedNew = normalizeValue(newValue);

      // Skip if values are the same after normalization
      if (JSON.stringify(normalizedOld) === JSON.stringify(normalizedNew)) {
        return;
      }

      changes.push({
        field: key,
        oldValue,
        newValue,
      });
    });

    return changes;
  };

  const formatFieldName = (fieldName: string): string => {
    // Handle special cases
    const specialCases: { [key: string]: string } = {
      po_number: "PO Number",
      id: "ID",
      jobs_id: "Job ID",
      user_id: "User ID",
      created_at: "Created At",
      updated_at: "Updated At",
    };

    if (specialCases[fieldName]) {
      return specialCases[fieldName];
    }

    // Convert snake_case to Title Case
    return fieldName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "—";
    }

    // Handle empty strings
    if (typeof value === "string" && value === "") {
      return "(empty)";
    }

    // Handle booleans
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    // Try to parse JSON strings first
    let parsedValue = value;
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        parsedValue = JSON.parse(value);
      } catch {
        // If parsing fails, return as-is
        return String(value);
      }
    }

    // Handle arrays
    if (Array.isArray(parsedValue)) {
      if (parsedValue.length === 0) {
        return "(empty array)";
      }

      // Check if array contains objects
      if (typeof parsedValue[0] === "object" && parsedValue[0] !== null) {
        // Format array of objects as key-value pairs
        return parsedValue
          .map((item, index) => {
            const entries = Object.entries(item)
              .filter(([key]) => key !== "id") // Skip id fields
              .map(([key, val]) => `${formatFieldName(key)}: ${formatValue(val)}`)
              .join(", ");
            return parsedValue.length > 1 ? `[${index + 1}] ${entries}` : entries;
          })
          .join("\n");
      }

      // Simple array of primitives
      return parsedValue.join(", ");
    }

    // Handle objects
    if (typeof parsedValue === "object") {
      const entries = Object.entries(parsedValue)
        .filter(([key]) => key !== "id") // Skip id fields
        .map(([key, val]) => `${formatFieldName(key)}: ${formatValue(val)}`)
        .join("\n");
      return entries || "(empty object)";
    }

    // Handle numbers and strings
    return String(parsedValue);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)]">
      <div className="p-6">
        <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
          Job Revision History
        </h3>

        <div className="space-y-4">
          {logs.map((log) => {
            const changes = getFieldChanges(log.old, log.new);
            const jobId = log.old?.id || log.new?.jobs_id;
            const jobName = log.old?.job_name || log.new?.job_name || "Unknown Job";
            const jobNumber = log.old?.job_number || log.new?.job_number || "N/A";
            const isExpanded = expandedIds.has(log.id);

            return (
              <div
                key={log.id}
                className="border border-[var(--border)] rounded-lg hover:shadow-md transition-shadow"
              >
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="w-full p-4 text-left flex justify-between items-start hover:bg-gray-50 transition-colors rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-semibold text-[var(--dark-blue)]">
                      Job #{jobNumber} - {jobName}
                    </div>
                    <div className="text-sm text-[var(--text-light)] mt-1">
                      Edited by {log.name} ({log.email})
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-sm text-[var(--text-light)] whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </div>
                    <svg
                      className={`w-5 h-5 text-[var(--text-light)] transition-transform ${
                        isExpanded ? "transform rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-[var(--border)] pt-4">
                    {changes.length > 0 ? (
                      <div>
                        <div className="text-sm font-medium text-[var(--dark-blue)] mb-3">
                          Changes:
                        </div>
                        <div className="space-y-2">
                          {changes.map((change, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-50 rounded p-3 border border-gray-200"
                            >
                              <div className="font-medium text-sm text-gray-700 mb-1">
                                {formatFieldName(change.field)}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">Old Value:</div>
                                  <div className="bg-red-50 border border-red-200 rounded p-2 text-gray-800 break-words whitespace-pre-wrap text-xs">
                                    {formatValue(change.oldValue)}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-xs text-gray-500 mb-1">New Value:</div>
                                  <div className="bg-green-50 border border-green-200 rounded p-2 text-gray-800 break-words whitespace-pre-wrap text-xs">
                                    {formatValue(change.newValue)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-[var(--text-light)]">
                        No field changes detected
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

