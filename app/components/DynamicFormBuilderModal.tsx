'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';

interface FormField {
  id: string;
  type: 'text' | 'number' | 'select';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[]; // For select fields
}

interface DynamicFormBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: User | null;
}

export default function DynamicFormBuilderModal({ isOpen, onClose, user }: DynamicFormBuilderModalProps) {
  const [formType, setFormType] = useState('');
  const [fields, setFields] = useState<FormField[]>([]);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Field editor state
  const [fieldId, setFieldId] = useState('');
  const [fieldType, setFieldType] = useState<'text' | 'number' | 'select'>('text');
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState(''); // Comma-separated for select

  // Preview form values
  const [previewValues, setPreviewValues] = useState<{ [key: string]: string }>({});

  if (!isOpen) return null;

  // Helper function to convert label to snake_case ID
  const toSnakeCase = (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_')     // Replace spaces with underscores
      .replace(/_+/g, '_')      // Replace multiple underscores with single
      .replace(/^_|_$/g, '');   // Remove leading/trailing underscores
  };

  const resetFieldEditor = () => {
    setFieldId('');
    setFieldType('text');
    setFieldLabel('');
    setFieldPlaceholder('');
    setFieldRequired(false);
    setFieldOptions('');
    setEditingFieldIndex(null);
  };

  const handleAddField = () => {
    if (!fieldLabel) {
      alert('Please provide a label for the field.');
      return;
    }

    // Auto-generate ID from label
    const generatedId = toSnakeCase(fieldLabel);

    if (!generatedId) {
      alert('Please provide a valid label that contains letters or numbers.');
      return;
    }

    const newField: FormField = {
      id: generatedId,
      type: fieldType,
      label: fieldLabel,
      placeholder: fieldPlaceholder || undefined,
      required: fieldRequired,
      options: fieldType === 'select' ? fieldOptions.split(',').map(opt => opt.trim()).filter(opt => opt) : undefined,
    };

    if (editingFieldIndex !== null) {
      // Update existing field
      const updatedFields = [...fields];
      updatedFields[editingFieldIndex] = newField;
      setFields(updatedFields);
    } else {
      // Add new field
      setFields([...fields, newField]);
    }

    resetFieldEditor();
  };

  const handleEditField = (index: number) => {
    const field = fields[index];
    setFieldId(field.id);
    setFieldType(field.type);
    setFieldLabel(field.label);
    setFieldPlaceholder(field.placeholder || '');
    setFieldRequired(field.required || false);
    setFieldOptions(field.options?.join(', ') || '');
    setEditingFieldIndex(index);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const handleDuplicateField = (index: number) => {
    const field = fields[index];
    const newLabel = `${field.label} (Copy)`;
    const duplicatedField: FormField = {
      ...field,
      id: toSnakeCase(newLabel),
      label: newLabel,
    };
    setFields([...fields, duplicatedField]);
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const newFields = [...fields];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= fields.length) return;
    
    [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
    setFields(newFields);
  };

  const handleSaveForm = async () => {
    if (!formType.trim()) {
      alert('Please provide a form type.');
      return;
    }

    if (fields.length === 0) {
      alert('Please add at least one field to the form.');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const payload = {
        type: formType,
        variables: {
          fields: fields,
        },
      };

      await api.post('/machine_variables', payload);
      
      setSaveStatus({
        type: 'success',
        message: 'Form saved successfully!',
      });

      // Reset after 2 seconds
      setTimeout(() => {
        setFormType('');
        setFields([]);
        setPreviewValues({});
        setSaveStatus(null);
        onClose();
      }, 2000);
    } catch (error: unknown) {
      setSaveStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save form. Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreviewInputChange = (fieldId: string, value: string) => {
    setPreviewValues({
      ...previewValues,
      [fieldId]: value,
    });
  };

  const handleClose = () => {
    if (fields.length > 0 && !confirm('Are you sure you want to close? All unsaved changes will be lost.')) {
      return;
    }
    setFormType('');
    setFields([]);
    setPreviewValues({});
    setSaveStatus(null);
    resetFieldEditor();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Dynamic Form Builder</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* Left Side - Form Builder */}
          <div className="flex-1 overflow-y-auto p-6 border-r border-gray-200">
            <div className="space-y-6">
              {/* Form Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Form Type / Category *
                </label>
                <input
                  type="text"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                  placeholder="e.g., Machine Variables, Job Requirements"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Field Editor */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-4">
                  {editingFieldIndex !== null ? 'Edit Field' : 'Add New Field'}
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
                    <p className="mt-1 text-xs text-gray-500">
                      ID will be auto-generated: {fieldLabel ? toSnakeCase(fieldLabel) : 'e.g., maximum_speed'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Field Type *
                    </label>
                    <select
                      value={fieldType}
                      onChange={(e) => setFieldType(e.target.value as 'text' | 'number' | 'select')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="select">Select</option>
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

                  {fieldType === 'select' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Options (comma-separated) *
                      </label>
                      <input
                        type="text"
                        value={fieldOptions}
                        onChange={(e) => setFieldOptions(e.target.value)}
                        placeholder="e.g., Option 1, Option 2, Option 3"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="fieldRequired"
                      checked={fieldRequired}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="fieldRequired" className="ml-2 text-sm text-gray-700">
                      Required field
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleAddField}
                      className="flex-1 px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                    >
                      {editingFieldIndex !== null ? 'Update Field' : 'Add Field'}
                    </button>
                    {editingFieldIndex !== null && (
                      <button
                        onClick={resetFieldEditor}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Field List */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Form Fields ({fields.length})</h3>
                {fields.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No fields added yet. Add your first field above.</p>
                ) : (
                  <div className="space-y-2">
                    {fields.map((field, index) => (
                      <div
                        key={index}
                        className="bg-white border border-gray-300 rounded-lg p-3 flex items-center justify-between hover:border-blue-400 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {field.id} | Type: {field.type}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Move Up */}
                          <button
                            onClick={() => handleMoveField(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move up"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          {/* Move Down */}
                          <button
                            onClick={() => handleMoveField(index, 'down')}
                            disabled={index === fields.length - 1}
                            className="p-1.5 text-gray-500 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Move down"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {/* Duplicate */}
                          <button
                            onClick={() => handleDuplicateField(index)}
                            className="p-1.5 text-gray-500 hover:text-green-600 transition-colors"
                            title="Duplicate"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                          {/* Edit */}
                          <button
                            onClick={() => handleEditField(index)}
                            className="p-1.5 text-gray-500 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          {/* Remove */}
                          <button
                            onClick={() => handleRemoveField(index)}
                            className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Side - Live Preview */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
            <div className="sticky top-0 bg-gray-50 pb-4 mb-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900 text-lg">Live Preview</h3>
              <p className="text-sm text-gray-500 mt-1">See how your form will look</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {formType && (
                <div className="mb-6 pb-4 border-b border-gray-200">
                  <h4 className="text-xl font-bold text-[var(--dark-blue)]">{formType}</h4>
                </div>
              )}

              {fields.length === 0 ? (
                <p className="text-gray-400 italic text-center py-8">
                  Add fields to see them previewed here
                </p>
              ) : (
                <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                  {fields.map((field, index) => (
                    <div key={index}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          value={previewValues[field.id] || ''}
                          onChange={(e) => handlePreviewInputChange(field.id, e.target.value)}
                          required={field.required}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select an option...</option>
                          {field.options?.map((option, i) => (
                            <option key={i} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={previewValues[field.id] || ''}
                          onChange={(e) => handlePreviewInputChange(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          required={field.required}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              {saveStatus && (
                <div
                  className={`inline-flex items-center px-4 py-2 rounded-lg ${
                    saveStatus.type === 'success'
                      ? 'bg-green-100 text-green-800 border border-green-200'
                      : 'bg-red-100 text-red-800 border border-red-200'
                  }`}
                >
                  {saveStatus.message}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={isSaving}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveForm}
                disabled={isSaving || !formType || fields.length === 0}
                className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  'Save Form'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

