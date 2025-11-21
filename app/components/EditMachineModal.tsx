"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Machine, MachineCapabilityValue, MachineStatus, User, isAdmin } from "@/types";
import { updateMachine, deleteMachine, getMachineRules } from "@/lib/api";
import Toast from "./Toast";
import WizardStepIndicator from "./wizard/WizardStepIndicator";
import WizardNavigation from "./wizard/WizardNavigation";
import StepBasicInfo from "./wizard/StepBasicInfo";
import StepCapabilities from "./wizard/StepCapabilities";
import StepGroupsAndRules from "./wizard/StepGroupsAndRules";
import { EditMachineReviewStep } from "./wizard/StepReview";
import type {
  CustomFormField,
  MachineVariable,
  FormBuilderField,
  RuleFormData,
} from "@/hooks/useWizardState";
import { getAllMachineVariables } from "@/lib/api";

interface EditMachineModalProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onSuccess?: () => void;
  user?: User | null;
}

type StepNumber = 1 | 2 | 3 | 4;

const WIZARD_STEPS = [
  { number: 1, label: "Basic Info", shortLabel: "Info" },
  { number: 2, label: "Process & Capabilities", shortLabel: "Config" },
  { number: 3, label: "Groups & Rules", shortLabel: "Rules" },
  { number: 4, label: "Review & Confirm", shortLabel: "Review" },
];

export default function EditMachineModal({
  isOpen,
  machine,
  onClose,
  onSuccess,
  user,
}: EditMachineModalProps) {
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Form state
  const [line, setLine] = useState<string>("");
  const [machineName, setMachineName] = useState<string>("");
  const [machineDesignation, setMachineDesignation] = useState<string>("");
  const [facilities_id, setFacilities_id] = useState<number | null>(null);
  const [process_type_key, setProcess_type_key] = useState<string>("");
  const [isCustomProcessType, setIsCustomProcessType] = useState(false);
  const [customProcessTypeName, setCustomProcessTypeName] = useState("");
  const [customProcessTypeFields, setCustomProcessTypeFields] = useState<CustomFormField[]>([]);
  const [capabilities, setCapabilities] = useState<Record<string, MachineCapabilityValue>>({});
  const [machineVariables, setMachineVariables] = useState<MachineVariable[]>([]);
  const [machineVariablesId, setMachineVariablesId] = useState<number | null>(null);
  const [formBuilderFields, setFormBuilderFields] = useState<FormBuilderField[]>([]);
  const [machineGroupOption, setMachineGroupOption] = useState<"none" | "existing" | "new">("none");
  const [existingGroupId, setExistingGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [newGroupDescription, setNewGroupDescription] = useState<string>("");
  const [rules, setRules] = useState<RuleFormData[]>([]);
  const initializedRef = useRef<number | null>(null);
  const machineIdRef = useRef<number | null>(null);

  // Extract stable machine ID
  const machineId = useMemo(() => machine?.id ?? null, [machine?.id]);
  const processTypeKey = useMemo(() => machine?.process_type_key ?? null, [machine?.process_type_key]);

  // Load machine rules
  const loadMachineRules = useCallback(async (machineId: number, processTypeKey: string) => {
    try {
      const machineRules = await getMachineRules(processTypeKey, machineId, true);
      // Transform rules to RuleFormData format
      const transformedRules: RuleFormData[] = machineRules.map((rule, index) => ({
        name: rule.name,
        conditions: rule.conditions.map((cond, condIndex) => ({
          parameter: cond.parameter,
          operator: cond.operator,
          value: cond.value,
          logic: cond.logic || (condIndex > 0 ? "AND" : undefined),
        })),
        outputs: {
          speed_modifier: rule.outputs.speed_modifier,
          people_required: rule.outputs.people_required,
          fixed_rate: rule.outputs.fixed_rate,
          notes: rule.outputs.notes || "",
        },
        priority: rule.priority || index + 1,
      }));
      setRules(transformedRules);
    } catch (error) {
      console.error("[EditMachineModal] Error loading machine rules:", error);
    }
  }, []);

  // Load machine variables
  const loadMachineVariables = useCallback(async (processKey: string) => {
    try {
      const allVariables = await getAllMachineVariables();
      const processTypeGroup = allVariables.find(
        (group: any) => group.type === processKey,
      );

      if (processTypeGroup && processTypeGroup.id) {
        setMachineVariablesId(processTypeGroup.id);
        
        // Convert to FormBuilderField format
        let fields: FormBuilderField[] = [];
        if (processTypeGroup.variables && Array.isArray(processTypeGroup.variables)) {
          fields = processTypeGroup.variables.map((v: any, index: number) => ({
            id: `field_${index}`,
            fieldName: v.variable_name || "",
            fieldLabel: v.variable_label || v.variable_name || "",
            fieldType: (v.variable_type as "text" | "number" | "select" | "boolean") || "text",
            fieldValue: v.variable_value || "",
            options: v.options,
            required: v.required || false,
            addToJobInput: v.addToJobInput || false,
          }));
        }
        setFormBuilderFields(fields);
      }
    } catch (error) {
      console.error("[EditMachineModal] Error loading machine variables:", error);
    }
  }, []);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = null;
      machineIdRef.current = null;
    }
  }, [isOpen]);

  // Initialize form with machine data when modal opens
  useEffect(() => {
    if (!isOpen || !machine || !machineId) {
      return;
    }

    // Check if we've already initialized for this machine ID
    if (initializedRef.current === machineId) {
      return;
    }

    // Set the ref immediately to prevent re-initialization
    initializedRef.current = machineId;
    machineIdRef.current = machineId;

    console.log("[EditMachineModal] Initializing with machine:", machine);

    // Handle capabilities - ensure it's always an object
    let capabilitiesValue = {};
    if (machine.capabilities) {
      if (typeof machine.capabilities === 'object' && !Array.isArray(machine.capabilities)) {
        capabilitiesValue = machine.capabilities;
      } else if (typeof machine.capabilities === 'string') {
        try {
          capabilitiesValue = JSON.parse(machine.capabilities);
        } catch {
          capabilitiesValue = {};
        }
      }
    }

    // Batch all state updates together
    setLine(machine.line !== undefined && machine.line !== null ? machine.line.toString() : "");
    setMachineName((typeof machine.name === 'string' ? machine.name : '') || "");
    setMachineDesignation((typeof machine.designation === 'string' ? machine.designation : '') || "");
    setFacilities_id(machine.facilities_id !== undefined && machine.facilities_id !== null ? machine.facilities_id : null);
    setProcess_type_key(machine.process_type_key || "");
    setCapabilities(capabilitiesValue);

    // Set machine group
    if (machine.machine_group_id) {
      setMachineGroupOption("existing");
      setExistingGroupId(machine.machine_group_id);
    } else {
      setMachineGroupOption("none");
      setExistingGroupId(null);
    }

    // Reset step to 1
    setCurrentStep(1);
  }, [isOpen, machine, machineId]);

  // Load machine rules and variables when process type is available
  useEffect(() => {
    if (!isOpen || !machineId || !processTypeKey || initializedRef.current !== machineId) {
      return;
    }

    // Load machine rules for this machine
    loadMachineRules(machineId, processTypeKey);
    // Load machine variables if process type is set
    loadMachineVariables(processTypeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, machineId, processTypeKey]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !machine) return null;

  // Check if user is admin
  if (!isAdmin(user)) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">
              Machine Details
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Line Number</p>
                <p className="font-medium text-gray-900">Line {machine.line}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium text-gray-900">{machine.type}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 italic">
                Only administrators can edit machine details.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: string, value: any) => {
    switch (field) {
      case "line":
        setLine(value);
        break;
      case "machineName":
        setMachineName(value);
        break;
      case "machineDesignation":
        setMachineDesignation(value);
        break;
      case "facilities_id":
        setFacilities_id(value);
        break;
      default:
        break;
    }
    setTouched({ ...touched, [field]: true });
    // Clear error for this field
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
  };

  const handleCapabilityChange = (field: string, value: MachineCapabilityValue) => {
    setCapabilities((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProcessTypeChange = (processTypeKey: string) => {
    setProcess_type_key(processTypeKey);
    setCapabilities({});
    setFormBuilderFields([]);
  };

  const getStepErrors = (step: StepNumber): Record<string, string> => {
    const stepErrors: Record<string, string> = {};

    if (step === 1) {
      if (!line) {
        stepErrors.line = "Line number is required";
      }
      if (!machineName) {
        stepErrors.machineName = "Machine name is required";
      }
      if (!machineDesignation) {
        stepErrors.machineDesignation = "Machine designation is required";
      }
      if (!facilities_id) {
        stepErrors.facilities_id = "Facility is required";
      }
    } else if (step === 2) {
      if (!process_type_key) {
        stepErrors.process_type_key = "Process type is required";
      }
    }

    return stepErrors;
  };

  const validateStep = (step: StepNumber): boolean => {
    const newErrors = getStepErrors(step);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const canProceed = (step: StepNumber): boolean => {
    return Object.keys(getStepErrors(step)).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return;
    }

    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as StepNumber);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as StepNumber);
    }
  };

  const handleSubmit = async () => {
    const stepsToValidate: StepNumber[] = [1, 2];
    for (const step of stepsToValidate) {
      if (!validateStep(step)) {
        setCurrentStep(step);
        return;
      }
    }

    setSubmitting(true);

    try {
      // Convert formBuilderFields to capabilities if they exist
      const finalCapabilities = formBuilderFields.length > 0
        ? formBuilderFields.reduce((acc, field) => {
            if (typeof field.fieldValue === 'boolean') {
              acc[field.fieldName] = field.fieldValue ? 'true' : 'false';
            } else {
              acc[field.fieldName] = field.fieldValue as MachineCapabilityValue;
            }
            return acc;
          }, {} as Record<string, MachineCapabilityValue>)
        : capabilities;

      // Prepare the machine data
      const machineData = {
        line: parseInt(line),
        type: machine.type, // Keep original type
        name: machineName || undefined,
        designation: machineDesignation || undefined,
        process_type_key: process_type_key,
        facilities_id: facilities_id ?? undefined,
        status: machine.status, // Keep original status
        capabilities: finalCapabilities,
        machine_group_id: machineGroupOption === "existing" ? (existingGroupId ?? undefined) : undefined,
      };

      console.log("[EditMachineModal] Updating machine:", machine.id, "with data:", machineData);

      await updateMachine(machine.id, machineData);
      console.log("[EditMachineModal] Machine updated successfully");

      setShowSuccessToast(true);

      if (onSuccess) {
        onSuccess();
      }

      setTimeout(() => {
        onClose();
        setShowSuccessToast(false);
        setCurrentStep(1);
      }, 2000);
    } catch (error) {
      console.error("[EditMachineModal] Error updating machine:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to update machine. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!machine) return;

    setDeleting(true);

    try {
      console.log("[EditMachineModal] Deleting machine:", machine.id);
      await deleteMachine(machine.id);
      console.log("[EditMachineModal] Machine deleted successfully");

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (error) {
      console.error("[EditMachineModal] Error deleting machine:", error);
      alert(
        error instanceof Error
          ? error.message
          : "Failed to delete machine. Please try again.",
      );
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setErrors({});
    setTouched({});
    setShowDeleteConfirm(false);
    onClose();
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Modal Container */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-[var(--text-dark)]">
                Edit Machine - Line {machine.line}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Update machine configuration and settings
              </p>
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
              type="button"
            >
              ×
            </button>
          </div>

          {/* Step Indicator */}
          <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <WizardStepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />
          </div>

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {currentStep === 1 && (
              <StepBasicInfo
                quantity={1}
                line={line}
                lineStart=""
                lineEnd=""
                machineName={machineName}
                machineDesignation={machineDesignation}
                facilities_id={facilities_id}
                onChange={handleInputChange}
                errors={errors}
                touched={touched}
                onBlur={handleBlur}
              />
            )}

            {currentStep === 2 && (
              <StepCapabilities
                processTypeKey={process_type_key}
                isCustomProcessType={isCustomProcessType}
                customProcessTypeName={customProcessTypeName}
                customProcessTypeFields={customProcessTypeFields}
                capabilities={capabilities}
                machineVariables={machineVariables}
                machineVariablesId={machineVariablesId}
                formBuilderFields={formBuilderFields}
                onSelectProcessType={handleProcessTypeChange}
                onSelectCustomProcessType={(name) => {
                  setIsCustomProcessType(true);
                  setCustomProcessTypeName(name);
                }}
                onCancelCustomProcessType={() => {
                  setIsCustomProcessType(false);
                  setCustomProcessTypeName("");
                }}
                onSetCustomProcessTypeFields={setCustomProcessTypeFields}
                onCapabilityChange={handleCapabilityChange}
                onSetMachineVariables={setMachineVariables}
                onSetMachineVariablesId={setMachineVariablesId}
                onUpdateMachineVariable={() => {}}
                onSetFormBuilderFields={setFormBuilderFields}
                onAddFormBuilderField={(field) => {
                  setFormBuilderFields((prev) => [...prev, field]);
                }}
                onUpdateFormBuilderField={(id, field) => {
                  setFormBuilderFields((prev) =>
                    prev.map((f) => (f.id === id ? { ...f, ...field } : f))
                  );
                }}
                onRemoveFormBuilderField={(id) => {
                  setFormBuilderFields((prev) => prev.filter((f) => f.id !== id));
                }}
                errors={errors}
              />
            )}

            {currentStep === 3 && (
              <StepGroupsAndRules
                machineGroupOption={machineGroupOption}
                existingGroupId={existingGroupId}
                newGroupName={newGroupName}
                newGroupDescription={newGroupDescription}
                processTypeKey={process_type_key || customProcessTypeName}
                facilitiesId={facilities_id}
                machineVariablesId={machineVariablesId}
                rules={rules}
                onSelectGroupOption={setMachineGroupOption}
                onSelectExistingGroup={setExistingGroupId}
                onSetNewGroupName={setNewGroupName}
                onSetNewGroupDescription={setNewGroupDescription}
                onAddRule={(rule) => {
                  setRules((prev) => [...prev, rule]);
                }}
                onRemoveRule={(index) => {
                  setRules((prev) => prev.filter((_, i) => i !== index));
                }}
                errors={errors}
              />
            )}

            {currentStep === 4 && machine && (
              <EditMachineReviewStep
                machine={machine}
                line={line}
                machineName={machineName}
                machineDesignation={machineDesignation}
                facilitiesId={facilities_id}
                processTypeKey={process_type_key}
                isCustomProcessType={isCustomProcessType}
                customProcessTypeName={customProcessTypeName}
                customProcessTypeFields={customProcessTypeFields}
                capabilities={capabilities}
                formBuilderFields={formBuilderFields}
                machineGroupOption={machineGroupOption}
                existingGroupId={existingGroupId}
                newGroupName={newGroupName}
                newGroupDescription={newGroupDescription}
                rules={rules}
              />
            )}
          </div>

          {/* Footer - Navigation */}
          <div className="border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <div className="px-6 py-4 flex items-center justify-between">
              {/* Left side - Delete button */}
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={submitting || deleting}
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
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Delete Machine
              </button>

              {/* Right side - Navigation */}
              <WizardNavigation
                currentStep={currentStep}
                totalSteps={4}
                onBack={handleBack}
                onNext={handleNext}
                onSubmit={handleSubmit}
                canProceed={canProceed(currentStep)}
                isSubmitting={submitting}
                showCancel={false}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">
              Confirm Deletion
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete Machine Line {machine.line}? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message={`Machine Line ${machine.line} updated successfully!`}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </>
  );
}
