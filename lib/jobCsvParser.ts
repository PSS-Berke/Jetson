import * as XLSX from 'xlsx';

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
}

export interface ParsedBulkJob {
  row: number; // Original row number for error reporting
  job_number: number;
  sub_client: string; // Will be mapped to client in UI
  quantity: number;
  schedule_type?: string; // "Hard Schedule" or "Soft Schedule"
  facility?: string; // "Bolingbrook" or "Lemont"
  description?: string;
  start_date?: Date;
  end_date?: Date;
  process_types: string[]; // Array of process types (comma-separated in CSV)
  requirements: ParsedJobRequirement[]; // One per process type
  errors: string[];
  warnings: string[];
}

export interface JobCsvParseResult {
  jobs: ParsedBulkJob[];
  errors: string[]; // Global errors
  warnings: string[]; // Global warnings
  subClients: string[]; // Unique list of sub-clients for mapping
}

// Column name aliases for flexible matching
const COLUMN_ALIASES: Record<string, string[]> = {
  schedule_type: ['schedule_type', 'schedule type', 'schedule', 'type'],
  facility: ['facility', 'facilities', 'location', 'plant'],
  job_number: ['job_number', 'job number', 'job#', 'job_no', 'jobnumber'],
  client: ['client', 'customer'], // Main client name
  sub_client: ['sub_client', 'sub client', 'subclient'], // Sub-client name (removed 'client' to avoid conflict)
  description: ['description', 'desc', 'job description', 'job_description'],
  quantity: ['quantity', 'qty', 'pieces', 'count'],
  start_date: ['start_date', 'start date', 'start', 'begin_date'],
  end_date: ['end_date', 'end date', 'due_date', 'due date', 'end'],
  process_type: ['process_type', 'process type', 'process', 'service_type', 'service type', 'service'],
  price_per_m: ['price_per_m', 'price per m', 'price', 'rate', 'price_per_thousand'],
  paper_size: ['paper_size', 'paper size', 'size', 'envelope'],
  pockets: ['pockets', 'inserts', 'pieces'],
  sort_type: ['sort_type', 'sort type', 'sort'],
  print_coverage: ['print_coverage', 'print coverage', 'coverage', 'color_type'],
  num_addresses: ['num_addresses', 'number of addresses', 'addresses'],
  application_type: ['application_type', 'application type', 'application'],
  label_size: ['label_size', 'label size', 'label'],
  fold_type: ['fold_type', 'fold type', 'fold'],
  paper_stock: ['paper_stock', 'paper stock', 'stock', 'paper_type'],
  print_type: ['print_type', 'print type', 'printing'],
  color: ['color', 'colour', 'print_color'],
};

/**
 * Find column value by checking multiple possible column name aliases
 */
function findColumnValue(row: any, fieldName: string): any {
  const aliases = COLUMN_ALIASES[fieldName] || [fieldName];

  for (const alias of aliases) {
    // Check exact match (case-insensitive, trimmed, normalized spaces)
    for (const key in row) {
      const normalizedKey = key.toLowerCase().trim().replace(/\s+/g, ' ');
      const normalizedAlias = alias.toLowerCase().trim().replace(/\s+/g, ' ');
      if (normalizedKey === normalizedAlias) {
        return row[key]; // Return the value even if empty - let caller decide what to do
      }
    }
  }

  return undefined;
}

/**
 * Parse a date string flexibly
 */
function parseDate(dateStr: any): Date | undefined {
  if (!dateStr) return undefined;

  // If it's already a date
  if (dateStr instanceof Date) return dateStr;

  // If it's a number (Excel serial date)
  if (typeof dateStr === 'number') {
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
  cleanStr = cleanStr.replace(/^(now|data|rolls in|mat in|arrives folded|in folded|p\/?u|pickup|drop \d+ -?)\s+/i, '');

  // Handle comma-separated dates - take the first one (e.g., "10/2,10/9" -> "10/2")
  if (cleanStr.includes(',')) {
    const firstDate = cleanStr.split(',')[0].trim();
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
    cleanStr += '/2025';
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

  if (str.includes('lemont') || str.includes('shakopee') || str === '2') {
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

  return str.includes('hard');
}

/**
 * Validate process-type-specific fields
 */
function validateRequirementFields(
  processType: string,
  requirement: ParsedJobRequirement,
  row: number
): string[] {
  const errors: string[] = [];

  switch (processType.toLowerCase()) {
    case 'insert':
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: Insert requires paper_size (6x9, 6x12, 9x12, 10x13, 12x15, #10, 11x17)`);
      }
      break;

    case 'sort':
      if (!requirement.sort_type) {
        errors.push(`Row ${row}: Sort requires sort_type (Standard Sort, Presort, EDDM, Full Service)`);
      }
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: Sort requires paper_size`);
      }
      break;

    case 'inkjet':
      if (!requirement.print_coverage) {
        errors.push(`Row ${row}: Inkjet requires print_coverage (Black & White, Full Color, Spot Color)`);
      }
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: Inkjet requires paper_size`);
      }
      break;

    case 'labelapply':
    case 'label/apply':
      if (!requirement.application_type) {
        errors.push(`Row ${row}: Label/Apply requires application_type (Label Application, Affix, Wafer Seal)`);
      }
      if (!requirement.label_size) {
        errors.push(`Row ${row}: Label/Apply requires label_size (1x2.625, 2x3, 3x5, 4x6, Custom)`);
      }
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: Label/Apply requires paper_size`);
      }
      break;

    case 'fold':
      if (!requirement.fold_type) {
        errors.push(`Row ${row}: Fold requires fold_type (Half Fold, Tri-fold, Z-fold, Double Parallel, Roll Fold)`);
      }
      if (!requirement.paper_stock) {
        errors.push(`Row ${row}: Fold requires paper_stock (20# Bond, 24# Bond, 60# Text, 80# Text, 100# Text, Cardstock)`);
      }
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: Fold requires paper_size (8.5x11, 8.5x14, 11x17, 12x18, Custom)`);
      }
      break;

    case 'laser':
      if (!requirement.print_type) {
        errors.push(`Row ${row}: Laser requires print_type (Simplex (1-sided), Duplex (2-sided))`);
      }
      if (!requirement.paper_stock) {
        errors.push(`Row ${row}: Laser requires paper_stock (20# Bond, 24# Bond, 60# Cover, 80# Cover)`);
      }
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: Laser requires paper_size (Letter, Legal, Tabloid, 11x17)`);
      }
      if (!requirement.color) {
        errors.push(`Row ${row}: Laser requires color (Black & White, Full Color)`);
      }
      break;

    case 'hppress':
    case 'hp press':
      if (!requirement.print_type) {
        errors.push(`Row ${row}: HP Press requires print_type (Simplex, Duplex)`);
      }
      if (!requirement.paper_stock) {
        errors.push(`Row ${row}: HP Press requires paper_stock (80# Text, 100# Text, 80# Cover, 100# Cover, 12pt Cardstock)`);
      }
      if (!requirement.paper_size) {
        errors.push(`Row ${row}: HP Press requires paper_size (12x18, 13x19, Custom)`);
      }
      break;
  }

  return errors;
}

/**
 * Parse Excel/CSV file and return structured job data
 */
export function parseJobCsv(file: File): Promise<JobCsvParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Get first sheet (assuming data is in first sheet or "Jobs" sheet)
        const sheetName = workbook.SheetNames.find(name =>
          name.toLowerCase() === 'jobs' || name.toLowerCase() === 'data'
        ) || workbook.SheetNames[0];

        const worksheet = workbook.Sheets[sheetName];

        // First, try to parse and detect if the first row is empty (all __EMPTY columns)
        let jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        // Check if first row columns are all __EMPTY (indicating an empty header row)
        if (jsonData.length > 0 && jsonData[0]) {
          const firstRowKeys = Object.keys(jsonData[0] as object);
          const allEmpty = firstRowKeys.every(key => key.startsWith('__EMPTY'));

          if (allEmpty) {
            console.log('[CSV Parser] Detected empty first row, re-parsing with range starting from row 2');
            // Re-parse starting from row 2 (skip the empty row)
            jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '', range: 1 });
          }
        }

        console.log('[CSV Parser] Total rows:', jsonData.length);
        const firstRowKeys = jsonData[0] ? Object.keys(jsonData[0]) : [];
        console.log('[CSV Parser] First row columns:', firstRowKeys);
        console.log('[CSV Parser] Column names with quotes:', firstRowKeys.map(k => `"${k}"`));
        if (jsonData[0]) {
          console.log('[CSV Parser] First row sample data:', jsonData[0]);
        }

        const jobs: ParsedBulkJob[] = [];
        const globalErrors: string[] = [];
        const globalWarnings: string[] = [];
        const subClientsSet = new Set<string>();

        jsonData.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +2 because Excel rows are 1-indexed and header is row 1
          const errors: string[] = [];
          const warnings: string[] = [];

          // Extract required fields
          const jobNumberRaw = findColumnValue(row, 'job_number');
          const quantityRaw = findColumnValue(row, 'quantity');
          const processTypeRaw = findColumnValue(row, 'process_type');
          const pricePerMRaw = findColumnValue(row, 'price_per_m');

          // Convert to strings for checking
          const jobNumberStr = String(jobNumberRaw || '').trim().toLowerCase();
          const quantityStr = String(quantityRaw || '').trim();

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
          const anyClientRaw = findColumnValue(row, 'sub_client') || findColumnValue(row, 'client');
          const anyClientStr = String(anyClientRaw || '').trim();

          if (!jobNumberStr && !quantityStr && !anyClientStr) {
            console.log(`[CSV Parser] Skipping empty row ${rowNum}`);
            return; // Skip this row entirely
          }

          // Skip rows with placeholder job numbers (but still has some data)
          if ((jobNumberStr === 'tbd' || jobNumberStr === 'n/a') && quantityStr) {
            console.log(`[CSV Parser] Skipping placeholder row ${rowNum}: ${jobNumberStr}`);
            // Has quantity but job number is placeholder - skip
            return;
          }

          // Validate required fields (only quantity is truly required now)
          if (!jobNumberRaw || jobNumberStr === '') {
            warnings.push(`No job_number specified - will need to add later`);
          }
          if (!quantityRaw || quantityStr === '') {
            errors.push(`Missing quantity - required field`);
          }
          // Process type and price are now optional - warn instead of error
          if (!processTypeRaw) {
            warnings.push(`No process_type specified - will need to add later`);
          }
          if (!pricePerMRaw) {
            warnings.push(`No price_per_m specified - will default to 0`);
          }

          // Parse values - handle alphanumeric job numbers by extracting digits
          let job_number: number;
          if (jobNumberRaw && jobNumberStr) {
            const jobNumStr = String(jobNumberRaw).replace(/,/g, '').trim();
            // Check if it's purely numeric or alphanumeric (e.g., "60468-2", "COSTCO IJ")
            const numericPart = jobNumStr.match(/\d+/);
            if (numericPart) {
              job_number = parseInt(numericPart[0]);
            } else {
              job_number = NaN;
              errors.push(`Invalid job_number format: '${jobNumberRaw}'`);
            }
          } else {
            // No job number provided - use 0 as placeholder
            job_number = 0;
          }

          const quantity = parseInt(String(quantityRaw).replace(/,/g, ''));
          const price_per_m = pricePerMRaw ? parseFloat(String(pricePerMRaw).replace(/,/g, '')) : 0;

          // Validate parsed values
          if (isNaN(quantity) || quantity <= 0) {
            errors.push(`Invalid quantity: '${quantityRaw}'`);
          }
          if (price_per_m < 0) {
            errors.push(`Invalid price_per_m: '${pricePerMRaw}'`);
          }

          // Parse process types (can be comma-separated) - now optional
          const process_types = processTypeRaw
            ? String(processTypeRaw)
                .split(',')
                .map(pt => pt.trim().toLowerCase())
                .filter(pt => pt)
            : [];

          // Extract optional fields
          // Try to get client name from either 'sub_client' or 'client' column (prefer sub_client if both exist)
          const subClientRaw = String(findColumnValue(row, 'sub_client') || '').trim();
          const clientRaw = String(findColumnValue(row, 'client') || '').trim();
          const sub_client = subClientRaw || clientRaw; // Use sub_client if present, otherwise fall back to client

          const description = String(findColumnValue(row, 'description') || '').trim();
          const schedule_type = findColumnValue(row, 'schedule_type');
          const facility = findColumnValue(row, 'facility');
          const start_date = parseDate(findColumnValue(row, 'start_date'));
          const end_date = parseDate(findColumnValue(row, 'end_date'));

          // Add sub-client to set if present
          if (sub_client) {
            subClientsSet.add(sub_client);
          } else {
            warnings.push(`No client specified - will need to assign a client`);
          }

          // Extract process-specific fields
          const paper_size = String(findColumnValue(row, 'paper_size') || '').trim() || undefined;
          const pocketsRaw = findColumnValue(row, 'pockets');
          const pockets = pocketsRaw ? parseInt(String(pocketsRaw)) : undefined;
          const sort_type = String(findColumnValue(row, 'sort_type') || '').trim() || undefined;
          const print_coverage = String(findColumnValue(row, 'print_coverage') || '').trim() || undefined;
          const num_addressesRaw = findColumnValue(row, 'num_addresses');
          const num_addresses = num_addressesRaw ? parseInt(String(num_addressesRaw).replace(/,/g, '')) : undefined;
          const application_type = String(findColumnValue(row, 'application_type') || '').trim() || undefined;
          const label_size = String(findColumnValue(row, 'label_size') || '').trim() || undefined;
          const fold_type = String(findColumnValue(row, 'fold_type') || '').trim() || undefined;
          const paper_stock = String(findColumnValue(row, 'paper_stock') || '').trim() || undefined;
          const print_type = String(findColumnValue(row, 'print_type') || '').trim() || undefined;
          const color = String(findColumnValue(row, 'color') || '').trim() || undefined;

          // Build requirements array (one per process type) - or empty if no process types
          const requirements: ParsedJobRequirement[] = process_types.length > 0
            ? process_types.map(pt => {
                const req: ParsedJobRequirement = {
                  process_type: pt,
                  price_per_m,
                };

                // Add process-specific fields
                if (paper_size) req.paper_size = paper_size;
                if (pockets !== undefined) req.pockets = pockets;
                if (sort_type) req.sort_type = sort_type;
                if (print_coverage) req.print_coverage = print_coverage;
                if (num_addresses !== undefined) req.num_addresses = num_addresses;
                if (application_type) req.application_type = application_type;
                if (label_size) req.label_size = label_size;
                if (fold_type) req.fold_type = fold_type;
                if (paper_stock) req.paper_stock = paper_stock;
                if (print_type) req.print_type = print_type;
                if (color) req.color = color;

                // Validate requirement fields only if process type was specified
                const reqErrors = validateRequirementFields(pt, req, rowNum);
                // Remove row number from errors since we'll show it differently
                const cleanErrors = reqErrors.map(err => err.replace(`Row ${rowNum}: `, ''));
                errors.push(...cleanErrors);

                return req;
              })
            : []; // Empty array if no process types - user can add later

          // Create parsed job object
          const parsedJob: ParsedBulkJob = {
            row: rowNum,
            job_number,
            sub_client,
            quantity,
            schedule_type: schedule_type ? String(schedule_type) : undefined,
            facility: facility ? String(facility) : undefined,
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
        const jobNumbers = new Set<number>();
        jobs.forEach(job => {
          if (jobNumbers.has(job.job_number)) {
            globalWarnings.push(`Duplicate job_number ${job.job_number} found`);
          }
          jobNumbers.add(job.job_number);
        });

        console.log('[CSV Parser] Parsed jobs:', jobs.length);
        console.log('[CSV Parser] Sub-clients found:', Array.from(subClientsSet));
        console.log('[CSV Parser] Global errors:', globalErrors);

        resolve({
          jobs,
          errors: globalErrors,
          warnings: globalWarnings,
          subClients: Array.from(subClientsSet).sort(),
        });
      } catch (error) {
        reject(new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsBinaryString(file);
  });
}
