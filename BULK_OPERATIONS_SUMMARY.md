# Bulk Selection & Operations - Implementation Summary

## Overview
Added bulk selection and bulk operations capabilities to the ProjectionsTable component, allowing users to select multiple jobs and perform actions like locking/unlocking schedules and deleting jobs.

**📖 See also**: [Bulk Actions UI Guide](BULK_ACTIONS_UI_GUIDE.md) for detailed UI flow, visual diagrams, and user interaction patterns.

## What Was Added

### 1. Reusable DataTable Component
Created a fully-featured, reusable table component in [app/components/DataTable/](app/components/DataTable/)

**Files Created:**
- `DataTable.tsx` - Main component with sorting, pagination, selection
- `DataTableTypes.ts` - TypeScript interfaces
- `DataTableCell.tsx` - Inline editing support
- `DataTableHeader.tsx` - Sortable headers with select-all
- `DataTableRow.tsx` - Row with selection checkbox
- `DataTableBulkActions.tsx` - Bulk action toolbar
- `DataTablePagination.tsx` - Full pagination controls
- `DataTableMobileCard.tsx` - Mobile-responsive card view
- `README.md` - Complete documentation with examples
- `index.ts` - Clean exports

**Features:**
- ✅ Bulk selection with "Select All"
- ✅ Configurable bulk actions
- ✅ Inline cell editing
- ✅ Sortable columns
- ✅ Pagination
- ✅ Mobile responsive (auto card view)
- ✅ Full TypeScript support

### 2. Enhanced ProjectionsTable Component
Updated [app/components/ProjectionsTable.tsx](app/components/ProjectionsTable.tsx) with bulk operations.

**New Features:**

#### Selection System
- **Checkbox column** in all views (desktop table, mobile table, mobile cards)
- **Select All checkbox** in table headers
- **Visual feedback**: Selected rows highlighted in blue
- **Selection counter**: Shows how many jobs are selected

#### Bulk Actions Toolbar
Appears when jobs are selected with a **"Bulk Actions"** dropdown button containing:

**1. Change Status** (Expandable submenu)
   - Radio button options:
     - **Hard Scheduled (Lock)**: Sets all weeks in `locked_weeks` array to `true`
     - **Soft Scheduled (Unlock)**: Sets all weeks in `locked_weeks` array to `false`
   - **Confirm button**: Only enabled when a status is selected
   - Visual icons indicate lock/unlock state
   - Confirmation dialog before execution

**2. Delete Selected** (Destructive action)
   - Bulk deletes all selected jobs
   - Confirmation dialog before execution
   - Shows success/failure counts
   - Red text indicates destructive action

#### Selection Handlers
- `handleToggleSelect(jobId)` - Toggle individual job selection
- `handleSelectAll(checked)` - Select/deselect all visible jobs
- `handleClearSelection()` - Clear all selections
- `handleBulkLockWeeks(shouldLock)` - Lock or unlock selected jobs
- `handleBulkDelete()` - Delete selected jobs

### 3. API Methods
Added to [lib/api.ts](lib/api.ts):

```typescript
// Delete multiple jobs in parallel
bulkDeleteJobs(jobIds: number[]): Promise<{
  success: number;
  failures: { jobId: number; error: string }[]
}>

// Update multiple jobs with any fields
bulkUpdateJobs(jobIds: number[], updates: Partial<Job>): Promise<{
  success: Job[];
  failures: { jobId: number; error: string }[]
}>
```

Both methods:
- Execute operations in parallel for performance
- Return detailed success/failure information
- Handle errors gracefully

## Usage

### In ProjectionsTable

The bulk operations are automatically available in the ProjectionsTable. Users can:

1. **Select jobs** by clicking checkboxes (or use Select All)
2. **Bulk actions toolbar appears** showing selected count with "Bulk Actions" button
3. **Click "Bulk Actions"** dropdown button to see available actions
4. **Choose an action**:
   - **Change Status** → Expand submenu → Select Hard/Soft → Click Confirm
   - **Delete Selected** → Confirm in dialog
5. **See results** via alert showing success/failure counts
6. **Data refreshes** automatically via `onRefresh()` callback
7. **Dropdown closes** automatically after action or when clicking outside

### Selection Works Across All Views

- ✅ Desktop table view
- ✅ Mobile table view
- ✅ Mobile card view

All views maintain the same selection state and show the same bulk actions toolbar.

## Technical Details

### Selection State Management
```typescript
const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
```

Uses a `Set` for efficient lookups and prevents duplicates.

### Lock/Unlock Implementation

The `locked_weeks` field in the Job type is an array of booleans corresponding to each week in the job's schedule:

```typescript
// Example: 4-week job
locked_weeks: [true, true, true, true]  // All weeks locked (hard scheduled)
locked_weeks: [false, false, false, false]  // All weeks unlocked (soft scheduled)
```

The bulk lock/unlock operations:
1. Get selected jobs from `sortedJobProjections`
2. Calculate weeks count from `job.weekly_split?.length`
3. Create new `locked_weeks` array filled with `true` or `false`
4. Call `bulkUpdateJobs()` with the update
5. Refresh data and clear selection

### Error Handling

All bulk operations:
- Show confirmation dialogs
- Use try/catch blocks
- Display success/failure counts
- Log errors to console
- Refresh data after operations
- Clear selection after completion

### Mobile Responsiveness

The bulk actions toolbar adapts to mobile:
```typescript
className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
```

- **Mobile**: Stacked layout
- **Desktop**: Horizontal layout

## Benefits

1. **User Efficiency**: Select and modify multiple jobs at once instead of one-by-one
2. **Organized UI**: Dropdown menu keeps actions organized and uncluttered
3. **Deliberate Actions**: Two-step process (select status → confirm) prevents accidental changes
4. **Consistent UX**: Same functionality across desktop and mobile
5. **Error Resilient**: Partial failures don't break the whole operation
6. **Type Safe**: Full TypeScript support prevents bugs
7. **Reusable**: DataTable component can be used in other tables
8. **Performance**: Parallel API calls for bulk operations
9. **Accessibility**: Keyboard navigation and clear visual feedback

## Future Enhancements

Potential additions:
- Bulk edit other fields (dates, quantities, etc.)
- Filter + select all (select all jobs matching current filters)
- Keyboard shortcuts (Ctrl+A, Delete key, etc.)
- Undo/redo for bulk operations
- Export selected jobs to CSV
- Bulk assign to machines
- Bulk update pricing

## Files Modified

1. [app/components/ProjectionsTable.tsx](app/components/ProjectionsTable.tsx) - Added selection & bulk actions
2. [lib/api.ts](lib/api.ts) - Added `bulkDeleteJobs()` and `bulkUpdateJobs()`
3. [app/components/DataTable/](app/components/DataTable/) - New reusable component (9 files)

## Testing Checklist

- [x] Select individual jobs via checkbox
- [x] Select all jobs via header checkbox
- [x] Indeterminate state when some selected
- [x] Clear selection button works
- [x] Lock jobs updates locked_weeks to true
- [x] Unlock jobs updates locked_weeks to false
- [x] Delete jobs removes them from database
- [x] Success/failure messages show correctly
- [x] Data refreshes after operations
- [x] Selection works on mobile
- [x] Bulk actions toolbar appears/disappears
- [x] Confirmation dialogs prevent accidents
- [x] Visual feedback for selected rows

## Notes

- The `locked_weeks` field represents hard/soft scheduled status
- All bulk operations require user confirmation
- Operations are performed in parallel for speed
- Partial failures are reported but don't block successes
- Selection state is cleared after bulk operations complete
