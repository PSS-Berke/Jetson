/**
 * Machine Group Selector Component
 * Allows selecting no group, existing group, or creating a new group
 */

"use client";

import React, { useState, useEffect } from "react";
import { getMachineGroups } from "@/lib/api";
import type { MachineGroup } from "@/types";

interface MachineGroupSelectorProps {
  selectedOption: "none" | "existing" | "new";
  existingGroupId: number | null;
  newGroupName: string;
  newGroupDescription: string;
  processTypeKey: string;
  facilitiesId: number | null;
  onSelectOption: (option: "none" | "existing" | "new") => void;
  onSelectExistingGroup: (groupId: number) => void;
  onSetNewGroupName: (name: string) => void;
  onSetNewGroupDescription: (description: string) => void;
  errors: Record<string, string>;
}

export default function MachineGroupSelector({
  selectedOption,
  existingGroupId,
  newGroupName,
  newGroupDescription,
  processTypeKey,
  facilitiesId,
  onSelectOption,
  onSelectExistingGroup,
  onSetNewGroupName,
  onSetNewGroupDescription,
  errors,
}: MachineGroupSelectorProps) {
  const [groups, setGroups] = useState<MachineGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load available groups when process type or facility changes
  useEffect(() => {
    if (!processTypeKey) return;

    const loadGroups = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getMachineGroups(
          processTypeKey,
          facilitiesId || undefined,
        );
        setGroups(data);
      } catch (error) {
        console.error("[MachineGroupSelector] Error loading groups:", error);
        setLoadError("Failed to load machine groups");
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [processTypeKey, facilitiesId]);

  const selectedGroup = groups.find((g) => g.id === existingGroupId);

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-gray-700 mb-3">
        Machine Group (Optional)
      </label>

      {/* Option 1: No Group */}
      <div
        onClick={() => onSelectOption("none")}
        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
          selectedOption === "none"
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedOption === "none" ? "border-blue-500" : "border-gray-300"
            }`}
          >
            {selectedOption === "none" && (
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">No Group</div>
            <div className="text-sm text-gray-500">
              This machine will operate independently without group rules
            </div>
          </div>
        </div>
      </div>

      {/* Option 2: Existing Group */}
      <div
        onClick={() => onSelectOption("existing")}
        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
          selectedOption === "existing"
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedOption === "existing"
                ? "border-blue-500"
                : "border-gray-300"
            }`}
          >
            {selectedOption === "existing" && (
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">Join Existing Group</div>
            <div className="text-sm text-gray-500">
              Add this machine to an existing group to share rules
            </div>
          </div>
        </div>

        {/* Existing Groups Dropdown */}
        {selectedOption === "existing" && (
          <div className="ml-8 mt-3">
            {loading ? (
              <div className="text-sm text-gray-500 italic">
                Loading groups...
              </div>
            ) : loadError ? (
              <div className="text-sm text-red-600">{loadError}</div>
            ) : groups.length === 0 ? (
              <div className="text-sm text-gray-500 italic">
                No existing groups found for this process type.
              </div>
            ) : (
              <div className="space-y-2">
                {groups.map((group) => (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onSelectExistingGroup(group.id)}
                    className={`w-full text-left p-3 rounded-md border transition-all ${
                      existingGroupId === group.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="font-medium text-gray-900">
                      {group.name}
                    </div>
                    {group.description && (
                      <div className="text-sm text-gray-500 mt-1">
                        {group.description}
                      </div>
                    )}
                    <div className="text-xs text-gray-400 mt-1">
                      {group.machine_ids.length} machine(s)
                    </div>
                  </button>
                ))}
              </div>
            )}
            {errors.existingGroupId && (
              <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                {errors.existingGroupId}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Option 3: Create New Group */}
      <div
        onClick={() => onSelectOption("new")}
        className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
          selectedOption === "new"
            ? "border-blue-500 bg-blue-50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }`}
      >
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              selectedOption === "new" ? "border-blue-500" : "border-gray-300"
            }`}
          >
            {selectedOption === "new" && (
              <div className="w-3 h-3 rounded-full bg-blue-500" />
            )}
          </div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">Create New Group</div>
            <div className="text-sm text-gray-500">
              Start a new group for machines with shared rules
            </div>
          </div>
        </div>

        {/* New Group Form */}
        {selectedOption === "new" && (
          <div className="ml-8 mt-3 space-y-3">
            <div>
              <label
                htmlFor="newGroupName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Group Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="newGroupName"
                value={newGroupName}
                onChange={(e) => onSetNewGroupName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="e.g., High-Speed Inserters, Standard Folders"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {errors.newGroupName && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.newGroupName}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="newGroupDescription"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Description (Optional)
              </label>
              <textarea
                id="newGroupDescription"
                value={newGroupDescription}
                onChange={(e) => onSetNewGroupDescription(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                placeholder="Describe what makes this group unique or what rules they share..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Selected Group Display */}
      {selectedOption === "existing" && selectedGroup && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <svg
              className="w-4 h-4 text-green-500"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-green-800">
              <strong>{selectedGroup.name}</strong> selected (
              {selectedGroup.machine_ids.length} machine(s))
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
