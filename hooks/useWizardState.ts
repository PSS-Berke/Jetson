/**
 * Wizard state management hook
 * Handles state, validation, and persistence for the machine creation wizard
 */

import { useReducer, useEffect, useCallback } from 'react';
import type { MachineCategory, MachineCapabilityValue, MachineStatus } from '@/types';
import type { RuleCondition, RuleOutputs } from '@/types';

export interface CustomFormField {
  id: string;
  type: 'text' | 'number' | 'select';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface RuleFormData {
  name: string;
  conditions: RuleCondition[];
  outputs: RuleOutputs;
  priority: number;
}

export interface MachineVariable {
  id: string; // Use string ID for client-side generated items
  key: string;
  value: string;
  // Additional fields from API
  label?: string;
  type?: string;
  options?: string[];
  required?: boolean;
  [key: string]: any; // Allow any other fields from API
}

export interface MachineVariableFromAPI {
  id?: number;
  type: string;
  variables: Array<{
    variable_name: string;
    variable_label?: string;
    variable_type?: string;
    variable_value?: string;
    options?: string[];
    required?: boolean;
    [key: string]: any; // Allow any other fields from API
  }> | Record<string, any>;
}

export interface FormBuilderField {
  id: string;
  fieldName: string;
  fieldLabel: string;
  fieldType: 'text' | 'number' | 'select' | 'boolean';
  fieldValue: string | number | boolean;
  options?: string[];
  required?: boolean;
}

export interface WizardState {
  currentStep: 1 | 2 | 3 | 4 | 5;

  // Step 1: Category Selection
  machineCategory: MachineCategory | null;

  // Step 2: Basic Information
  quantity: number;
  line: string;
  lineStart: string;
  lineEnd: string;
  machineName: string;
  machineDesignation: string;
  facilities_id: number | null;

  // Step 3: Process Type & Capabilities
  process_type_key: string;
  isCustomProcessType: boolean;
  customProcessTypeName: string;
  customProcessTypeFields: CustomFormField[];
  capabilities: Record<string, MachineCapabilityValue>;
  machineVariables: MachineVariable[];
  machineVariablesId: number | null;
  formBuilderFields: FormBuilderField[];

  // Step 4: Machine Groups & Rules
  machineGroupOption: 'none' | 'existing' | 'new';
  existingGroupId: number | null;
  newGroupName: string;
  newGroupDescription: string;
  rules: RuleFormData[];

  // Validation state
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

type WizardAction =
  | { type: 'SET_STEP'; payload: number }
  | { type: 'SET_CATEGORY'; payload: MachineCategory }
  | { type: 'SET_BASIC_INFO'; payload: { quantity?: number; line?: string; lineStart?: string; lineEnd?: string; machineName?: string; machineDesignation?: string; facilities_id?: number | null } }
  | { type: 'SET_PROCESS_TYPE'; payload: string }
  | { type: 'SET_CUSTOM_PROCESS_TYPE'; payload: { name: string; isCustom: boolean } }
  | { type: 'SET_CUSTOM_PROCESS_TYPE_FIELDS'; payload: CustomFormField[] }
  | { type: 'SET_CAPABILITIES'; payload: Record<string, MachineCapabilityValue> }
  | { type: 'SET_CAPABILITY'; payload: { field: string; value: MachineCapabilityValue } }
  | { type: 'SET_MACHINE_VARIABLES'; payload: MachineVariable[] }
  | { type: 'SET_MACHINE_VARIABLES_ID'; payload: number | null }
  | { type: 'ADD_MACHINE_VARIABLE'; payload: MachineVariable }
  | { type: 'UPDATE_MACHINE_VARIABLE'; payload: { id: string; key?: string; value?: string } }
  | { type: 'REMOVE_MACHINE_VARIABLE'; payload: string }
  | { type: 'SET_FORM_BUILDER_FIELDS'; payload: FormBuilderField[] }
  | { type: 'ADD_FORM_BUILDER_FIELD'; payload: FormBuilderField }
  | { type: 'UPDATE_FORM_BUILDER_FIELD'; payload: { id: string; field?: Partial<FormBuilderField> } }
  | { type: 'REMOVE_FORM_BUILDER_FIELD'; payload: string }
  | { type: 'SET_GROUP_OPTION'; payload: 'none' | 'existing' | 'new' }
  | { type: 'SET_EXISTING_GROUP'; payload: number }
  | { type: 'SET_NEW_GROUP'; payload: { name?: string; description?: string } }
  | { type: 'ADD_RULE'; payload: RuleFormData }
  | { type: 'UPDATE_RULE'; payload: { index: number; rule: RuleFormData } }
  | { type: 'REMOVE_RULE'; payload: number }
  | { type: 'SET_ERROR'; payload: { field: string; error: string } }
  | { type: 'CLEAR_ERRORS' }
  | { type: 'SET_TOUCHED'; payload: string }
  | { type: 'RESET' }
  | { type: 'LOAD_FROM_STORAGE'; payload: Partial<WizardState> };

const initialState: WizardState = {
  currentStep: 1,
  machineCategory: null,
  quantity: 1,
  line: '',
  lineStart: '',
  lineEnd: '',
  machineName: '',
  machineDesignation: '',
  facilities_id: null,
  process_type_key: '',
  isCustomProcessType: false,
  customProcessTypeName: '',
  customProcessTypeFields: [],
  capabilities: {},
  machineVariables: [],
  machineVariablesId: null,
  formBuilderFields: [],
  machineGroupOption: 'none',
  existingGroupId: null,
  newGroupName: '',
  newGroupDescription: '',
  rules: [],
  errors: {},
  touched: {},
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload as WizardState['currentStep'] };

    case 'SET_CATEGORY':
      return { ...state, machineCategory: action.payload };

    case 'SET_BASIC_INFO':
      return {
        ...state,
        ...action.payload,
      };

    case 'SET_PROCESS_TYPE':
      return {
        ...state,
        process_type_key: action.payload,
        isCustomProcessType: false,
        capabilities: {}, // Reset capabilities when process type changes
      };

    case 'SET_CUSTOM_PROCESS_TYPE':
      return {
        ...state,
        customProcessTypeName: action.payload.name,
        isCustomProcessType: action.payload.isCustom,
        process_type_key: action.payload.isCustom ? '' : state.process_type_key,
      };

    case 'SET_CUSTOM_PROCESS_TYPE_FIELDS':
      return { ...state, customProcessTypeFields: action.payload };

    case 'SET_CAPABILITIES':
      return { ...state, capabilities: action.payload };

    case 'SET_CAPABILITY':
      return {
        ...state,
        capabilities: {
          ...state.capabilities,
          [action.payload.field]: action.payload.value,
        },
      };

    case 'SET_MACHINE_VARIABLES':
      return { ...state, machineVariables: action.payload };

    case 'SET_MACHINE_VARIABLES_ID':
      return { ...state, machineVariablesId: action.payload };

    case 'ADD_MACHINE_VARIABLE':
      return { ...state, machineVariables: [...state.machineVariables, action.payload] };

    case 'UPDATE_MACHINE_VARIABLE':
      return {
        ...state,
        machineVariables: state.machineVariables.map(variable =>
          variable.id === action.payload.id
            ? { 
                ...variable, 
                key: action.payload.key !== undefined ? action.payload.key : variable.key,
                value: action.payload.value !== undefined ? action.payload.value : variable.value,
                // Preserve all other fields
              }
            : variable
        ),
      };

    case 'REMOVE_MACHINE_VARIABLE':
      return {
        ...state,
        machineVariables: state.machineVariables.filter(variable => variable.id !== action.payload),
      };

    case 'SET_FORM_BUILDER_FIELDS':
      return { ...state, formBuilderFields: action.payload };

    case 'ADD_FORM_BUILDER_FIELD':
      return { ...state, formBuilderFields: [...state.formBuilderFields, action.payload] };

    case 'UPDATE_FORM_BUILDER_FIELD':
      return {
        ...state,
        formBuilderFields: state.formBuilderFields.map(field =>
          field.id === action.payload.id
            ? { ...field, ...action.payload.field }
            : field
        ),
      };

    case 'REMOVE_FORM_BUILDER_FIELD':
      return {
        ...state,
        formBuilderFields: state.formBuilderFields.filter(field => field.id !== action.payload),
      };

    case 'SET_GROUP_OPTION':
      return { ...state, machineGroupOption: action.payload };

    case 'SET_EXISTING_GROUP':
      return { ...state, existingGroupId: action.payload };

    case 'SET_NEW_GROUP':
      return {
        ...state,
        newGroupName: action.payload.name !== undefined ? action.payload.name : state.newGroupName,
        newGroupDescription: action.payload.description !== undefined ? action.payload.description : state.newGroupDescription,
      };

    case 'ADD_RULE':
      return { ...state, rules: [...state.rules, action.payload] };

    case 'UPDATE_RULE':
      return {
        ...state,
        rules: state.rules.map((rule, index) =>
          index === action.payload.index ? action.payload.rule : rule
        ),
      };

    case 'REMOVE_RULE':
      return {
        ...state,
        rules: state.rules.filter((_, index) => index !== action.payload),
      };

    case 'SET_ERROR':
      return {
        ...state,
        errors: { ...state.errors, [action.payload.field]: action.payload.error },
      };

    case 'CLEAR_ERRORS':
      return { ...state, errors: {} };

    case 'SET_TOUCHED':
      return {
        ...state,
        touched: { ...state.touched, [action.payload]: true },
      };

    case 'RESET':
      return initialState;

    case 'LOAD_FROM_STORAGE':
      return { ...state, ...action.payload };

    default:
      return state;
  }
}

const STORAGE_KEY = 'machine_wizard_draft';

export function useWizardState() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        dispatch({ type: 'LOAD_FROM_STORAGE', payload: parsed });
      }
    } catch (error) {
      console.error('[useWizardState] Error loading from storage:', error);
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[useWizardState] Error saving to storage:', error);
    }
  }, [state]);

  // Clear localStorage
  const clearStorage = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[useWizardState] Error clearing storage:', error);
    }
  }, []);

  // Validation functions
  const validateStep1 = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!state.machineCategory) {
      errors.machineCategory = 'Please select a machine category';
    }

    Object.entries(errors).forEach(([field, error]) => {
      dispatch({ type: 'SET_ERROR', payload: { field, error } });
    });

    return Object.keys(errors).length === 0;
  }, [state.machineCategory]);

  const validateStep2 = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (state.quantity < 1) {
      errors.quantity = 'Quantity must be at least 1';
    } else if (state.quantity > 100) {
      errors.quantity = 'Quantity cannot exceed 100';
    }

    if (state.quantity === 1) {
      if (!state.line.trim()) {
        errors.line = 'Line number is required';
      } else if (!/^\d+$/.test(state.line.trim())) {
        errors.line = 'Line number must be numeric';
      }
    } else {
      // Multiple machines - validate line range
      if (!state.lineStart.trim()) {
        errors.lineStart = 'Starting line number is required';
      } else if (!/^\d+$/.test(state.lineStart.trim())) {
        errors.lineStart = 'Starting line number must be numeric';
      }

      if (!state.lineEnd.trim()) {
        errors.lineEnd = 'Ending line number is required';
      } else if (!/^\d+$/.test(state.lineEnd.trim())) {
        errors.lineEnd = 'Ending line number must be numeric';
      }

      if (state.lineStart.trim() && state.lineEnd.trim() && 
          parseInt(state.lineStart) >= parseInt(state.lineEnd)) {
        errors.lineEnd = 'Ending line must be greater than starting line';
      }

      const lineRange = state.lineEnd.trim() && state.lineStart.trim() 
        ? parseInt(state.lineEnd) - parseInt(state.lineStart) + 1 
        : 0;
      if (lineRange !== state.quantity) {
        errors.lineEnd = `Line range must match quantity (${state.quantity} machines)`;
      }
    }

    if (!state.machineName.trim()) {
      errors.machineName = 'Machine name is required';
    }

    if (!state.machineDesignation.trim()) {
      errors.machineDesignation = 'Machine designation is required';
    } else if (!/^[a-zA-Z0-9]+$/.test(state.machineDesignation)) {
      errors.machineDesignation = 'Machine designation must be alphanumeric';
    }

    if (!state.facilities_id) {
      errors.facilities_id = 'Facility is required';
    }

    Object.entries(errors).forEach(([field, error]) => {
      dispatch({ type: 'SET_ERROR', payload: { field, error } });
    });

    return Object.keys(errors).length === 0;
  }, [state.quantity, state.line, state.lineStart, state.lineEnd, state.machineName, state.machineDesignation, state.facilities_id]);

  const validateStep3 = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!state.process_type_key && !state.isCustomProcessType) {
      errors.process_type_key = 'Please select or create a process type';
    }

    if (state.isCustomProcessType && !state.customProcessTypeName.trim()) {
      errors.customProcessTypeName = 'Custom process type name is required';
    }

    if (state.isCustomProcessType && state.customProcessTypeFields.length === 0) {
      errors.customProcessTypeFields = 'Please add at least one field to your custom process type';
    }

    // Validate custom field values if any custom fields exist
    if (state.customProcessTypeFields.length > 0) {
      const requiredFields = state.customProcessTypeFields.filter(f => f.required);
      const missingFields = requiredFields.filter(field => !state.capabilities[field.id]);
      
      if (missingFields.length > 0) {
        errors.capabilities = `Please fill in all required custom fields: ${missingFields.map(f => f.label).join(', ')}`;
      }
    }

    // Validate required machine variables from API
    if (state.machineVariables && state.machineVariables.length > 0) {
      const requiredVariables = state.machineVariables.filter(v => v.required);
      const missingVariables = requiredVariables.filter(v => !v.value || v.value === '');
      
      if (missingVariables.length > 0) {
        errors.machineVariables = `Please fill in all required machine variables: ${missingVariables.map(v => v.label || v.key).join(', ')}`;
      }
    }

    Object.entries(errors).forEach(([field, error]) => {
      dispatch({ type: 'SET_ERROR', payload: { field, error } });
    });

    return Object.keys(errors).length === 0;
  }, [state.process_type_key, state.isCustomProcessType, state.customProcessTypeName, state.customProcessTypeFields, state.capabilities]);

  const validateStep4 = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (state.machineGroupOption === 'existing' && !state.existingGroupId) {
      errors.existingGroupId = 'Please select a machine group';
    }

    if (state.machineGroupOption === 'new' && !state.newGroupName.trim()) {
      errors.newGroupName = 'Group name is required';
    }

    // Rules are optional, but if provided, validate them
    state.rules.forEach((rule, index) => {
      if (!rule.name.trim()) {
        errors[`rule_${index}_name`] = 'Rule name is required';
      }
      if (rule.conditions.length === 0) {
        errors[`rule_${index}_conditions`] = 'At least one condition is required';
      }
      if (rule.outputs.speed_modifier <= 0 || rule.outputs.speed_modifier > 200) {
        errors[`rule_${index}_speed`] = 'Speed modifier must be between 1 and 200';
      }
      if (rule.outputs.people_required <= 0) {
        errors[`rule_${index}_people`] = 'People required must be greater than 0';
      }
    });

    Object.entries(errors).forEach(([field, error]) => {
      dispatch({ type: 'SET_ERROR', payload: { field, error } });
    });

    return Object.keys(errors).length === 0;
  }, [state.machineGroupOption, state.existingGroupId, state.newGroupName, state.rules]);

  // Check if can proceed without side effects (for rendering)
  const checkCanProceed = useCallback((step: number): boolean => {
    switch (step) {
      case 1:
        return !!state.machineCategory;
      case 2:
        if (state.quantity < 1 || state.quantity > 100) return false;
        if (!state.machineName.trim() || !state.machineDesignation.trim() || !state.facilities_id) return false;
        if (!/^[a-zA-Z0-9]+$/.test(state.machineDesignation)) return false;
        
        if (state.quantity === 1) {
          return !!(state.line.trim() && /^\d+$/.test(state.line.trim()));
        } else {
          if (!state.lineStart.trim() || !state.lineEnd.trim()) return false;
          if (!/^\d+$/.test(state.lineStart.trim()) || !/^\d+$/.test(state.lineEnd.trim())) return false;
          const lineRange = parseInt(state.lineEnd) - parseInt(state.lineStart) + 1;
          return lineRange === state.quantity && parseInt(state.lineStart) < parseInt(state.lineEnd);
        }
        return true;
      case 3:
        if (!state.process_type_key && !state.isCustomProcessType) return false;
        
        if (state.isCustomProcessType) {
          // Custom process type validation
          if (!state.customProcessTypeName.trim() || state.customProcessTypeFields.length === 0) return false;
          
          // Check if all required custom fields have values
          const requiredFields = state.customProcessTypeFields.filter(f => f.required);
          const allRequiredFilled = requiredFields.every(field => state.capabilities[field.id]);
          return allRequiredFilled;
        } else {
          // Standard process type validation
          // If there are custom fields added, check those are filled
          if (state.customProcessTypeFields.length > 0) {
            const requiredFields = state.customProcessTypeFields.filter(f => f.required);
            const allRequiredFilled = requiredFields.every(field => state.capabilities[field.id]);
            return allRequiredFilled;
          } else {
            // Check if all required machine variables are filled
            if (state.machineVariables && state.machineVariables.length > 0) {
              const requiredVariables = state.machineVariables.filter(v => v.required);
              return requiredVariables.every(v => v.value && v.value !== '');
            }
            // No validation required if no machine variables
            return true;
          }
        }
      case 4:
        if (state.machineGroupOption === 'existing' && !state.existingGroupId) return false;
        if (state.machineGroupOption === 'new' && !state.newGroupName.trim()) return false;
        return true;
      case 5:
        return true; // Review step has no validation
      default:
        return false;
    }
  }, [state.machineCategory, state.quantity, state.line, state.lineStart, state.lineEnd, state.machineName, 
      state.machineDesignation, state.facilities_id, state.process_type_key,
      state.isCustomProcessType, state.customProcessTypeName, state.customProcessTypeFields, state.capabilities,
      state.machineGroupOption, state.existingGroupId, state.newGroupName]);

  // Validate and proceed (with side effects - call this on button click)
  const canProceed = useCallback((step: number): boolean => {
    dispatch({ type: 'CLEAR_ERRORS' });

    switch (step) {
      case 1:
        return validateStep1();
      case 2:
        return validateStep2();
      case 3:
        return validateStep3();
      case 4:
        return validateStep4();
      case 5:
        return true; // Review step has no validation
      default:
        return false;
    }
  }, [validateStep1, validateStep2, validateStep3, validateStep4]);

  const nextStep = useCallback(() => {
    if (canProceed(state.currentStep)) {
      const nextStep = Math.min(5, state.currentStep + 1) as WizardState['currentStep'];
      dispatch({ type: 'SET_STEP', payload: nextStep });
    }
  }, [state.currentStep, canProceed]);

  const prevStep = useCallback(() => {
    const prevStep = Math.max(1, state.currentStep - 1) as WizardState['currentStep'];
    dispatch({ type: 'SET_STEP', payload: prevStep });
  }, [state.currentStep]);

  const goToStep = useCallback((step: number) => {
    dispatch({ type: 'SET_STEP', payload: step });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    clearStorage();
  }, [clearStorage]);

  return {
    state,
    dispatch,
    nextStep,
    prevStep,
    goToStep,
    canProceed,
    checkCanProceed,
    reset,
    clearStorage,
  };
}
