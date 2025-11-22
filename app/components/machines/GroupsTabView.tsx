"use client";

import { useState, useEffect } from "react";
import { getAllVariableCombinations, getMachineRules, getMachines, deleteMachineRule } from "@/lib/api";
import type { MachineRule } from "@/types";
import RuleCard from "../RuleCard";
import { Plus, Filter, X } from "lucide-react";

interface GroupData {
  id: number;
  rule_name: string;
  description?: string;
  process_type?: string;
  is_grouped?: boolean;
}

interface MachineData {
  id: number;
  name?: string;
  type: string;
  variable_combination_id?: number;
}

interface EnrichedRule extends MachineRule {
  groupName?: string;
  machineName?: string;
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
  const [allRules, setAllRules] = useState<EnrichedRule[]>([]);
  const [filteredRules, setFilteredRules] = useState<EnrichedRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(true);
  const [expandedRuleIds, setExpandedRuleIds] = useState<Set<number>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  // Filter states
  const [filterGroup, setFilterGroup] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"priority" | "name" | "created">("priority");
  const [showFilters, setShowFilters] = useState(false);

  // Data for filters
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [machines, setMachines] = useState<MachineData[]>([]);

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

  // Fetch all data needed for enrichment and filtering
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoadingRules(true);

        // Fetch all rules, groups, and machines in parallel
        const [rulesData, groupsData, machinesData] = await Promise.all([
          getMachineRules(),
          getAllVariableCombinations(),
          getMachines(), // Use getMachines() instead of api.get to properly handle the response
        ]);

        // Create lookup maps
        const groupMap = new Map(groupsData.map((g) => [g.id, g.rule_name || `Group ${g.id}`]));
        const machineMap = new Map(machinesData.map((m) => [m.id, m.name]));

        // Enrich rules with group and machine names
        const enrichedRules: EnrichedRule[] = rulesData.map((rule) => ({
          ...rule,
          groupName: rule.machine_group_id ? groupMap.get(rule.machine_group_id) : undefined,
          machineName: rule.machine_id ? machineMap.get(rule.machine_id) : undefined,
        }));

        setAllRules(enrichedRules);
        setGroups(groupsData);
        setMachines(machinesData);
      } catch (error) {
        console.error("[GroupsTabView] Error fetching data:", error);
        setAllRules([]);
      } finally {
        setLoadingRules(false);
      }
    };

    fetchData();
  }, []);

  // Apply filters and sorting whenever dependencies change
  useEffect(() => {
    let filtered = [...allRules];

    // Filter by machine type
    if (selectedMachineType) {
      filtered = filtered.filter((rule) => {
        // Check if rule applies to machines of this type
        if (rule.machine_id) {
          const machine = machines.find((m) => m.id === rule.machine_id);
          if (!machine) return false;
          const typeFilterFn = getTypeFilterFn(selectedMachineType);
          return typeFilterFn(machine);
        }
        // If rule applies to a group, check if any machines in that group match the type
        if (rule.machine_group_id) {
          const groupMachines = machines.filter(
            (m) => m.variable_combination_id === rule.machine_group_id
          );
          if (groupMachines.length === 0) return false;
          const typeFilterFn = getTypeFilterFn(selectedMachineType);
          return groupMachines.some(typeFilterFn);
        }
        // If no specific machine or group, include it
        return true;
      });
    }

    // Filter by group
    if (filterGroup !== "all") {
      filtered = filtered.filter(
        (rule) => rule.machine_group_id?.toString() === filterGroup
      );
    }

    // Filter by priority range
    if (filterPriority !== "all") {
      if (filterPriority === "high") {
        filtered = filtered.filter((rule) => rule.priority >= 90);
      } else if (filterPriority === "medium") {
        filtered = filtered.filter((rule) => rule.priority >= 50 && rule.priority < 90);
      } else if (filterPriority === "low") {
        filtered = filtered.filter((rule) => rule.priority < 50);
      }
    }

    // Filter by active status
    if (filterActive !== "all") {
      const isActive = filterActive === "active";
      filtered = filtered.filter((rule) => (rule.active ?? true) === isActive);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === "priority") {
        return b.priority - a.priority; // Higher priority first
      } else if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "created") {
        return b.created_at - a.created_at; // Newer first
      }
      return 0;
    });

    setFilteredRules(filtered);
  }, [allRules, selectedMachineType, filterGroup, filterPriority, filterActive, sortBy, machines]);

  const toggleExpand = (ruleId: number) => {
    setExpandedRuleIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(ruleId)) {
        newSet.delete(ruleId);
      } else {
        newSet.add(ruleId);
      }
      return newSet;
    });
  };

  const handleDeleteRule = async (ruleId: number) => {
    try {
      await deleteMachineRule(ruleId);
      // Remove from local state
      setAllRules((prev) => prev.filter((rule) => rule.id !== ruleId));
    } catch (error) {
      console.error("[GroupsTabView] Error deleting rule:", error);
      alert("Failed to delete rule. Please try again.");
    }
  };

  const handleEditRule = (rule: MachineRule) => {
    // TODO: Implement edit functionality
    alert(`Edit functionality for rule "${rule.name}" coming soon!`);
  };

  // Get unique groups that have rules for the filter dropdown
  const groupsWithRules = groups.filter((group) =>
    allRules.some((rule) => rule.machine_group_id === group.id)
  );

  // If no machineType prop was passed (global view), show machine type selection first
  if (!machineType && !selectedMachineType) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Select a Machine Type
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Choose a machine type to view and manage its rules
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

  if (loadingRules) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading rules...</span>
      </div>
    );
  }

  // Get selected machine type name for display
  const selectedMachineTypeName = selectedMachineType
    ? machineTypes.find((mt) => mt.key === selectedMachineType)?.name
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Machine Rules
                {selectedMachineTypeName && (
                  <span className="text-[var(--primary-blue)]">
                    - {selectedMachineTypeName}
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {filteredRules.length} rule{filteredRules.length !== 1 ? "s" : ""} configured
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
              showFilters
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={() => setIsCreating(!isCreating)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-900">Filter & Sort</h4>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Group Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Group
              </label>
              <select
                value={filterGroup}
                onChange={(e) => setFilterGroup(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Groups</option>
                {groupsWithRules.map((group) => (
                  <option key={group.id} value={group.id.toString()}>
                    {group.rule_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <select
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Priorities</option>
                <option value="high">High (90+)</option>
                <option value="medium">Medium (50-89)</option>
                <option value="low">Low (&lt;50)</option>
              </select>
            </div>

            {/* Active Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "priority" | "name" | "created")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="priority">Priority (High to Low)</option>
                <option value="name">Name (A-Z)</option>
                <option value="created">Recently Created</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {(filterGroup !== "all" || filterPriority !== "all" || filterActive !== "all" || sortBy !== "priority") && (
            <div className="mt-3 pt-3 border-t border-gray-300">
              <button
                onClick={() => {
                  setFilterGroup("all");
                  setFilterPriority("all");
                  setFilterActive("all");
                  setSortBy("priority");
                }}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create Rule Form */}
      {isCreating && (
        <div className="bg-white border-2 border-blue-500 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Add New Rule
            </h4>
            <button
              onClick={() => setIsCreating(false)}
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

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Rule creation interface coming soon. This will allow you to create new rules with conditions and outputs.
            </p>
          </div>
        </div>
      )}

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white border border-gray-200 rounded-lg">
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
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No rules found matching your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              groupName={rule.groupName}
              machineName={rule.machineName}
              onEdit={handleEditRule}
              onDelete={handleDeleteRule}
              isExpanded={expandedRuleIds.has(rule.id)}
              onToggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
