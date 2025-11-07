# Excel Import Feature for Production Data

## Overview

This feature allows users to bulk import daily production numbers from an Excel spreadsheet by matching job numbers. This significantly reduces manual data entry time and improves data accuracy.

## User Guide

### Accessing the Feature

1. Navigate to the **Production** page
2. Click the green **"Import from Excel"** button in the top-right corner (next to "Export PDF")

### Using the Feature

#### Step 1: Prepare Your Excel File

1. Click **"Download Excel Template"** to get a pre-formatted template
2. Fill in your production data:
   - **Job Number** (Required): The job number from your system
   - **Production Quantity** (Required): Number of units produced
   - **Date** (Optional): Production date. If empty, uses today's date
   - **Notes** (Optional): Any additional information

**Example:**

| Job Number | Production Quantity | Date       | Notes              |
|------------|---------------------|------------|--------------------|
| 12345      | 5000                | 2025-01-15 | First batch done   |
| 12346      | 3200                | 2025-01-15 |                    |
| 12347      | 1500                |            | Uses today's date  |

#### Step 2: Upload Your File

1. Drag and drop your Excel file onto the upload zone, or
2. Click to browse and select your file
3. Supported formats: `.xlsx`, `.xls`, `.csv` (max 5MB)

#### Step 3: Review and Validate

The system will automatically:
- Parse your Excel file
- Match job numbers to existing jobs in the system
- Validate all data (quantities, dates, etc.)
- Show visual indicators:
  - 🟢 **Green**: Valid entries ready to upload
  - 🟡 **Yellow**: Warnings (e.g., quantity exceeds job total)
  - 🔴 **Red**: Errors (e.g., job number not found)

Review the preview table and:
- Check the validation summary at the top
- Expand error/warning details for each row
- Remove invalid rows if needed (click the trash icon)

#### Step 4: Confirm and Upload

1. Click **"Continue"** to proceed to the confirmation screen
2. Review the summary of entries to be created
3. Click **"Upload X Entries"** to create the production records
4. Wait for the upload to complete (progress bar will show)

#### Step 5: Success!

- Production entries are now in your system
- The production table will automatically refresh
- You can upload another file or close the modal

## Technical Details

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Production Page                              │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  [Import from Excel] Button                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│           ExcelProductionUploadModal Component                   │
│                                                                  │
│  Step 1: Upload                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ExcelUploadZone                                            │ │
│  │  - Drag & drop interface                                    │ │
│  │  - File validation (size, type)                             │ │
│  │  - Download template button                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  excelParser.ts                                             │ │
│  │  - Parse Excel/CSV files                                    │ │
│  │  - Extract rows and columns                                 │ │
│  │  - Handle date formats                                      │ │
│  │  - Generate parse errors                                    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  Step 2: Preview                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  productionValidator.ts                                     │ │
│  │  - Match job numbers → job IDs                              │ │
│  │  - Validate quantities                                      │ │
│  │  - Check date ranges                                        │ │
│  │  - Detect duplicates                                        │ │
│  │  - Generate warnings/errors                                 │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  ExcelPreviewTable                                          │ │
│  │  - Display validated data                                   │ │
│  │  - Color-coded status indicators                            │ │
│  │  - Show errors/warnings inline                              │ │
│  │  - Summary statistics                                       │ │
│  │  - Allow row removal                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  Step 3: Confirm                                                │
│  - Show upload summary                                          │
│  - Final confirmation                                           │
│                                 │                                │
│                                 ▼                                │
│  Step 4: Upload                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  batchCreateProductionEntries()                             │ │
│  │  - Batch API calls (50 entries/chunk)                       │ │
│  │  - Progress tracking                                        │ │
│  │  - Error handling                                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                 │                                │
│                                 ▼                                │
│  Step 5: Complete                                               │
│  - Show success message                                         │
│  - Refresh production data                                      │
│  - Option to upload more                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Components

#### 1. **excelParser.ts** (`/lib/excelParser.ts`)

Handles Excel file parsing using the SheetJS (xlsx) library.

**Functions:**
- `parseExcelFile(file: File)`: Main parsing function
- `validateFile(file: File)`: File validation (size, type)
- `mapColumns()`: Flexible column header mapping
- `parseRow()`: Individual row parsing with error handling
- `parseExcelDate()`: Date parsing for multiple formats

**Features:**
- Supports `.xlsx`, `.xls`, and `.csv` files
- Flexible column name matching (case-insensitive)
- Handles Excel date serial numbers
- Comprehensive error reporting with row numbers

#### 2. **productionValidator.ts** (`/lib/productionValidator.ts`)

Validates parsed Excel data against the job database.

**Functions:**
- `validateProductionRow()`: Validates a single row
- `validateProductionRows()`: Batch validation
- `getValidationSummary()`: Statistics generation
- `findJobByJobNumber()`: Fuzzy job number matching

**Validation Rules:**
- ✅ Job number must exist in system
- ✅ Quantity must be positive
- ✅ Date format must be valid
- ⚠️ Warns if quantity exceeds job total
- ⚠️ Warns if date outside job date range
- ⚠️ Warns about duplicate entries
- ⚠️ Warns about facility mismatches

#### 3. **ExcelUploadZone.tsx** (`/app/components/ExcelUploadZone.tsx`)

Drag-and-drop file upload interface.

**Features:**
- Drag and drop support
- Click to browse
- File validation feedback
- Loading states
- Download template button
- Expected format guide

#### 4. **ExcelPreviewTable.tsx** (`/app/components/ExcelPreviewTable.tsx`)

Visual preview of validated data.

**Features:**
- Color-coded validation status
- Expandable error/warning details
- Summary statistics cards
- Row removal capability
- Scrollable table (max height 96)
- Legend for status colors

#### 5. **ExcelProductionUploadModal.tsx** (`/app/components/ExcelProductionUploadModal.tsx`)

Main modal orchestrating the entire flow.

**Features:**
- Multi-step wizard (Upload → Preview → Confirm → Upload → Complete)
- State management for entire process
- Progress tracking during upload
- Error handling and recovery
- Toast notifications
- Auto-refresh on success

#### 6. **excelTemplate.ts** (`/lib/excelTemplate.ts`)

Generates downloadable Excel templates.

**Functions:**
- `downloadExcelTemplate()`: Creates Excel file with instructions
- `downloadCSVTemplate()`: Creates CSV alternative

**Template Features:**
- Pre-formatted with correct columns
- Example data rows
- Separate instructions sheet
- Column width optimization
- Professional styling

### Data Flow

```
1. User uploads file
   ↓
2. excelParser.ts parses file
   - Extracts rows and columns
   - Handles dates and numbers
   - Generates ParsedExcelRow[]
   ↓
3. productionValidator.ts validates data
   - Matches job numbers
   - Checks constraints
   - Generates ValidatedProductionRow[]
   ↓
4. ExcelPreviewTable displays results
   - Shows validation status
   - User reviews and removes invalid rows
   ↓
5. User confirms upload
   ↓
6. batchCreateProductionEntries() creates records
   - Batches in chunks of 50
   - Shows progress
   - Handles errors
   ↓
7. Production data refreshes
   - SWR cache updated
   - Table shows new entries
```

### API Integration

The feature uses the existing production API:

```typescript
// Create production entries in parallel
batchCreateProductionEntries(entries: Omit<ProductionEntry, 'id' | 'created_at' | 'updated_at'>[])
  : Promise<ProductionEntry[]>
```

**Performance:**
- Batches requests in chunks of 50 to avoid API overload
- Uses `Promise.all()` for parallel execution within chunks
- Shows real-time progress to user

### Error Handling

**Parse Errors:**
- File too large (>5MB)
- Invalid file type
- Missing required columns
- Empty file
- Malformed data

**Validation Errors:**
- Job number not found
- Invalid quantity (negative or zero)
- Invalid date format
- Missing required fields

**Upload Errors:**
- Network failures
- API errors
- Partial upload failures

All errors are displayed to the user with actionable messages.

## Configuration

### Supported Date Formats

- ISO: `YYYY-MM-DD` (e.g., 2025-01-15)
- US: `MM/DD/YYYY` (e.g., 01/15/2025)
- Excel serial numbers (automatic conversion)

### File Size Limits

- Maximum: 5MB
- Recommended: <1MB for best performance

### Column Names (Case-Insensitive)

**Job Number:**
- "Job Number", "job_number", "jobnumber", "Job #", "job"

**Quantity:**
- "Production Quantity", "quantity", "qty", "amount", "production"

**Date:**
- "Date", "production date", "entry date"

**Notes:**
- "Notes", "note", "comments", "comment", "description"

## Testing

### Manual Test Cases

1. **Valid Upload:**
   - Upload template with sample data
   - Verify all rows show as valid (green)
   - Confirm upload succeeds

2. **Invalid Job Number:**
   - Add row with non-existent job number
   - Verify error indicator (red)
   - Verify cannot upload

3. **Missing Required Field:**
   - Leave quantity blank
   - Verify error message

4. **Date Handling:**
   - Test with no date (should default to today)
   - Test with various date formats

5. **Large File:**
   - Upload file with 100+ rows
   - Verify batching works
   - Verify progress indicator

6. **Duplicate Detection:**
   - Upload entry for existing date/job
   - Verify warning shown

### Edge Cases

- Leading zeros in job numbers (00123 → 123)
- Very large quantities (1000000+)
- Future dates (should warn)
- Dates before job start or after job due
- Multiple facilities in same upload
- Special characters in notes field
- Empty rows (should skip)
- Partial row data

## Future Enhancements

### Potential Improvements

1. **Drag-reorder rows** in preview table
2. **Edit inline** before upload (change quantities/dates)
3. **Save drafts** for later completion
4. **Upload history** with audit trail
5. **Scheduled imports** (automatic recurring uploads)
6. **Email notifications** on upload completion
7. **Validation rule customization** per facility
8. **Bulk edit** capabilities in preview
9. **Export validation report** as PDF
10. **Integration with external systems** (ERP, MES)

### Advanced Features

1. **Smart matching:**
   - Fuzzy job number matching (123 matches 00123, 0123, etc.)
   - Job name/client name fallback matching

2. **Conflict resolution:**
   - Auto-merge with existing entries
   - Replace vs. add modes

3. **Data transformation:**
   - Unit conversion (kg → units)
   - Formula-based calculations

4. **Multi-sheet support:**
   - Process multiple sheets in one file
   - Different sheets for different facilities

## Troubleshooting

### Common Issues

**Issue:** "Job number not found"
- **Solution:** Verify job number exists in system. Check for leading zeros.

**Issue:** "Invalid file type"
- **Solution:** Ensure file is .xlsx, .xls, or .csv format.

**Issue:** "File too large"
- **Solution:** Split into multiple smaller files (<5MB each).

**Issue:** "Missing required column"
- **Solution:** Use the template or ensure columns are named correctly.

**Issue:** Upload fails partway through
- **Solution:** Check network connection. System will show which entries failed.

**Issue:** "Duplicate entry" warning
- **Solution:** Review existing entries for that date/job. You can still proceed.

## Support

For issues or questions:
1. Check this documentation
2. Review validation error messages (they're designed to be actionable)
3. Download and use the provided template
4. Contact your system administrator

## Credits

- **Excel Parsing:** SheetJS (xlsx) library
- **UI Framework:** React with Tailwind CSS
- **Data Fetching:** SWR for cache management
- **Date Handling:** date-fns library
