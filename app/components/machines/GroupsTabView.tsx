"use client";

import { useState, useEffect } from "react";
import { getAllVariableCombinations, getMachineRules, api } from "@/lib/api";
import type { MachineRule } from "@/types";
import { formatConditions } from "@/lib/rulesEngine";
import { Plus } from "lucide-react";
import RuleCreationForm from "../wizard/RuleCreationForm";
import type { RuleFormData } from "@/hooks/useWizardState";

interface GroupData {
  id: number;
  rule_name: string;
  description?: string;
  process_type?: string;
  is_grouped?: boolean; // Distinguishes explicitly created groups from auto-generated configurations
}

interface GroupsTabViewProps {
  machineType?: string;
}

// Helper function to get filter function for machine type
const getTypeFilterFn = (machineType: string) => {
  const typeFilters: Record<string, (machine: any) => boolean> = {
    inserters: (machine) => machine.type.toLowerCase().includes("insert"),
    folders: (machine) =>
      machine.type.toLowerCase().includes("folder") ||
      machine.type.toLowerCase().includes("fold"),
    "hp-press": (machine) =>
      machine.type.toLowerCase().includes("hp") ||
      machine.type.toLowerCase().includes("press"),
    inkjetters: (machine) => machine.type.toLowerCase().includes("inkjet"),
    affixers: (machine) =>
      machine.type.toLowerCase().includes("affixer") ||
      machine.type.toLowerCase().includes("affix"),
  };

  return typeFilters[machineType] || (() => true);
};

export default function GroupsTabView({ machineType }: GroupsTabViewProps) {
  const [selectedMachineType, setSelectedMachineType] = useState<string | null>(
    machineType || null
  );
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
  const [groupRules, setGroupRules] = useState<Record<number, MachineRule[]>>(
    {}
  );
  const [loadingRules, setLoadingRules] = useState<Record<number, boolean>>({});
  const [isCreating, setIsCreating] = useState(false);
  const [machineGroupIds, setMachineGroupIds] = useState<number[]>([]);
  const [selectedGroupForRule, setSelectedGroupForRule] = useState<number | null>(null);
  const [existingRulesForGroup, setExistingRulesForGroup] = useState<RuleFormData[]>([]);

  // Machine type tiles data
  const machineTypes = [
    {
      key: "inserters",
      name: "Inserters",
      description: "High-speed insertion machines",
    },
    {
      key: "folders",
      name: "Folders",
      description: "Document folding equipment",
    },
    {
      key: "hp-press",
      name: "HP Press",
      description: "High-performance printing press",
    },
    {
      key: "inkjetters",
      name: "Inkjetters",
      description: "Inkjet printing systems",
    },
    {
      key: "affixers",
      name: "Affixers",
      description: "Label and stamp affixing machines",
    },
  ];

  // Fetch machines of this type to get their group IDs
  useEffect(() => {
    if (!selectedMachineType) {
      return;
    }

    const fetchMachineGroupIds = async () => {
      try {
        const machines = await api.get<any[]>("/machines");
        // Filter machines by type
        const typeFilterFn = getTypeFilterFn(selectedMachineType);
        const filteredMachines = machines.filter(typeFilterFn);

        // Extract unique variable_combination_id values
        const groupIds = Array.from(
          new Set(
            filteredMachines
              .map((m) => m.variable_combination_id)
              .filter((id) => id !== null && id !== undefined)
          )
        );

        setMachineGroupIds(groupIds as number[]);
      } catch (error) {
        console.error(
          "[GroupsTabView] Error fetching machine group IDs:",
          error
        );
      }
    };

    fetchMachineGroupIds();
  }, [selectedMachineType]);

  // Fetch all groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoadingGroups(true);
        const variableCombinations = await getAllVariableCombinations();

        const transformedGroups = variableCombinations.map((vc) => ({
          id: vc.id,
          rule_name: vc.rule_name || `Group ${vc.id}`,
          description: vc.description,
          process_type: vc.process_type,
        }));

        setGroups(transformedGroups);
      } catch (error) {
        console.error("[GroupsTabView] Error fetching groups:", error);
        setGroups([]);
      } finally {
        setLoadingGroups(false);
      }
    };

    fetchGroups();
  }, []);

  // Fetch rules when a group is expanded
  useEffect(() => {
    if (expandedGroup === null) {
      return;
    }

    // Check if we already have rules for this group
    if (groupRules[expandedGroup]) {
      return;
    }

    const fetchRules = async () => {
      setLoadingRules((prev) => ({ ...prev, [expandedGroup]: true }));

      try {
        // Fetch all rules and filter by machine_group_id
        // Note: API doesn't support machine_group_id filtering yet, so we fetch all and filter client-side
        const rules = await getMachineRules();
        const filteredRules = rules.filter((rule) => rule.machine_group_id === expandedGroup);
        setGroupRules((prev) => ({
          ...prev,
          [expandedGroup]: filteredRules || [],
        }));
      } catch (error) {
        console.error("[GroupsTabView] Error fetching rules:", error);
        setGroupRules((prev) => ({
          ...prev,
          [expandedGroup]: [],
        }));
      } finally {
        setLoadingRules((prev) => ({ ...prev, [expandedGroup]: false }));
      }
    };

    fetchRules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandedGroup]);

  const toggleExpand = (groupId: number) => {
    setExpandedGroup(expandedGroup === groupId ? null : groupId);
  };

  const handleAddRule = async (rule: RuleFormData) => {
    if (!selectedGroupForRule) {
      alert("Please select a group first.");
      return;
    }

    try {
      // Create the rule via API
      // Note: This is simplified - you may need to adjust based on your API
      alert("Rule creation API integration needed - rule data ready");
      console.log("Rule to create:", rule, "For group:", selectedGroupForRule);

      // Reset form
      setIsCreating(false);
      setSelectedGroupForRule(null);
      setExistingRulesForGroup([]);

      // Refresh the list
      window.location.reload();
    } catch (error) {
      console.error("[GroupsTabView] Error creating rule:", error);
      alert("Failed to create rule. Please try again.");
    }
  };

  // Filter groups if selectedMachineType is set
  // Only show explicitly created groups (is_grouped === true)
  const filteredGroups = selectedMachineType
    ? groups.filter((group) => machineGroupIds.includes(group.id) && group.is_grouped === true)
    : groups.filter((group) => group.is_grouped === true);

  // If no machineType prop was passed (global view), show machine type selection first
  if (!machineType && !selectedMachineType) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Select a Machine Type
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Choose a machine type to view and manage its groups and rules
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machineTypes.map((machine) => (
            <button
              key={machine.key}
              onClick={() => setSelectedMachineType(machine.key)}
              className="group bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 hover:shadow-md hover:border-[var(--primary-blue)] transition-all duration-200 cursor-pointer text-left"
            >
              <div className="flex flex-col items-center text-center">
                <h3 className="text-xl font-semibold text-[var(--dark-blue)] mb-2">
                  {machine.name}
                </h3>
                <p className="text-[var(--text-light)] text-sm">
                  {machine.description}
                </p>
                <div className="mt-4 text-[var(--primary-blue)] font-medium group-hover:translate-x-1 transition-transform duration-200">
                  Manage Rules →
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (loadingGroups) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading groups...</span>
      </div>
    );
  }

  if (filteredGroups.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-blue-600"
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
              Machine Groups & Rules
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {machineType
                ? `No groups found for ${machineType} machines`
                : "No machine groups configured"}
            </p>
          </div>
        </div>
        <div className="text-center py-12 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto mb-3 text-gray-400"
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
          <p>No machine groups for this type</p>
        </div>
      </div>
    );
  }

  // Get selected machine type name for display
  const selectedMachineTypeName = selectedMachineType
    ? machineTypes.find((mt) => mt.key === selectedMachineType)?.name
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {!machineType && selectedMachineType && (
              <button
                onClick={() => setSelectedMachineType(null)}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to machine types"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
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
                Machine Groups & Rules
                {selectedMachineTypeName && (
                  <span className="text-[var(--primary-blue)]">
                    - {selectedMachineTypeName}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedMachineTypeName
                  ? `Viewing groups for ${selectedMachineTypeName} machines`
                  : "View and manage machine groups and their associated rules"}
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setIsCreating(!isCreating)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Rule
        </button>
      </div>

      {isCreating && (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Add New Rule
            </h4>
            <button
              onClick={() => {
                setIsCreating(false);
                setSelectedGroupForRule(null);
                setExistingRulesForGroup([]);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Group <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedGroupForRule || ""}
              onChange={(e) => setSelectedGroupForRule(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a group...</option>
              {filteredGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.rule_name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Rules will be added to the selected group
            </p>
          </div>

          {selectedGroupForRule && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                Note: The RuleCreationForm component requires a processTypeKey and machineVariablesId.
                This integration is simplified for demonstration. You'll need to pass the appropriate
                values based on the selected group.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {filteredGroups.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const rules = groupRules[group.id] || [];
          const rulesLoading = loadingRules[group.id] || false;

          return (
            <div
              key={group.id}
              className="bg-white rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all"
            >
              <button
                type="button"
                onClick={() => toggleExpand(group.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg
                        className="w-5 h-5 text-blue-600"
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
                      <span className="font-semibold text-gray-900 text-lg">
                        {group.rule_name}
                      </span>
                      {group.process_type && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">
                          {group.process_type}
                        </span>
                      )}
                    </div>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">
                        {group.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {rules.length > 0
                        ? `${rules.length} rule${rules.length !== 1 ? "s" : ""} configured`
                        : isExpanded && !rulesLoading
                          ? "No rules configured"
                          : "Click to view rules"}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 border-t border-gray-200 pt-3">
                  {rulesLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-xs text-gray-500">
                        Loading rules...
                      </p>
                    </div>
                  ) : rules.length > 0 ? (
                    <div className="space-y-3">
                      {rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="bg-green-50 border border-green-200 rounded-lg p-4"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 text-base mb-1">
                                {rule.name}
                              </div>
                              <div className="text-sm text-gray-700">
                                <span className="font-medium">Conditions:</span>{" "}
                                {formatConditions(rule.conditions)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-700 mt-2">
                            <div className="flex items-center gap-1">
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
                              <span className="font-medium">Speed:</span>{" "}
                              {rule.outputs.speed_modifier}%
                            </div>
                            <div className="flex items-center gap-1">
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
                              <span className="font-medium">People:</span>{" "}
                              {rule.outputs.people_required}
                            </div>
                          </div>
                          {rule.outputs.notes && (
                            <div className="mt-2 pt-2 border-t border-green-300">
                              <p className="text-xs text-gray-600 italic">
                                {rule.outputs.notes}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                      No rules configured for this group
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
