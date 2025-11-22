/**
 * Create Machine Wizard
 * 5-step wizard for creating machines with full configuration
 */

"use client";

import React, { useState } from "react";
import { useWizardState, generateLineList } from "@/hooks/useWizardState";
import {
  createMachine,
  createMachinesBulk,
  createMachineRule,
  createMachineGroup,
} from "@/lib/api";
import type {
  Machine,
  MachineCategory,
  MachineStatus,
} from "@/types";
import {
  validateCapabilities,
  getAllValidationMessages,
} from "@/lib/capabilityValidation";

// Wizard components
import WizardStepIndicator from "./wizard/WizardStepIndicator";
import WizardNavigation from "./wizard/WizardNavigation";
import StepCategorySelection from "./wizard/StepCategorySelection";
import StepBasicInfo from "./wizard/StepBasicInfo";
import StepCapabilities from "./wizard/StepCapabilities";
import StepGroupsAndRules from "./wizard/StepGroupsAndRules";
import StepReview from "./wizard/StepReview";
import Toast from "./Toast";

interface CreateMachineWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const WIZARD_STEPS = [
  { number: 1, label: "Category", shortLabel: "Type" },
  { number: 2, label: "Basic Info", shortLabel: "Info" },
  { number: 3, label: "Process & Capabilities", shortLabel: "Config" },
  { number: 4, label: "Groups & Rules", shortLabel: "Rules" },
  { number: 5, label: "Review", shortLabel: "Review" },
];

const FACILITIES = [
  { id: 1, name: "Bolingbrook" },
  { id: 2, name: "Lemont" },
];

export default function CreateMachineWizard({
  isOpen,
  onClose,
  onSuccess,
}: CreateMachineWizardProps) {
  const {
    state,
    dispatch,
    nextStep,
    prevStep,
    goToStep,
    canProceed,
    checkCanProceed,
    reset,
    clearStorage,
  } = useWizardState();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  const handleCancel = () => {
    const confirmCancel = confirm(
      "Are you sure you want to cancel? Your progress has been saved as a draft and you can continue later.",
    );
    if (confirmCancel) {
      handleClose();
    }
  };

  const handleNext = async () => {
    // Note: No API calls are made when clicking Next in any step
    // APIs are only called when fields are modified (auto-save) or on final submission
    nextStep();
  };

  const handleBack = () => {
    prevStep();
  };

  const handleSubmit = async () => {
    if (!canProceed(5)) {
      setToastMessage("Please complete all required fields");
      setShowErrorToast(true);
      return;
    }

    setIsSubmitting(true);

    try {
      // Build combined capabilities object from step 3
      // This includes both custom process type fields and form builder fields
      const combinedCapabilities: Record<string, any> = {
        ...state.capabilities, // Custom process type field values
      };

      // Add form builder field values to capabilities
      if (state.formBuilderFields && state.formBuilderFields.length > 0) {
        state.formBuilderFields.forEach((field) => {
          // Include the field if:
          // 1. It's not undefined or null
          // 2. It's not an empty string (for text fields)
          // 3. For boolean fields, explicitly include false values
          const shouldInclude = 
            field.fieldValue !== undefined && 
            field.fieldValue !== null && 
            (field.fieldType === "boolean" || field.fieldValue !== "");
          
          if (shouldInclude) {
            // Normalize boolean values: if it's a boolean field, ensure false is boolean, not empty string
            let value = field.fieldValue;
            if (field.fieldType === "boolean") {
              // Convert empty string, "false", 0, or falsy values to boolean false
              // Convert "true", 1, or truthy values to boolean true
              if (value === "" || value === "false" || value === 0 || value === false) {
                value = false;
              } else if (value === "true" || value === 1 || value === true) {
                value = true;
              } else {
                // Default to false for any other falsy value
                value = false;
              }
            }
            combinedCapabilities[field.fieldName] = value;
          }
        });
      }

      console.log("[CreateMachineWizard] Combined capabilities from step 3:", JSON.stringify(combinedCapabilities, null, 2));

      // Validate capabilities before submitting
      const processTypeKey = state.isCustomProcessType
        ? state.customProcessTypeName
        : state.process_type_key;

      const validationResult = validateCapabilities(
        processTypeKey,
        combinedCapabilities
      );

      // Show validation errors/warnings (non-blocking for warnings)
      if (!validationResult.valid) {
        const messages = getAllValidationMessages(validationResult);
        const errorMessages = messages.filter((m) => m.startsWith("❌"));

        if (errorMessages.length > 0) {
          setToastMessage(
            `Capability validation errors:\n${errorMessages.join("\n")}`
          );
          setShowErrorToast(true);
          setIsSubmitting(false);
          return;
        }
      }

      // Log warnings but continue
      if (validationResult.warnings.length > 0) {
        const warningMessages = getAllValidationMessages(validationResult)
          .filter((m) => m.startsWith("⚠️"));
        console.warn(
          "[CreateMachineWizard] Capability validation warnings:",
          warningMessages.join("\n")
        );
      }

      // Step 1: Create machine group if needed
      let variableCombinationId: number | undefined;

      if (state.machineGroupOption === "new") {
        // Create a new group (variable combination marked as is_grouped=true)
        const newGroup = await createMachineGroup({
          rule_name: state.newGroupName,
          description: state.newGroupDescription,
          process_type: state.isCustomProcessType
            ? state.customProcessTypeName
            : state.process_type_key,
          is_grouped: true, // Mark this as an explicitly created group
        });
        variableCombinationId = newGroup.id;
        console.log("[CreateMachineWizard] Created new group:", newGroup);
      } else if (state.machineGroupOption === "existing") {
        variableCombinationId = state.existingGroupId || undefined;
      }

      // Step 2: Create machine(s)
      let createdMachines: Machine[] = [];

      if (state.quantity === 1) {
        // Single machine - use regular createMachine
        const machineData = {
          line: state.line,
          name: state.machineName,
          designation: state.machineDesignation,
          facilities_id: state.facilities_id!,
          process_type_key: state.isCustomProcessType
            ? state.customProcessTypeName
            : state.process_type_key,
          machine_category: state.machineCategory as MachineCategory,
          machine_group_id: variableCombinationId,
          capabilities: combinedCapabilities,
          status: "Offline" as MachineStatus,
          // Placeholder values - will be determined by rules
          speed_hr: 0,
          shiftCapacity: 0,
          people_per_process: 1,
        };

        const newMachine = await createMachine(machineData);
        createdMachines = [newMachine];
      } else {
        // Multiple machines - use bulk creation with line_list
        const startLineStr = state.lineStart.trim();
        
        if (!startLineStr) {
          throw new Error(`Starting line number is required`);
        }

        // Build line_list array with all line numbers (handles numeric and alphanumeric)
        const lineList = generateLineList(startLineStr, state.quantity);

        const bulkData = {
          quantity: state.quantity,
          line_list: lineList,
          name: state.machineName,
          designation: state.machineDesignation,
          facilities_id: state.facilities_id!,
          process_type_key: state.isCustomProcessType
            ? state.customProcessTypeName
            : state.process_type_key,
          machine_category: state.machineCategory as MachineCategory,
          variable_combination_id: variableCombinationId,
          capabilities: combinedCapabilities,
          status: "Offline" as MachineStatus,
          details: {},
        };

        createdMachines = await createMachinesBulk(bulkData);
      }

      // Step 3: Add machines to existing group if selected
      if (state.machineGroupOption === "existing" && state.existingGroupId) {
        
      }

      // Step 4: Create rules
      for (const rule of state.rules) {
        await createMachineRule({
          name: rule.name,
          process_type_key:
            state.process_type_key || state.customProcessTypeName,
          machine_id: variableCombinationId
            ? undefined
            : createdMachines.length === 1
              ? createdMachines[0].id
              : undefined,
          machine_group_id: variableCombinationId,
          priority: rule.priority,
          conditions: rule.conditions,
          outputs: rule.outputs,
          active: true,
        });
      }

      // Step 5: Save machine variables (form builder fields + values)
      // Only save if we have a valid ID and at least one field
      if (
        state.machineVariablesId &&
        typeof state.machineVariablesId === "number" &&
        state.formBuilderFields &&
        state.formBuilderFields.length > 0
      ) {
        try {
          console.log(
            "[CreateMachineWizard] ===== SAVING MACHINE VARIABLES =====",
          );
          console.log(
            "[CreateMachineWizard] Machine Variables ID:",
            state.machineVariablesId,
          );
          console.log(
            "[CreateMachineWizard] Form Builder Fields:",
            state.formBuilderFields,
          );

          // Convert form builder fields to variables object
          const variables: Record<string, any> = {};
          state.formBuilderFields.forEach((field) => {
            variables[field.fieldName] = {
              label: field.fieldLabel,
              type: field.fieldType,
              value: field.fieldValue,
              options: field.options,
              required: field.required,
            };
          });

          console.log(
            "[CreateMachineWizard] Variables object to save:",
            JSON.stringify(variables, null, 2),
          );
          console.log(
            "[CreateMachineWizard] Calling PATCH /machine_variables/" +
              state.machineVariablesId,
          );

          
        } catch (error: any) {
          console.error(
            "[CreateMachineWizard] ✗ Error updating machine variables:",
            error,
          );
          console.error("[CreateMachineWizard] Error details:", {
            message: error?.message,
            stack: error?.stack,
            machineVariablesId: state.machineVariablesId,
          });
          // Don't fail the entire operation if variables fail to save
        }
      } else {
        console.log(
          "[CreateMachineWizard] Skipping machine variables save - missing required data:",
          {
            hasId: !!state.machineVariablesId,
            idType: typeof state.machineVariablesId,
            idValue: state.machineVariablesId,
            hasFields:
              !!state.formBuilderFields && state.formBuilderFields.length > 0,
            formBuilderFieldsCount: state.formBuilderFields?.length || 0,
          },
        );
      }

      // Success!
      const message =
        state.quantity === 1
          ? `Machine "${state.machineName}" created successfully!`
          : `${state.quantity} machines created successfully!`;
      setToastMessage(message);
      setShowSuccessToast(true);

      // Clear the draft
      clearStorage();
      reset();

      // Wait a moment for toast to show, then close and callback
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error("[CreateMachineWizard] Error creating machine:", error);
      setToastMessage(
        error.message || "Failed to create machine. Please try again.",
      );
      setShowErrorToast(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use checkCanProceed for rendering (no side effects)
  const canProceedCurrentStep = checkCanProceed(state.currentStep);

  return (
    <>
      {/* Modal Overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        {/* Modal Container */}
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Create New Machine
              </h2>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Step Indicator */}
            <div className="mt-4">
              <WizardStepIndicator
                currentStep={state.currentStep}
                steps={WIZARD_STEPS}
              />
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {state.currentStep === 1 && (
              <StepCategorySelection
                selected={state.machineCategory}
                onSelect={(category) =>
                  dispatch({ type: "SET_CATEGORY", payload: category })
                }
                error={state.errors.machineCategory}
              />
            )}

            {state.currentStep === 2 && (
              <StepBasicInfo
                quantity={state.quantity}
                line={state.line}
                lineStart={state.lineStart}
                lineEnd={state.lineEnd}
                machineName={state.machineName}
                machineDesignation={state.machineDesignation}
                facilities_id={state.facilities_id}
                onChange={(field, value) =>
                  dispatch({
                    type: "SET_BASIC_INFO",
                    payload: { [field]: value },
                  })
                }
                errors={state.errors}
                touched={state.touched}
                onBlur={(field) =>
                  dispatch({ type: "SET_TOUCHED", payload: field })
                }
              />
            )}

            {state.currentStep === 3 && (
              <StepCapabilities
                processTypeKey={state.process_type_key}
                isCustomProcessType={state.isCustomProcessType}
                customProcessTypeName={state.customProcessTypeName}
                customProcessTypeFields={state.customProcessTypeFields}
                capabilities={state.capabilities}
                machineVariables={state.machineVariables}
                machineVariablesId={state.machineVariablesId}
                formBuilderFields={state.formBuilderFields}
                onSelectProcessType={(key) =>
                  dispatch({ type: "SET_PROCESS_TYPE", payload: key })
                }
                onSelectCustomProcessType={(name) =>
                  dispatch({
                    type: "SET_CUSTOM_PROCESS_TYPE",
                    payload: { name, isCustom: true },
                  })
                }
                onCancelCustomProcessType={() =>
                  dispatch({
                    type: "SET_CUSTOM_PROCESS_TYPE",
                    payload: { name: "", isCustom: false },
                  })
                }
                onSetCustomProcessTypeFields={(fields) =>
                  dispatch({
                    type: "SET_CUSTOM_PROCESS_TYPE_FIELDS",
                    payload: fields,
                  })
                }
                onCapabilityChange={(field, value) =>
                  dispatch({
                    type: "SET_CAPABILITY",
                    payload: { field, value },
                  })
                }
                onSetMachineVariables={(variables) =>
                  dispatch({
                    type: "SET_MACHINE_VARIABLES",
                    payload: variables,
                  })
                }
                onSetMachineVariablesId={(id) =>
                  dispatch({ type: "SET_MACHINE_VARIABLES_ID", payload: id })
                }
                onUpdateMachineVariable={(id, key, value) =>
                  dispatch({
                    type: "UPDATE_MACHINE_VARIABLE",
                    payload: { id, key, value },
                  })
                }
                onSetFormBuilderFields={(fields) =>
                  dispatch({ type: "SET_FORM_BUILDER_FIELDS", payload: fields })
                }
                onAddFormBuilderField={(field) =>
                  dispatch({ type: "ADD_FORM_BUILDER_FIELD", payload: field })
                }
                onUpdateFormBuilderField={(id, field) =>
                  dispatch({
                    type: "UPDATE_FORM_BUILDER_FIELD",
                    payload: { id, field },
                  })
                }
                onRemoveFormBuilderField={(id) =>
                  dispatch({ type: "REMOVE_FORM_BUILDER_FIELD", payload: id })
                }
                errors={state.errors}
                disableAutoSave={true}
              />
            )}

            {state.currentStep === 4 && (
              <StepGroupsAndRules
                machineGroupOption={state.machineGroupOption}
                existingGroupId={state.existingGroupId}
                newGroupName={state.newGroupName}
                newGroupDescription={state.newGroupDescription}
                processTypeKey={
                  state.process_type_key || state.customProcessTypeName
                }
                facilitiesId={state.facilities_id}
                machineVariablesId={state.machineVariablesId}
                rules={state.rules}
                onSelectGroupOption={(option) =>
                  dispatch({ type: "SET_GROUP_OPTION", payload: option })
                }
                onSelectExistingGroup={(groupId) =>
                  dispatch({ type: "SET_EXISTING_GROUP", payload: groupId })
                }
                onSetNewGroupName={(name) =>
                  dispatch({ type: "SET_NEW_GROUP", payload: { name } })
                }
                onSetNewGroupDescription={(description) =>
                  dispatch({ type: "SET_NEW_GROUP", payload: { description } })
                }
                onAddRule={(rule) =>
                  dispatch({ type: "ADD_RULE", payload: rule })
                }
                onRemoveRule={(index) =>
                  dispatch({ type: "REMOVE_RULE", payload: index })
                }
                errors={state.errors}
              />
            )}

            {state.currentStep === 5 && (
              <StepReview
                state={state}
                onEditStep={(step) => goToStep(step)}
                facilities={FACILITIES}
              />
            )}
          </div>

          {/* Footer - Navigation */}
          <WizardNavigation
            currentStep={state.currentStep}
            totalSteps={WIZARD_STEPS.length}
            onBack={handleBack}
            onNext={handleNext}
            onSubmit={handleSubmit}
            canProceed={canProceedCurrentStep}
            isSubmitting={isSubmitting}
            showCancel={true}
            onCancel={handleCancel}
          />
        </div>
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message={toastMessage}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Error Toast */}
      {showErrorToast && (
        <Toast
          message={toastMessage}
          type="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </>
  );
}
