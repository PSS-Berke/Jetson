/**
 * Capability Schema Validation
 *
 * Validates machine capabilities against their process type schema
 * from the machine_variables table (single source of truth)
 */

import { getAllMachineVariables } from './api';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate machine capabilities against process type schema
 *
 * @param processTypeKey - The process type key (e.g., 'insert', 'fold')
 * @param capabilities - The capabilities object to validate
 * @param allVariables - Optional cached machine variables to avoid API call
 * @returns Validation result with errors and warnings
 */
export async function validateMachineCapabilities(
  processTypeKey: string,
  capabilities: Record<string, any>,
  allVariables?: any[],
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Fetch process type schema from database
    const variables = allVariables || (await getAllMachineVariables());
    const processType = variables.find((v) => v.type === processTypeKey);

    if (!processType) {
      return {
        valid: false,
        errors: [`Process type '${processTypeKey}' not found in database`],
        warnings: [],
      };
    }

    // If no variables defined for this process type, skip validation
    if (!processType.variables || typeof processType.variables !== 'object') {
      return {
        valid: true,
        errors: [],
        warnings: ['No schema defined for this process type'],
      };
    }

    // Get field definitions from process type
    const fieldDefinitions = processType.variables;

    // Validate required fields
    Object.entries(fieldDefinitions).forEach(([fieldName, fieldDef]: [string, any]) => {
      if (fieldDef.required) {
        const value = capabilities[fieldName];

        // Check if required field is missing or empty
        if (value === undefined || value === null || value === '') {
          errors.push(`Missing required field: ${fieldDef.label || fieldName}`);
        }
      }
    });

    // Validate field types
    Object.entries(capabilities).forEach(([fieldName, value]) => {
      const fieldDef = fieldDefinitions[fieldName];

      // Warn about orphaned fields (fields not in schema)
      if (!fieldDef) {
        warnings.push(
          `Field '${fieldName}' is not defined in the ${processTypeKey} schema. ` +
          `It may be from an older version or deprecated.`
        );
        return;
      }

      // Skip validation if value is null/undefined (already checked required fields)
      if (value === null || value === undefined) {
        return;
      }

      // Type-specific validation
      switch (fieldDef.type) {
        case 'number':
        case 'currency':
          if (typeof value !== 'number' && isNaN(Number(value))) {
            errors.push(
              `Invalid type for '${fieldDef.label || fieldName}': expected number, got ${typeof value}`
            );
          }
          break;

        case 'boolean':
          if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
            errors.push(
              `Invalid type for '${fieldDef.label || fieldName}': expected boolean, got ${typeof value}`
            );
          }
          break;

        case 'select':
          // Validate against allowed options
          if (fieldDef.options && Array.isArray(fieldDef.options)) {
            const stringValue = String(value);
            if (!fieldDef.options.includes(stringValue)) {
              errors.push(
                `Invalid value for '${fieldDef.label || fieldName}': '${stringValue}' is not in allowed options [${fieldDef.options.join(', ')}]`
              );
            }
          }
          break;

        case 'text':
          // Text fields accept any string value
          if (typeof value !== 'string' && typeof value !== 'number') {
            warnings.push(
              `Field '${fieldDef.label || fieldName}' expects text, got ${typeof value}`
            );
          }
          break;

        default:
          // Unknown field type
          warnings.push(
            `Unknown field type '${fieldDef.type}' for field '${fieldName}'`
          );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    console.error('[validateMachineCapabilities] Validation error:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Validation failed'],
      warnings: [],
    };
  }
}

/**
 * Validate job requirements against process type schema
 * Similar to machine capabilities but for job requirements
 *
 * @param requirements - Array of job requirements
 * @param allVariables - Optional cached machine variables
 * @returns Validation result
 */
export async function validateJobRequirements(
  requirements: Array<{ process_type: string; [key: string]: any }>,
  allVariables?: any[],
): Promise<ValidationResult> {
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  try {
    const variables = allVariables || (await getAllMachineVariables());

    // Validate each requirement
    for (const [index, requirement] of requirements.entries()) {
      const { process_type, ...capabilityValues } = requirement;

      if (!process_type) {
        allErrors.push(`Requirement #${index + 1}: Missing process_type`);
        continue;
      }

      // Validate this requirement's capabilities
      const validation = await validateMachineCapabilities(
        process_type,
        capabilityValues,
        variables,
      );

      // Add errors with requirement number prefix
      validation.errors.forEach(err => {
        allErrors.push(`Requirement #${index + 1} (${process_type}): ${err}`);
      });

      // Add warnings with requirement number prefix
      validation.warnings.forEach(warn => {
        allWarnings.push(`Requirement #${index + 1} (${process_type}): ${warn}`);
      });
    }

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
    };
  } catch (error) {
    console.error('[validateJobRequirements] Validation error:', error);
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Validation failed'],
      warnings: [],
    };
  }
}

/**
 * Get field schema for a specific process type
 * Useful for building dynamic forms
 *
 * @param processTypeKey - The process type key
 * @param allVariables - Optional cached machine variables
 * @returns Field definitions or null if not found
 */
export async function getProcessTypeSchema(
  processTypeKey: string,
  allVariables?: any[],
): Promise<Record<string, any> | null> {
  try {
    const variables = allVariables || (await getAllMachineVariables());
    const processType = variables.find((v) => v.type === processTypeKey);

    if (!processType || !processType.variables) {
      return null;
    }

    return processType.variables;
  } catch (error) {
    console.error('[getProcessTypeSchema] Error:', error);
    return null;
  }
}

/**
 * Check if a capability field is required
 *
 * @param processTypeKey - The process type key
 * @param fieldName - The field name to check
 * @param allVariables - Optional cached machine variables
 * @returns True if field is required, false otherwise
 */
export async function isFieldRequired(
  processTypeKey: string,
  fieldName: string,
  allVariables?: any[],
): Promise<boolean> {
  const schema = await getProcessTypeSchema(processTypeKey, allVariables);
  if (!schema || !schema[fieldName]) {
    return false;
  }
  return schema[fieldName].required === true;
}
