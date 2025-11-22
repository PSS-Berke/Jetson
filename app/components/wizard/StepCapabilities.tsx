/**
 * Step 3: Process Type & Capabilities Configuration
 * Allows selecting process type and configuring capabilities
 */

"use client";

import React, { useEffect, useState, useRef } from "react";
import ProcessTypeSelector from "../ProcessTypeSelector";
import CustomProcessTypeBuilder from "./CustomProcessTypeBuilder";
import type { MachineCapabilityValue } from "@/types";
import type {
  CustomFormField,
  MachineVariable,
  MachineVariableFromAPI,
  FormBuilderField,
} from "@/hooks/useWizardState";
import {
  getAllMachineVariables,
  getMachineVariablesById,
  updateMachineVariables,
} from "@/lib/api";
import {
  validateFieldName,
} from "@/lib/capabilityValidation";

interface StepCapabilitiesProps {
  processTypeKey: string;
  isCustomProcessType: boolean;
  customProcessTypeName: string;
  customProcessTypeFields: CustomFormField[];
  capabilities: Record<string, MachineCapabilityValue>;
  machineVariables: MachineVariable[];
  machineVariablesId: number | null;
  formBuilderFields: FormBuilderField[];
  onSelectProcessType: (key: string) => void;
  onSelectCustomProcessType: (name: string) => void;
  onCancelCustomProcessType: () => void;
  onSetCustomProcessTypeFields: (fields: CustomFormField[]) => void;
  onCapabilityChange: (field: string, value: MachineCapabilityValue) => void;
  onSetMachineVariables: (variables: MachineVariable[]) => void;
  onSetMachineVariablesId: (id: number | null) => void;
  onUpdateMachineVariable: (id: string, key?: string, value?: string) => void;
  onSetFormBuilderFields: (fields: FormBuilderField[]) => void;
  onAddFormBuilderField: (field: FormBuilderField) => void;
  onUpdateFormBuilderField: (
    id: string,
    field: Partial<FormBuilderField>,
  ) => void;
  onRemoveFormBuilderField: (id: string) => void;
  errors: Record<string, string>;
  disableAutoSave?: boolean; // When true, prevents PATCH machine variables on value changes
  isEditMode?: boolean; // When true, indicates editing existing machine (don't clear pre-loaded fields)
}

export default function StepCapabilities({
  processTypeKey,
  isCustomProcessType,
  customProcessTypeName,
  customProcessTypeFields,
  capabilities,
  machineVariables,
  machineVariablesId,
  formBuilderFields,
  onSelectProcessType,
  onSelectCustomProcessType,
  onCancelCustomProcessType,
  onSetCustomProcessTypeFields,
  onCapabilityChange,
  onSetMachineVariables,
  onSetMachineVariablesId,
  onUpdateMachineVariable,
  onSetFormBuilderFields,
  onAddFormBuilderField,
  onUpdateFormBuilderField,
  onRemoveFormBuilderField,
  errors,
  disableAutoSave = false,
  isEditMode = false,
}: StepCapabilitiesProps) {
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null,
  );
  const [fieldFormData, setFieldFormData] = useState({
    fieldName: "",
    fieldLabel: "",
    fieldType: "text" as "text" | "number" | "select" | "boolean",
    fieldValue: "",
    options: "",
    required: false,
    addToJobInput: false,
  });
  const editFormRef = useRef<HTMLDivElement>(null);
  const pendingEditFieldNameRef = useRef<string | null>(null);
  // Store available fields from saved process type (for selection)
  const [availableFields, setAvailableFields] = useState<FormBuilderField[]>(
    [],
  );
  // Simplified auto-save tracking - only prevent save on initial mount
  const isInitialMountRef = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-generate field name from field label (convert to snake_case)
  const generateFieldName = (label: string): string => {
    const baseName = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    // Return the snake_case name without prefix
    return baseName;
  };

  // Helper function to properly handle field values, preserving boolean false
  const getFieldValue = (value: any, fieldType: string): string | number | boolean => {
    // For boolean fields, preserve false as boolean, not empty string
    if (fieldType === "boolean") {
      if (value === false || value === "false" || value === 0) {
        return false;
      }
      if (value === true || value === "true" || value === 1) {
        return true;
      }
      // Default to false if value is undefined/null/empty
      return false;
    }
    // For other types, use the value or default to empty string
    return value !== undefined && value !== null ? value : "";
  };

  // Function to load machine variables from API (only called when process type is clicked)
  const loadVariablesForProcessType = async (processKey: string) => {
    if (!processKey || isCustomProcessType) {
      // Clear variables if switching to custom or no process type
      if (isCustomProcessType || !processKey) {
        onSetMachineVariables([]);
        onSetMachineVariablesId(null);
        onSetFormBuilderFields([]);
        setAvailableFields([]);
      }
      return;
    }

    try {
      // Fetch machine variables by ID directly (skip the first GET /machine_variables call)
      // We need to find the ID first, but we'll use a more efficient approach
      // Check if we can use the data from getAllMachineVariables if it has variables
      const allVariables = await getAllMachineVariables();
      const processTypeGroup = allVariables.find(
        (group: MachineVariableFromAPI) => group.type === processKey,
      );

      if (processTypeGroup && processTypeGroup.id) {
        // Store the ID
        console.log(
          "[StepCapabilities] Process type group:",
          processTypeGroup,
        );
        console.log(
          "[StepCapabilities] Setting machine variables ID:",
          processTypeGroup.id,
        );
        onSetMachineVariablesId(processTypeGroup.id);

        // Check if we can use data from getAllMachineVariables directly
        // If it has variables, use them; otherwise fetch by ID
        let fields: FormBuilderField[] = [];
        let useDirectData = false;

        if (
          processTypeGroup.variables &&
          typeof processTypeGroup.variables === "object" &&
          (Array.isArray(processTypeGroup.variables) ||
            Object.keys(processTypeGroup.variables).length > 0)
        ) {
          // Use data from getAllMachineVariables directly
          useDirectData = true;
          if (Array.isArray(processTypeGroup.variables)) {
            fields = processTypeGroup.variables.map(
              (v: any, index: number) => {
                const fieldType = (v.variable_type as
                  | "text"
                  | "number"
                  | "select"
                  | "boolean") || "text";
                return {
                  id: `available_${index}`,
                  fieldName: v.variable_name || "",
                  fieldLabel: v.variable_label || v.variable_name || "",
                  fieldType: fieldType,
                  fieldValue: getFieldValue(v.variable_value, fieldType),
                  options: v.options,
                  required: v.required || false,
                  addToJobInput: v.addToJobInput || false,
                };
              },
            );
          } else {
            fields = Object.entries(processTypeGroup.variables).map(
              ([key, value], index) => {
                const val = value as any;
                const fieldType = (val.type as "text" | "number" | "select" | "boolean") || "text";
                const fieldValue = typeof val === "object" 
                  ? getFieldValue(val.value, fieldType)
                  : getFieldValue(val, fieldType);
                return {
                  id: `available_${Date.now()}_${index}`,
                  fieldName: key,
                  fieldLabel: val.label || key,
                  fieldType: fieldType,
                  fieldValue: fieldValue,
                  options: val.options,
                  required: val.required || false,
                  addToJobInput: val.addToJobInput || false,
                };
              },
            );
          }
        }

        // Only fetch by ID if we don't have the data from getAllMachineVariables
        if (!useDirectData) {
          try {
            console.log(
              "[StepCapabilities] Fetching machine variables by ID:",
              processTypeGroup.id,
            );
            const machineVariablesData = await getMachineVariablesById(
              processTypeGroup.id,
            );
            console.log(
              "[StepCapabilities] Machine variables data:",
              machineVariablesData,
            );

            // Convert to available fields
            if (
              machineVariablesData.variables &&
              typeof machineVariablesData.variables === "object"
            ) {
              if (Array.isArray(machineVariablesData.variables)) {
                fields = machineVariablesData.variables.map(
                  (v: any, index: number) => {
                    const fieldType = (v.variable_type as
                      | "text"
                      | "number"
                      | "select"
                      | "boolean") || "text";
                    return {
                      id: `available_${index}`,
                      fieldName: v.variable_name || "",
                      fieldLabel: v.variable_label || v.variable_name || "",
                      fieldType: fieldType,
                      fieldValue: getFieldValue(v.variable_value, fieldType),
                      options: v.options,
                      required: v.required || false,
                      addToJobInput: v.addToJobInput || false,
                    };
                  },
                );
              } else {
                fields = Object.entries(machineVariablesData.variables).map(
                  ([key, value], index) => {
                    const val = value as any;
                    const fieldType = (val.type as "text" | "number" | "select" | "boolean") || "text";
                    const fieldValue = typeof val === "object" 
                      ? getFieldValue(val.value, fieldType)
                      : getFieldValue(val, fieldType);
                    return {
                      id: `available_${Date.now()}_${index}`,
                      fieldName: key,
                      fieldLabel: val.label || key,
                      fieldType: fieldType,
                      fieldValue: fieldValue,
                      options: val.options,
                      required: val.required || false,
                      addToJobInput: val.addToJobInput || false,
                    };
                  },
                );
              }
            }
          } catch (fetchError) {
            console.error(
              "[StepCapabilities] Error fetching machine variables by ID:",
              fetchError,
            );
            // Fields will remain empty if fetch fails
          }
        }

        // Store as available fields for user selection (don't auto-add)
        setAvailableFields(fields);
        // Clear existing form builder fields when process type changes
        // User will need to select which fields they want
        // EXCEPT when in edit mode - preserve pre-loaded fields from saved machine data
        if (!isEditMode) {
          onSetFormBuilderFields([]);
        }
      } else {
        // No variables for this process type
        console.warn(
          "[StepCapabilities] No ID found in process type group:",
          processTypeGroup,
        );
        onSetMachineVariables([]);
        onSetMachineVariablesId(null);
        onSetFormBuilderFields([]);
        setAvailableFields([]);
      }
    } catch (error) {
      console.error(
        "[StepCapabilities] Error loading variables for process type:",
        error,
      );
      onSetMachineVariables([]);
      onSetMachineVariablesId(null);
      onSetFormBuilderFields([]);
      setAvailableFields([]);
    }
  };

  // Handler for when process type is selected (called when user clicks on a process type)
  const handleSelectProcessType = (key: string) => {
    onSelectProcessType(key);
    // Load variables only when process type is clicked
    loadVariablesForProcessType(key);
  };

  const handleAddField = () => {
    if (!fieldFormData.fieldLabel) {
      alert("Please provide a field label.");
      return;
    }

    // Auto-generate field name from label, or use existing fieldName if editing
    const fieldName =
      editingFieldIndex !== null && fieldFormData.fieldName
        ? fieldFormData.fieldName
        : generateFieldName(fieldFormData.fieldLabel);

    // Validate field name
    const validation = validateFieldName(fieldName);
    if (!validation.valid) {
      const errorMessage = validation.errors.map((e) => e.message).join("\n");
      alert(`Field name validation error:\n${errorMessage}`);
      return;
    }

    // Show warnings if any
    if (validation.warnings.length > 0) {
      const warningMessage = validation.warnings
        .map((w) => w.message)
        .join("\n");
      console.warn("[StepCapabilities] Field name warnings:", warningMessage);
    }

    // Check for duplicate field names (excluding the field being edited)
    const duplicateField = formBuilderFields.find(
      (field, index) =>
        field.fieldName === fieldName &&
        (editingFieldIndex === null || index !== editingFieldIndex)
    );

    if (duplicateField) {
      alert(
        `A field with the name "${fieldName}" already exists. Please choose a different label.`
      );
      return;
    }

    const newField: FormBuilderField = {
      id:
        editingFieldIndex !== null
          ? formBuilderFields[editingFieldIndex].id
          : `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fieldName: fieldName,
      fieldLabel: fieldFormData.fieldLabel,
      fieldType: fieldFormData.fieldType,
      fieldValue: fieldFormData.fieldValue,
      options:
        fieldFormData.fieldType === "select" && fieldFormData.options
          ? fieldFormData.options
              .split(",")
              .map((opt) => opt.trim())
              .filter((opt) => opt)
          : undefined,
      required: fieldFormData.required,
      addToJobInput: fieldFormData.addToJobInput,
    };

    if (editingFieldIndex !== null) {
      const updatedFields = [...formBuilderFields];
      updatedFields[editingFieldIndex] = newField;
      onSetFormBuilderFields(updatedFields);
      setEditingFieldIndex(null);
      // Save to API immediately when updating a field
      if (machineVariablesId) {
        saveFieldsToAPI(updatedFields);
      }
    } else {
      onAddFormBuilderField(newField);
      // Save to API immediately when adding a new field
      // Include all existing fields plus the new field
      const fieldsWithNewField = [...formBuilderFields, newField];
      if (machineVariablesId) {
        saveFieldsToAPI(fieldsWithNewField);
      }
    }

    // Reset form
    setFieldFormData({
      fieldName: "",
      fieldLabel: "",
      fieldType: "text",
      fieldValue: "",
      options: "",
      required: false,
      addToJobInput: false,
    });
  };

  const handleEditField = (index: number) => {
    const field = formBuilderFields[index];
    setFieldFormData({
      fieldName: field.fieldName,
      fieldLabel: field.fieldLabel,
      fieldType: field.fieldType,
      fieldValue: String(field.fieldValue || ""),
      options: field.options?.join(", ") || "",
      required: field.required || false,
      addToJobInput: (field as any).addToJobInput || false,
    });
    setEditingFieldIndex(index);
  };

  const handleEditFieldByLabel = (fieldLabel: string) => {
    // First, try to find the field in formBuilderFields (already selected)
    let index = formBuilderFields.findIndex(
      (field) => field.fieldLabel === fieldLabel,
    );
    
    let fieldToEdit: FormBuilderField | null = null;
    
    if (index !== -1) {
      // Field is already in formBuilderFields, use it
      fieldToEdit = formBuilderFields[index];
    } else {
      // Field is not in formBuilderFields yet, check availableFields
      const availableField = availableFields.find(
        (field) => field.fieldLabel === fieldLabel,
      );
      
      if (availableField) {
        // Create a new field from availableField and add it to formBuilderFields
        const newField: FormBuilderField = {
          ...availableField,
          id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        };
        // Populate the edit form with the field's data first
        setFieldFormData({
          fieldName: newField.fieldName,
          fieldLabel: newField.fieldLabel,
          fieldType: newField.fieldType,
          fieldValue: String(newField.fieldValue || ""),
          options: newField.options?.join(", ") || "",
          required: newField.required || false,
          addToJobInput: (newField as any).addToJobInput || false,
        });
        // Store the fieldName to find it after state update (useEffect will handle it)
        pendingEditFieldNameRef.current = newField.fieldName;
        // Add the field - useEffect will set editingFieldIndex when it's added
        onAddFormBuilderField(newField);
        return; // Early return, useEffect will handle the rest
      } else {
        // Field not found, can't edit
        console.warn(`[StepCapabilities] Field with label "${fieldLabel}" not found`);
        return;
      }
    }
    
    if (fieldToEdit) {
      // Populate the edit form with the field's data
      setFieldFormData({
        fieldName: fieldToEdit.fieldName,
        fieldLabel: fieldToEdit.fieldLabel,
        fieldType: fieldToEdit.fieldType,
        fieldValue: String(fieldToEdit.fieldValue || ""),
        options: fieldToEdit.options?.join(", ") || "",
        required: fieldToEdit.required || false,
        addToJobInput: (fieldToEdit as any).addToJobInput || false,
      });
      
      // If field was already in formBuilderFields, set index immediately
      if (index !== -1) {
        setEditingFieldIndex(index);
        // Scroll to edit form after a short delay to ensure it's rendered
        setTimeout(() => {
          editFormRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    }
  };

  const handleRemoveField = (id: string) => {
    // Calculate the fields after removal
    const fieldsAfterRemoval = formBuilderFields.filter((field) => field.id !== id);
    
    // Update the state first
    onRemoveFormBuilderField(id);
    
    // Only save to API if auto-save is enabled (edit mode) and we have a machineVariablesId
    if (!disableAutoSave && machineVariablesId) {
      // Use setTimeout to ensure state has updated before saving
      setTimeout(() => {
        saveFieldsToAPI(fieldsAfterRemoval);
      }, 0);
    }
  };

  const handleDeleteFieldFromProcessType = async (
    processTypeKeyParam: string,
    fieldName: string,
  ) => {
    // Find the field in formBuilderFields by fieldName and remove it
    const fieldToRemove = formBuilderFields.find(
      (field) => field.fieldName === fieldName,
    );
    
    if (fieldToRemove) {
      // Remove from formBuilderFields
      onRemoveFormBuilderField(fieldToRemove.id);
      
      // If auto-save is enabled, save the updated fields to API
      if (!disableAutoSave && machineVariablesId) {
        const fieldsAfterRemoval = formBuilderFields.filter(
          (field) => field.id !== fieldToRemove.id,
        );
        setTimeout(() => {
          saveFieldsToAPI(fieldsAfterRemoval);
        }, 0);
      }
    }

    // If we have machineVariablesId and the process type matches, update the API
    // This removes the field from the saved process type definition
    if (machineVariablesId && processTypeKeyParam === processTypeKey) {
      try {
        // Get current variables
        const machineVariablesData = await getMachineVariablesById(
          machineVariablesId,
        );
        
        if (machineVariablesData.variables && typeof machineVariablesData.variables === "object") {
          const variables = { ...machineVariablesData.variables };
          // Remove the field from variables
          delete variables[fieldName];
          
          // Save updated variables
          await updateMachineVariables(machineVariablesId, variables);
          
          // Update availableFields to reflect the deletion
          setAvailableFields((prev) =>
            prev.filter((field) => field.fieldName !== fieldName),
          );
        }
      } catch (error) {
        console.error(
          "[StepCapabilities] Error deleting field from process type:",
          error,
        );
      }
    }
  };

  const handleFieldValueChange = (
    id: string,
    value: string | number | boolean,
  ) => {
    onUpdateFormBuilderField(id, { fieldValue: value });
    // Auto-save will be triggered by useEffect when formBuilderFields updates
  };

  // Helper function to save fields to API with debouncing
  const saveFieldsToAPI = async (fieldsToSave: FormBuilderField[]) => {
    if (!machineVariablesId) {
      return;
    }

    try {
      // Convert form builder fields to variables object
      // Even if empty, we save an empty object to clear all fields
      const variables: Record<string, any> = {};
      fieldsToSave.forEach((field) => {
        variables[field.fieldName] = {
          label: field.fieldLabel,
          type: field.fieldType,
          value: field.fieldValue,
          options: field.options,
          required: field.required,
          addToJobInput: (field as any).addToJobInput,
        };
      });

      console.log(
        "[StepCapabilities] Saving machine variables:",
        machineVariablesId,
        variables,
      );
      await updateMachineVariables(machineVariablesId, variables);
      console.log("[StepCapabilities] Machine variables saved successfully");
    } catch (error) {
      console.error(
        "[StepCapabilities] Error saving machine variables:",
        error,
      );
      // Don't show error to user - silent failure
    }
  };

  // Handle pending edit after field is added to formBuilderFields
  useEffect(() => {
    if (pendingEditFieldNameRef.current) {
      const index = formBuilderFields.findIndex(
        (field) => field.fieldName === pendingEditFieldNameRef.current,
      );
      if (index !== -1) {
        setEditingFieldIndex(index);
        pendingEditFieldNameRef.current = null;
        // Scroll to edit form
        setTimeout(() => {
          editFormRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    }
  }, [formBuilderFields]);

  // Debounced auto-save when formBuilderFields change
  useEffect(() => {
    // Skip if auto-save is disabled (e.g., in create mode)
    if (disableAutoSave) {
      return;
    }

    // Skip initial mount
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set a new timeout for debounced save (500ms delay)
    if (machineVariablesId) {
      saveTimeoutRef.current = setTimeout(() => {
        saveFieldsToAPI(formBuilderFields);
      }, 500);
    }

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formBuilderFields, machineVariablesId, disableAutoSave]);

  // Handle selecting a field from available saved processes
  const handleSelectAvailableField = (availableField: FormBuilderField) => {
    // Check if field is already selected
    const isAlreadySelected = formBuilderFields.some(
      (field) => field.fieldName === availableField.fieldName,
    );

    if (isAlreadySelected) {
      // Remove if already selected
      const fieldToRemove = formBuilderFields.find(
        (field) => field.fieldName === availableField.fieldName,
      );
      if (fieldToRemove) {
        onRemoveFormBuilderField(fieldToRemove.id);
        // Don't save to API when selecting from saved processes - let auto-save or form submission handle it
      }
    } else {
      // Add the field with a new unique ID
      const newField: FormBuilderField = {
        ...availableField,
        id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };
      onAddFormBuilderField(newField);
      // Don't save to API when selecting from saved processes - let auto-save or form submission handle it
    }
  };

  return (
    <div className="space-y-8">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Process Type & Capabilities
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Select a process type with pre-configured capabilities, or create a
          custom one.
        </p>
      </div>

      {/* Process Type Selection */}
      <ProcessTypeSelector
        selectedProcessType={processTypeKey}
        isCustom={isCustomProcessType}
        customName={customProcessTypeName}
        onSelectExisting={handleSelectProcessType}
        onSelectCustom={onSelectCustomProcessType}
        onCancelCustom={onCancelCustomProcessType}
        onEditField={handleEditFieldByLabel}
        onDeleteField={handleDeleteFieldFromProcessType}
        error={errors.process_type_key || errors.customProcessTypeName}
      />

      {/* Custom Process Type Builder */}
      {isCustomProcessType && customProcessTypeName && (
        <div className="border-t border-gray-200 pt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Build Custom Form
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Define the fields for your custom process type &quot;
              <strong>{customProcessTypeName}</strong>&quot;.
            </p>
          </div>

          <CustomProcessTypeBuilder
            processTypeName={customProcessTypeName}
            fields={customProcessTypeFields}
            onChange={onSetCustomProcessTypeFields}
          />

          {errors.customProcessTypeFields && (
            <p className="mt-4 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.customProcessTypeFields}
            </p>
          )}
        </div>
      )}

      {/* Available Fields from Saved Process - Select Individual Fields */}
      {processTypeKey && !isCustomProcessType && availableFields.length > 0 && (
        <div className="border-t border-gray-200 pt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Select from Saved Processes
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Choose which fields from the saved process type you want to use
              for this machine. Select individual fields by clicking on them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {availableFields.map((availableField) => {
              const isSelected = formBuilderFields.some(
                (field) => field.fieldName === availableField.fieldName,
              );
              return (
                <button
                  key={availableField.id}
                  type="button"
                  onClick={() => handleSelectAvailableField(availableField)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isSelected ? "bg-blue-500" : "bg-gray-300"
                          }`}
                        />
                        <span className="font-medium text-gray-900">
                          {availableField.fieldLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {availableField.fieldType}
                        {availableField.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </p>
                    </div>
                    {isSelected && (
                      <svg
                        className="w-5 h-5 text-blue-500 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Form Builder - Add Inputs and Assign Values */}
      {processTypeKey && !isCustomProcessType && (
        <div className="border-t border-gray-200 pt-8">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Build Input Form
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Add input fields and assign values. These will be saved to the
              machine variables.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Form Builder */}
            <div className="space-y-4">
              <div
                ref={editFormRef}
                className="bg-gray-50 p-4 rounded-lg border border-gray-200"
              >
                <h4 className="font-semibold text-gray-900 mb-4">
                  {editingFieldIndex !== null
                    ? `Edit Field: ${formBuilderFields[editingFieldIndex]?.fieldLabel || ""}`
                    : "Add New Field"}
                </h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Label *
                    </label>
                    <input
                      type="text"
                      value={fieldFormData.fieldLabel}
                      onChange={(e) =>
                        setFieldFormData({
                          ...fieldFormData,
                          fieldLabel: e.target.value,
                        })
                      }
                      placeholder="e.g., Serial Number (field name will be auto-generated)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {fieldFormData.fieldLabel && (
                      <p className="mt-1 text-xs text-gray-500">
                        Field name:{" "}
                        <span className="font-mono">
                          {generateFieldName(fieldFormData.fieldLabel)}
                        </span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Type *
                    </label>
                    <select
                      value={fieldFormData.fieldType}
                      onChange={(e) =>
                        setFieldFormData({
                          ...fieldFormData,
                          fieldType: e.target.value as any,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="select">Select (Dropdown)</option>
                      <option value="boolean">Boolean (Checkbox)</option>
                    </select>
                  </div>

                  {fieldFormData.fieldType === "select" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Options (comma-separated) *
                      </label>
                      <input
                        type="text"
                        value={fieldFormData.options}
                        onChange={(e) =>
                          setFieldFormData({
                            ...fieldFormData,
                            options: e.target.value,
                          })
                        }
                        placeholder="e.g., Option 1, Option 2, Option 3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Default Value
                    </label>
                    {fieldFormData.fieldType === "boolean" ? (
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={fieldFormData.fieldValue === "true"}
                          onChange={(e) =>
                            setFieldFormData({
                              ...fieldFormData,
                              fieldValue: e.target.checked ? "true" : "false",
                            })
                          }
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-600">
                          Enable by default
                        </span>
                      </div>
                    ) : (
                      <input
                        type={
                          fieldFormData.fieldType === "number"
                            ? "number"
                            : "text"
                        }
                        value={fieldFormData.fieldValue}
                        onChange={(e) =>
                          setFieldFormData({
                            ...fieldFormData,
                            fieldValue: e.target.value,
                          })
                        }
                        placeholder="Enter default value"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="required"
                      checked={fieldFormData.required}
                      onChange={(e) =>
                        setFieldFormData({
                          ...fieldFormData,
                          required: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="required"
                      className="ml-2 text-sm text-gray-700"
                    >
                      Required field
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="addToJobInput"
                      checked={fieldFormData.addToJobInput}
                      onChange={(e) =>
                        setFieldFormData({
                          ...fieldFormData,
                          addToJobInput: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label
                      htmlFor="addToJobInput"
                      className="ml-2 text-sm text-gray-700"
                    >
                      Add to job input
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddField}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    {editingFieldIndex !== null ? "Update Field" : "Add Field"}
                  </button>

                  {editingFieldIndex !== null && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFieldIndex(null);
                        setFieldFormData({
                          fieldName: "",
                          fieldLabel: "",
                          fieldType: "text",
                          fieldValue: "",
                          options: "",
                          required: false,
                          addToJobInput: false,
                        });
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Assign Values */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Assign Values
              </h4>

              {formBuilderFields.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No fields added yet.</p>
                  <p className="text-sm mt-1">Add fields to assign values.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {formBuilderFields.map((field, index) => (
                    <div key={field.id} className="bg-white p-4 rounded-lg border border-green-200">
                      <div className="flex items-start justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          {field.fieldLabel}
                          {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditField(index)}
                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Edit field"
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
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(field.id)}
                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                            title="Delete field"
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
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {field.fieldType === "select" && field.options ? (
                        <select
                          value={String(field.fieldValue || "")}
                          onChange={(e) =>
                            handleFieldValueChange(field.id, e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                        >
                          <option value="">Select an option...</option>
                          {field.options.map((option, idx) => (
                            <option key={idx} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : field.fieldType === "boolean" ? (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={
                              field.fieldValue === true ||
                              field.fieldValue === "true"
                            }
                            onChange={(e) =>
                              handleFieldValueChange(field.id, e.target.checked)
                            }
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                          />
                          <span className="ml-2 text-sm text-gray-600">
                            Enable
                          </span>
                        </div>
                      ) : (
                        <input
                          type={
                            field.fieldType === "number" ? "number" : "text"
                          }
                          value={String(field.fieldValue || "")}
                          onChange={(e) => {
                            const value =
                              field.fieldType === "number"
                                ? parseFloat(e.target.value) || 0
                                : e.target.value;
                            handleFieldValueChange(field.id, value);
                          }}
                          placeholder={`Enter ${field.fieldLabel.toLowerCase()}`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 bg-white"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Help Text */}
      {!processTypeKey && !isCustomProcessType && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-gray-700">
                Getting Started
              </h4>
              <p className="mt-1 text-sm text-gray-600">
                Choose an existing process type to use pre-configured
                capabilities, or create a custom process type if you need
                specific configurations not available in the standard options.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
