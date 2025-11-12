'use client';

import { useState, FormEvent, useEffect } from 'react';
import { X, Plus, Trash2, Edit2 } from 'lucide-react';
import type {
  MachineRule,
  RuleCondition,
  RuleOperator,
  LogicOperator,
} from '@/types';
import {
  createMachineRule,
  getMachineRules,
  updateMachineRule,
  deleteMachineRule,
  getMachines,
} from '@/lib/api';
import { PROCESS_TYPE_CONFIGS } from '@/lib/processTypeConfig';
import { formatConditions } from '@/lib/rulesEngine';
import Toast from './Toast';

interface MachineRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface RuleFormData {
  name: string;
  process_type_key: string;
  machine_id: string; // Empty string for "all machines", or specific machine ID
  priority: number;
  conditions: RuleCondition[];
  outputs: {
    speed_modifier: number;
    people_required: number;
    notes: string;
  };
}

const OPERATOR_OPTIONS: { value: RuleOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
  { value: 'less_than_or_equal', label: 'Less Than or Equal' },
  { value: 'between', label: 'Between' },
  { value: 'in', label: 'Is One Of' },
  { value: 'not_in', label: 'Is Not One Of' },
];

const PEOPLE_FRACTION_OPTIONS = [0.25, 0.5, 0.75];

export default function MachineRulesModal({ isOpen, onClose, onSuccess }: MachineRulesModalProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'view'>('create');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [existingRules, setExistingRules] = useState<MachineRule[]>([]);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [machines, setMachines] = useState<any[]>([]);

  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    process_type_key: '',
    machine_id: '', // Empty = all machines
    priority: 1,
    conditions: [],
    outputs: {
      speed_modifier: 100,
      people_required: 1,
      notes: '',
    },
  });

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      loadExistingRules();
      loadMachines();
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const loadMachines = async () => {
    try {
      const allMachines = await getMachines();
      setMachines(allMachines);
    } catch (error) {
      console.error('[MachineRulesModal] Error loading machines:', error);
    }
  };

  const loadExistingRules = async () => {
    setLoading(true);
    try {
      const rules = await getMachineRules();
      setExistingRules(rules);
    } catch (error) {
      console.error('[MachineRulesModal] Error loading rules:', error);
      // Set empty array if endpoint is not available yet
      setExistingRules([]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const handleClose = () => {
    // Reset form
    setFormData({
      name: '',
      process_type_key: '',
      machine_id: '',
      priority: 1,
      conditions: [],
      outputs: {
        speed_modifier: 100,
        people_required: 1,
        notes: '',
      },
    });
    setEditingRuleId(null);
    setErrors({});
    onClose();
  };

  const addCondition = () => {
    setFormData((prev) => ({
      ...prev,
      conditions: [
        ...prev.conditions,
        {
          parameter: '',
          operator: 'equals',
          value: '',
          logic: 'AND',
        },
      ],
    }));
  };

  const removeCondition = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index),
    }));
  };

  const updateCondition = (index: number, field: keyof RuleCondition, value: any) => {
    setFormData((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? { ...cond, [field]: value } : cond
      ),
    }));
  };

  const getAvailableParameters = () => {
    if (!formData.process_type_key) return [];

    const processConfig = PROCESS_TYPE_CONFIGS.find(
      (config) => config.key === formData.process_type_key
    );

    return processConfig?.fields.map((field) => ({
      value: field.name,
      label: field.label,
      type: field.type,
      options: field.options,
    })) || [];
  };

  const getFilteredMachines = () => {
    if (!formData.process_type_key) return [];
    return machines.filter((m) => m.process_type_key === formData.process_type_key);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Rule name is required';
    }
    if (!formData.process_type_key) {
      newErrors.process_type_key = 'Process type is required';
    }
    if (formData.conditions.length === 0) {
      newErrors.conditions = 'At least one condition is required';
    }
    if (formData.outputs.speed_modifier <= 0 || formData.outputs.speed_modifier > 200) {
      newErrors.speed_modifier = 'Speed modifier must be between 1 and 200';
    }
    if (formData.outputs.people_required <= 0) {
      newErrors.people_required = 'People required must be greater than 0';
    }

    // Validate each condition
    formData.conditions.forEach((cond, index) => {
      if (!cond.parameter) {
        newErrors[`condition_${index}_parameter`] = 'Parameter is required';
      }
      if (!cond.value && cond.value !== 0) {
        newErrors[`condition_${index}_value`] = 'Value is required';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const ruleData: Omit<MachineRule, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        process_type_key: formData.process_type_key,
        machine_id: formData.machine_id ? parseInt(formData.machine_id) : undefined,
        priority: formData.priority,
        conditions: formData.conditions,
        outputs: formData.outputs,
        active: true,
      };

      if (editingRuleId) {
        await updateMachineRule(editingRuleId, ruleData);
        setToastMessage('Rule updated successfully!');
      } else {
        await createMachineRule(ruleData);
        setToastMessage('Rule created successfully!');
      }

      setShowSuccessToast(true);

      // Reset form
      setFormData({
        name: '',
        process_type_key: '',
        machine_id: '',
        priority: 1,
        conditions: [],
        outputs: {
          speed_modifier: 100,
          people_required: 1,
          notes: '',
        },
      });
      setEditingRuleId(null);

      // Reload rules
      await loadExistingRules();

      // Switch to view tab
      setActiveTab('view');

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('[MachineRulesModal] Error saving rule:', error);
      alert('Failed to save rule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditRule = (rule: MachineRule) => {
    setFormData({
      name: rule.name,
      process_type_key: rule.process_type_key,
      machine_id: rule.machine_id?.toString() || '',
      priority: rule.priority,
      conditions: rule.conditions,
      outputs: {
        speed_modifier: rule.outputs.speed_modifier,
        people_required: rule.outputs.people_required,
        notes: rule.outputs.notes || '',
      },
    });
    setEditingRuleId(rule.id);
    setActiveTab('create');
  };

  const handleDeleteRule = async (ruleId: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      await deleteMachineRule(ruleId);
      setToastMessage('Rule deleted successfully!');
      setShowSuccessToast(true);
      await loadExistingRules();
    } catch (error) {
      console.error('[MachineRulesModal] Error deleting rule:', error);
      alert('Failed to delete rule. Please try again.');
    }
  };

  const renderConditionValue = (condition: RuleCondition, index: number) => {
    const parameter = getAvailableParameters().find((p) => p.value === condition.parameter);

    // If parameter has options and operator is 'in' or 'not_in', show multi-select
    if (parameter?.options && (condition.operator === 'in' || condition.operator === 'not_in')) {
      const selectedValues: (string | number)[] = Array.isArray(condition.value) ? condition.value : [];
      return (
        <div className="space-y-2">
          <label className="block text-sm text-gray-600">Select values:</label>
          <div className="flex flex-wrap gap-2">
            {parameter.options.map((option) => {
              const isSelected = selectedValues.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    const newValues = isSelected
                      ? selectedValues.filter((v) => v !== option)
                      : [...selectedValues, option];
                    updateCondition(index, 'value', newValues);
                  }}
                  className={`px-3 py-1 rounded-md text-sm ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // If parameter has options and operator is 'equals' or 'not_equals', show dropdown
    if (parameter?.options && ['equals', 'not_equals'].includes(condition.operator)) {
      return (
        <select
          value={condition.value as string}
          onChange={(e) => updateCondition(index, 'value', e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Select value...</option>
          {parameter.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    // For 'between' operator, show two inputs
    if (condition.operator === 'between') {
      const values = Array.isArray(condition.value) ? condition.value : ['', ''];
      return (
        <div className="flex gap-2 flex-1">
          <input
            type={parameter?.type === 'number' ? 'number' : 'text'}
            value={values[0] || ''}
            onChange={(e) => {
              const newValues = [e.target.value, values[1] || ''];
              updateCondition(index, 'value', newValues);
            }}
            placeholder="Min"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
          <span className="py-2">and</span>
          <input
            type={parameter?.type === 'number' ? 'number' : 'text'}
            value={values[1] || ''}
            onChange={(e) => {
              const newValues = [values[0] || '', e.target.value];
              updateCondition(index, 'value', newValues);
            }}
            placeholder="Max"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
          />
        </div>
      );
    }

    // Default: single text/number input
    return (
      <input
        type={parameter?.type === 'number' ? 'number' : 'text'}
        value={condition.value as string | number}
        onChange={(e) => {
          const value =
            parameter?.type === 'number' ? parseFloat(e.target.value) : e.target.value;
          updateCondition(index, 'value', value);
        }}
        placeholder="Enter value..."
        className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
      />
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
            <h2 className="text-2xl font-semibold text-gray-900">Machine Rules</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('create')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'create'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {editingRuleId ? 'Edit Rule' : 'Create Rule'}
            </button>
            <button
              onClick={() => setActiveTab('view')}
              className={`px-6 py-3 font-medium ${
                activeTab === 'view'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              View Rules ({existingRules.length})
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(90vh - 140px)' }}>
            {activeTab === 'create' ? (
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Rule Identity */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Rule Identity</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rule Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Large Envelope Speed Reduction"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Process Type *
                      </label>
                      <select
                        value={formData.process_type_key}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            process_type_key: e.target.value,
                            machine_id: '', // Reset machine when process type changes
                            conditions: [], // Reset conditions
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">Select process type...</option>
                        {PROCESS_TYPE_CONFIGS.map((config) => (
                          <option key={config.key} value={config.key}>
                            {config.label}
                          </option>
                        ))}
                      </select>
                      {errors.process_type_key && (
                        <p className="text-red-500 text-sm mt-1">{errors.process_type_key}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apply To
                      </label>
                      <select
                        value={formData.machine_id}
                        onChange={(e) =>
                          setFormData({ ...formData, machine_id: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        disabled={!formData.process_type_key}
                      >
                        <option value="">All machines of this type</option>
                        {getFilteredMachines().map((machine) => (
                          <option key={machine.id} value={machine.id}>
                            {machine.type} - Line {machine.line}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <input
                      type="number"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({ ...formData, priority: parseInt(e.target.value) || 1 })
                      }
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Higher priority rules are used for tie-breaking
                    </p>
                  </div>
                </div>

                {/* Conditions */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium text-gray-900">Conditions</h3>
                    <button
                      type="button"
                      onClick={addCondition}
                      disabled={!formData.process_type_key}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4" />
                      Add Condition
                    </button>
                  </div>

                  {errors.conditions && (
                    <p className="text-red-500 text-sm">{errors.conditions}</p>
                  )}

                  {!formData.process_type_key && (
                    <p className="text-gray-500 text-sm">
                      Select a process type first to add conditions
                    </p>
                  )}

                  {formData.conditions.map((condition, index) => (
                    <div key={index} className="bg-white p-4 rounded-md space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-medium text-gray-700">
                          Condition {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeCondition(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Parameter</label>
                          <select
                            value={condition.parameter}
                            onChange={(e) => updateCondition(index, 'parameter', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            <option value="">Select...</option>
                            {getAvailableParameters().map((param) => (
                              <option key={param.value} value={param.value}>
                                {param.label}
                              </option>
                            ))}
                          </select>
                          {errors[`condition_${index}_parameter`] && (
                            <p className="text-red-500 text-xs mt-1">
                              {errors[`condition_${index}_parameter`]}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Operator</label>
                          <select
                            value={condition.operator}
                            onChange={(e) =>
                              updateCondition(index, 'operator', e.target.value as RuleOperator)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                          >
                            {OPERATOR_OPTIONS.map((op) => (
                              <option key={op.value} value={op.value}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Logic</label>
                          <select
                            value={condition.logic || 'AND'}
                            onChange={(e) =>
                              updateCondition(index, 'logic', e.target.value as LogicOperator)
                            }
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                            disabled={index === formData.conditions.length - 1}
                          >
                            <option value="AND">AND</option>
                            <option value="OR">OR</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Value</label>
                        {renderConditionValue(condition, index)}
                        {errors[`condition_${index}_value`] && (
                          <p className="text-red-500 text-xs mt-1">
                            {errors[`condition_${index}_value`]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Outputs */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Outputs</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Speed Modifier (% of base speed) *
                    </label>
                    <input
                      type="number"
                      value={formData.outputs.speed_modifier}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          outputs: {
                            ...formData.outputs,
                            speed_modifier: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      min="1"
                      max="200"
                      step="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      100 = base speed, 80 = 80% of base speed, 120 = 120% of base speed
                    </p>
                    {errors.speed_modifier && (
                      <p className="text-red-500 text-sm mt-1">{errors.speed_modifier}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      People Required *
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="number"
                        value={Math.floor(formData.outputs.people_required)}
                        onChange={(e) => {
                          const whole = parseInt(e.target.value) || 0;
                          const fraction = formData.outputs.people_required % 1;
                          setFormData({
                            ...formData,
                            outputs: {
                              ...formData.outputs,
                              people_required: whole + fraction,
                            },
                          });
                        }}
                        min="0"
                        step="1"
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <span className="text-gray-600">+</span>
                      <div className="flex gap-2">
                        {PEOPLE_FRACTION_OPTIONS.map((fraction) => {
                          const whole = Math.floor(formData.outputs.people_required);
                          const currentFraction = formData.outputs.people_required % 1;
                          const isSelected = Math.abs(currentFraction - fraction) < 0.01;

                          return (
                            <button
                              key={fraction}
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  outputs: {
                                    ...formData.outputs,
                                    people_required: whole + (isSelected ? 0 : fraction),
                                  },
                                })
                              }
                              className={`px-3 py-2 rounded-md text-sm font-medium ${
                                isSelected
                                  ? 'bg-blue-500 text-white'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              {fraction}
                            </button>
                          );
                        })}
                      </div>
                      <span className="text-gray-600">people</span>
                    </div>
                    {errors.people_required && (
                      <p className="text-red-500 text-sm mt-1">{errors.people_required}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
                    </label>
                    <textarea
                      value={formData.outputs.notes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          outputs: {
                            ...formData.outputs,
                            notes: e.target.value,
                          },
                        })
                      }
                      placeholder="Explain why this rule affects performance..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Saving...' : editingRuleId ? 'Update Rule' : 'Create Rule'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6">
                {loading ? (
                  <p className="text-center text-gray-500">Loading rules...</p>
                ) : existingRules.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">No rules created yet</p>
                    <button
                      onClick={() => setActiveTab('create')}
                      className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      Create Your First Rule
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {existingRules.map((rule) => {
                      const processConfig = PROCESS_TYPE_CONFIGS.find(
                        (c) => c.key === rule.process_type_key
                      );
                      const machine = rule.machine_id
                        ? machines.find((m) => m.id === rule.machine_id)
                        : null;

                      return (
                        <div
                          key={rule.id}
                          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <h4 className="text-lg font-medium text-gray-900">{rule.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className="inline-block px-2 py-1 rounded text-xs font-medium text-white"
                                  style={{ backgroundColor: processConfig?.color || '#gray' }}
                                >
                                  {processConfig?.label || rule.process_type_key}
                                </span>
                                {machine && (
                                  <span className="text-sm text-gray-600">
                                    • {machine.type} (Line {machine.line})
                                  </span>
                                )}
                                {!machine && (
                                  <span className="text-sm text-gray-600">
                                    • All machines
                                  </span>
                                )}
                                <span className="text-sm text-gray-400">
                                  • Priority: {rule.priority}
                                </span>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditRule(rule)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium text-gray-700">Conditions: </span>
                              <span className="text-gray-600">{formatConditions(rule.conditions)}</span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">Speed: </span>
                              <span className="text-gray-600">
                                {rule.outputs.speed_modifier}% of base speed
                              </span>
                            </div>
                            <div>
                              <span className="font-medium text-gray-700">People: </span>
                              <span className="text-gray-600">
                                {rule.outputs.people_required}
                              </span>
                            </div>
                            {rule.outputs.notes && (
                              <div>
                                <span className="font-medium text-gray-700">Notes: </span>
                                <span className="text-gray-600">{rule.outputs.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSuccessToast && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </>
  );
}
