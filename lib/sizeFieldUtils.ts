/**
 * Utilities for working with size fields from machine_variables
 */

import { getAllMachineVariables } from "./api";
import { normalizeProcessType } from "./processTypeConfig";

export interface SizeField {
  name: string;
  label: string;
  values: Set<string>; // Distinct values found in jobs
  isComposite?: boolean; // If true, this is part of a composite size (width x height)
  compositePartner?: string; // Name of the partner field (e.g., width -> height)
}

export interface CompositeSizeValue {
  width: string;
  height: string;
  display: string; // "3x3"
}

/**
 * Get size fields for a process type from machine_variables
 * Returns fields where is_size === true
 */
export async function getSizeFieldsForProcessType(
  processType: string,
  jobs?: any[] // Optional jobs to get distinct values
): Promise<SizeField[]> {
  try {
    const allVariables = await getAllMachineVariables();
    const normalizedProcessType = normalizeProcessType(processType);

    // Find the machine_variables record for this process type
    const processTypeRecord = allVariables.find((record: any) => {
      const recordType = normalizeProcessType(record.type || "");
      return recordType === normalizedProcessType;
    });

    if (!processTypeRecord || !processTypeRecord.variables) {
      return [];
    }

    const variables = processTypeRecord.variables;
    const sizeFields: SizeField[] = [];
    const compositeSizeMap = new Map<string, CompositeSizeValue[]>(); // For width x height combinations

    // First pass: identify composite size fields (width/height pairs)
    const widthFields: string[] = [];
    const heightFields: string[] = [];
    
    if (typeof variables === "object" && !Array.isArray(variables)) {
      Object.entries(variables).forEach(([fieldName, fieldConfig]: [string, any]) => {
        if (fieldConfig?.is_size === true) {
          if (fieldName.includes("_width") || fieldName.includes("width")) {
            widthFields.push(fieldName);
          } else if (fieldName.includes("_height") || fieldName.includes("height")) {
            heightFields.push(fieldName);
          }
        }
      });

      // Match width and height fields
      widthFields.forEach((widthField) => {
        const heightField = heightFields.find((h) => {
          const widthBase = widthField.replace(/_width|width/g, "");
          const heightBase = h.replace(/_height|height/g, "");
          return widthBase === heightBase;
        });

        if (heightField) {
          // This is a composite size field
          const compositeValues = new Map<string, CompositeSizeValue>();

          if (jobs && jobs.length > 0) {
            jobs.forEach((job) => {
              if (!job.requirements) return;

              job.requirements.forEach((req: any) => {
                if (!req.process_type) return;
                const reqProcessType = normalizeProcessType(req.process_type);
                if (reqProcessType !== normalizedProcessType) return;

                const widthValue = req[widthField];
                const heightValue = req[heightField];

                if (
                  widthValue !== undefined &&
                  widthValue !== null &&
                  widthValue !== "" &&
                  heightValue !== undefined &&
                  heightValue !== null &&
                  heightValue !== ""
                ) {
                  const widthStr = String(widthValue);
                  const heightStr = String(heightValue);
                  const compositeKey = `${widthStr}x${heightStr}`;

                  if (!compositeValues.has(compositeKey)) {
                    compositeValues.set(compositeKey, {
                      width: widthStr,
                      height: heightStr,
                      display: compositeKey,
                    });
                  }
                }
              });
            });
          }

          const widthLabel = variables[widthField]?.label || widthField.replace(/_/g, " ");
          const heightLabel = variables[heightField]?.label || heightField.replace(/_/g, " ");
          // Create a cleaner label - if both have same base, just show "Size"
          const baseWidth = widthField.replace(/_width|width/g, "");
          const baseHeight = heightField.replace(/_height|height/g, "");
          const compositeLabel = baseWidth === baseHeight 
            ? `${widthLabel.replace(/\s*width\s*/i, "").trim()} Size`
            : `${widthLabel} × ${heightLabel}`;

          sizeFields.push({
            name: `COMPOSITE_${widthField}_${heightField}`, // Combined name with prefix
            label: compositeLabel,
            values: new Set(Array.from(compositeValues.values()).map(v => v.display)),
            isComposite: true,
            compositePartner: heightField, // Store partner for reference
          });
        }
      });
    }

    // Second pass: handle non-composite size fields
    if (typeof variables === "object" && !Array.isArray(variables)) {
      Object.entries(variables).forEach(([fieldName, fieldConfig]: [string, any]) => {
        // Check if this field has is_size === true and is not part of a composite
        if (fieldConfig?.is_size === true) {
          const isWidth = fieldName.includes("_width") || fieldName.includes("width");
          const isHeight = fieldName.includes("_height") || fieldName.includes("height");
          
          // Skip if it's part of a composite we already handled
          if (isWidth || isHeight) {
            const baseName = fieldName.replace(/_width|_height|width|height/g, "");
            const hasPartner = (isWidth && heightFields.some(h => h.replace(/_height|height/g, "") === baseName)) ||
                              (isHeight && widthFields.some(w => w.replace(/_width|width/g, "") === baseName));
            if (hasPartner) {
              return; // Skip, already handled as composite
            }
          }

          const fieldLabel = fieldConfig?.label || fieldName.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase());
          const values = new Set<string>();

          // If jobs are provided, collect distinct values
          if (jobs && jobs.length > 0) {
            jobs.forEach((job) => {
              if (!job.requirements) return;

              job.requirements.forEach((req: any) => {
                if (!req.process_type) return;
                const reqProcessType = normalizeProcessType(req.process_type);
                if (reqProcessType !== normalizedProcessType) return;

                const value = req[fieldName];
                if (
                  value !== undefined &&
                  value !== null &&
                  value !== "" &&
                  value !== "undefined" &&
                  value !== "null"
                ) {
                  values.add(String(value));
                }
              });
            });
          }

          sizeFields.push({
            name: fieldName,
            label: fieldLabel,
            values,
          });
        }
      });
    }

    return sizeFields;
  } catch (error) {
    console.error("[getSizeFieldsForProcessType] Error:", error);
    return [];
  }
}

/**
 * Get all size fields for multiple process types (cached)
 */
const sizeFieldsCache = new Map<string, Promise<SizeField[]>>();

export async function getSizeFieldsForProcessTypeCached(
  processType: string,
  jobs?: any[]
): Promise<SizeField[]> {
  const cacheKey = `${processType}-${jobs?.length || 0}`;
  
  if (!sizeFieldsCache.has(cacheKey)) {
    sizeFieldsCache.set(cacheKey, getSizeFieldsForProcessType(processType, jobs));
  }

  return sizeFieldsCache.get(cacheKey)!;
}
