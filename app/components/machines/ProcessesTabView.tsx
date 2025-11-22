"use client";

import { useState, useEffect, useCallback } from "react";
import { getAllMachineVariables, api, getCapabilityBuckets, createCapabilityBucket, updateCapabilityBucket, deleteCapabilityBucket, type CapabilityBucket } from "@/lib/api";
import { PROCESS_TYPE_CONFIGS } from "@/lib/processTypeConfig";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import CustomProcessTypeBuilder from "../wizard/CustomProcessTypeBuilder";

interface MachineVariableGroup {
  id?: number;
  created_at?: number;
  type: string;
  variables: Record<string, any> | null | {};
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
  
  // Capability buckets state
  const [capabilityBuckets, setCapabilityBuckets] = useState<CapabilityBucket[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [isEditingBucket, setIsEditingBucket] = useState<CapabilityBucket | null>(null);
  const [isCreatingBucket, setIsCreatingBucket] = useState(false);
  const [bucketName, setBucketName] = useState("");
  const [bucketCapabilities, setBucketCapabilities] = useState<Record<string, any>>({});
  const [availableMachineVariables, setAvailableMachineVariables] = useState<MachineVariableGroup[]>([]);
  const [loadingMachineVariables, setLoadingMachineVariables] = useState(false);
  const [showFieldSelector, setShowFieldSelector] = useState(false);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

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
        // Filter out null, undefined, empty strings, and invalid values
        const processTypeKeys = Array.from(
          new Set(
            filteredMachines
              .map((m) => m.process_type_key)
              .filter((key) => {
                // Ensure key is a valid string
                return key &&
                       typeof key === 'string' &&
                       key.trim() !== "" &&
                       key !== 'null' &&
                       key !== 'undefined';
              })
          )
        );

        setMachineProcessTypes(processTypeKeys as string[]);
      } catch (error) {
        console.error(
          "[ProcessesTabView] Error fetching machine process types:",
          error
        );
        // Set empty array on error to prevent cascading failures
        setMachineProcessTypes([]);
      }
    };

    fetchMachineProcessTypes();
  }, [machineType]);

  // Fetch all process types and their variable counts
  const fetchProcessTypes = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchProcessTypes();
  }, [fetchProcessTypes]);

  // Fetch capability buckets
  useEffect(() => {
    const fetchBuckets = async () => {
      try {
        setLoadingBuckets(true);
        const buckets = await getCapabilityBuckets();
        setCapabilityBuckets(buckets);
      } catch (error) {
        console.error("[ProcessesTabView] Error fetching capability buckets:", error);
      } finally {
        setLoadingBuckets(false);
      }
    };

    fetchBuckets();
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


  // Fetch machine variables for field selection
  useEffect(() => {
    if (isCreatingBucket || isEditingBucket) {
      const fetchMachineVariables = async () => {
        try {
          setLoadingMachineVariables(true);
          const allVariables = await getAllMachineVariables();
          setAvailableMachineVariables(allVariables);
        } catch (error) {
          console.error("[ProcessesTabView] Error fetching machine variables:", error);
        } finally {
          setLoadingMachineVariables(false);
        }
      };
      fetchMachineVariables();
    }
  }, [isCreatingBucket, isEditingBucket]);

  // Capability bucket handlers
  const handleCreateBucket = () => {
    setIsCreatingBucket(true);
    setBucketName("");
    setBucketCapabilities({});
    setIsEditingBucket(null);
    setShowFieldSelector(false);
    setSelectedFields(new Set());
  };

  const handleEditBucket = (bucket: CapabilityBucket) => {
    setIsEditingBucket(bucket);
    setBucketName(bucket.name);
    setBucketCapabilities(bucket.capabilities || {});
    setIsCreatingBucket(false);
  };

  const handleCancelBucket = () => {
    setIsCreatingBucket(false);
    setIsEditingBucket(null);
    setBucketName("");
    setBucketCapabilities({});
    setShowFieldSelector(false);
    setSelectedFields(new Set());
  };

  const handleSaveBucket = async () => {
    if (!bucketName.trim()) {
      alert("Please provide a bucket name.");
      return;
    }

    try {
      if (isEditingBucket) {
        await updateCapabilityBucket(isEditingBucket.id, {
          name: bucketName,
          capabilities: bucketCapabilities,
        });
      } else {
        await createCapabilityBucket({
          name: bucketName,
          capabilities: bucketCapabilities,
        });
      }

      // Refresh buckets
      const buckets = await getCapabilityBuckets();
      setCapabilityBuckets(buckets);
      handleCancelBucket();
    } catch (error) {
      console.error("[ProcessesTabView] Error saving capability bucket:", error);
      alert("Failed to save capability bucket. Please try again.");
    }
  };

  const handleDeleteBucket = async (bucketId: number) => {
    if (!confirm("Are you sure you want to delete this capability bucket? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteCapabilityBucket(bucketId);
      const buckets = await getCapabilityBuckets();
      setCapabilityBuckets(buckets);
    } catch (error) {
      console.error("[ProcessesTabView] Error deleting capability bucket:", error);
      alert("Failed to delete capability bucket. Please try again.");
    }
  };

  const getFieldDefaultValue = (fieldDef: any): any => {
    let defaultValue: any;
    
    if (fieldDef.value !== undefined && fieldDef.value !== null && fieldDef.value !== "") {
      // Use the field's default value if available
      defaultValue = fieldDef.value;
      // Convert string numbers to actual numbers for number type fields
      if (fieldDef.type === "number" && typeof defaultValue === "string" && !isNaN(Number(defaultValue))) {
        defaultValue = Number(defaultValue);
      }
      // Convert string booleans to actual booleans
      if (fieldDef.type === "boolean") {
        if (defaultValue === "true" || defaultValue === true || defaultValue === 1) {
          defaultValue = true;
        } else if (defaultValue === "false" || defaultValue === false || defaultValue === 0) {
          defaultValue = false;
        } else {
          defaultValue = false;
        }
      }
    } else {
      // Set default based on type
      switch (fieldDef.type) {
        case "boolean":
          defaultValue = false;
          break;
        case "number":
          defaultValue = 0;
          break;
        case "select":
          defaultValue = fieldDef.options && fieldDef.options.length > 0 ? fieldDef.options[0] : "";
          break;
        case "text":
        default:
          defaultValue = "";
          break;
      }
    }
    return defaultValue;
  };

  const buildFieldDefinition = (fieldKey: string, fieldDef: any): Record<string, any> => {
    const defaultValue = getFieldDefaultValue(fieldDef);
    
    // Build the full field definition structure
    const fieldDefinition: Record<string, any> = {
      type: fieldDef.type || "text",
      label: fieldDef.label || fieldKey,
      value: defaultValue,
      required: fieldDef.required || false,
    };

    // Add addToJobInput if present
    if (fieldDef.addToJobInput !== undefined) {
      fieldDefinition.addToJobInput = fieldDef.addToJobInput;
    }

    // Add options for select fields
    if (fieldDef.type === "select" && fieldDef.options && Array.isArray(fieldDef.options)) {
      fieldDefinition.options = fieldDef.options;
    }

    return fieldDefinition;
  };

  const handleToggleFieldSelection = (fieldKey: string) => {
    setSelectedFields((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  };

  const handleAddSelectedFields = () => {
    if (selectedFields.size === 0) {
      alert("Please select at least one field to add.");
      return;
    }

    const fieldsToAdd: Array<{ key: string; definition: Record<string, any> }> = [];
    const fieldsToSkip: string[] = [];

    // Collect all selected fields with their full definitions
    availableMachineVariables.forEach((group) => {
      if (group.variables && typeof group.variables === "object" && !Array.isArray(group.variables)) {
        Object.entries(group.variables).forEach(([fieldKey, fieldDef]: [string, any]) => {
          if (selectedFields.has(fieldKey)) {
            if (bucketCapabilities.hasOwnProperty(fieldKey)) {
              fieldsToSkip.push(fieldKey);
            } else {
              const fieldDefinition = buildFieldDefinition(fieldKey, fieldDef);
              fieldsToAdd.push({ key: fieldKey, definition: fieldDefinition });
            }
          }
        });
      }
    });

    if (fieldsToSkip.length > 0) {
      const skipMessage = fieldsToSkip.length === 1
        ? `Field "${fieldsToSkip[0]}" is already added. Skip it?`
        : `${fieldsToSkip.length} fields are already added. Skip them?`;
      if (!confirm(skipMessage)) {
        return;
      }
    }

    if (fieldsToAdd.length === 0) {
      alert("All selected fields are already added to the bucket.");
      setSelectedFields(new Set());
      return;
    }

    // Add all selected fields at once with full definitions
    setBucketCapabilities((prev) => {
      const updated = { ...prev };
      fieldsToAdd.forEach(({ key, definition }) => {
        updated[key] = definition;
      });
      return updated;
    });

    // Clear selections and close selector
    setSelectedFields(new Set());
    setShowFieldSelector(false);
  };

  const handleSelectAllAvailableFields = () => {
    const allAvailableFields = new Set<string>();
    availableMachineVariables.forEach((group) => {
      if (group.variables && typeof group.variables === "object" && !Array.isArray(group.variables)) {
        Object.keys(group.variables).forEach((fieldKey) => {
          // Only include fields that aren't already in the bucket
          if (!bucketCapabilities.hasOwnProperty(fieldKey)) {
            allAvailableFields.add(fieldKey);
          }
        });
      }
    });
    setSelectedFields(allAvailableFields);
  };

  const handleDeselectAllFields = () => {
    setSelectedFields(new Set());
  };

  const handleAddFieldFromSelector = (processType: string, fieldKey: string, fieldDef: any) => {
    // Single field add (for backward compatibility, but now uses multi-select)
    handleToggleFieldSelection(fieldKey);
    // Auto-add if not already in bucket
    if (!bucketCapabilities.hasOwnProperty(fieldKey)) {
      const fieldDefinition = buildFieldDefinition(fieldKey, fieldDef);
      setBucketCapabilities((prev) => ({
        ...prev,
        [fieldKey]: fieldDefinition,
      }));
      setShowFieldSelector(false);
    }
  };

  const handleAddCapabilityField = () => {
    setShowFieldSelector(true);
  };

  const handleRemoveCapabilityField = (key: string) => {
    const newCapabilities = { ...bucketCapabilities };
    delete newCapabilities[key];
    setBucketCapabilities(newCapabilities);
  };

  const handleUpdateCapabilityField = (key: string, value: any) => {
    setBucketCapabilities((prev) => {
      const currentField = prev[key];
      
      // If the current field is already a full definition object, update just the value
      if (currentField && typeof currentField === "object" && !Array.isArray(currentField) && currentField.type) {
        return {
          ...prev,
          [key]: {
            ...currentField,
            value: value,
          },
        };
      }
      
      // Otherwise, if it's just a value, we need to check if we can find the original definition
      // For now, if it's a simple value, replace it (backward compatibility)
      return {
        ...prev,
        [key]: value,
      };
    });
  };

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
      // Build a fresh variables object containing ONLY the fields currently in newProcessTypeFields
      // This ensures any deleted fields are removed from the JSON when saving
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
        // Update existing process type using PATCH
        // Send the complete variables object - this replaces the entire variables object
        // Any fields not in the variables object will be removed from the JSON
        await api.patch(`/machine_variables/${selectedType.id}`, {
          type: processTypeKey,
          variables: variables, // Complete replacement - deleted fields are excluded
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

      // Refresh the process types list without reloading the page
      await fetchProcessTypes();
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
              You&apos;re editing the {selectedType.label} process type configuration
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

  // If editing or creating a capability bucket, show the bucket form
  if (isEditingBucket || isCreatingBucket) {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-blue-900">
              {isEditingBucket ? "Edit Capability Bucket" : "Create Capability Bucket"}
            </span>
            <button
              onClick={handleCancelBucket}
              className="ml-auto text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bucket Name Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Bucket Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={bucketName}
            onChange={(e) => setBucketName(e.target.value)}
            placeholder="e.g., Standard Inserter Config, High-Speed Folder"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Capabilities Editor */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              Capabilities
            </label>
            <button
              type="button"
              onClick={handleAddCapabilityField}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Field
            </button>
          </div>

          {/* Field Selector Modal */}
          {showFieldSelector && (
            <div className="mb-4 border border-blue-300 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="font-medium text-gray-900">Select Fields from Machine Variables</h4>
                  {selectedFields.size > 0 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedFields.size} field{selectedFields.size !== 1 ? 's' : ''} selected
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {selectedFields.size > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={handleDeselectAllFields}
                        className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                      >
                        Deselect All
                      </button>
                      <button
                        type="button"
                        onClick={handleAddSelectedFields}
                        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Selected ({selectedFields.size})
                      </button>
                    </>
                  )}
                  {selectedFields.size === 0 && (
                    <button
                      type="button"
                      onClick={handleSelectAllAvailableFields}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      Select All Available
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setShowFieldSelector(false);
                      setSelectedFields(new Set());
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {loadingMachineVariables ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600">Loading fields...</span>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto space-y-4">
                  {availableMachineVariables
                    .filter((group) => 
                      group.variables && 
                      typeof group.variables === "object" && 
                      !Array.isArray(group.variables) &&
                      Object.keys(group.variables).length > 0
                    )
                    .map((group) => {
                      const processTypeConfig = PROCESS_TYPE_CONFIGS.find((c) => c.key === group.type);
                      const processTypeLabel = processTypeConfig?.label || group.type;
                      const processTypeColor = processTypeConfig?.color || "#6B7280";
                      
                      return (
                        <div key={group.id || group.type} className="bg-white rounded border border-gray-200 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: processTypeColor }}
                            />
                            <span className="font-medium text-gray-900">{processTypeLabel}</span>
                            <span className="text-xs text-gray-500">
                              ({Object.keys(group.variables || {}).length} field{Object.keys(group.variables || {}).length !== 1 ? 's' : ''})
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(group.variables || {}).map(([fieldKey, fieldDef]: [string, any]) => {
                              const isAlreadyAdded = bucketCapabilities.hasOwnProperty(fieldKey);
                              const isSelected = selectedFields.has(fieldKey);
                              return (
                                <label
                                  key={fieldKey}
                                  className={`flex items-start gap-2 p-2 rounded border transition-colors cursor-pointer ${
                                    isAlreadyAdded
                                      ? "bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed"
                                      : isSelected
                                      ? "bg-blue-100 border-blue-500 text-gray-900"
                                      : "bg-white border-gray-300 hover:border-blue-500 hover:bg-blue-50"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => handleToggleFieldSelection(fieldKey)}
                                    disabled={isAlreadyAdded}
                                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-gray-900 truncate">
                                      {fieldDef.label || fieldKey}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {fieldDef.type}
                                      {fieldDef.options && ` • ${fieldDef.options.length} options`}
                                    </div>
                                  </div>
                                  {isAlreadyAdded && (
                                    <span className="ml-2 text-xs text-gray-400" title="Already added">✓</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  
                  {availableMachineVariables.filter((group) => group.variables && typeof group.variables === "object" && Object.keys(group.variables).length > 0).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No machine variables available. Create process types with fields first.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="border border-gray-300 rounded-md p-4 space-y-3 min-h-[200px]">
            {Object.keys(bucketCapabilities).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                No capabilities added. Click "Add Field" to select fields from machine variables.
              </p>
            ) : (
              Object.entries(bucketCapabilities).map(([key, value]) => {
                // Check if value is a full field definition or just a simple value
                const isFieldDefinition = value && typeof value === "object" && !Array.isArray(value) && value.type;
                const fieldDef = isFieldDefinition ? value : null;
                const displayValue = isFieldDefinition ? value.value : value;
                const fieldLabel = isFieldDefinition ? value.label : key;
                const fieldType = isFieldDefinition ? value.type : typeof value;

                const renderFieldInput = () => {
                  if (!isFieldDefinition) {
                    // Fallback for old format - show as text input
                    return (
                      <input
                        type="text"
                        value={String(displayValue || "")}
                        onChange={(e) => handleUpdateCapabilityField(key, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    );
                  }

                  // Render based on field type
                  switch (fieldDef.type) {
                    case "boolean":
                      return (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={fieldDef.value === true || fieldDef.value === "true" || fieldDef.value === 1}
                            onChange={(e) => {
                              setBucketCapabilities((prev) => ({
                                ...prev,
                                [key]: {
                                  ...fieldDef,
                                  value: e.target.checked,
                                },
                              }));
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="text-sm text-gray-700">
                            {fieldDef.value === true || fieldDef.value === "true" || fieldDef.value === 1 ? "Yes" : "No"}
                          </span>
                        </label>
                      );

                    case "number":
                      return (
                        <input
                          type="number"
                          value={fieldDef.value !== undefined && fieldDef.value !== null ? fieldDef.value : ""}
                          onChange={(e) => {
                            const numValue = e.target.value === "" ? "" : Number(e.target.value);
                            setBucketCapabilities((prev) => ({
                              ...prev,
                              [key]: {
                                ...fieldDef,
                                value: numValue,
                              },
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      );

                    case "select":
                      return (
                        <select
                          value={fieldDef.value !== undefined && fieldDef.value !== null ? String(fieldDef.value) : ""}
                          onChange={(e) => {
                            setBucketCapabilities((prev) => ({
                              ...prev,
                              [key]: {
                                ...fieldDef,
                                value: e.target.value,
                              },
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">-- Select --</option>
                          {fieldDef.options && Array.isArray(fieldDef.options) && fieldDef.options.map((option: string, idx: number) => (
                            <option key={idx} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      );

                    case "text":
                    default:
                      return (
                        <input
                          type="text"
                          value={fieldDef.value !== undefined && fieldDef.value !== null ? String(fieldDef.value) : ""}
                          onChange={(e) => {
                            setBucketCapabilities((prev) => ({
                              ...prev,
                              [key]: {
                                ...fieldDef,
                                value: e.target.value,
                              },
                            }));
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      );
                  }
                };

                return (
                  <div key={key} className="flex items-start gap-2 p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">
                          {fieldLabel}
                        </label>
                        <span className="text-xs text-gray-500">({fieldType})</span>
                        {isFieldDefinition && fieldDef.required && (
                          <span className="text-xs text-red-500">*</span>
                        )}
                      </div>
                      
                      {/* Render the appropriate input based on field type */}
                      {renderFieldInput()}
                      
                      {/* Show field metadata */}
                      {isFieldDefinition && fieldDef.options && (
                        <div className="text-xs text-gray-500">
                          <span>{fieldDef.options.length} option{fieldDef.options.length !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCapabilityField(key)}
                      className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      title="Remove field"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSaveBucket}
            disabled={!bucketName.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isEditingBucket ? "Update Bucket" : "Create Bucket"}
          </button>
          <button
            type="button"
            onClick={handleCancelBucket}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Process Types Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Process Types</h3>
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

      {/* Divider between sections */}
      <div className="border-t border-gray-300 my-6"></div>

      {/* Capability Buckets Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Capability Buckets</h3>
          <button
            type="button"
            onClick={handleCreateBucket}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Capability Bucket
          </button>
        </div>

        {loadingBuckets ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading capability buckets...</span>
          </div>
        ) : capabilityBuckets.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-500">No capability buckets yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {capabilityBuckets.map((bucket) => (
              <div
                key={bucket.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{bucket.name}</h4>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditBucket(bucket)}
                      className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                      title="Edit bucket"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBucket(bucket.id)}
                      className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                      title="Delete bucket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    {Object.keys(bucket.capabilities || {}).length} capability field(s)
                  </p>
                  {bucket.capabilities && Object.keys(bucket.capabilities).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(bucket.capabilities).slice(0, 3).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="font-medium">{key}:</span>{" "}
                            <span className="text-gray-500">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))}
                        {Object.keys(bucket.capabilities).length > 3 && (
                          <div className="text-xs text-gray-400">
                            +{Object.keys(bucket.capabilities).length - 3} more...
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
