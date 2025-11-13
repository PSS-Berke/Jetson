/**
 * Custom Process Type Builder
 * Embedded dynamic form builder for creating custom process types in the wizard
 */

"use client";

import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown, Copy, Trash2, Edit2 } from "lucide-react";

interface FormField {
  id: string;
  type: "text" | "number" | "select";
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

interface CustomProcessTypeBuilderProps {
  processTypeName: string;
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
}

export default function CustomProcessTypeBuilder({
  processTypeName,
  fields,
  onChange,
}: CustomProcessTypeBuilderProps) {
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(
    null,
  );

  // Field editor state
  const [fieldType, setFieldType] = useState<"text" | "number" | "select">(
    "text",
  );
  const [fieldLabel, setFieldLabel] = useState("");
  const [fieldPlaceholder, setFieldPlaceholder] = useState("");
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState("");

  // Preview form values
  const [previewValues, setPreviewValues] = useState<{ [key: string]: string }>(
    {},
  );

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
    setEditingFieldIndex(index);
  };

  const handleRemoveField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index));
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left Side - Form Builder */}
      <div className="space-y-6">
        {/* Field Editor */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">
            {editingFieldIndex !== null ? "Edit Field" : "Add New Field"}
          </h3>

          <div className="space-y-4">
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
                  setFieldType(e.target.value as "text" | "number" | "select")
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="select">Select (Dropdown)</option>
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

        {/* Field List */}
        {fields.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Form Fields ({fields.length})
            </h3>
            <div className="space-y-2">
              {fields.map((field, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {field.label}
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
                    <button
                      type="button"
                      onClick={() => handleDuplicateField(index)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
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
                      className="p-1 text-red-500 hover:text-red-700"
                      title="Remove"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right Side - Live Preview */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Live Preview
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          See how your form will look
        </p>

        {fields.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No fields added yet.</p>
            <p className="text-sm mt-1">Add fields to see the preview.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-lg font-bold text-blue-600 mb-4">
              {processTypeName}
            </h4>
            <div className="space-y-4">
              {fields.map((field) => (
                <div key={field.id}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1">*</span>
                    )}
                  </label>

                  {field.type === "select" ? (
                    <select
                      value={previewValues[field.id] || ""}
                      onChange={(e) =>
                        handlePreviewInputChange(field.id, e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select an option...</option>
                      {field.options?.map((option, idx) => (
                        <option key={idx} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={previewValues[field.id] || ""}
                      onChange={(e) =>
                        handlePreviewInputChange(field.id, e.target.value)
                      }
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
