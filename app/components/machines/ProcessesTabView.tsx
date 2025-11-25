"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getAllMachineVariables, api, getCapabilityBuckets, createCapabilityBucket, updateCapabilityBucket, deleteCapabilityBucket, type CapabilityBucket } from "@/lib/api";
import { PROCESS_TYPE_CONFIGS, normalizeProcessType } from "@/lib/processTypeConfig";
import { Plus, Edit2, Trash2, X } from "lucide-react";
import CustomProcessTypeBuilder from "../wizard/CustomProcessTypeBuilder";
import { useToast } from "@/app/components/ui/Toast";

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
  type: "text" | "number" | "select" | "boolean" | "currency";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  addToJobInput?: boolean;
  showInAdditionalFields?: boolean;
  order?: number;
  locked?: boolean; // If true, field cannot be deleted (but can be edited/reordered)
}

// Helper function to get filter function for machine type
const getTypeFilterFn = (machineType: string) => {
  const typeFilters: Record<string, (machine: any) => boolean> = {
    data: (machine) =>
      machine.type.toLowerCase().includes("data") ||
      machine.type.toLowerCase().includes("sort"),
    hp: (machine) =>
      machine.type.toLowerCase().includes("hp"),
    "hp-press": (machine) =>
      machine.type.toLowerCase().includes("hp"),
    inserters: (machine) => machine.type.toLowerCase().includes("insert"),
    folders: (machine) =>
      machine.type.toLowerCase().includes("folder") ||
      machine.type.toLowerCase().includes("fold"),
    inkjetters: (machine) => machine.type.toLowerCase().includes("inkjet"),
    affixers: (machine) =>
      machine.type.toLowerCase().includes("affixer") ||
      machine.type.toLowerCase().includes("affix"),
  };

  return typeFilters[machineType] || (() => true);
};

export default function ProcessesTabView({ machineType }: ProcessesTabViewProps) {
  const { showToast } = useToast();

  const [apiProcessTypes, setApiProcessTypes] = useState<
    Array<{ key: string; label: string; color: string; id?: number; sourceTypes?: string[] }>
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

  // Auto-save state
  const [saveQueue, setSaveQueue] = useState<Array<() => Promise<void>>>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const isProcessingQueueRef = useRef(false);
  const isInitialMountRef = useRef(true);

  // Queue system for managing saves
  const queueSave = useCallback((saveOperation: () => Promise<void>) => {
    setSaveQueue(prev => [...prev, saveOperation]);
  }, []);

  const processSaveQueue = useCallback(async () => {
    if (isProcessingQueueRef.current || saveQueue.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;

    try {
      while (saveQueue.length > 0) {
        const operation = saveQueue[0];
        await operation();
        setSaveQueue(prev => prev.slice(1));
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, [saveQueue]);

  // Process queue when new operations are added
  useEffect(() => {
    if (saveQueue.length > 0) {
      processSaveQueue();
    }
  }, [saveQueue, processSaveQueue]);

  // Save fields to API
  const saveFieldsToAPI = useCallback(async (fieldsToSave: FormField[]) => {
    // Don't save if creating a new custom type (no ID yet)
    if (isCreatingCustom) {
      return;
    }

    // Find the selected process type record
    const selectedType = apiProcessTypes.find((pt) => pt.key === selectedProcessType);

    if (!selectedType || !selectedType.id) {
      console.error("[ProcessesTabView] Cannot save: No process type ID found");
      return;
    }

    try {
      setSaveStatus('saving');
      setSaveError(null);

      // Convert FormField[] to variables object
      const variables: Record<string, any> = {};
      fieldsToSave.forEach((field, index) => {
        variables[field.id] = {
          label: field.label,
          type: field.type,
          required: field.required || false,
          order: index,
          ...(field.options && { options: field.options }),
          ...(field.placeholder && { placeholder: field.placeholder }),
          ...(field.addToJobInput !== undefined && { addToJobInput: field.addToJobInput }),
          ...(field.showInAdditionalFields !== undefined && { showInAdditionalFields: field.showInAdditionalFields }),
          ...(field.locked !== undefined && { locked: field.locked }), // Persist locked status
        };
      });

      // PATCH existing process type
      await api.patch(`/machine_variables/${selectedType.id}`, {
        type: selectedProcessType,
        variables: variables,
      });

      setSaveStatus('saved');

      // Auto-clear saved status after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);

    } catch (error) {
      setSaveStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'Failed to save changes';
      setSaveError(errorMessage);
      showToast({
        type: 'error',
        message: `Failed to save: ${errorMessage}`,
        duration: 5000,
      });
    }
  }, [apiProcessTypes, selectedProcessType, isCreatingCustom, showToast]);

  // Track if user has made changes (to prevent auto-save on initial load)
  const hasUserChangesRef = useRef(false);

  // Store showToast in a ref to avoid it being a dependency
  const showToastRef = useRef(showToast);
  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  // Handle field changes with auto-save
  const handleFieldsChange = useCallback((updatedFields: FormField[]) => {
    setNewProcessTypeFields(updatedFields);
    // Mark that user has made changes (not just loading from API)
    hasUserChangesRef.current = true;
  }, []);

  // Debounced auto-save for process type fields
  const processTypeSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Store apiProcessTypes in a ref to avoid it being a dependency
  const apiProcessTypesRef = useRef(apiProcessTypes);
  useEffect(() => {
    apiProcessTypesRef.current = apiProcessTypes;
  }, [apiProcessTypes]);

  useEffect(() => {
    // Skip auto-save when fields are being loaded from API
    if (loadingFields) {
      return;
    }

    // Only auto-save when:
    // 1. User has made changes (not just initial load)
    // 2. Editing an existing process type (not creating new)
    // 3. There are fields to save
    if (hasUserChangesRef.current && !isCreatingCustom && selectedProcessType && newProcessTypeFields.length > 0) {
      // Clear any existing timeout
      if (processTypeSaveTimeoutRef.current) {
        clearTimeout(processTypeSaveTimeoutRef.current);
      }

      // Set a new timeout for debounced save (2 seconds delay)
      processTypeSaveTimeoutRef.current = setTimeout(async () => {
        console.log("[ProcessesTabView] Auto-saving process type fields...");

        // Find the selected process type record
        const selectedType = apiProcessTypesRef.current.find((pt) => pt.key === selectedProcessType);

        if (!selectedType || !selectedType.id) {
          console.error("[ProcessesTabView] Cannot auto-save: No process type ID found");
          return;
        }

        try {
          setSaveStatus('saving');
          setSaveError(null);

          // Convert FormField[] to variables object
          const variables: Record<string, any> = {};
          newProcessTypeFields.forEach((field, index) => {
            variables[field.id] = {
              label: field.label,
              type: field.type,
              required: field.required || false,
              order: index,
              ...(field.options && { options: field.options }),
              ...(field.placeholder && { placeholder: field.placeholder }),
              ...(field.addToJobInput !== undefined && { addToJobInput: field.addToJobInput }),
              ...(field.showInAdditionalFields !== undefined && { showInAdditionalFields: field.showInAdditionalFields }),
            };
          });

          // PATCH existing process type
          await api.patch(`/machine_variables/${selectedType.id}`, {
            type: selectedProcessType,
            variables: variables,
          });

          setSaveStatus('saved');

          // Auto-clear saved status after 2 seconds
          setTimeout(() => {
            setSaveStatus('idle');
          }, 2000);

        } catch (error) {
          setSaveStatus('error');
          const errorMessage = error instanceof Error ? error.message : 'Failed to save changes';
          setSaveError(errorMessage);
          showToastRef.current({
            type: 'error',
            message: `Failed to save: ${errorMessage}`,
            duration: 5000,
          });
        }
      }, 2000);
    }

    // Cleanup timeout on unmount
    return () => {
      if (processTypeSaveTimeoutRef.current) {
        clearTimeout(processTypeSaveTimeoutRef.current);
      }
    };
  }, [newProcessTypeFields, isCreatingCustom, selectedProcessType, loadingFields]);

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
        sourceTypes?: string[];
      }> = [];

      // Track which IDs belong to which normalized type for consolidation
      const normalizedCounts: Record<string, number> = {};
      const normalizedSources: Record<string, string[]> = {};
      const normalizedPrimaryIds: Record<string, number> = {}; // Track the first ID for saving

      allVariables.forEach((group: MachineVariableGroup) => {
        if (group.type) {
          // Normalize the process type (e.g., "HP Press" -> "hp", "Label/Apply" -> "affix")
          const normalizedType = normalizeProcessType(group.type);

          // Count variables for the normalized type
          let varCount = 0;
          if (Array.isArray(group.variables)) {
            varCount = group.variables.length;
          } else if (group.variables && typeof group.variables === "object") {
            varCount = Object.keys(group.variables).length;
          }

          // Accumulate counts for normalized types
          normalizedCounts[normalizedType] = (normalizedCounts[normalizedType] || 0) + varCount;

          // Track the original source types that map to this normalized type
          if (!normalizedSources[normalizedType]) {
            normalizedSources[normalizedType] = [];
          }
          if (!normalizedSources[normalizedType].includes(group.type)) {
            normalizedSources[normalizedType].push(group.type);
          }

          // Track the primary ID (first record) for each normalized type
          if (!normalizedPrimaryIds[normalizedType] && group.id) {
            normalizedPrimaryIds[normalizedType] = group.id;
          }
        }
      });

      // Create the consolidated list of process types
      Object.keys(normalizedCounts).forEach((normalizedType) => {
        const configMatch = PROCESS_TYPE_CONFIGS.find(
          (c) => c.key === normalizedType
        );

        apiTypes.push({
          key: normalizedType,
          label:
            configMatch?.label ||
            normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1),
          color: configMatch?.color || "#6B7280",
          sourceTypes: normalizedSources[normalizedType] || [],
          id: normalizedPrimaryIds[normalizedType], // Primary ID for saving
        });
      });

      setVariableCounts(normalizedCounts);
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

  // Handle deleting a field from a process type
  const handleDeleteField = useCallback(async (fieldId: string) => {
    if (!selectedProcessType) {
      console.error("[ProcessesTabView] No process type selected for deletion");
      return;
    }

    try {
      // Find the selected process type config to get all source types
      const selectedConfig = apiProcessTypes.find(pt => pt.key === selectedProcessType);
      if (!selectedConfig) {
        console.error("[ProcessesTabView] Could not find process type config");
        return;
      }

      const sourceTypes = selectedConfig.sourceTypes || [selectedProcessType];

      // Fetch all machine variables
      const allVariables = await getAllMachineVariables();

      // Track if we successfully deleted from at least one record
      let deletedFromAny = false;
      const updatePromises: Promise<any>[] = [];

      // Update ALL source records that contain this field
      for (const sourceType of sourceTypes) {
        const group = allVariables.find((g: MachineVariableGroup) => g.type === sourceType);

        if (group && group.id && group.variables) {
          const variables = typeof group.variables === 'object' && !Array.isArray(group.variables)
            ? { ...group.variables }
            : {};

          // Check if this record has the field
          if (variables[fieldId]) {
            // Remove the field
            delete variables[fieldId];
            deletedFromAny = true;

            // Queue the update
            updatePromises.push(
              api.patch(`/machine_variables/${group.id}`, {
                type: sourceType,
                variables: variables,
              })
            );
          }
        }
      }

      if (!deletedFromAny) {
        showToast({
          type: 'error',
          message: 'Field not found in any source records',
          duration: 3000,
        });
        return;
      }

      // Execute all updates
      await Promise.all(updatePromises);

      // Update local state immediately
      setNewProcessTypeFields(prev => prev.filter(field => field.id !== fieldId));

      // Refresh the process types list to update counts
      await fetchProcessTypes();

      showToast({
        type: 'success',
        message: 'Field deleted successfully',
        duration: 2000,
      });

    } catch (error) {
      console.error("[ProcessesTabView] Error deleting field:", error);
      showToast({
        type: 'error',
        message: 'Failed to delete field. Please try again.',
        duration: 5000,
      });
    }
  }, [selectedProcessType, apiProcessTypes, showToast, fetchProcessTypes]);

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

        // Find the selected process type config to get source types
        const selectedConfig = apiProcessTypes.find(pt => pt.key === selectedProcessType);
        const sourceTypes = selectedConfig?.sourceTypes || [selectedProcessType];

        // Find ALL variable groups that map to this normalized process type
        const matchingGroups = allVariables.filter(
          (group: MachineVariableGroup) => sourceTypes.includes(group.type)
        );

        console.log(`[ProcessesTabView] Loading fields for "${selectedProcessType}"`);
        console.log(`  Source types to match: [${sourceTypes.join(', ')}]`);
        console.log(`  Found ${matchingGroups.length} matching record(s):`);
        matchingGroups.forEach((group: MachineVariableGroup, index) => {
          const varCount = group.variables && typeof group.variables === 'object' && !Array.isArray(group.variables)
            ? Object.keys(group.variables).length
            : 0;
          console.log(`    Record ${index + 1}: type="${group.type}", id=${group.id}, fields=${varCount}`);
        });

        // Consolidate all fields from all matching groups
        const fieldsArray: FormField[] = [];
        const fieldMap = new Map<string, FormField>(); // To avoid duplicates

        matchingGroups.forEach((group: MachineVariableGroup) => {
          if (group.variables) {
            const vars = group.variables;

            if (typeof vars === "object" && !Array.isArray(vars)) {
              // Variables is an object with keys
              Object.entries(vars).forEach(([key, value]: [string, any]) => {
                // Only add if we haven't seen this field ID before
                if (!fieldMap.has(key)) {
                  const field: FormField = {
                    id: key,
                    type: value.type || "text",
                    label: value.label || key,
                    placeholder: value.placeholder,
                    required: value.required || false,
                    options: value.options,
                    addToJobInput: value.addToJobInput !== undefined ? value.addToJobInput : true,
                    showInAdditionalFields: value.showInAdditionalFields || false,
                    order: value.order,
                    locked: value.locked || (key === 'price_per_m'), // Lock price_per_m field
                  };
                  fieldMap.set(key, field);
                  fieldsArray.push(field);
                }
              });
            }
          }
        });

        // Check if price_per_m exists in fieldsArray, if not create it from processTypeConfig
        const hasPricePerM = fieldsArray.some(f => f.id === 'price_per_m');
        if (!hasPricePerM) {
          // Get the price_per_m config from processTypeConfig
          const processConfig = PROCESS_TYPE_CONFIGS.find(c => c.key === selectedProcessType);
          const pricePerMConfig = processConfig?.fields.find(f => f.name === 'price_per_m');

          if (pricePerMConfig) {
            const pricePerMField: FormField = {
              id: 'price_per_m',
              type: 'currency', // Use currency type for money fields
              label: pricePerMConfig.label,
              placeholder: pricePerMConfig.placeholder,
              required: pricePerMConfig.required,
              addToJobInput: true, // Always add to job input
              showInAdditionalFields: false,
              order: 999, // Put at the end by default
              locked: true, // Always locked
            };
            fieldsArray.push(pricePerMField);
          }
        }

        // Sort fields by order property (fields without order go to the end)
        fieldsArray.sort((a, b) => {
          const orderA = a.order ?? 999;
          const orderB = b.order ?? 999;
          return orderA - orderB;
        });

        setNewProcessTypeFields(fieldsArray);
        // Reset the user changes flag when loading fields from API
        hasUserChangesRef.current = false;
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
  }, [selectedProcessType, apiProcessTypes]);


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

  const handleAddSelectedFields = async () => {
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

    // Build the updated capabilities with new fields
    const updatedCapabilities = { ...bucketCapabilities };
    fieldsToAdd.forEach(({ key, definition }) => {
      updatedCapabilities[key] = definition;
    });

    // Update local state
    setBucketCapabilities(updatedCapabilities);

    // Clear selections and close selector
    setSelectedFields(new Set());
    setShowFieldSelector(false);

    // Auto-save if we're editing an existing bucket (has ID and name)
    if (isEditingBucket && isEditingBucket.id && bucketName.trim()) {
      try {
        await updateCapabilityBucket(isEditingBucket.id, {
          name: bucketName,
          capabilities: updatedCapabilities,
        });
        showToast({
          type: 'success',
          message: 'Fields added and saved successfully',
          duration: 3000,
        });
      } catch (error) {
        console.error("[ProcessesTabView] Error auto-saving after adding fields:", error);
        showToast({
          type: 'error',
          message: 'Fields added but failed to save. Please click Save to try again.',
          duration: 5000,
        });
      }
    }
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

  const handleRemoveCapabilityField = async (key: string) => {
    const newCapabilities = { ...bucketCapabilities };
    delete newCapabilities[key];
    setBucketCapabilities(newCapabilities);

    // Auto-save if we're editing an existing bucket (has ID and name)
    if (isEditingBucket && isEditingBucket.id && bucketName.trim()) {
      try {
        await updateCapabilityBucket(isEditingBucket.id, {
          name: bucketName,
          capabilities: newCapabilities,
        });
        showToast({
          type: 'success',
          message: 'Field removed and saved successfully',
          duration: 3000,
        });
      } catch (error) {
        console.error("[ProcessesTabView] Error auto-saving after removing field:", error);
        showToast({
          type: 'error',
          message: 'Field removed but failed to save. Please click Save to try again.',
          duration: 5000,
        });
      }
    }
  };

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleUpdateCapabilityField = (key: string, value: any) => {
    setBucketCapabilities((prev) => {
      const currentField = prev[key];

      let updatedCapabilities;
      // If the current field is already a full definition object, update just the value
      if (currentField && typeof currentField === "object" && !Array.isArray(currentField) && currentField.type) {
        updatedCapabilities = {
          ...prev,
          [key]: {
            ...currentField,
            value: value,
          },
        };
      } else {
        // Otherwise, if it's just a value, we need to check if we can find the original definition
        // For now, if it's a simple value, replace it (backward compatibility)
        updatedCapabilities = {
          ...prev,
          [key]: value,
        };
      }

      // Debounced auto-save if we're editing an existing bucket
      if (isEditingBucket && isEditingBucket.id && bucketName.trim()) {
        // Clear any existing timeout
        if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
        }

        // Set a new timeout for debounced save (1 second delay)
        autoSaveTimeoutRef.current = setTimeout(async () => {
          try {
            await updateCapabilityBucket(isEditingBucket.id, {
              name: bucketName,
              capabilities: updatedCapabilities,
            });
            showToast({
              type: 'success',
              message: 'Changes saved',
              duration: 2000,
            });
          } catch (error) {
            console.error("[ProcessesTabView] Error auto-saving field update:", error);
            showToast({
              type: 'error',
              message: 'Failed to save changes',
              duration: 3000,
            });
          }
        }, 1000);
      }

      return updatedCapabilities;
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

  // Define allowed core process types
  const ALLOWED_CORE_TYPES = ['data', 'hp', 'laser', 'fold', 'affix', 'insert', 'inkjet', 'labeling'];

  // Define deprecated process types to hide
  const DEPRECATED_TYPES = ['9-12 in+', 'sort', 'insert +', 'insert+', '13+ in+', '13+'];

  // Define all known config types (including deprecated ones we want to hide)
  const ALL_CONFIG_TYPES = PROCESS_TYPE_CONFIGS.map(c => c.key.toLowerCase());

  // Filter process types to show only:
  // 1. Allowed core types (data, hp, laser, affix, insert)
  // 2. Custom process types (not in PROCESS_TYPE_CONFIGS)
  // 3. Exclude deprecated types
  const allowedProcessTypes = apiProcessTypes.filter((pt) => {
    const normalizedKey = pt.key.toLowerCase().trim();

    // Always exclude deprecated types
    if (DEPRECATED_TYPES.includes(normalizedKey)) {
      return false;
    }

    // If it's in PROCESS_TYPE_CONFIGS, only show if it's in ALLOWED_CORE_TYPES
    if (ALL_CONFIG_TYPES.includes(normalizedKey)) {
      return ALLOWED_CORE_TYPES.includes(normalizedKey);
    }

    // If it's not in PROCESS_TYPE_CONFIGS, it's a custom type - allow it
    return true;
  });

  // Further filter by machineType if prop is set (for individual type pages)
  const filteredProcessTypes = machineType
    ? allowedProcessTypes.filter((pt) => machineProcessTypes.includes(pt.key))
    : allowedProcessTypes;

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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg
                className="w-5 h-5 text-blue-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-medium text-blue-900">
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
            <div className="flex items-center justify-between">
              <p className="text-sm text-blue-700">
                You&apos;re editing the {selectedType.label} process type configuration
                {newProcessTypeFields.length > 0 && ` (${newProcessTypeFields.length} field${newProcessTypeFields.length !== 1 ? 's' : ''})`}
              </p>

              {/* Save Status Indicator */}
              {!isCreatingCustom && (
                <div className="ml-4 flex items-center gap-2">
                  {saveStatus === 'saving' && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </div>
                  )}
                  {saveStatus === 'saved' && (
                    <div className="flex items-center gap-1.5 text-sm text-green-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Saved</span>
                    </div>
                  )}
                  {saveStatus === 'error' && saveError && (
                    <div className="flex items-center gap-1.5 text-sm text-red-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      <span>Failed to save</span>
                      <button
                        onClick={() => queueSave(() => saveFieldsToAPI(newProcessTypeFields))}
                        className="ml-1 text-xs underline hover:no-underline"
                      >
                        Retry
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
          processTypeKey={selectedProcessType || undefined}
          fields={newProcessTypeFields}
          onChange={handleFieldsChange}
          onDeleteField={handleDeleteField}
        />
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
