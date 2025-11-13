import * as XLSX from "xlsx";

/**
 * Represents a row parsed from an Excel file for production entry
 */
export interface ParsedExcelRow {
  jobNumber: number | string;
  quantity: number;
  date?: Date | number;
  notes?: string;
  rowIndex: number; // Original row number in Excel for error reporting
}

/**
 * Result of parsing an Excel file
 */
export interface ExcelParseResult {
  data: ParsedExcelRow[];
  errors: ExcelParseError[];
  warnings: ExcelParseWarning[];
}

/**
 * Error encountered during Excel parsing
 */
export interface ExcelParseError {
  rowIndex: number;
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Warning encountered during Excel parsing
 */
export interface ExcelParseWarning {
  rowIndex: number;
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Expected column names in the Excel file (case-insensitive)
 */
const EXPECTED_COLUMNS = {
  jobNumber: ["job number", "job_number", "jobnumber", "job #", "job"],
  quantity: ["production quantity", "quantity", "qty", "amount", "production"],
  date: ["date", "production date", "entry date"],
  notes: ["notes", "note", "comments", "comment", "description"],
};

/**
 * Parses an Excel file and extracts production entry data
 * @param file - The Excel file to parse
 * @returns Promise resolving to parsed data with errors and warnings
 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const result: ExcelParseResult = {
    data: [],
    errors: [],
    warnings: [],
  };

  try {
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();

    // Parse workbook
    const workbook = XLSX.read(arrayBuffer, {
      type: "array",
      cellDates: true, // Parse dates as Date objects
      cellNF: false,
      cellText: false,
    });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      result.errors.push({
        rowIndex: 0,
        field: "file",
        message: "Excel file contains no sheets",
      });
      return result;
    }

    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with header row
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Get raw array data first
      defval: null,
      blankrows: false,
    });

    if (rawData.length === 0) {
      result.errors.push({
        rowIndex: 0,
        field: "file",
        message: "Excel file is empty",
      });
      return result;
    }

    // Find header row (first non-empty row)
    const headerRow = rawData[0] as unknown[];
    if (!headerRow || headerRow.length === 0) {
      result.errors.push({
        rowIndex: 1,
        field: "headers",
        message: "Could not find header row",
      });
      return result;
    }

    // Map column indices
    const columnMap = mapColumns(headerRow);

    // Validate required columns exist
    if (columnMap.jobNumber === -1) {
      result.errors.push({
        rowIndex: 1,
        field: "headers",
        message: `Missing required column: Job Number. Expected one of: ${EXPECTED_COLUMNS.jobNumber.join(", ")}`,
      });
    }

    if (columnMap.quantity === -1) {
      result.errors.push({
        rowIndex: 1,
        field: "headers",
        message: `Missing required column: Quantity. Expected one of: ${EXPECTED_COLUMNS.quantity.join(", ")}`,
      });
    }

    // If missing required columns, stop parsing
    if (result.errors.length > 0) {
      return result;
    }

    // Parse data rows (skip header)
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i] as unknown[];
      const excelRowNumber = i + 1; // Excel rows are 1-indexed

      // Skip completely empty rows
      if (
        !row ||
        row.every((cell) => cell === null || cell === undefined || cell === "")
      ) {
        continue;
      }

      try {
        const parsedRow = parseRow(row, columnMap, excelRowNumber);
        result.data.push(parsedRow);
      } catch (error) {
        result.errors.push({
          rowIndex: excelRowNumber,
          field: "row",
          message:
            error instanceof Error
              ? error.message
              : "Unknown error parsing row",
        });
      }
    }

    // Add warning if no data rows found
    if (result.data.length === 0 && result.errors.length === 0) {
      result.warnings.push({
        rowIndex: 0,
        field: "file",
        message: "No data rows found in Excel file",
      });
    }
  } catch (error) {
    result.errors.push({
      rowIndex: 0,
      field: "file",
      message: `Failed to parse Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }

  return result;
}

/**
 * Maps column headers to indices
 */
function mapColumns(headerRow: unknown[]): {
  jobNumber: number;
  quantity: number;
  date: number;
  notes: number;
} {
  const columnMap = {
    jobNumber: -1,
    quantity: -1,
    date: -1,
    notes: -1,
  };

  headerRow.forEach((header, index) => {
    if (!header) return;

    const headerStr = String(header).toLowerCase().trim();

    // Match job number column
    if (
      columnMap.jobNumber === -1 &&
      EXPECTED_COLUMNS.jobNumber.some((col) => headerStr.includes(col))
    ) {
      columnMap.jobNumber = index;
    }

    // Match quantity column
    if (
      columnMap.quantity === -1 &&
      EXPECTED_COLUMNS.quantity.some((col) => headerStr.includes(col))
    ) {
      columnMap.quantity = index;
    }

    // Match date column
    if (
      columnMap.date === -1 &&
      EXPECTED_COLUMNS.date.some((col) => headerStr.includes(col))
    ) {
      columnMap.date = index;
    }

    // Match notes column
    if (
      columnMap.notes === -1 &&
      EXPECTED_COLUMNS.notes.some((col) => headerStr.includes(col))
    ) {
      columnMap.notes = index;
    }
  });

  return columnMap;
}

/**
 * Parses a single data row
 */
function parseRow(
  row: unknown[],
  columnMap: {
    jobNumber: number;
    quantity: number;
    date: number;
    notes: number;
  },
  rowIndex: number,
): ParsedExcelRow {
  const parsedRow: ParsedExcelRow = {
    jobNumber: "",
    quantity: 0,
    rowIndex,
  };

  // Parse job number (required)
  const jobNumberValue = row[columnMap.jobNumber];
  if (
    jobNumberValue === null ||
    jobNumberValue === undefined ||
    jobNumberValue === ""
  ) {
    throw new Error("Job number is required");
  }

  // Convert job number to string first to handle various formats
  let jobNumberStr = String(jobNumberValue).trim();

  // Handle Excel's automatic number formatting (e.g., "12345" might become 12345)
  // Remove any non-numeric characters except decimal point
  jobNumberStr = jobNumberStr.replace(/[^0-9.]/g, "");

  // Try to parse as number
  const jobNumberNum = parseFloat(jobNumberStr);
  if (isNaN(jobNumberNum)) {
    throw new Error(`Invalid job number: "${jobNumberValue}"`);
  }

  // Store as number if it's a whole number, otherwise as string
  parsedRow.jobNumber = Number.isInteger(jobNumberNum)
    ? Math.floor(jobNumberNum)
    : jobNumberStr;

  // Parse quantity (required)
  const quantityValue = row[columnMap.quantity];
  if (
    quantityValue === null ||
    quantityValue === undefined ||
    quantityValue === ""
  ) {
    throw new Error("Quantity is required");
  }

  const quantity = parseFloat(String(quantityValue));
  if (isNaN(quantity) || quantity < 0) {
    throw new Error(
      `Invalid quantity: "${quantityValue}". Must be a positive number`,
    );
  }

  parsedRow.quantity = quantity;

  // Parse date (optional)
  if (columnMap.date !== -1) {
    const dateValue = row[columnMap.date];
    if (dateValue !== null && dateValue !== undefined && dateValue !== "") {
      try {
        const parsedDate = parseExcelDate(dateValue);
        if (parsedDate) {
          parsedRow.date = parsedDate;
        }
      } catch {
        throw new Error(
          `Invalid date format: "${dateValue}". Expected: YYYY-MM-DD or MM/DD/YYYY`,
        );
      }
    }
  }

  // Parse notes (optional)
  if (columnMap.notes !== -1) {
    const notesValue = row[columnMap.notes];
    if (notesValue !== null && notesValue !== undefined && notesValue !== "") {
      parsedRow.notes = String(notesValue).trim();
    }
  }

  return parsedRow;
}

/**
 * Parses a date value from Excel
 * Handles both Date objects and various string formats
 */
function parseExcelDate(value: unknown): Date | number | null {
  // If it's already a Date object (from cellDates: true)
  if (value instanceof Date) {
    return value;
  }

  // If it's a number (Excel date serial number)
  if (typeof value === "number") {
    // Excel dates are days since 1900-01-01 (with a leap year bug)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(
      excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000,
    );
    return date;
  }

  // Try to parse string formats
  const dateStr = String(value).trim();

  // Try ISO format (YYYY-MM-DD)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    const date = new Date(
      parseInt(isoMatch[1]),
      parseInt(isoMatch[2]) - 1,
      parseInt(isoMatch[3]),
    );
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try US format (MM/DD/YYYY)
  const usMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const date = new Date(
      parseInt(usMatch[3]),
      parseInt(usMatch[1]) - 1,
      parseInt(usMatch[2]),
    );
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Try general Date parsing as last resort
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  throw new Error(`Could not parse date: "${value}"`);
}

/**
 * Validates file before parsing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (5MB)`,
    };
  }

  // Check file type
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv", // .csv
  ];

  const allowedExtensions = [".xlsx", ".xls", ".csv"];
  const fileExtension = file.name
    .toLowerCase()
    .substring(file.name.lastIndexOf("."));

  if (
    !allowedTypes.includes(file.type) &&
    !allowedExtensions.includes(fileExtension)
  ) {
    return {
      valid: false,
      error: `Invalid file type. Please upload an Excel file (.xlsx, .xls) or CSV file (.csv)`,
    };
  }

  return { valid: true };
}
