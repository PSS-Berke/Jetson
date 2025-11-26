"use client";

import { useState, useEffect } from "react";
import { getMachines, updateMachine } from "@/lib/api";
import type { Machine, MachineCapabilityValue } from "@/types";
import Toast from "@/app/components/Toast";

interface CapabilityEdit {
  machineId: number;
  field: string;
  value: MachineCapabilityValue;
}

export default function MachineCapabilitiesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProcessType, setSelectedProcessType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCapability, setEditingCapability] = useState<CapabilityEdit | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [selectedMachineForBulk, setSelectedMachineForBulk] = useState<number | null>(null);
  const [bulkUpdateTarget, setBulkUpdateTarget] = useState<"similar" | "all" | null>(null);

  useEffect(() => {
    loadMachines();
  }, []);

  const loadMachines = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMachines();
      setMachines(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load machines");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCapability = async (
    machineId: number,
    field: string,
    value: MachineCapabilityValue
  ) => {
    try {
      const machine = machines.find((m) => m.id === machineId);
      if (!machine) return;

      const updatedCapabilities = {
        ...(machine.capabilities || {}),
        [field]: value,
      };

      await updateMachine(machineId, {
        capabilities: updatedCapabilities,
      });

      // Update local state
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId
            ? { ...m, capabilities: updatedCapabilities }
            : m
        )
      );

      setShowSuccessToast(true);
      setEditingCapability(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update capability");
    }
  };

  const handleBulkCopyCapabilities = async (
    sourceMachineId: number,
    targetType: "similar" | "all"
  ) => {
    const sourceMachine = machines.find((m) => m.id === sourceMachineId);
    if (!sourceMachine || !sourceMachine.capabilities) {
      alert("Source machine has no capabilities to copy");
      return;
    }

    const confirmMessage =
      targetType === "similar"
        ? `Copy capabilities from Line ${sourceMachine.line} to all machines with process type "${sourceMachine.process_type_key}"?`
        : `Copy capabilities from Line ${sourceMachine.line} to ALL machines? This will overwrite existing capabilities!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const targetMachines =
        targetType === "similar"
          ? machines.filter(
              (m) =>
                m.process_type_key === sourceMachine.process_type_key &&
                m.id !== sourceMachineId
            )
          : machines.filter((m) => m.id !== sourceMachineId);

      let updatedCount = 0;
      for (const targetMachine of targetMachines) {
        await updateMachine(targetMachine.id, {
          capabilities: { ...sourceMachine.capabilities },
        });
        updatedCount++;
      }

      alert(`Successfully updated ${updatedCount} machines!`);
      await loadMachines();
      setShowSuccessToast(true);
      setBulkUpdateTarget(null);
      setSelectedMachineForBulk(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to bulk update");
    }
  };

  // Get unique process types for filter
  const processTypes = Array.from(
    new Set(machines.map((m) => m.process_type_key).filter(Boolean))
  ).sort();

  // Filter machines
  const filteredMachines = machines.filter((machine) => {
    const matchesProcessType =
      selectedProcessType === "all" ||
      machine.process_type_key === selectedProcessType;
    const matchesSearch =
      searchQuery === "" ||
      machine.line.toString().includes(searchQuery) ||
      machine.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      machine.name?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProcessType && matchesSearch;
  });

  // Get all unique capability keys across all machines
  const allCapabilityKeys = Array.from(
    new Set(
      machines.flatMap((m) =>
        m.capabilities ? Object.keys(m.capabilities) : []
      )
    )
  ).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary-blue)]"></div>
            <p className="mt-4 text-gray-600">Loading machines...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
            <button
              onClick={loadMachines}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--dark-blue)] mb-2">
            Machine Capabilities
          </h1>
          <p className="text-gray-600">
            Manage machine capabilities for capacity-based job matching
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Process Type
              </label>
              <select
                value={selectedProcessType}
                onChange={(e) => setSelectedProcessType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
              >
                <option value="all">All Process Types</option>
                {processTypes.map((pt) => (
                  <option key={pt} value={pt}>
                    {pt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by line, type, or name..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setSearchQuery("")}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Total Machines</p>
            <p className="text-3xl font-bold text-[var(--dark-blue)]">
              {machines.length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">With Capabilities</p>
            <p className="text-3xl font-bold text-green-600">
              {
                machines.filter(
                  (m) => m.capabilities && Object.keys(m.capabilities).length > 0
                ).length
              }
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Without Capabilities</p>
            <p className="text-3xl font-bold text-yellow-600">
              {
                machines.filter(
                  (m) => !m.capabilities || Object.keys(m.capabilities).length === 0
                ).length
              }
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <p className="text-sm text-gray-600 mb-1">Filtered Results</p>
            <p className="text-3xl font-bold text-[var(--primary-blue)]">
              {filteredMachines.length}
            </p>
          </div>
        </div>

        {/* Machines Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Machine
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Process Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capabilities
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMachines.map((machine) => {
                  const capabilityCount = machine.capabilities
                    ? Object.keys(machine.capabilities).length
                    : 0;

                  return (
                    <tr key={machine.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            Line {machine.line}
                          </p>
                          <p className="text-sm text-gray-500">
                            {machine.name || machine.type}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">
                          {machine.process_type_key || "None"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {capabilityCount === 0 ? (
                          <span className="text-sm text-gray-400 italic">
                            No capabilities defined
                          </span>
                        ) : (
                          <details className="text-sm">
                            <summary className="cursor-pointer text-[var(--primary-blue)] hover:underline">
                              {capabilityCount} capabilities
                            </summary>
                            <div className="mt-2 space-y-1 pl-4">
                              {Object.entries(machine.capabilities || {}).map(
                                ([key, value]) => (
                                  <div
                                    key={key}
                                    className="flex items-center justify-between py-1 border-b border-gray-100"
                                  >
                                    <span className="font-mono text-xs text-gray-600">
                                      {key}:
                                    </span>
                                    <span className="font-mono text-xs text-gray-900 ml-2">
                                      {JSON.stringify(value)}
                                    </span>
                                  </div>
                                )
                              )}
                            </div>
                          </details>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => {
                            setSelectedMachineForBulk(machine.id);
                            setBulkUpdateTarget("similar");
                          }}
                          className="text-[var(--primary-blue)] hover:text-[var(--dark-blue)] mr-3"
                          title="Copy to similar machines"
                        >
                          Copy to Similar
                        </button>
                        <a
                          href={`/machines/${machine.process_type_key || "insert"}`}
                          className="text-green-600 hover:text-green-900"
                        >
                          Edit
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredMachines.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No machines found matching your filters</p>
            </div>
          )}
        </div>

        {/* Bulk Copy Confirmation Modal */}
        {selectedMachineForBulk && bulkUpdateTarget && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                Confirm Bulk Copy
              </h3>
              <p className="text-gray-600 mb-6">
                This will copy capabilities from{" "}
                <strong>
                  Line{" "}
                  {machines.find((m) => m.id === selectedMachineForBulk)?.line}
                </strong>{" "}
                to{" "}
                {bulkUpdateTarget === "similar"
                  ? "all machines with the same process type"
                  : "ALL machines"}
                .
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedMachineForBulk(null);
                    setBulkUpdateTarget(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleBulkCopyCapabilities(
                      selectedMachineForBulk,
                      bulkUpdateTarget
                    )
                  }
                  className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-[var(--dark-blue)]"
                >
                  Confirm Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message="Capabilities updated successfully!"
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}
