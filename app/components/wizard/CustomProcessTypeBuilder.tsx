/**
 * Custom Process Type Builder
 * Embedded dynamic form builder for creating custom process types in the wizard
 */

"use client";

import React, { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, Edit2 } from "lucide-react";
import { getAllMachineVariables, api } from "@/lib/api";
import FieldActionDropdown from "@/app/components/FieldActionDropdown";
import Toast from "@/app/components/Toast";

interface FormField {
  id: string;
  type: "text" | "number" | "select" | "boolean" | "currency";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
  addToJobInput?: boolean;
  showInAdditionalFields?: boolean;
  is_size?: boolean;
  order?: number;
  locked?: boolean; // If true, field cannot be deleted (but can be edited/reordered)
}

interface CustomProcessTypeBuilderProps {
  processTypeName: string;
  processTypeKey?: string; // The actual key like "laser", "hp", etc.
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  onDeleteField?: (fieldId: string) => void;
}

export default function CustomProcessTypeBuilder({
  processTypeName,
  processTypeKey,
  fields,
  onChange,
  onDeleteField,
}: CustomProcessTypeBuilderProps) {
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null,
  );

  // Toast notification state
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Field editor state
  const [fieldType, setFieldType] = useState<"text" | "number" | "select" | "boolean" | "currency">(
    "text",
  );
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldPlaceholder, setFieldPlaceholder] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");
  const [addToJobInput, setAddToJobInput] = useState(false);
  const [showInAdditionalFields, setShowInAdditionalFields] = useState(false);
  const [isSize, setIsSize] = useState(false);

  // Preview form values
  const [previewValues, setPreviewValues] = useState<{ [key: string]: string }>(
    {},
  );

  // Preview section state
  const [showAdditionalFieldsPreview, setShowAdditionalFieldsPreview] = useState(false);

  // Helper to convert label to snake_case ID
  const toSnakeCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const resetFieldEditor = () => {
    setFieldType("text");
    setFieldLabel("");
    setFieldPlaceholder("");
    setFieldRequired(false);
    setFieldOptions("");
    setAddToJobInput(false);
    setShowInAdditionalFields(false);
    setIsSize(false);
    setEditingFieldIndex(null);
  };

  const handleAddField = () => {
    if (!fieldLabel) {
      alert("Please provide a label for the field.");
      return;
    }

    const generatedId = toSnakeCase(fieldLabel);

    if (!generatedId) {
      alert("Please provide a valid label that contains letters or numbers.");
      return;
    }

    const newField: FormField = {
      id: generatedId,
      type: fieldType,
      label: fieldLabel,
      placeholder: fieldPlaceholder || undefined,
      required: fieldRequired,
      options:
        fieldType === "select"
          ? fieldOptions
              .split(",")
              .map((opt) => opt.trim())
              .filter((opt) => opt)
          : undefined,
      addToJobInput: addToJobInput,
      showInAdditionalFields: showInAdditionalFields,
      is_size: isSize,
    };

    if (editingFieldIndex !== null) {
      const updatedFields = [...fields];
      updatedFields[editingFieldIndex] = newField;
      onChange(updatedFields);
    } else {
      onChange([...fields, newField]);
    }

    resetFieldEditor();
  };

  const handleEditField = (index: number) => {
    const field = fields[index];
    setFieldType(field.type);
    setFieldLabel(field.label);
    setFieldPlaceholder(field.placeholder || "");
    setFieldRequired(field.required || false);
    setFieldOptions(field.options?.join(", ") || "");
    setAddToJobInput(field.addToJobInput || false);
    setShowInAdditionalFields(field.showInAdditionalFields || false);
    setIsSize(field.is_size || false);
    setEditingFieldIndex(index);
  };

  const handleRemoveField = (index: number) => {
    const field = fields[index];

    // If onDeleteField prop is provided, use it for API deletion
    if (onDeleteField && field) {
      onDeleteField(field.id);
    } else {
      // Otherwise, just update local state
      onChange(fields.filter((_, i) => i !== index));
    }
  };

  const handleDuplicateField = (index: number) => {
    const field = fields[index];
    const newLabel = `${field.label} (Copy)`;
    const duplicatedField: FormField = {
      ...field,
      id: toSnakeCase(newLabel),
      label: newLabel,
    };
    onChange([...fields, duplicatedField]);
  };

  const handleSendFieldToAnotherProcess = async (
    fieldIndex: number,
    targetProcessType: string
  ) => {
    try {
      const field = fields[fieldIndex];

      // 1. Get all machine variables to find the target process type
      const allVariables = await getAllMachineVariables();
      const targetProcessGroup = allVariables.find(
        (group: any) => group.type === targetProcessType
      );

      if (!targetProcessGroup) {
        setToast({
          message: `Process type "${targetProcessType}" not found in database`,
          type: "error",
        });
        return;
      }

      // 2. Get the current variables for the target process type
      const targetVariables =
        typeof targetProcessGroup.variables === "object" &&
        !Array.isArray(targetProcessGroup.variables)
          ? targetProcessGroup.variables
          : {};

      // 3. Check if field ID already exists, if so, rename it
      let newFieldId = field.id;
      let newFieldLabel = field.label;

      if (targetVariables[newFieldId]) {
        // Field ID exists, append _copy
        newFieldId = `${field.id}_copy`;
        newFieldLabel = `${field.label} (Copy)`;

        // If _copy also exists, add numbers
        let counter = 2;
        while (targetVariables[newFieldId]) {
          newFieldId = `${field.id}_copy_${counter}`;
          newFieldLabel = `${field.label} (Copy ${counter})`;
          counter++;
        }
      }

      // 4. Create the new field object
      const newFieldData = {
        label: newFieldLabel,
        type: field.type,
        ...(field.placeholder && { placeholder: field.placeholder }),
        ...(field.required !== undefined && { required: field.required }),
        ...(field.options && { options: field.options }),
        ...(field.addToJobInput !== undefined && {
          addToJobInput: field.addToJobInput,
        }),
        ...(field.showInAdditionalFields !== undefined && {
          showInAdditionalFields: field.showInAdditionalFields,
        }),
        ...(field.is_size !== undefined && {
          is_size: field.is_size,
        }),
        ...(field.order !== undefined && { order: field.order }),
      };

      // 5. Add the field to the target process type's variables
      const updatedVariables = {
        ...targetVariables,
        [newFieldId]: newFieldData,
      };

      // 6. Save to API
      await api.patch(
        `/machine_variables/${targetProcessGroup.id}`,
        {
          machine_variables_id: targetProcessGroup.id,
          variables: updatedVariables,
        }
      );

      // 7. Show success toast
      const targetProcessConfig = await import("@/lib/processTypeConfig").then(
        (m) => m.PROCESS_TYPE_CONFIGS.find((c) => c.key === targetProcessType)
      );
      const targetLabel = targetProcessConfig?.label || targetProcessType;

      setToast({
        message: `Field "${field.label}" sent to ${targetLabel}${newFieldLabel !== field.label ? " (renamed to avoid conflict)" : ""}`,
        type: "success",
      });
    } catch (error) {
      console.error("Error sending field to another process:", error);
      setToast({
        message: "Failed to send field. Please try again.",
        type: "error",
      });
    }
  };

  const handleMoveField = (index: number, direction: "up" | "down") => {
    const newFields = [...fields];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= fields.length) return;

    [newFields[index], newFields[targetIndex]] = [
      newFields[targetIndex],
      newFields[index],
    ];
    onChange(newFields);
  };

  const handlePreviewInputChange = (fieldId: string, value: string) => {
    setPreviewValues({
      ...previewValues,
      [fieldId]: value,
    });
  };

  // Helper function to render preview fields
  const renderPreviewField = (field: FormField) => {
    const baseInputClasses =
      "w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed";

    return (
      <div className="flex-1 min-w-[200px]">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {field.label} {field.required && <span className="text-red-500">*</span>}
        </label>
        {field.type === "boolean" ? (
          <div className="flex items-center h-[42px]">
            <input
              type="checkbox"
              disabled
              className="w-4 h-4 text-blue-600 border-gray-300 rounded cursor-not-allowed"
            />
            <span className="ml-2 text-sm text-gray-600">{field.label}</span>
          </div>
        ) : field.type === "select" ? (
          <select disabled className={baseInputClasses}>
            <option>Select...</option>
            {field.options?.map((option, idx) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        ) : field.type === "number" ? (
          <input
            type="number"
            disabled
            placeholder={field.placeholder || "Enter number..."}
            className={baseInputClasses}
          />
        ) : field.type === "currency" ? (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500">$</span>
            </div>
            <input
              type="number"
              disabled
              step="0.01"
              placeholder={field.placeholder || "0.00"}
              className={`${baseInputClasses} pl-8`}
            />
          </div>
        ) : (
          <input
            type="text"
            disabled
            placeholder={field.placeholder || "Enter text..."}
            className={baseInputClasses}
          />
        )}
      </div>
    );
  };

  // Filter fields for preview
  const regularFields = fields.filter(
    (f) => f.addToJobInput === true && f.showInAdditionalFields !== true
  );
  const additionalFields = fields.filter(
    (f) => f.addToJobInput === true && f.showInAdditionalFields === true
  );
  const hasJobInputFields = regularFields.length > 0 || additionalFields.length > 0;

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Field Editor */}
      <div className="h-[600px]">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full flex flex-col">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingFieldIndex !== null ? "Edit Field" : "Add New Field"}
          </h3>

          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label *
              </label>
              <input
                type="text"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                placeholder="e.g., Maximum Speed"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {fieldLabel && (
                <p className="text-xs text-gray-500 mt-1">
                  ID will be auto-generated: e.g., {toSnakeCase(fieldLabel)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Field Type *
              </label>
              <select
                value={fieldType}
                onChange={(e) =>
                  setFieldType(e.target.value as "text" | "number" | "select" | "boolean" | "currency")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="currency">Currency (Money)</option>
                <option value="select">Select (Dropdown)</option>
                <option value="boolean">Boolean (Checkbox)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Placeholder (Optional)
              </label>
              <input
                type="text"
                value={fieldPlaceholder}
                onChange={(e) => setFieldPlaceholder(e.target.value)}
                placeholder="Enter placeholder text..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {fieldType === "select" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Options (comma-separated) *
                </label>
                <input
                  type="text"
                  value={fieldOptions}
                  onChange={(e) => setFieldOptions(e.target.value)}
                  placeholder="e.g., Small, Medium, Large"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Separate each option with a comma
                </p>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                id="required"
                checked={fieldRequired}
                onChange={(e) => setFieldRequired(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="required" className="ml-2 text-sm text-gray-700">
                Required field
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="addToJobInput"
                checked={addToJobInput}
                onChange={(e) => {
                  setAddToJobInput(e.target.checked);
                  if (!e.target.checked) {
                    setShowInAdditionalFields(false);
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="addToJobInput" className="ml-2 text-sm text-gray-700">
                Add to job input
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="showInAdditionalFields"
                checked={showInAdditionalFields}
                onChange={(e) => setShowInAdditionalFields(e.target.checked)}
                disabled={!addToJobInput}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
              />
              <label htmlFor="showInAdditionalFields" className={`ml-2 text-sm ${!addToJobInput ? 'text-gray-400' : 'text-gray-700'}`}>
                Show in Additional Fields
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isSize"
                checked={isSize}
                onChange={(e) => setIsSize(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isSize" className="ml-2 text-sm text-gray-700">
                Is Size
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
                onClick={resetFieldEditor}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right: Field List */}
      <div className="h-[600px]">
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 h-full flex flex-col">
          <h3 className="font-semibold text-gray-900 mb-4">
            Form Fields ({fields.length})
          </h3>

          {fields.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p>No fields added yet.</p>
                <p className="text-sm mt-1">Add fields using the form on the left.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {fields.map((field, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900 flex items-center gap-2">
                    {field.label}
                    {field.locked && (
                      <span title="This field is required and cannot be deleted">
                        🔒
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    ID: {field.id} | Type: {field.type}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleMoveField(index, "up")}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Move up"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveField(index, "down")}
                    disabled={index === fields.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    title="Move down"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <FieldActionDropdown
                    currentProcessType={processTypeKey || ""}
                    onDuplicateOnThisProcess={() => handleDuplicateField(index)}
                    onSendToAnotherProcess={(targetType) =>
                      handleSendFieldToAnotherProcess(index, targetType)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => handleEditField(index)}
                    className="p-1 text-blue-500 hover:text-blue-700"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(index)}
                    disabled={field.locked}
                    className={`p-1 ${
                      field.locked
                        ? "text-gray-300 cursor-not-allowed"
                        : "text-red-500 hover:text-red-700"
                    }`}
                    title={field.locked ? "This field cannot be deleted" : "Remove"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Full-Width Preview Section */}
    <div className="w-full">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="font-semibold text-gray-900 mb-4">
          Live Preview - Add New Job Form
        </h3>

        {fields.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>Add fields above to see preview</p>
          </div>
        ) : !hasJobInputFields ? (
          <div className="text-center text-gray-500 py-8">
            <p>No fields configured for job input.</p>
            <p className="text-sm mt-1">
              Enable &quot;Add to job input&quot; checkbox when creating fields.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Process Type Dropdown */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Process Type <span className="text-red-500">*</span>
              </label>
              <select
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
              >
                <option>{processTypeName || "Custom Process Type"}</option>
              </select>
            </div>

            {/* Regular Fields */}
            {regularFields.length > 0 && (
              <div className="flex flex-wrap gap-4">
                {regularFields.map((field, idx) => (
                  <React.Fragment key={`regular-${field.id}-${idx}`}>
                    {renderPreviewField(field)}
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Add Additional Info Button */}
            {additionalFields.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() =>
                    setShowAdditionalFieldsPreview(!showAdditionalFieldsPreview)
                  }
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1"
                >
                  {showAdditionalFieldsPreview ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      Hide Additional Info
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      Add Additional Info
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Additional Fields Section */}
            {showAdditionalFieldsPreview && additionalFields.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Additional Information
                </h4>
                <div className="flex flex-wrap gap-4">
                  {additionalFields.map((field, idx) => (
                    <React.Fragment key={`additional-${field.id}-${idx}`}>
                      {renderPreviewField(field)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Toast Notification */}
    {toast && (
      <Toast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast(null)}
      />
    )}
  </div>
  );
}
