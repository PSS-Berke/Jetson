"use client";

import React from "react";
import type { Machine, MachineCapabilityValue } from "@/types";
import type {
  CustomFormField,
  FormBuilderField,
  RuleFormData,
  WizardState,
} from "@/hooks/useWizardState";
import { PROCESS_TYPE_CONFIGS } from "@/lib/processTypeConfig";
import { Edit2 } from "lucide-react";

interface EditMachineReviewStepProps {
  machine: Machine;
  line: string;
  machineName: string;
  machineDesignation: string;
  facilitiesId: number | null;
  processTypeKey: string;
  isCustomProcessType: boolean;
  customProcessTypeName: string;
  customProcessTypeFields: CustomFormField[];
  capabilities: Record<string, MachineCapabilityValue>;
  formBuilderFields: FormBuilderField[];
  machineGroupOption: "none" | "existing" | "new";
  existingGroupId: number | null;
  newGroupName: string;
  newGroupDescription: string;
  rules: RuleFormData[];
}

const formatValue = (value: any): string => {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join(", ") : "Not set";
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
};

const formatRuleConditions = (conditions: RuleFormData["conditions"]): string => {
  if (conditions.length === 0) {
    return "No conditions";
  }
  return conditions
    .map((condition, index) => {
      const prefix = index > 0 ? ` ${condition.logic || "AND"} ` : "";
      return `${prefix}${condition.parameter} ${condition.operator} ${condition.value}`;
    })
    .join("");
};

export function EditMachineReviewStep({
  machine,
  line,
  machineName,
  machineDesignation,
  facilitiesId,
  processTypeKey,
  isCustomProcessType,
  customProcessTypeName,
  customProcessTypeFields,
  capabilities,
  formBuilderFields,
  machineGroupOption,
  existingGroupId,
  newGroupName,
  newGroupDescription,
  rules,
}: EditMachineReviewStepProps) {
  const capabilityEntries =
    formBuilderFields.length > 0
      ? formBuilderFields.map((field) => ({
          id: field.id,
          label: field.fieldLabel || field.fieldName,
          value: formatValue(field.fieldValue),
          helper: field.fieldType,
        }))
      : Object.entries(capabilities).map(([key, value]) => ({
          id: key,
          label: key,
          value: formatValue(value),
          helper: undefined as string | undefined,
        }));

  const processSummary = isCustomProcessType
    ? customProcessTypeName || "Custom process type (name not set)"
    : processTypeKey || "No process type selected";

  let groupSummaryTitle = "No group selected";
  let groupSummaryBody =
    "This machine will operate independently without shared configurations.";

  if (machineGroupOption === "existing") {
    groupSummaryTitle = "Existing group";
    groupSummaryBody = existingGroupId
      ? `Machine will remain in group #${existingGroupId}.`
      : "Group not selected yet.";
  } else if (machineGroupOption === "new") {
    groupSummaryTitle = "New group";
    groupSummaryBody = newGroupName
      ? `Creating new group "${newGroupName}".`
      : "New group name not provided yet.";
    if (newGroupDescription) {
      groupSummaryBody += ` Description: ${newGroupDescription}`;
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <svg className="w-5 h-5 text-blue-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a1 1 0 00-.894.553l-3 6A1 1 0 007 13h6a1 1 0 00.894-1.447l-3-6A1 1 0 0010 5zm0 8a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="text-sm text-blue-800 font-medium">
            Review all details before saving your changes.
          </p>
          <p className="text-xs text-blue-700">
            Use the Back button if something needs to be updated. Submitting will immediately update this machine.
          </p>
        </div>
      </div>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Basic Details</h3>
          <p className="text-sm text-gray-600">
            Confirm that the identifying information and facility assignments are correct.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs uppercase text-gray-500">Line</p>
            <p className="text-base font-semibold text-gray-900">{formatValue(line)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs uppercase text-gray-500">Machine Name</p>
            <p className="text-base font-semibold text-gray-900">
              {formatValue(machineName || machine.name)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs uppercase text-gray-500">Designation</p>
            <p className="text-base font-semibold text-gray-900">
              {formatValue(machineDesignation || machine.designation)}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs uppercase text-gray-500">Facility</p>
            <p className="text-base font-semibold text-gray-900">
              {facilitiesId ?? machine.facilities_id ?? "Not set"}
            </p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs uppercase text-gray-500">Machine Type</p>
            <p className="text-base font-semibold text-gray-900">{formatValue(machine.type)}</p>
          </div>
          <div className="rounded-lg border border-gray-200 p-4">
            <p className="text-xs uppercase text-gray-500">Status</p>
            <p className="text-base font-semibold text-gray-900">
              {formatValue(machine.status)}
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Process & Capabilities</h3>
          <p className="text-sm text-gray-600">
            Verify the selected process type and the values that will be saved for this machine.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div>
            <p className="text-xs uppercase text-gray-500">Process Type</p>
            <p className="text-base font-semibold text-gray-900">{processSummary}</p>
          </div>

          {isCustomProcessType && customProcessTypeFields.length > 0 && (
            <div>
              <p className="text-xs uppercase text-gray-500 mb-2">Custom Fields</p>
              <div className="space-y-2">
                {customProcessTypeFields.map((field, index) => (
                  <div
                    key={`${field.id}-${index}`}
                    className="p-3 rounded-md bg-purple-50 border border-purple-100 text-sm text-purple-900"
                  >
                    <span className="font-medium">{field.label}</span>
                    <span className="text-xs text-purple-700 ml-2">
                      {field.type || "text"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs uppercase text-gray-500 mb-2">Capabilities / Variables</p>
            {capabilityEntries.length === 0 ? (
              <p className="text-sm text-gray-500">
                No capability values are set. You can add them in the previous step.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {capabilityEntries.map((entry) => (
                  <div key={entry.id} className="border border-gray-200 rounded-md p-3">
                    <p className="text-xs uppercase text-gray-500">{entry.label}</p>
                    <p className="text-sm font-semibold text-gray-900">{entry.value}</p>
                    {entry.helper && (
                      <p className="text-xs text-gray-500">Type: {entry.helper}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Groups & Rules</h3>
          <p className="text-sm text-gray-600">
            Ensure the machine is assigned to the correct group and that the expected rules are present.
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-xs uppercase text-gray-500">Group Assignment</p>
            <p className="text-sm font-semibold text-gray-900">{groupSummaryTitle}</p>
            <p className="text-xs text-gray-600 mt-1">{groupSummaryBody}</p>
          </div>

          <div>
            <p className="text-xs uppercase text-gray-500 mb-2">Rules ({rules.length})</p>
            {rules.length === 0 ? (
              <p className="text-sm text-gray-500">
                No rules are configured. You can add rules in the previous step or leave this blank.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div key={`${rule.name}-${index}`} className="border border-gray-200 rounded-md p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">{rule.name}</p>
                      <span className="text-xs text-gray-500">Priority {rule.priority ?? index + 1}</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      When: {formatRuleConditions(rule.conditions)}
                    </p>
                    <div className="mt-2 text-xs text-gray-500 flex flex-wrap gap-3">
                      <span>Speed: {rule.outputs.speed_modifier ?? 100}%</span>
                      <span>People: {rule.outputs.people_required ?? 1}</span>
                      {rule.outputs.fixed_rate && <span>Fixed Rate: {rule.outputs.fixed_rate}</span>}
                      {rule.outputs.notes && <span>Notes: {rule.outputs.notes}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-green-900">Ready to Update</p>
        <p className="text-xs text-green-800 mt-1">
          Everything looks good! Use the submit button below to save these changes. You can always go back to edit before submitting.
        </p>
      </div>
    </div>
  );
}

interface StepReviewProps {
  state: WizardState;
  onEditStep: (step: number) => void;
  facilities: any[]; // Array of facility objects
}

export default function StepReview({
  state,
  onEditStep,
  facilities,
}: StepReviewProps) {
  // Get facility name
  const facility = facilities.find((f) => f.id === state.facilities_id);
  const facilityName = facility?.name || "Unknown Facility";

  // Get process type config
  const processConfig = PROCESS_TYPE_CONFIGS.find(
    (c) => c.key === state.process_type_key,
  );

  // Format conditions for display
  const formatConditions = (conditions: any[]): string => {
    if (conditions.length === 0) return "No conditions";
    return conditions
      .map((cond, index) => {
        const prefix = index > 0 ? ` ${cond.logic} ` : "";
        return `${prefix}${cond.parameter} ${cond.operator} ${cond.value}`;
      })
      .join("");
  };

  return (
    <div className="space-y-6">
      {/* Step Title */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Review & Submit</h2>
        <p className="mt-2 text-sm text-gray-600">
          Review all information before creating the machine. Click any edit
          button to go back and make changes.
        </p>
      </div>

      {/* Section 1: Category */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            1. Machine Category
          </h3>
          <button
            type="button"
            onClick={() => onEditStep(1)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">
              {state.machineCategory === "conveyance" ? "🏭" : "🔧"}
            </span>
            <span className="font-medium text-gray-900 capitalize">
              {state.machineCategory}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {state.machineCategory === "conveyance"
              ? "Primary production equipment that processes materials"
              : "Detachable equipment that connects to conveyance machines"}
          </p>
        </div>
      </div>

      {/* Section 2: Basic Information */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            2. Basic Information
          </h3>
          <button
            type="button"
            onClick={() => onEditStep(2)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Quantity</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {state.quantity} {state.quantity === 1 ? "Machine" : "Machines"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {state.quantity === 1 ? "Line Number" : "Line Range"}
            </dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {state.quantity === 1
                ? state.line
                : `${state.lineStart} - ${state.lineEnd}`}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Machine Name</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {state.machineName}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Machine Designation
            </dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {state.machineDesignation}
              {state.quantity > 1 && (
                <span className="text-sm text-gray-500 ml-2">
                  ({state.machineDesignation}1, {state.machineDesignation}2,
                  ...)
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Facility</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {facilityName}
            </dd>
          </div>
        </dl>

        {state.quantity > 1 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Multiple Machines:</strong> {state.quantity} machines will
              be created with lines {state.lineStart} through {state.lineEnd},
              named &quot;{state.machineName} {state.machineDesignation}1&quot;
              through &quot;{state.machineName} {state.machineDesignation}
              {state.quantity}&quot;
            </p>
          </div>
        )}
      </div>

      {/* Section 3: Process Type & Capabilities */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            3. Process Type & Capabilities
          </h3>
          <button
            type="button"
            onClick={() => onEditStep(3)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        {state.isCustomProcessType ? (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                Custom
              </div>
              <span className="font-medium text-gray-900">
                {state.customProcessTypeName}
              </span>
            </div>

            {state.customProcessTypeFields.length > 0 ? (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Custom Fields & Values
                </h4>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {state.customProcessTypeFields.map((field) => {
                    const value = state.capabilities[field.id];
                    return (
                      <div key={field.id}>
                        <dt className="text-sm text-gray-600">
                          {field.label}
                          {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </dt>
                        <dd className="mt-0.5 text-sm font-medium text-gray-900">
                          {value ? (
                            String(value)
                          ) : (
                            <span className="text-gray-400 italic">
                              Not set
                            </span>
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ) : (
              <p className="text-sm text-gray-600 italic">
                No custom fields defined
              </p>
            )}
          </div>
        ) : processConfig ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: processConfig.color }}
              />
              <span className="font-medium text-gray-900">
                {processConfig.label}
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Process type selected. Machine variables from API will be
              configured below.
            </p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 italic">
            No process type selected
          </p>
        )}

        {/* Form Builder Fields */}
        {state.formBuilderFields && state.formBuilderFields.length > 0 && (
          <div className="mt-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-green-800 mb-3">
              Form Fields & Values
            </h4>
            <div className="space-y-3">
              {state.formBuilderFields.map((field) => (
                <div
                  key={field.id}
                  className="bg-white rounded-lg p-3 border border-green-200"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <dt className="text-sm text-green-700 font-medium">
                        {field.fieldLabel}
                        {field.required && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </dt>
                      <dd className="mt-0.5 text-sm text-green-900">
                        {field.fieldValue !== undefined &&
                        field.fieldValue !== null &&
                        field.fieldValue !== "" ? (
                          String(field.fieldValue)
                        ) : (
                          <span className="text-green-400 italic">Not set</span>
                        )}
                      </dd>
                    </div>
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                      {field.fieldName}
                    </span>
                  </div>
                  <div className="mt-2 pt-2 border-t border-green-100 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-green-600">Type:</span>
                      <span className="ml-1 text-green-800">
                        {field.fieldType}
                      </span>
                    </div>
                    <div>
                      <span className="text-green-600">Required:</span>
                      <span className="ml-1 text-green-800">
                        {field.required ? "Yes" : "No"}
                      </span>
                    </div>
                    {field.options && field.options.length > 0 && (
                      <div className="col-span-2 sm:col-span-1">
                        <span className="text-green-600">Options:</span>
                        <span className="ml-1 text-green-800">
                          {field.options.join(", ")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Groups & Rules */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            4. Machine Groups & Rules
          </h3>
          <button
            type="button"
            onClick={() => onEditStep(4)}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
          >
            <Edit2 className="w-4 h-4" />
            Edit
          </button>
        </div>

        {/* Machine Group */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Machine Group
          </h4>
          {state.machineGroupOption === "none" ? (
            <p className="text-sm text-gray-600">
              No group - machine operates independently
            </p>
          ) : state.machineGroupOption === "existing" ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                Will join existing group (ID: {state.existingGroupId})
              </p>
            </div>
          ) : (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm font-medium text-green-900">
                {state.newGroupName}
              </p>
              {state.newGroupDescription && (
                <p className="text-sm text-green-700 mt-1">
                  {state.newGroupDescription}
                </p>
              )}
              <p className="text-xs text-green-600 mt-2">
                New group will be created
              </p>
            </div>
          )}
        </div>

        {/* Rules */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">
            Rules ({state.rules.length})
          </h4>
          {state.rules.length === 0 ? (
            <p className="text-sm text-gray-600 italic">No rules configured</p>
          ) : (
            <div className="space-y-2">
              {state.rules.map((rule, index) => (
                <div
                  key={index}
                  className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="font-medium text-gray-900">
                      {rule.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      Priority: {rule.priority}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 mb-2">
                    <strong>When:</strong> {formatConditions(rule.conditions)}
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-700">
                      <strong>Speed:</strong> {rule.outputs.speed_modifier}%
                    </span>
                    <span className="text-gray-700">
                      <strong>People:</strong> {rule.outputs.people_required}
                    </span>
                  </div>
                  {rule.outputs.notes && (
                    <p className="text-xs text-gray-500 mt-2">
                      {rule.outputs.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Ready to Submit */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5"
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
            <h4 className="text-sm font-semibold text-blue-900">
              Ready to Create{" "}
              {state.quantity === 1 ? "Machine" : `${state.quantity} Machines`}
            </h4>
            <p className="mt-1 text-sm text-blue-800">
              Review all the information above. If everything looks correct,
              click &quot;Create {state.quantity === 1 ? "Machine" : "Machines"}
              &quot; to save. You can edit any section by clicking the Edit
              button.
            </p>
          </div>
        </div>
      </div>

      {/* Additional notes */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-700 mb-2">
          What happens next?
        </h4>
        <ul className="space-y-1 text-sm text-gray-600">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>
              {state.quantity === 1
                ? 'The machine will be created with status "Offline"'
                : `All ${state.quantity} machines will be created with status "Offline"`}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>
              {state.machineGroupOption === "new"
                ? `A new machine group will be created and ${state.quantity === 1 ? "this machine" : "these machines"} added to it`
                : state.machineGroupOption === "existing"
                  ? `${state.quantity === 1 ? "This machine" : "These machines"} will be added to the selected group`
                  : `${state.quantity === 1 ? "This machine" : "These machines"} will operate independently`}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>
              {state.rules.length > 0
                ? `${state.rules.length} rule(s) will be created and associated with ${state.quantity === 1 ? "the machine" : "all machines"}`
                : "No rules will be created (you can add them later)"}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span>
              You can edit the machine details, groups, and rules at any time
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}
