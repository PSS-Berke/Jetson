"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  getProcessTypeOptions,
  normalizeProcessType,
  getSourceTypesForProcessType,
  type FieldConfig,
} from "@/lib/processTypeConfig";
import { getAllMachineVariables, getCapabilityBuckets, type CapabilityBucket } from "@/lib/api";

// Module-level cache to persist fetched fields across component remounts
// Key: processType, Value: { fields: FieldConfig[], additionalFields: FieldConfig[], timestamp: number }
const fieldsCache = new Map<string, { basicFields: FieldConfig[]; additionalFields: FieldConfig[]; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface DynamicRequirementFieldsProps {
  requirement: {
    process_type: string;
    [key: string]: string | number | boolean | undefined;
  };
  onChange: (field: string, value: string | number | boolean) => void;
  errors?: Record<string, string>;
  disableRequired?: boolean;
}

export default function DynamicRequirementFields({
  requirement,
  onChange,
  errors = {},
  disableRequired = false,
}: DynamicRequirementFieldsProps) {
  const [dynamicFields, setDynamicFields] = useState<FieldConfig[]>([]);
  const [additionalFields, setAdditionalFields] = useState<FieldConfig[]>([]);
  const [showAdditionalFields, setShowAdditionalFields] = useState(false);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [capabilityBuckets, setCapabilityBuckets] = useState<CapabilityBucket[]>([]);
  const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);
  const populatedProcessTypeRef = useRef<string | null>(null);
  const populatedBucketRef = useRef<number | null>(null);
  const fetchedProcessTypeRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const previousProcessTypeRef = useRef<string | null>(null);
  const processTypeOptions = getProcessTypeOptions();

  // Fetch capability buckets when process_type is "Capability Bucket"
  useEffect(() => {
    if (requirement.process_type !== "Capability Bucket") {
      setCapabilityBuckets([]);
      return;
    }

    const fetchBuckets = async () => {
      setIsLoadingBuckets(true);
      try {
        const buckets = await getCapabilityBuckets();
        setCapabilityBuckets(buckets);
      } catch (error) {
        setCapabilityBuckets([]);
      } finally {
        setIsLoadingBuckets(false);
      }
    };

    fetchBuckets();
  }, [requirement.process_type]);

  // Auto-populate bucket capabilities when editing existing job with capability bucket
  useEffect(() => {
    if (
      requirement.process_type === "Capability Bucket" &&
      requirement.capability_bucket_id &&
      capabilityBuckets.length > 0 &&
      populatedBucketRef.current !== requirement.capability_bucket_id
    ) {
      const selectedBucket = capabilityBuckets.find(
        b => b.id === requirement.capability_bucket_id
      );

      if (selectedBucket) {
        // Check if capabilities are already populated
        const hasCapabilities = Object.keys(selectedBucket.capabilities).some(
          key => requirement[key] !== undefined && requirement[key] !== null && requirement[key] !== ""
        );

        // Only populate if capabilities are missing
        if (!hasCapabilities) {
          Object.entries(selectedBucket.capabilities).forEach(([key, value]) => {
            let actualValue = value;
            if (typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value) {
              actualValue = (value as any).value;
            }
            onChange(key, actualValue);
          });
        }
        populatedBucketRef.current = typeof requirement.capability_bucket_id === 'number'
          ? requirement.capability_bucket_id
          : parseInt(String(requirement.capability_bucket_id));
      }
    }
  }, [requirement.process_type, requirement.capability_bucket_id, capabilityBuckets, requirement, onChange]);

  // Fetch dynamic fields when process_type changes
  useEffect(() => {
    const currentProcessType = requirement.process_type;

    // CRITICAL: Only proceed if process_type actually changed
    // This prevents the effect from running when other fields change
    if (previousProcessTypeRef.current === currentProcessType) {
      // Process type hasn't changed - this effect shouldn't run
      // This can happen if React re-runs the effect for other reasons
      return;
    }


    // Update the previous process type ref
    previousProcessTypeRef.current = currentProcessType;

    if (!currentProcessType) {
      setDynamicFields([]);
      setAdditionalFields([]);
      populatedProcessTypeRef.current = null;
      fetchedProcessTypeRef.current = null;
      return;
    }

    // Don't fetch machine_variables if process_type is "Capability Bucket"
    if (currentProcessType === "Capability Bucket") {
      setDynamicFields([]);
      setAdditionalFields([]);
      fetchedProcessTypeRef.current = null;
      return;
    }

    // CRITICAL: Check module-level cache FIRST (before any other checks)
    // This prevents API calls when component remounts due to field value changes
    const cachedData = fieldsCache.get(currentProcessType);
    if (cachedData) {
      const cacheAge = Date.now() - cachedData.timestamp;
      if (cacheAge < CACHE_DURATION) {
        // Cache is still valid - use it and skip API call
        // This handles the case where component remounts but we have cached data
        setDynamicFields(cachedData.basicFields);
        setAdditionalFields(cachedData.additionalFields);
        fetchedProcessTypeRef.current = currentProcessType;
        return; // CRITICAL: Return early to prevent API call
      } else {
        // Cache expired, remove it
        fieldsCache.delete(currentProcessType);
      }
    }

    // If we've already fetched for this process type AND have fields, skip
    // This prevents re-fetching when field values change (component doesn't remount)
    if (fetchedProcessTypeRef.current === currentProcessType) {
      if (dynamicFields.length > 0 || additionalFields.length > 0) {
        return;
      }
      // If we don't have fields in state but requirement has field values, skip
      const hasFieldValues = Object.keys(requirement).some(
        key => key !== 'process_type' && key !== 'price_per_m' && key !== 'id' &&
               !key.endsWith('_cost') && // Exclude cost fields from this check
               requirement[key] !== undefined && requirement[key] !== null && requirement[key] !== ''
      );
      if (hasFieldValues) {
        return;
      }
    }

    // Prevent duplicate fetches: if we're already fetching for this process type, skip
    if (isFetchingRef.current) {
      return;
    }

    const fetchFields = async () => {
      // Capture the process type at the start to avoid stale closures
      const processTypeToFetch = currentProcessType;

      // Double-check: if another fetch started, bail out
      if (isFetchingRef.current) {
        return;
      }

      // Mark as fetching (but don't mark as fetched until we successfully get the data)
      isFetchingRef.current = true;
      setIsLoadingFields(true);

      try {
        // Normalize the process type to match database keys (e.g., "Insert" -> "insert")
        const normalizedType = normalizeProcessType(processTypeToFetch);

        // Get source types that should be included for this normalized type
        const sourceTypes = getSourceTypesForProcessType(normalizedType);

  
        // Fetch all machine variables and filter by source types
        const allVariables = await getAllMachineVariables();
        const response = allVariables.filter((group: any) =>
          sourceTypes.includes(group.type)
        );


        // Extract fields from the API response
        // Response structure: [{ id, type, variables: { varName: { type, label, value, required, addToJobInput } } }]
        // NOTE: Multiple records may be returned for the same normalized type (e.g., "Insert" and "Ink jet+")
        // We need to merge all variables from all matching records
        if (response && response.length > 0) {
          // Merge all variables from all records
          const mergedVariables: Record<string, any> = {};
          response.forEach((record: any, index: number) => {
            console.log(`  Record ${index + 1}: type="${record.type}", id=${record.id}, variables count=${Object.keys(record.variables || {}).length}`);

            if (record.variables && typeof record.variables === 'object') {
              console.log(`    Fields in record ${index + 1}:`, Object.keys(record.variables).join(', '));

              // Merge variables, later records override earlier ones if same field name exists
              Object.entries(record.variables).forEach(([varName, varConfig]) => {
                if (mergedVariables[varName]) {
                  console.log(`    ⚠️  Overwriting "${varName}" from record ${index} with record ${index + 1}`);
                }
                mergedVariables[varName] = varConfig;
              });
            }
          });


          // Check if we have any variables after merging
          if (Object.keys(mergedVariables).length > 0) {
            const variables = mergedVariables;

            // Filter variables where addToJobInput === true and map to FieldConfig
            // Split into basic fields (shown immediately) and additional fields (behind button)
            // Sort by order property first, then filter

            // Debug: Log all variables and their addToJobInput status
            Object.entries(variables).forEach(([varName, varConfig]: [string, any]) => {
              console.log(`  - ${varName}:`, {
                addToJobInput: varConfig.addToJobInput,
                showInAdditionalFields: varConfig.showInAdditionalFields,
                type: varConfig.type,
                label: varConfig.label,
              });
            });

            const allJobInputFields = Object.entries(variables)
              .map(([varName, varConfig]: [string, any]) => ({
                varName,
                varConfig,
                order: varConfig.order ?? 999, // Fields without order go to the end
              }))
              .sort((a, b) => a.order - b.order)
              .filter(({ varConfig }) => {
                // Only include variables where addToJobInput is true
                const shouldInclude = varConfig.addToJobInput === true;
                if (!shouldInclude) {
                  console.log(`  [FILTERED OUT] ${varConfig.label || 'unnamed'}: addToJobInput=${varConfig.addToJobInput}`);
                }
                return shouldInclude;
              })
              .map(({ varName, varConfig }) => [varName, varConfig] as [string, any]);


            const basicFields: FieldConfig[] = [];
            const additionalFieldsList: FieldConfig[] = [];

            allJobInputFields.forEach(([varName, varConfig]: [string, any]) => {
                // Map variable type to FieldConfig type
                let fieldType: FieldConfig["type"] = "text";
                if (varConfig.type === "select" || varConfig.type === "dropdown") {
                  fieldType = "dropdown";
                } else if (varConfig.type === "number" || varConfig.type === "integer") {
                  fieldType = "number";
                } else if (varConfig.type === "boolean") {
                  fieldType = "text"; // We'll handle boolean separately in renderField
                } else if (varConfig.type === "currency") {
                  fieldType = "currency";
                } else {
                  fieldType = (varConfig.type || "text") as FieldConfig["type"];
                }

                // Map variable config to FieldConfig format
                const fieldConfig: FieldConfig = {
                  name: varName,
                  type: fieldType,
                  label: varConfig.label || varName,
                  required: varConfig.required || false,
                  placeholder: varConfig.placeholder,
                  options: varConfig.options,
                  validation: {
                    ...varConfig.validation,
                    // For integer types, ensure step is 1 if not specified
                    step: varConfig.type === "integer"
                      ? (varConfig.validation?.step || 1)
                      : varConfig.validation?.step,
                  },
                  // Store the original type for boolean and integer handling
                  ...(varConfig.type === "boolean" && { originalType: "boolean" }),
                  ...(varConfig.type === "integer" && { originalType: "integer" }),
                } as FieldConfig & { originalType?: string };

                // Push to appropriate array based on showInAdditionalFields flag
                if (varConfig.showInAdditionalFields === true) {
                  additionalFieldsList.push(fieldConfig);
                } else {
                  basicFields.push(fieldConfig);
                }
              });

            // Pre-populate field values from API response
            // Only populate once per process type change
            // Use the captured process type to avoid stale closure issues
            if (populatedProcessTypeRef.current !== processTypeToFetch) {
              Object.entries(variables).forEach(([varName, varConfig]: [string, any]) => {
                if (varConfig.addToJobInput === true) {
                  // Handle boolean values - they can be false, which is a valid value
                  const isBoolean = varConfig.type === "boolean";
                  const hasValue = isBoolean
                    ? varConfig.value !== undefined && varConfig.value !== null
                    : varConfig.value !== undefined &&
                      varConfig.value !== null &&
                      varConfig.value !== "";
                  
                  // Check if value is already set and matches the API value
                  const currentValue = requirement[varName];
                  const apiValue = varConfig.value;
                  const valuesMatch = isBoolean
                    ? (currentValue === apiValue || (currentValue === "true" && apiValue === true) || (currentValue === "false" && apiValue === false))
                    : (currentValue === apiValue || String(currentValue) === String(apiValue));
                  
                  const notAlreadySet = currentValue === undefined ||
                    currentValue === null ||
                    (isBoolean ? false : currentValue === "");

                  // Only call onChange if value is not set or if it's different from API value
                  if (hasValue && (notAlreadySet || !valuesMatch)) {
                    onChange(varName, apiValue);
                  }
                }
              });
              populatedProcessTypeRef.current = processTypeToFetch;
            }

           
           
            setDynamicFields(basicFields);
            setAdditionalFields(additionalFieldsList);
            // Cache the fields for this process type (survives component remounts)
            fieldsCache.set(processTypeToFetch, {
              basicFields,
              additionalFields: additionalFieldsList,
              timestamp: Date.now(),
            });
            // Mark this process type as fetched (use captured value to avoid stale closure)
            fetchedProcessTypeRef.current = processTypeToFetch;
          } else {
            // No variables after merging all records
           
            setDynamicFields([]);
            setAdditionalFields([]);
            // Cache empty result to prevent repeated fetches
            fieldsCache.set(processTypeToFetch, {
              basicFields: [],
              additionalFields: [],
              timestamp: Date.now(),
            });
            fetchedProcessTypeRef.current = processTypeToFetch;
          }
        } else {
          // Fallback to static config if API returns no fields
        
          setDynamicFields([]);
          // Cache empty result to prevent repeated fetches
          fieldsCache.set(processTypeToFetch, {
            basicFields: [],
            additionalFields: [],
            timestamp: Date.now(),
          });
          fetchedProcessTypeRef.current = processTypeToFetch;
        }
      } catch (error) {
     
        // Fallback to static config on error
        setDynamicFields([]);
        // Don't mark as fetched on error - allow retry if user navigates away and back
        // Reset the fetched ref so it can try again (use captured value)
        if (fetchedProcessTypeRef.current === processTypeToFetch) {
          fetchedProcessTypeRef.current = null;
        }
      } finally {
        setIsLoadingFields(false);
        isFetchingRef.current = false;
      }
    };

    fetchFields();

    // Cleanup function to reset fetching flag if component unmounts or process_type changes
    return () => {
      // Only reset if we were fetching for the current process type
      // This prevents resetting if the process type changed while fetching
      if (fetchedProcessTypeRef.current === currentProcessType || !fetchedProcessTypeRef.current) {
        isFetchingRef.current = false;
      }
    };
  }, [requirement.process_type]);

  // Only use dynamic fields from API - no fallback to static config
  const fieldsToRender = dynamicFields;

  // Handle bucket selection
  const handleBucketChange = (bucketId: string) => {
    if (!bucketId) {
      onChange("capability_bucket_id", "");
      populatedBucketRef.current = null;
      return;
    }

    const bucketIdNum = parseInt(bucketId);
    const selectedBucket = capabilityBuckets.find(b => b.id === bucketIdNum);

    if (selectedBucket) {
      onChange("capability_bucket_id", bucketIdNum);

      // Clear all existing capability fields (except process_type, price_per_m, and capability_bucket_id)
      // IMPORTANT: Do this BEFORE clearing dynamicFields array so we can check field types
      const fieldsToClear = Object.keys(requirement);

      fieldsToClear.forEach(fieldName => {
        if (fieldName !== "process_type" && fieldName !== "price_per_m" && fieldName !== "capability_bucket_id") {
          const field = dynamicFields.find(f => f.name === fieldName);
          if (field) {
            const isBoolean = (field as any).originalType === "boolean";
            if (isBoolean) {
              onChange(fieldName, false);
            } else if (field.type === "number") {
              onChange(fieldName, 0);
            } else {
              onChange(fieldName, "");
            }
          } else {
            onChange(fieldName, "");
          }
        }
      });

      // Clear dynamicFields so machine_variables fields are not displayed
      setDynamicFields([]);

      // Populate fields with bucket capabilities (always populate, no ref check)
      Object.entries(selectedBucket.capabilities).forEach(([key, value]) => {
        let actualValue = value;
        if (typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value) {
          actualValue = (value as any).value;
        }
        onChange(key, actualValue);
      });

      populatedBucketRef.current = bucketIdNum;
    }
  };

  // Get selected bucket name
  const getSelectedBucketName = (): string => {
    if (!requirement.capability_bucket_id) return "";
    const bucket = capabilityBuckets.find(b => b.id === requirement.capability_bucket_id);
    return bucket?.name || "";
  };

  // Helper function to determine if cost field should be shown
  const shouldShowCostField = (field: FieldConfig, value: any): boolean => {
    if (value === undefined || value === null) return false;

    // Check if this is a boolean field
    const isBoolean = (field as any).originalType === "boolean";

    if (isBoolean) {
      // For booleans, show cost only if true
      return value === "true" || value === true || value === 1;
    }

    switch (field.type) {
      case "dropdown":
      case "text":
        // Show cost if non-empty string
        return String(value).trim() !== "";

      case "number":
      case "currency":
        // Show cost if non-zero
        return Number(value) !== 0;

      default:
        return String(value).trim() !== "";
    }
  };

  // Helper function to render cost input field
  const renderCostInput = (field: FieldConfig) => {
    const costFieldName = `${field.name}_cost`;
    const costValue = requirement[costFieldName];
    // Convert to string for input value, handling different types
    const displayValue = costValue !== undefined && costValue !== null ? String(costValue) : "";

    return (
      <div className="ml-4 pl-4 border-l-2 border-blue-200 bg-blue-50/30 rounded-r py-2 pr-2">
        <label
          htmlFor={`${costFieldName}-input`}
          className="block text-xs font-semibold text-gray-700 mb-1"
        >
          Additional Cost
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-500 text-sm">$</span>
          </div>
          <input
            type="number"
            id={`${costFieldName}-input`}
            value={displayValue}
            onChange={(e) => onChange(costFieldName, e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            step="0.01"
            min="0"
            placeholder="0.00"
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-blue-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
          />
        </div>
      </div>
    );
  };

  const renderField = (field: FieldConfig, index: number, isAdditionalField: boolean = false) => {
    // Check if this is a boolean field (stored in originalType)
    const isBoolean = (field as any).originalType === "boolean";

    // Handle boolean values - default to false if not set
    const value = isBoolean
      ? (requirement[field.name] !== undefined ? requirement[field.name] : false)
      : (requirement[field.name] || "");

    const error = errors[field.name];
    const fieldId = `${field.name}-${index}-${requirement.process_type}`;
    const fieldKey = `${requirement.process_type}-${field.name}-${index}`;

    // Match the styling from AddJobModal/EditJobModal for consistency
    const baseInputClasses = `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
      error
        ? "border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500"
        : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
    }`;

    // Handle boolean fields
    if (isBoolean) {
      return (
        <div key={fieldKey} className="flex-1 min-w-[200px] space-y-2">
          <div>
            <label
              htmlFor={fieldId}
              className="flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                id={fieldId}
                checked={value === "true" || value === 1 || (!!value && value !== "false")}
                onChange={(e) => onChange(field.name, e.target.checked ? "true" : "false")}
                className="w-5 h-5 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-[var(--primary-blue)] focus:ring-2"
              />
              <span className="text-sm font-semibold text-[var(--text-dark)]">
                {field.label}{" "}
                {!disableRequired && field.required && <span className="text-red-500">*</span>}
              </span>
            </label>
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
          </div>

          {/* Cost field - only show for additional fields when checkbox is checked */}
          {isAdditionalField && shouldShowCostField(field, value) && renderCostInput(field)}
        </div>
      );
    }

    switch (field.type) {
      case "dropdown":
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px] space-y-2">
            <div>
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
              >
                {field.label}{" "}
                {!disableRequired && field.required && <span className="text-red-500">*</span>}
              </label>
              <select
                id={fieldId}
                value={value as string}
                onChange={(e) => onChange(field.name, e.target.value)}
                className={baseInputClasses}
                required={!disableRequired && field.required}
              >
                <option value="">Select {field.label}...</option>
                {field.options?.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            {/* Cost field - only show for additional fields when option is selected */}
            {isAdditionalField && shouldShowCostField(field, value) && renderCostInput(field)}
          </div>
        );

      case "number":
        const isInteger = (field as any).originalType === "integer";
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px] space-y-2">
            <div>
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
              >
                {field.label}{" "}
                {!disableRequired && field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                id={fieldId}
                value={value as number}
                onChange={(e) => {
                  const inputValue = e.target.value;
                  // Use parseInt for integers, parseFloat for numbers
                  const parsedValue = isInteger
                    ? (inputValue === "" ? 0 : parseInt(inputValue, 10) || 0)
                    : (inputValue === "" ? 0 : parseFloat(inputValue) || 0);
                  onChange(field.name, parsedValue);
                }}
                onWheel={(e) => e.currentTarget.blur()}
                min={field.validation?.min}
                max={field.validation?.max}
                step={field.validation?.step || (isInteger ? 1 : undefined)}
                placeholder={field.placeholder}
                className={baseInputClasses}
                required={!disableRequired && field.required}
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            {/* Cost field - only show for additional fields when number is non-zero */}
            {isAdditionalField && shouldShowCostField(field, value) && renderCostInput(field)}
          </div>
        );

      case "currency":
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px] space-y-2">
            <div>
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
              >
                {field.label}{" "}
                {!disableRequired && field.required && <span className="text-red-500">*</span>}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <span className="text-gray-500 text-base">$</span>
                </div>
                <input
                  type="number"
                  id={fieldId}
                  value={value as string}
                  onChange={(e) => onChange(field.name, e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  min={field.validation?.min || 0}
                  step={field.validation?.step || 0.01}
                  placeholder={field.placeholder || "0.00"}
                  className={`${baseInputClasses} pl-8`}
                  required={!disableRequired && field.required}
                />
              </div>
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            {/* Cost field - only show for additional fields when currency value is non-zero */}
            {isAdditionalField && shouldShowCostField(field, value) && renderCostInput(field)}
          </div>
        );

      case "text":
      default:
        return (
          <div key={fieldKey} className="flex-1 min-w-[200px] space-y-2">
            <div>
              <label
                htmlFor={fieldId}
                className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
              >
                {field.label}{" "}
                {!disableRequired && field.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                id={fieldId}
                value={value as string}
                onChange={(e) => onChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                className={baseInputClasses}
                required={!disableRequired && field.required}
              />
              {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            </div>

            {/* Cost field - only show for additional fields when text is entered */}
            {isAdditionalField && shouldShowCostField(field, value) && renderCostInput(field)}
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Process Type Selector */}
      <div className="w-full">
        <label
          htmlFor="process-type"
          className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
        >
          Process Type {!disableRequired && <span className="text-red-500">*</span>}
        </label>
        <select
          id="process-type"
          value={requirement.process_type}
          onChange={(e) => {
            onChange("process_type", e.target.value);
            // Clear bucket selection when process type changes
            onChange("capability_bucket_id", "");
            populatedBucketRef.current = null;
          }}
          className={`w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
            errors.process_type
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
          }`}
          required={!disableRequired}
        >
          <option value="">Select Process Type...</option>
          {processTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.process_type && (
          <p className="mt-1 text-sm text-red-600">{errors.process_type}</p>
        )}
      </div>

      {/* Capability Bucket Selector - only show when process type is "Capability Bucket" */}
      {requirement.process_type === "Capability Bucket" && (
        <div className="w-full space-y-4">
          {/* Bucket Dropdown */}
          {isLoadingBuckets ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-light)]">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              <span>Loading buckets...</span>
            </div>
          ) : (
            <div>
              <label
                htmlFor="capability-bucket-select"
                className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
              >
                Select Bucket {!disableRequired && <span className="text-red-500">*</span>}
              </label>
              <select
                id="capability-bucket-select"
                value={requirement.capability_bucket_id ? String(requirement.capability_bucket_id) : ""}
                onChange={(e) => handleBucketChange(e.target.value)}
                className={`w-full px-4 py-3 text-base border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                  errors.capability_bucket_id
                    ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                    : "border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
                }`}
                required={!disableRequired}
              >
                <option value="">Select a bucket...</option>
                {capabilityBuckets.map((bucket) => (
                  <option key={bucket.id} value={bucket.id}>
                    {bucket.name}
                  </option>
                ))}
              </select>

              {capabilityBuckets.length === 0 && (
                <p className="mt-1 text-sm text-gray-500 italic">
                  No capability buckets available
                </p>
              )}
              {errors.capability_bucket_id && (
                <p className="mt-1 text-sm text-red-600">{errors.capability_bucket_id}</p>
              )}
            </div>
          )}

          {/* Selected Bucket Capabilities Display */}
          {requirement.capability_bucket_id && !isLoadingBuckets && (() => {
            const selectedBucket = capabilityBuckets.find(
              b => b.id === requirement.capability_bucket_id
            );

            if (selectedBucket && selectedBucket.capabilities) {
              const capabilities = selectedBucket.capabilities;
              const capabilityEntries = Object.entries(capabilities);

              if (capabilityEntries.length > 0) {
                return (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h5 className="text-sm font-semibold text-[var(--text-dark)] mb-3">
                      Bucket Capabilities:
                    </h5>
                    <div className="space-y-2">
                      {capabilityEntries.map(([key, value]) => {
                        // Extract display value
                        let displayKey = key;
                        let displayValue: any = value;

                        if (typeof value === "object" && value !== null && !Array.isArray(value) && "label" in value && "value" in value) {
                          displayKey = (value as any).label || key;
                          displayValue = (value as any).value;
                        }

                        return (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-gray-600 font-medium">{displayKey}:</span>
                            <span className="text-[var(--text-dark)] font-semibold">
                              {String(displayValue)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }
            }
            return null;
          })()}
        </div>
      )}

      {/* Dynamic Fields Based on Selected Process Type - Don't show if process type is Capability Bucket */}
      {requirement.process_type !== "Capability Bucket" && isLoadingFields ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3 text-[var(--text-light)]">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Loading fields...</span>
          </div>
        </div>
      ) : requirement.process_type !== "Capability Bucket" && requirement.process_type && (fieldsToRender.length > 0 || additionalFields.length > 0) ? (
        <>
          {fieldsToRender.length > 0 && (
            <div className="flex flex-wrap gap-4">
              {fieldsToRender.map((field, index) => renderField(field, index, false))}
            </div>
          )}

          {/* Additional Fields Section - only show if there are additional fields */}
          {additionalFields.length > 0 && (
            <div className="w-full">
              <button
                type="button"
                onClick={() => setShowAdditionalFields(!showAdditionalFields)}
                className="w-full px-4 py-3 text-sm font-semibold text-[var(--primary-blue)] bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
              >
                <span>{showAdditionalFields ? 'Hide' : 'Additional To'}</span>
                <svg
                  className={`w-4 h-4 transition-transform ${showAdditionalFields ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showAdditionalFields && (
                <div className="flex flex-wrap gap-4 mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  {additionalFields.map((field, index) => renderField(field, index + fieldsToRender.length, true))}
                </div>
              )}
            </div>
          )}
        </>
      ) : null}

      {/* Help Text */}
      {!requirement.process_type && !isLoadingFields && (
        <p className="text-sm text-gray-500 italic">
          Select a process type to see relevant fields
        </p>
      )}
    </div>
  );
}
