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
import { getAllMachineVariables, getMachineVariablesById } from "@/lib/api";

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
  });
  const editFormRef = useRef<HTMLDivElement>(null);

  // Auto-generate field name from field label (convert to snake_case)
  const generateFieldName = (label: string): string => {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  // Load machine variables from API when process type is selected
  useEffect(() => {
    const loadVariablesForProcessType = async () => {
      if (!processTypeKey || isCustomProcessType) {
        // Clear variables if switching to custom or no process type
        if (isCustomProcessType || !processTypeKey) {
          onSetMachineVariables([]);
          onSetMachineVariablesId(null);
          onSetFormBuilderFields([]);
        }
        return;
      }

      try {
        // First, get all machine variables to find the one matching the process type
        const allVariables = await getAllMachineVariables();
        const processTypeGroup = allVariables.find(
          (group: MachineVariableFromAPI) => group.type === processTypeKey,
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

          // Now fetch the full details using GET /machine_variables/{id}
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

            // Load existing form builder fields from variables if they exist
            if (
              machineVariablesData.variables &&
              typeof machineVariablesData.variables === "object"
            ) {
              if (Array.isArray(machineVariablesData.variables)) {
                // Convert array to form builder fields
                const fields: FormBuilderField[] =
                  machineVariablesData.variables.map(
                    (v: any, index: number) => ({
                      id: `field_${index}`,
                      fieldName: v.variable_name || "",
                      fieldLabel: v.variable_label || v.variable_name || "",
                      fieldType:
                        (v.variable_type as
                          | "text"
                          | "number"
                          | "select"
                          | "boolean") || "text",
                      fieldValue: v.variable_value || "",
                      options: v.options,
                      required: v.required || false,
                    }),
                  );
                onSetFormBuilderFields(fields);
              } else {
                // Convert object to form builder fields (this is the format from PATCH)
                const fields: FormBuilderField[] = Object.entries(
                  machineVariablesData.variables,
                ).map(([key, value], index) => {
                  const val = value as any;
                  return {
                    id: `field_${Date.now()}_${index}`,
                    fieldName: key,
                    fieldLabel: val.label || key,
                    fieldType:
                      (val.type as "text" | "number" | "select" | "boolean") ||
                      "text",
                    fieldValue:
                      typeof val === "object" ? val.value || "" : String(val),
                    options: val.options,
                    required: val.required || false,
                  };
                });
                onSetFormBuilderFields(fields);
              }
            } else {
              // No existing fields, start with empty
              onSetFormBuilderFields([]);
            }
          } catch (fetchError) {
            console.error(
              "[StepCapabilities] Error fetching machine variables by ID:",
              fetchError,
            );
            // Fallback: try to use data from getAllMachineVariables
            if (
              processTypeGroup.variables &&
              typeof processTypeGroup.variables === "object"
            ) {
              if (Array.isArray(processTypeGroup.variables)) {
                const fields: FormBuilderField[] =
                  processTypeGroup.variables.map((v: any, index: number) => ({
                    id: `field_${index}`,
                    fieldName: v.variable_name || "",
                    fieldLabel: v.variable_label || v.variable_name || "",
                    fieldType:
                      (v.variable_type as
                        | "text"
                        | "number"
                        | "select"
                        | "boolean") || "text",
                    fieldValue: v.variable_value || "",
                    options: v.options,
                    required: v.required || false,
                  }));
                onSetFormBuilderFields(fields);
              } else {
                const fields: FormBuilderField[] = Object.entries(
                  processTypeGroup.variables,
                ).map(([key, value], index) => {
                  const val = value as any;
                  return {
                    id: `field_${index}`,
                    fieldName: key,
                    fieldLabel: val.label || key,
                    fieldType:
                      (val.type as "text" | "number" | "select" | "boolean") ||
                      "text",
                    fieldValue:
                      typeof val === "object" ? val.value || "" : String(val),
                    options: val.options,
                    required: val.required || false,
                  };
                });
                onSetFormBuilderFields(fields);
              }
            } else {
              onSetFormBuilderFields([]);
            }
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
        }
      } catch (error) {
        console.error(
          "[StepCapabilities] Error loading variables for process type:",
          error,
        );
        onSetMachineVariables([]);
        onSetMachineVariablesId(null);
        onSetFormBuilderFields([]);
      }
    };

    loadVariablesForProcessType();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processTypeKey, isCustomProcessType]);

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
    };

    if (editingFieldIndex !== null) {
      const updatedFields = [...formBuilderFields];
      updatedFields[editingFieldIndex] = newField;
      onSetFormBuilderFields(updatedFields);
      setEditingFieldIndex(null);
    } else {
      onAddFormBuilderField(newField);
    }

    // Reset form
    setFieldFormData({
      fieldName: "",
      fieldLabel: "",
      fieldType: "text",
      fieldValue: "",
      options: "",
      required: false,
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
    });
    setEditingFieldIndex(index);
  };

  const handleEditFieldByLabel = (fieldLabel: string) => {
    const index = formBuilderFields.findIndex(
      (field) => field.fieldLabel === fieldLabel,
    );
    if (index !== -1) {
      handleEditField(index);
      // Scroll to edit form after a short delay to ensure it's rendered
      setTimeout(() => {
        editFormRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  };

  const handleRemoveField = (id: string) => {
    onRemoveFormBuilderField(id);
  };

  const handleFieldValueChange = (
    id: string,
    value: string | number | boolean,
  ) => {
    onUpdateFormBuilderField(id, { fieldValue: value });
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
        onSelectExisting={onSelectProcessType}
        onSelectCustom={onSelectCustomProcessType}
        onCancelCustom={onCancelCustomProcessType}
        onEditField={handleEditFieldByLabel}
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
                  {editingFieldIndex !== null ? "Edit Field" : "Add New Field"}
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
                  {formBuilderFields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {field.fieldLabel}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>

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
