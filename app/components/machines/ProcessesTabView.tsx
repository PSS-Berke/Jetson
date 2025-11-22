"use client";

import { useState, useEffect } from "react";
import { getAllMachineVariables, api } from "@/lib/api";
import { PROCESS_TYPE_CONFIGS } from "@/lib/processTypeConfig";
import { Plus } from "lucide-react";
import CustomProcessTypeBuilder from "../wizard/CustomProcessTypeBuilder";

interface MachineVariableGroup {
  id?: number;
  type: string;
  variables: any[];
}

interface ProcessesTabViewProps {
  machineType?: string;
}

interface FormField {
  id: string;
  type: "text" | "number" | "select";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
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

export default function ProcessesTabView({ machineType }: ProcessesTabViewProps) {
  const [apiProcessTypes, setApiProcessTypes] = useState<
    Array<{ key: string; label: string; color: string; id?: number }>
  >([]);
  const [loadingProcessTypes, setLoadingProcessTypes] = useState(true);
  const [variableCounts, setVariableCounts] = useState<Record<string, number>>(
    {}
  );
  const [selectedProcessType, setSelectedProcessType] = useState<string | null>(null);
  const [isCreatingCustom, setIsCreatingCustom] = useState(false);
  const [newProcessTypeName, setNewProcessTypeName] = useState("");
  const [newProcessTypeFields, setNewProcessTypeFields] = useState<FormField[]>([]);
  const [machineProcessTypes, setMachineProcessTypes] = useState<string[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);

  // Fetch machines of this type to get their process types (only when machineType prop is set)
  useEffect(() => {
    if (!machineType) {
      return;
    }

    const fetchMachineProcessTypes = async () => {
      try {
        const machines = await api.get<any[]>("/machines");
        // Filter machines by type using the same logic as the page
        const typeFilterFn = getTypeFilterFn(machineType);
        const filteredMachines = machines.filter(typeFilterFn);

        // Extract unique process type keys
        const processTypeKeys = Array.from(
          new Set(
            filteredMachines
              .map((m) => m.process_type_key)
              .filter((key) => key && key.trim() !== "")
          )
        );

        setMachineProcessTypes(processTypeKeys as string[]);
      } catch (error) {
        console.error(
          "[ProcessesTabView] Error fetching machine process types:",
          error
        );
      }
    };

    fetchMachineProcessTypes();
  }, [machineType]);

  // Fetch all process types and their variable counts
  useEffect(() => {
    const fetchProcessTypes = async () => {
      try {
        setLoadingProcessTypes(true);
        const allVariables = await getAllMachineVariables();

        const counts: Record<string, number> = {};
        const apiTypes: Array<{
          key: string;
          label: string;
          color: string;
          id?: number;
        }> = [];

        allVariables.forEach((group: MachineVariableGroup) => {
          if (group.type) {
            // Count variables
            if (Array.isArray(group.variables)) {
              counts[group.type] = group.variables.length;
            } else if (group.variables && typeof group.variables === "object") {
              counts[group.type] = Object.keys(group.variables).length;
            } else {
              counts[group.type] = 0;
            }

            // Add process type if not already added
            if (!apiTypes.find((t) => t.key === group.type)) {
              const configMatch = PROCESS_TYPE_CONFIGS.find(
                (c) => c.key === group.type
              );
              apiTypes.push({
                key: group.type,
                label:
                  configMatch?.label ||
                  group.type.charAt(0).toUpperCase() + group.type.slice(1),
                color: configMatch?.color || "#6B7280",
                id: group.id,
              });
            }
          }
        });

        setVariableCounts(counts);
        setApiProcessTypes(apiTypes);
      } catch (error) {
        console.error(
          "[ProcessesTabView] Error fetching process types:",
          error
        );
      } finally {
        setLoadingProcessTypes(false);
      }
    };

    fetchProcessTypes();
  }, []);

  // Load existing fields when a process type is selected
  useEffect(() => {
    if (!selectedProcessType) {
      return;
    }

    const loadProcessTypeFields = async () => {
      try {
        setLoadingFields(true);
        const allVariables = await getAllMachineVariables();

        // Find the variable group for this process type
        const variableGroup = allVariables.find(
          (group: MachineVariableGroup) => group.type === selectedProcessType
        );

        if (variableGroup && variableGroup.variables) {
          // Convert variables object to FormField array
          const fieldsArray: FormField[] = [];
          const vars = variableGroup.variables;

          if (typeof vars === "object" && !Array.isArray(vars)) {
            // Variables is an object with keys
            Object.entries(vars).forEach(([key, value]: [string, any]) => {
              fieldsArray.push({
                id: key,
                type: value.type || "text",
                label: value.label || key,
                placeholder: value.placeholder,
                required: value.required || false,
                options: value.options,
              });
            });
          }

          setNewProcessTypeFields(fieldsArray);
        } else {
          // No existing fields, start with empty array
          setNewProcessTypeFields([]);
        }
      } catch (error) {
        console.error(
          "[ProcessesTabView] Error loading process type fields:",
          error
        );
      } finally {
        setLoadingFields(false);
      }
    };

    loadProcessTypeFields();
  }, [selectedProcessType]);


  const handleSaveCapability = async () => {
    // Validation for new process types only
    if (isCreatingCustom && !newProcessTypeName.trim()) {
      alert("Please provide a process type name.");
      return;
    }

    if (newProcessTypeFields.length === 0) {
      alert("Please add at least one capability field.");
      return;
    }

    try {
      // Convert FormField[] to variables object format
      const variables: Record<string, any> = {};
      newProcessTypeFields.forEach((field) => {
        variables[field.id] = {
          label: field.label,
          type: field.type,
          required: field.required || false,
          ...(field.options && { options: field.options }),
          ...(field.placeholder && { placeholder: field.placeholder }),
        };
      });

      // Determine the process type key
      const processTypeKey = isCreatingCustom
        ? newProcessTypeName.toLowerCase().replace(/\s+/g, "_")
        : selectedProcessType;

      if (!processTypeKey) {
        alert("Invalid process type.");
        return;
      }

      // Check if we're updating an existing process type
      const selectedType = apiProcessTypes.find((pt) => pt.key === processTypeKey);

      if (selectedType && selectedType.id) {
        // Update existing process type
        await api.put(`/machine-variables/${selectedType.id}`, {
          type: processTypeKey,
          variables: variables,
        });
      } else {
        // Create new process type
        await api.post("/machine-variables", {
          type: processTypeKey,
          variables: variables,
        });
      }

      // Reset form
      setIsCreatingCustom(false);
      setSelectedProcessType(null);
      setNewProcessTypeName("");
      setNewProcessTypeFields([]);

      // Refresh the list
      window.location.reload();
    } catch (error) {
      console.error("[ProcessesTabView] Error saving capability:", error);
      alert("Failed to save capability. Please try again.");
    }
  };

  // Filter process types if machineType prop is set (for individual type pages)
  const filteredProcessTypes = machineType
    ? apiProcessTypes.filter((pt) => machineProcessTypes.includes(pt.key))
    : apiProcessTypes;

  if (loadingProcessTypes) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading process types...</span>
      </div>
    );
  }


  // If a process type is selected or we're creating custom, show the form builder
  if (selectedProcessType || isCreatingCustom) {
    const selectedType = apiProcessTypes.find(pt => pt.key === selectedProcessType);
    const displayName = isCreatingCustom ? newProcessTypeName : (selectedType?.label || selectedProcessType);

    // Show loading state while fields are being fetched
    if (loadingFields && selectedProcessType) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading fields...</span>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Selected Process Type Display */}
        {!isCreatingCustom && selectedType && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium text-green-900">
                {selectedType.label} Selected
              </span>
              <button
                onClick={() => {
                  setSelectedProcessType(null);
                  setNewProcessTypeFields([]);
                }}
                className="ml-auto text-gray-500 hover:text-gray-700"
              >
                Change
              </button>
            </div>
            <p className="text-sm text-green-700">
              You're editing the {selectedType.label} process type configuration
              {newProcessTypeFields.length > 0 && ` (${newProcessTypeFields.length} field${newProcessTypeFields.length !== 1 ? 's' : ''})`}
            </p>
          </div>
        )}

        {/* Custom Process Type Name Input */}
        {isCreatingCustom && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Process Type Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newProcessTypeName}
              onChange={(e) => setNewProcessTypeName(e.target.value)}
              placeholder="e.g., Custom Insert, Special Fold"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Process Type Field Builder */}
        <CustomProcessTypeBuilder
          processTypeName={displayName || "New Process Type"}
          fields={newProcessTypeFields}
          onChange={setNewProcessTypeFields}
        />

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveCapability}
            disabled={(!newProcessTypeName.trim() && isCreatingCustom) || newProcessTypeFields.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            Save Process Type
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedProcessType(null);
              setIsCreatingCustom(false);
              setNewProcessTypeName("");
              setNewProcessTypeFields([]);
            }}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Existing Process Type
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredProcessTypes.map((processType) => {
            return (
              <button
                key={processType.key}
                type="button"
                onClick={() => setSelectedProcessType(processType.key)}
                className="rounded-lg border-2 border-gray-200 bg-white hover:border-gray-300 p-3 text-left transition-all"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: processType.color }}
                  />
                  <span className="font-medium text-gray-900">
                    {processType.label}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  {variableCounts[processType.key] !== undefined
                    ? `${variableCounts[processType.key]} fields configured`
                    : "0 fields configured"}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">OR</span>
        </div>
      </div>

      {/* Create Custom Process Type */}
      <button
        type="button"
        onClick={() => setIsCreatingCustom(true)}
        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-5 h-5" />
        Create Custom Process Type
      </button>
    </div>
  );
}
