"use client";

import { useState } from "react";
import type { MachineRule } from "@/types";
import { formatConditions } from "@/lib/rulesEngine";

interface RuleCardProps {
  rule: MachineRule;
  groupName?: string;
  machineName?: string;
  onEdit?: (rule: MachineRule) => void;
  onDelete?: (ruleId: number) => void;
  isExpanded: boolean;
  onToggleExpand: (ruleId: number) => void;
}

export default function RuleCard({
  rule,
  groupName,
  machineName,
  onEdit,
  onDelete,
  isExpanded,
  onToggleExpand,
}: RuleCardProps) {
  const getPriorityBadgeColor = (priority: number) => {
    if (priority >= 90) return "bg-red-100 text-red-700 border-red-200";
    if (priority >= 70) return "bg-orange-100 text-orange-700 border-orange-200";
    if (priority >= 50) return "bg-yellow-100 text-yellow-700 border-yellow-200";
    return "bg-blue-100 text-blue-700 border-blue-200";
  };

  const getProcessTypeName = (key: string) => {
    const names: Record<string, string> = {
      insert: "Insert",
      fold: "Fold",
      laser: "Laser",
      inkjet: "Inkjet",
      affix: "Affix",
    };
    return names[key] || key;
  };

  return (
    <div className="border border-[var(--border)] rounded-lg hover:shadow-md transition-shadow">
      <button
        onClick={() => onToggleExpand(rule.id)}
        className="w-full p-4 text-left flex justify-between items-start hover:bg-gray-50 transition-colors rounded-lg"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-semibold text-[var(--dark-blue)] text-base">
              {rule.name}
            </span>

            {/* Priority Badge */}
            <span
              className={`px-2 py-0.5 text-xs font-semibold rounded border ${getPriorityBadgeColor(
                rule.priority
              )}`}
            >
              Priority: {rule.priority}
            </span>

            {/* Process Type Badge */}
            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded border border-purple-200">
              {getProcessTypeName(rule.process_type_key)}
            </span>

            {/* Active/Inactive Badge */}
            {rule.active === false && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded border border-gray-300">
                Inactive
              </span>
            )}
          </div>

          {/* Group or Machine Association */}
          <div className="text-sm text-[var(--text-light)] mt-1">
            {groupName && (
              <span className="inline-flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Group: {groupName}
              </span>
            )}
            {machineName && (
              <span className="inline-flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
                Machine: {machineName}
              </span>
            )}
          </div>

          {/* Conditions Preview */}
          <div className="text-xs text-gray-600 mt-2 line-clamp-1">
            <span className="font-medium">When:</span> {formatConditions(rule.conditions)}
          </div>
        </div>

        {/* Expand/Collapse Chevron */}
        <div className="flex items-center gap-3 ml-4">
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

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-[var(--border)] pt-4">
          <div className="space-y-4">
            {/* Conditions Section */}
            <div>
              <div className="text-sm font-semibold text-[var(--dark-blue)] mb-2">
                Conditions
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-gray-800">
                  {formatConditions(rule.conditions)}
                </div>
              </div>
            </div>

            {/* Outputs Section */}
            <div>
              <div className="text-sm font-semibold text-[var(--dark-blue)] mb-2">
                Performance Impact
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    <span className="text-sm">
                      <span className="font-medium">Speed:</span>{" "}
                      {rule.outputs.speed_modifier}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <span className="text-sm">
                      <span className="font-medium">People:</span>{" "}
                      {rule.outputs.people_required}
                    </span>
                  </div>
                  {rule.outputs.fixed_rate && (
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm">
                        <span className="font-medium">Fixed Rate:</span>{" "}
                        {rule.outputs.fixed_rate}
                      </span>
                    </div>
                  )}
                </div>
                {rule.outputs.notes && (
                  <div className="mt-3 pt-3 border-t border-green-300">
                    <p className="text-xs text-gray-700 italic">
                      <span className="font-medium not-italic">Notes:</span>{" "}
                      {rule.outputs.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {(onEdit || onDelete) && (
              <div className="flex gap-2 pt-2">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(rule);
                    }}
                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Are you sure you want to delete the rule "${rule.name}"?`
                        )
                      ) {
                        onDelete(rule.id);
                      }
                    }}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
