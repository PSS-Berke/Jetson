import * as XLSX from "xlsx";
import { getAllMachineVariables } from "./api";
import { normalizeProcessType, getSourceTypesForProcessType } from "./processTypeConfig";

export interface ParsedJobRequirement {
  process_type: string;
  price_per_m: number;
  // Insert fields
  paper_size?: string;
  pockets?: number;
  // Sort fields
  sort_type?: string;
  // Inkjet fields
  print_coverage?: string;
  num_addresses?: number;
  // Label/Apply fields
  application_type?: string;
  label_size?: string;
  // Fold fields
  fold_type?: string;
  paper_stock?: string;
  // Laser/HP Press fields
  print_type?: string;
  color?: string;
  // Additional fields
  read_write?: string;
  affix?: string;
  glue_closed?: string;
  stamps?: string;
  // Dynamic fields - allow any additional fields from machine_variables
  [key: string]: string | number | boolean | undefined;
}

// Field definition from machine_variables API
interface MachineVariableField {
  name: string;
  type: "text" | "number" | "integer" | "boolean" | "select" | "dropdown" | "currency";
  label: string;
  required?: boolean;
  options?: string[];
  value?: any;
}

// Column mapping result
interface ColumnMapping {
  csvColumnName: string;
  field: MachineVariableField;
}

export interface ParsedBulkJob {
  row: number; // Original row number for error reporting
  job_number: string;
  sub_client: string; // Will be mapped to client in UI
  client?: string; // Optional parent client captured from CSV
  quantity: number;
  schedule_type?: string; // "Hard Schedule" or "Soft Schedule"
  facility?: string; // "Bolingbrook" or "Lemont"
  name?: string; // Job name
  description?: string;
  start_date?: Date;
  end_date?: Date;
  process_types: string[]; // Array of process types (comma-separated in CSV)
  requirements: ParsedJobRequirement[]; // One per process type
  errors: string[];
  warnings: string[];
}

export interface SkippedRow {
  row: number;
  reason: string;
  data?: any; // Optional: store some data for debugging
}

export interface JobCsvParseResult {
  jobs: ParsedBulkJob[];
  errors: string[]; // Global errors
  warnings: string[]; // Global warnings
  subClients: string[]; // Unique list of sub-clients for mapping
  fieldMappings?: Map<string, { csvColumn: string; fieldName: string; fieldType: string }[]>; // Column mappings by process type
  skippedRows: SkippedRow[]; // Rows that were skipped during parsing
}

// Column name aliases for flexible matching
const COLUMN_ALIASES: Record<string, string[]> = {
  schedule_type: ["schedule_type", "schedule type", "schedule", "type"],
  facility: ["facility", "facilities", "location", "plant"],
  job_number: ["job_number", "job number", "job#", "job_no", "jobnumber"],
  client: ["client", "customer"], // Main client name
  sub_client: ["sub_client", "sub client", "subclient"], // Sub-client name (removed 'client' to avoid conflict)
  name: ["name", "job name", "job_name", "title"],
  description: ["description", "desc", "job description", "job_description"],
  quantity: ["quantity", "qty", "pieces", "count"],
  start_date: ["start_date", "start date", "start", "begin_date"],
  end_date: ["end_date", "end date", "due_date", "due date", "end"],
  process_type: [
    "process_type",
    "process type",
    "process",
    "service_type",
    "service type",
    "service",
  ],
  price_per_m: [
    "price_per_m",
    "price per m",
    "price",
    "rate",
    "price_per_thousand",
  ],
  paper_size: ["paper_size", "paper size", "size", "envelope", "basic_oe", "basic oe"],
  pockets: ["pockets", "inserts", "pieces"],
  sort_type: ["sort_type", "sort type", "sort"],
  print_coverage: [
    "print_coverage",
    "print coverage",
    "coverage",
    "color_type",
  ],
  num_addresses: ["num_addresses", "number of addresses", "addresses"],
  application_type: ["application_type", "application type", "application", "item_type", "item type", "affix_type", "affix type"],
  label_size: ["label_size", "label size", "label", "affix_label", "affix label", "affix lable"],
  fold_type: ["fold_type", "fold type", "fold"],
  paper_stock: ["paper_stock", "paper stock", "stock", "paper_type"],
  print_type: ["print_type", "print type", "printing"],
  color: ["color", "colour", "print_color"],
  read_write: ["read_write", "read write", "read/write", "rw", "r/w"],
  affix: ["affix"],
  glue_closed: ["glue_closed", "glue closed", "glue"],
  stamps: ["stamps", "stamp"],
};

/**
 * Find column value by checking multiple possible column name aliases
 */
function findColumnValue(row: any, fieldName: string): any {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];

  for (const alias of aliases) {
    // Check exact match (case-insensitive, trimmed, normalized spaces)
    for (const key in row) {
      const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, " ");
      const normalizedAlias = alias.toLowerCase().trim().replace(/\s+/g, " ");
      if (normalizedKey === normalizedAlias) {
        return row[key]; // Return the value even if empty - let caller decide what to do
      }
    }
  }

  return undefined;
}

/**
 * Fetch field definitions for the given process types
 */
async function fetchFieldDefinitionsForProcessTypes(
  processTypes: string[]
): Promise<Map<string, MachineVariableField[]>> {
  const fieldsByProcessType = new Map<string, MachineVariableField[]>();

  try {
    console.log("[CSV Parser] Fetching field definitions for process types:", processTypes);

    const allVariables = await getAllMachineVariables();

    for (const processType of processTypes) {
      const normalized = normalizeProcessType(processType);
      const sourceTypes = getSourceTypesForProcessType(normalized);

      console.log(`[CSV Parser] Process type "${processType}" -> normalized: "${normalized}", source types:`, sourceTypes);

      // Filter records by source types
      const matchingRecords = allVariables.filter((group: any) =>
        sourceTypes.includes(group.type)
      );

      // Merge variables from all matching records
      const mergedVariables: Record<string, any> = {};
      matchingRecords.forEach((record: any) => {
        if (record.variables && typeof record.variables === "object") {
          Object.entries(record.variables).forEach(([varName, varConfig]) => {
            mergedVariables[varName] = varConfig;
          });
        }
      });

      // Convert to field definitions array
      const fields: MachineVariableField[] = Object.entries(mergedVariables)
        .filter(([_, varConfig]: [string, any]) => varConfig.addToJobInput === true)
        .map(([varName, varConfig]: [string, any]) => ({
          name: varName,
          type: varConfig.type === "select" ? "dropdown" : varConfig.type,
          label: varConfig.label || varName,
          required: varConfig.required || false,
          options: varConfig.options,
          value: varConfig.value,
        }));

      fieldsByProcessType.set(processType, fields);
      console.log(`[CSV Parser] Found ${fields.length} fields for "${processType}"`);
    }
  } catch (error) {
    console.error("[CSV Parser] Error fetching field definitions:", error);
  }

  return fieldsByProcessType;
}

/**
 * Build column-to-field mapping for CSV headers
 */
function buildColumnMapping(
  csvHeaders: string[],
  fieldDefinitions: MachineVariableField[]
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];
  const processedColumns = new Set<string>();

  console.log("[CSV Parser] Building column mapping for headers:", csvHeaders);
  console.log("[CSV Parser] Available fields:", fieldDefinitions.map(f => `${f.name} (${f.label})`));

  for (const header of csvHeaders) {
    // Skip if already processed or if it's a standard column
    if (processedColumns.has(header)) continue;

    // Skip completely empty headers
    if (!header || header.trim() === "") {
      console.log(`[CSV Parser] Skipping empty header`);
      processedColumns.add(header);
      continue;
    }

    // Check if this matches an existing alias (standard field)
    const isStandardField = Object.keys(COLUMN_ALIASES).some(fieldName => {
      const aliases = COLUMN_ALIASES[fieldName];
      return aliases.some(alias => {
        const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, " ");
        const normalizedAlias = alias.toLowerCase().trim().replace(/\s+/g, " ");
        return normalizedHeader === normalizedAlias;
      });
    });

    if (isStandardField) {
      console.log(`[CSV Parser] Skipping standard field: "${header}"`);
      processedColumns.add(header);
      continue;
    }

    // Try to match against field definitions
    const normalizedHeader = header.toLowerCase().trim().replace(/\s+/g, " ");

    console.log(`[CSV Parser] Trying to match header: "${header}" (normalized: "${normalizedHeader}")`);

    // Try exact match on field name first
    let matchedField = fieldDefinitions.find(f => {
      const normalizedFieldName = f.name.toLowerCase().trim().replace(/\s+/g, " ");
      console.log(`  - Comparing with field name: "${f.name}" (normalized: "${normalizedFieldName}")`);
      return normalizedFieldName === normalizedHeader;
    });

    // Try match on field label if no name match
    if (!matchedField) {
      matchedField = fieldDefinitions.find(f => {
        const normalizedFieldLabel = f.label.toLowerCase().trim().replace(/\s+/g, " ");
        console.log(`  - Comparing with field label: "${f.label}" (normalized: "${normalizedFieldLabel}")`);
        return normalizedFieldLabel === normalizedHeader;
      });
    }

    if (matchedField) {
      mappings.push({
        csvColumnName: header,
        field: matchedField,
      });
      processedColumns.add(header);
      console.log(`[CSV Parser] ✓ Mapped column "${header}" -> field "${matchedField.name}" (${matchedField.type})`);
    } else {
      console.log(`[CSV Parser] ✗ No mapping found for column: "${header}"`);
    }
  }

  return mappings;
}

/**
 * Convert CSV value to appropriate type based on field definition
 */
function convertFieldValue(
  value: any,
  field: MachineVariableField
): string | number | boolean | undefined {
  // Handle empty values
  if (value === undefined || value === null || String(value).trim() === "") {
    return undefined;
  }

  const valueStr = String(value).trim();

  switch (field.type) {
    case "boolean":
      // Convert "yes"/"no" and other boolean representations
      const lowerValue = valueStr.toLowerCase();
      if (lowerValue === "yes" || lowerValue === "true" || lowerValue === "1") {
        return "true"; // Store as string to match DynamicRequirementFields format
      } else if (lowerValue === "no" || lowerValue === "false" || lowerValue === "0") {
        return "false";
      }
      return undefined; // Invalid boolean value

    case "number":
    case "currency":
      const numValue = parseFloat(valueStr.replace(/,/g, ""));
      return isNaN(numValue) ? undefined : numValue;

    case "integer":
      const intValue = parseInt(valueStr.replace(/,/g, ""), 10);
      return isNaN(intValue) ? undefined : intValue;

    case "dropdown":
    case "select":
      // Validate against options if provided
      if (field.options && field.options.length > 0) {
        console.log(`[CSV Parser] Dropdown validation for field "${field.name}":`, {
          value: valueStr,
          options: field.options,
          optionsCount: field.options.length
        });

        // Helper function to normalize strings - removes invisible characters and extra whitespace
        const normalizeForMatch = (str: string) => {
          return str
            .toLowerCase()
            .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width chars
            .replace(/\s+/g, ' ') // Normalize whitespace
            .trim();
        };

        const normalizedValue = normalizeForMatch(valueStr);

        // Try to find a matching option
        const matchedOption = field.options.find(opt => {
          const normalizedOpt = normalizeForMatch(opt);
          return normalizedOpt === normalizedValue;
        });

        if (matchedOption) {
          console.log(`[CSV Parser] ✓ Matched "${valueStr}" to option "${matchedOption}"`);
          return matchedOption;
        } else {
          console.log(`[CSV Parser] ✗ Value "${valueStr}" not found in options:`, field.options);
          return undefined; // Return undefined if not in options
        }
      }
      console.log(`[CSV Parser] No options validation for "${field.name}", returning value as-is`);
      return valueStr;

    case "text":
    default:
      return valueStr;
  }
}

/**
 * Parse a date string flexibly
 */
function parseDate(dateStr: any): Date | undefined {
  if (!dateStr) return undefined;

  // If it's already a date
  if (dateStr instanceof Date) return dateStr;

  // If it's a number (Excel serial date)
  if (typeof dateStr === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
  }

  // Try parsing as string
  const str = String(dateStr).trim();
  if (!str) return undefined;

  // Handle date ranges - take the first date (e.g., "10/29-10/31" -> "10/29")
  // Also handle formats like "10/29/25", "now 10/9", "rolls in 9/24 AM"
  let cleanStr = str;

  // Remove text prefixes like "now", "rolls in", "data", "PU", "drop 1 -", "mat in", etc.
  cleanStr = cleanStr.replace(
    /^(now|data|rolls in|mat in|arrives folded|in folded|p\/?u|pickup|drop \d+ -?)\s+/i,
    "",
  );

  // Handle comma-separated dates - take the first one (e.g., "10/2,10/9" -> "10/2")
  if (cleanStr.includes(",")) {
    const firstDate = cleanStr.split(",")[0].trim();
    cleanStr = firstDate;
  }

  // Extract just the date portion before any range or additional text
  // Match patterns like "10/29", "10/29/25", "10/29/2025"
  const dateMatch = cleanStr.match(/(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  if (dateMatch) {
    cleanStr = dateMatch[1];
  } else {
    // No valid date pattern found
    return undefined;
  }

  // If no year specified, assume 2025 (or current year)
  if (cleanStr.match(/^\d{1,2}\/\d{1,2}$/)) {
    cleanStr += "/2025";
  }

  // Try standard date parse
  const parsed = new Date(cleanStr);
  if (!isNaN(parsed.getTime())) return parsed;

  return undefined;
}

/**
 * Parse facility name to ID
 */
function parseFacility(facilityStr: any): number {
  if (!facilityStr) return 1; // Default to Bolingbrook

  const str = String(facilityStr).toLowerCase().trim();

  if (str.includes("lemont") || str.includes("shakopee") || str === "2") {
    return 2;
  }

  return 1; // Bolingbrook, B2, or anything else defaults to 1
}

/**
 * Parse schedule type to confirmed flag
 */
function parseScheduleType(scheduleStr: any): boolean {
  if (!scheduleStr) return false; // Default to soft schedule

  const str = String(scheduleStr).toLowerCase().trim();

  return str.includes("hard");
}

/**
 * Determine if a CSV row indicates sorting is required
 */
function hasSortRequirement(value: any): boolean {
  if (value === undefined || value === null) return false;

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const str = String(value).trim();
  if (!str) return false;

  const normalized = str.toLowerCase();
  const falsyValues = ["false", "no", "n", "0", "none", "na"];

  return !falsyValues.includes(normalized);
}

/**
 * Validate dynamic field values against field definitions
 */
function validateDynamicFields(
  requirement: ParsedJobRequirement,
  fieldDefinitions: MachineVariableField[],
  row: number
): string[] {
  const errors: string[] = [];

  fieldDefinitions.forEach((field) => {
    const value = requirement[field.name];

    // Check required fields (skip price_per_m - it's always optional for bulk upload)
    if (field.name !== "price_per_m" && field.required && (value === undefined || value === null || value === "")) {
      errors.push(`Row ${row}: ${field.label} is required`);
    }

    // Validate dropdown options
    if (value !== undefined && value !== null && value !== "" &&
        (field.type === "dropdown" || field.type === "select") &&
        field.options && field.options.length > 0) {
      const valueStr = String(value);
      const isValid = field.options.some(
        opt => opt.toLowerCase() === valueStr.toLowerCase()
      );
      if (!isValid) {
        errors.push(
          `Row ${row}: Invalid value "${valueStr}" for ${field.label}. Must be one of: ${field.options.join(", ")}`
        );
      }
    }
  });

  return errors;
}

/**
 * Validate process-type-specific fields (legacy validation - DISABLED)
 * All validation is now done through dynamic field validation from machine_variables
 */
function validateRequirementFields(
  processType: string,
  requirement: ParsedJobRequirement,
  row: number,
): string[] {
  // Disabled hardcoded validation - use dynamic field validation instead
  // This ensures validation is based on machine_variables configuration
  return [];
}

/**
 * Parse Excel/CSV file and return structured job data
 */
export function parseJobCsv(file: File): Promise<JobCsvParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });

        // Get first sheet (assuming data is in first sheet or "Jobs" sheet)
        const sheetName =
          workbook.SheetNames.find(
            (name) =>
              name.toLowerCase() === "jobs" || name.toLowerCase() === "data",
          ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];

        // First, try to parse and detect if the first row is empty (all __EMPTY columns)
        let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        // Check if first row columns are all __EMPTY (indicating an empty header row)
        if (jsonData.length > 0 && jsonData[0]) {
          const firstRowKeys = Object.keys(jsonData[0] as object);
          const allEmpty = firstRowKeys.every((key) =>
            key.startsWith("__EMPTY"),
          );

          if (allEmpty) {
            console.log(
              "[CSV Parser] Detected empty first row, re-parsing with range starting from row 2",
            );
            // Re-parse starting from row 2 (skip the empty row)
            jsonData = XLSX.utils.sheet_to_json(worksheet, {
              defval: "",
              range: 1,
            });
          }
        }

        console.log("[CSV Parser] Total rows:", jsonData.length);
        const firstRowKeys = jsonData[0] ? Object.keys(jsonData[0]) : [];
        console.log("[CSV Parser] First row columns:", firstRowKeys);
        console.log(
          "[CSV Parser] Column names with quotes:",
          firstRowKeys.map((k) => `"${k}"`),
        );
        if (jsonData[0]) {
          console.log("[CSV Parser] First row sample data:", jsonData[0]);
        }

        // Phase 1: Scan for unique process types
        const processTypesSet = new Set<string>();
        jsonData.forEach((row: any) => {
          const processTypeRaw = findColumnValue(row, "process_type");
          if (processTypeRaw) {
            const processTypes = String(processTypeRaw)
              .split(",")
              .map((pt) => pt.trim().toLowerCase())
              .filter((pt) => pt);
            processTypes.forEach((pt) => processTypesSet.add(pt));
          }

          const sortValueRaw = findColumnValue(row, "sort_type");
          if (hasSortRequirement(sortValueRaw)) {
            processTypesSet.add("sort");
          }
        });

        const uniqueProcessTypes = Array.from(processTypesSet);
        console.log("[CSV Parser] Unique process types found:", uniqueProcessTypes);

        // Phase 2: Fetch field definitions for all process types
        const fieldsByProcessType = await fetchFieldDefinitionsForProcessTypes(uniqueProcessTypes);

        // Phase 3: Build column mappings for each process type
        const columnMappingsByProcessType = new Map<string, ColumnMapping[]>();
        uniqueProcessTypes.forEach((processType) => {
          const fields = fieldsByProcessType.get(processType) || [];
          const mappings = buildColumnMapping(firstRowKeys, fields);
          columnMappingsByProcessType.set(processType, mappings);
          console.log(`[CSV Parser] Created ${mappings.length} column mappings for "${processType}"`);
        });

        const jobs: ParsedBulkJob[] = [];
        const globalErrors: string[] = [];
        const globalWarnings: string[] = [];
        const subClientsSet = new Set<string>();
        const skippedRows: SkippedRow[] = [];

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +2 because Excel rows are 1-indexed and header is row 1
          const errors: string[] = [];
          const warnings: string[] = [];

          // Extract required fields
          const jobNumberRaw = findColumnValue(row, "job_number");
          const quantityRaw = findColumnValue(row, "quantity");
          const processTypeRaw = findColumnValue(row, "process_type");
          const pricePerMRaw = findColumnValue(row, "price_per_m");

          // Convert to strings for checking
          const jobNumberStr = String(jobNumberRaw || "")
            .trim()
            .toLowerCase();
          const quantityStr = String(quantityRaw || "").trim();

          // Debug first few rows
          if (index < 3) {
            console.log(`[CSV Parser] Row ${rowNum}:`, {
              allColumns: Object.keys(row),
              jobNumberRaw,
              quantityRaw,
              jobNumberStr,
              quantityStr,
              fullRow: row,
            });
          }

          // Skip completely empty rows (no job number AND no quantity AND no client)
          const anyClientRaw =
            findColumnValue(row, "sub_client") ||
            findColumnValue(row, "client");
          const anyClientStr = String(anyClientRaw || "").trim();

          if (!jobNumberStr && !quantityStr && !anyClientStr) {
            console.log(`[CSV Parser] Skipping empty row ${rowNum}`);
            skippedRows.push({
              row: rowNum,
              reason: "Empty row (no job number, quantity, or client)",
              data: { jobNumberStr, quantityStr, anyClientStr }
            });
            return; // Skip this row entirely
          }

          // Skip rows with placeholder job numbers (but still has some data)
          if (
            (jobNumberStr === "tbd" || jobNumberStr === "n/a") &&
            quantityStr
          ) {
            console.log(
              `[CSV Parser] Skipping placeholder row ${rowNum}: ${jobNumberStr}`,
            );
            skippedRows.push({
              row: rowNum,
              reason: `Placeholder job number: "${jobNumberStr}"`,
              data: { jobNumber: jobNumberStr, quantity: quantityStr }
            });
            // Has quantity but job number is placeholder - skip
            return;
          }

          // Validate required fields (only quantity is truly required now)
          if (!jobNumberRaw || jobNumberStr === "") {
            warnings.push(`No job_number specified - will need to add later`);
          }
          if (!quantityRaw || quantityStr === "") {
            errors.push(`Missing quantity - required field`);
          }
          // Process type and price are now optional - warn instead of error
          if (!processTypeRaw) {
            warnings.push(`No process_type specified - will need to add later`);
          }
          if (!pricePerMRaw) {
            warnings.push(`No price_per_m specified - will default to 0`);
          }

          // Parse values - handle alphanumeric job numbers
          let job_number: string;
          if (jobNumberRaw && jobNumberStr) {
            const jobNumStr = String(jobNumberRaw).replace(/,/g, "").trim();
            // Keep the full alphanumeric job number (e.g., "60468-2", "COSTCO IJ", "12345")
            if (jobNumStr) {
              job_number = jobNumStr;
            } else {
              job_number = "";
              errors.push(`Invalid job_number format: '${jobNumberRaw}'`);
            }
          } else {
            // No job number provided - use empty string as placeholder
            job_number = "";
          }

          const quantity = parseInt(String(quantityRaw).replace(/,/g, ""));
          const price_per_m = pricePerMRaw
            ? parseFloat(String(pricePerMRaw).replace(/,/g, ""))
            : 0;

          // Validate parsed values
          if (isNaN(quantity) || quantity <= 0) {
            errors.push(`Invalid quantity: '${quantityRaw}'`);
          }
          if (price_per_m < 0) {
            errors.push(`Invalid price_per_m: '${pricePerMRaw}'`);
          }

          // Parse process types (can be comma-separated) - now optional
          let process_types = processTypeRaw
            ? String(processTypeRaw)
                .split(",")
                .map((pt) => pt.trim().toLowerCase())
                .filter((pt) => pt)
            : [];
          process_types = Array.from(new Set(process_types));

          // Extract optional fields
          // Try to get client name from either 'sub_client' or 'client' column (prefer sub_client if both exist)
          const subClientRaw = String(
            findColumnValue(row, "sub_client") || "",
          ).trim();
          const clientRaw = String(findColumnValue(row, "client") || "").trim();
          const sub_client = subClientRaw || clientRaw; // Use sub_client if present, otherwise fall back to client
          const client = clientRaw || undefined;

          const name = String(
            findColumnValue(row, "name") || "",
          ).trim();
          const description = String(
            findColumnValue(row, "description") || "",
          ).trim();
          const schedule_type = findColumnValue(row, "schedule_type");
          const facility = findColumnValue(row, "facility");
          const start_date = parseDate(findColumnValue(row, "start_date"));
          const end_date = parseDate(findColumnValue(row, "end_date"));

          // Add sub-client to set if present
          if (sub_client) {
            subClientsSet.add(sub_client);
          } else {
            warnings.push(`No client specified - will need to assign a client`);
          }

          // Extract process-specific fields
          const paper_size =
            String(findColumnValue(row, "paper_size") || "").trim() ||
            undefined;
          const pocketsRaw = findColumnValue(row, "pockets");
          const pockets = pocketsRaw ? parseInt(String(pocketsRaw)) : undefined;
          const sortValueRaw = findColumnValue(row, "sort_type");
          const sortValueString =
            sortValueRaw === undefined || sortValueRaw === null
              ? ""
              : String(sortValueRaw).trim();
          const sortRequired = hasSortRequirement(sortValueRaw);
          const sort_type = sortRequired
            ? sortValueString || "TRUE"
            : undefined;

          if (sortRequired && !process_types.includes("sort")) {
            process_types.push("sort");
          }
          const print_coverage =
            String(findColumnValue(row, "print_coverage") || "").trim() ||
            undefined;
          const num_addressesRaw = findColumnValue(row, "num_addresses");
          const num_addresses = num_addressesRaw
            ? parseInt(String(num_addressesRaw).replace(/,/g, ""))
            : undefined;
          const application_type =
            String(findColumnValue(row, "application_type") || "").trim() ||
            undefined;
          const label_size =
            String(findColumnValue(row, "label_size") || "").trim() ||
            undefined;
          const fold_type =
            String(findColumnValue(row, "fold_type") || "").trim() || undefined;
          const paper_stock =
            String(findColumnValue(row, "paper_stock") || "").trim() ||
            undefined;
          const print_type =
            String(findColumnValue(row, "print_type") || "").trim() ||
            undefined;
          const color =
            String(findColumnValue(row, "color") || "").trim() || undefined;
          const read_write =
            String(findColumnValue(row, "read_write") || "").trim() || undefined;
          const affix =
            String(findColumnValue(row, "affix") || "").trim() || undefined;
          const glue_closed =
            String(findColumnValue(row, "glue_closed") || "").trim() || undefined;
          const stamps =
            String(findColumnValue(row, "stamps") || "").trim() || undefined;

          // Build requirements array (one per process type) - or empty if no process types
          const requirements: ParsedJobRequirement[] =
            process_types.length > 0
              ? process_types.map((pt) => {
                  const requirementPrice = pt === "sort" ? 0 : price_per_m;
                  const req: ParsedJobRequirement = {
                    process_type: pt,
                    price_per_m: requirementPrice,
                  };

                  // Add standard process-specific fields (for backward compatibility)
                  if (paper_size) req.paper_size = paper_size;
                  if (pockets !== undefined) req.pockets = pockets;
                  if (sort_type) req.sort_type = sort_type;
                  if (print_coverage) req.print_coverage = print_coverage;
                  if (num_addresses !== undefined)
                    req.num_addresses = num_addresses;
                  if (application_type) req.application_type = application_type;
                  if (label_size) req.label_size = label_size;
                  if (fold_type) req.fold_type = fold_type;
                  if (paper_stock) req.paper_stock = paper_stock;
                  if (print_type) req.print_type = print_type;
                  if (color) req.color = color;
                  if (read_write) req.read_write = read_write;
                  if (affix) req.affix = affix;
                  if (glue_closed) req.glue_closed = glue_closed;
                  if (stamps) req.stamps = stamps;

                  // Add dynamic fields from column mappings
                  const columnMappings = columnMappingsByProcessType.get(pt) || [];
                  console.log(`[CSV Parser] Row ${rowNum}: Processing ${columnMappings.length} dynamic field mappings for process "${pt}"`);

                  columnMappings.forEach((mapping) => {
                    const rawValue = row[mapping.csvColumnName];
                    console.log(`[CSV Parser] Row ${rowNum}: Processing column "${mapping.csvColumnName}", raw value: "${rawValue}", field type: ${mapping.field.type}`);

                    const convertedValue = convertFieldValue(rawValue, mapping.field);

                    if (convertedValue !== undefined) {
                      req[mapping.field.name] = convertedValue;
                      console.log(
                        `[CSV Parser] Row ${rowNum}: ✓ Mapped "${mapping.csvColumnName}" -> "${mapping.field.name}" = ${JSON.stringify(convertedValue)}`
                      );
                    } else {
                      console.log(
                        `[CSV Parser] Row ${rowNum}: ✗ Skipped "${mapping.csvColumnName}" (empty or undefined value)`
                      );
                    }
                  });

                  // Validate standard requirement fields (legacy validation)
                  const reqErrors = validateRequirementFields(pt, req, rowNum);
                  const cleanErrors = reqErrors.map((err) =>
                    err.replace(`Row ${rowNum}: `, ""),
                  );
                  errors.push(...cleanErrors);

                  // Validate dynamic fields
                  const fieldDefinitions = fieldsByProcessType.get(pt) || [];
                  const dynamicErrors = validateDynamicFields(req, fieldDefinitions, rowNum);
                  const cleanDynamicErrors = dynamicErrors.map((err) =>
                    err.replace(`Row ${rowNum}: `, ""),
                  );
                  errors.push(...cleanDynamicErrors);

                  return req;
                })
              : []; // Empty array if no process types - user can add later

          // Create parsed job object
          const parsedJob: ParsedBulkJob = {
            row: rowNum,
            job_number,
            sub_client,
            client,
            quantity,
            schedule_type: schedule_type ? String(schedule_type) : undefined,
            facility: facility ? String(facility) : undefined,
            name: name || undefined,
            description: description || undefined,
            start_date,
            end_date,
            process_types,
            requirements,
            errors,
            warnings,
          };

          jobs.push(parsedJob);
        });

        // Check for duplicate job numbers
        const jobNumbers = new Set<string>();
        jobs.forEach((job) => {
          if (jobNumbers.has(job.job_number)) {
            globalWarnings.push(`Duplicate job_number ${job.job_number} found`);
          }
          jobNumbers.add(job.job_number);
        });

        console.log("[CSV Parser] Parsed jobs:", jobs.length);
        console.log(
          "[CSV Parser] Sub-clients found:",
          Array.from(subClientsSet),
        );
        console.log("[CSV Parser] Global errors:", globalErrors);

        // Convert field mappings to serializable format for logging
        const serializableMappings = new Map<string, { csvColumn: string; fieldName: string; fieldType: string }[]>();
        columnMappingsByProcessType.forEach((mappings, processType) => {
          serializableMappings.set(
            processType,
            mappings.map(m => ({
              csvColumn: m.csvColumnName,
              fieldName: m.field.name,
              fieldType: m.field.type,
            }))
          );
        });

        console.log("[CSV Parser] Field mappings by process type:",
          Array.from(serializableMappings.entries()).map(([pt, mappings]) =>
            `${pt}: ${mappings.length} fields`
          ).join(", ")
        );

        resolve({
          jobs,
          errors: globalErrors,
          warnings: globalWarnings,
          subClients: Array.from(subClientsSet).sort(),
          fieldMappings: serializableMappings,
          skippedRows,
        });
      } catch (error) {
        reject(
          new Error(
            `Failed to parse file: ${error instanceof Error ? error.message : "Unknown error"}`,
          ),
        );
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsBinaryString(file);
  });
}
