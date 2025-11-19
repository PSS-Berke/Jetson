"use client";

import { useState } from "react";
import { useJobEditLogs } from "@/hooks/useJobEditLogs";
import { format } from "date-fns";

interface JobRevisionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: number;
  jobNumber: number;
  jobName?: string;
}

export default function JobRevisionHistoryModal({
  isOpen,
  onClose,
  jobId,
  jobNumber,
  jobName,
}: JobRevisionHistoryModalProps) {
  const { logs, isLoading, error, refetch } = useJobEditLogs(jobId);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  if (!isOpen) return null;

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

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return "—";
    }
    
    // Try to parse JSON strings
    if (typeof value === "string" && (value.startsWith("[") || value.startsWith("{"))) {
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If parsing fails, return as-is
      }
    }
    
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }
    if (typeof value === "string" && value === "") {
      return "(empty)";
    }
    return String(value);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border)] sticky top-0 bg-white">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
              Revision History
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-light)] mt-1">
              Job #{jobNumber} {jobName && `- ${jobName}`}
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
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="text-[var(--text-light)]">Loading revision history...</div>
            </div>
          ) : error ? (
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
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-[var(--text-light)]">No revision history found for this job.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const changes = getFieldChanges(log.old, log.new);
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
                          Edited by {log.name} ({log.email})
                        </div>
                        <div className="text-sm text-[var(--text-light)] mt-1">
                          {changes.length} {changes.length === 1 ? "change" : "changes"}
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
                                    {change.field}
                                  </div>
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">Old Value:</div>
                                      <div className="bg-red-50 border border-red-200 rounded p-2 text-gray-800 break-words">
                                        <pre className="whitespace-pre-wrap text-xs">
                                          {formatValue(change.oldValue)}
                                        </pre>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-gray-500 mb-1">New Value:</div>
                                      <div className="bg-green-50 border border-green-200 rounded p-2 text-gray-800 break-words">
                                        <pre className="whitespace-pre-wrap text-xs">
                                          {formatValue(change.newValue)}
                                        </pre>
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
          )}
        </div>
      </div>
    </div>
  );
}

