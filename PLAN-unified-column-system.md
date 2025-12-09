# Plan: Unified Column System for ProjectionsTable

## Goal
Refactor the column system so that ALL columns (checkbox, static columns, time ranges, total, notes) go through a unified rendering system with consistent visibility, ordering, and configuration.

---

## Current Problems

1. **Three different column types with different handling:**
   - Static columns (job_number, facility, etc.) - go through `renderColumnHeader()`/`renderCell()`
   - Special columns (checkbox, notes) - hardcoded in JSX
   - Dynamic columns (time ranges) - hardcoded in JSX, not in config at all
   - Total column - hybrid (skipped in map, then added separately)

2. **Inconsistent visibility control:**
   - Regular columns: `isColumnVisible(key)`
   - Notes: `showNotes` prop (completely separate system)
   - Checkbox: Always visible (can't be hidden)
   - Time ranges: No visibility control

3. **Three different filtering mechanisms:**
   - `useColumnSettings`: filters by hidden set
   - `ProjectionsTable`: filters out checkbox/notes from `orderedColumnKeys`
   - `ColumnSettingsPopover`: filters out checkbox/notes from configurable list

---

## Proposed Architecture

### Column Types
Define explicit column types in the config:

```typescript
type ColumnType =
  | "static"      // Regular data columns (job_number, facility, etc.)
  | "checkbox"    // Selection checkbox
  | "time_range"  // Dynamic time period columns
  | "total"       // Aggregation column
  | "notes";      // Notes column

interface ProjectionColumnConfig {
  key: string;
  type: ColumnType;
  label: string;
  sortable: boolean;
  sortField?: SortField;
  width?: string;
  align?: "left" | "center" | "right";
  sticky?: "left" | "right";
  required?: boolean;        // Can't be hidden
  reorderable?: boolean;     // Can be reordered (false for checkbox, time_range, notes)
  externalControl?: string;  // If visibility is controlled by an external prop (e.g., "showNotes")
}
```

### Rendering Context
Pass all necessary context to render functions:

```typescript
interface ColumnRenderContext {
  // Selection
  isSelected: boolean;
  onToggleSelect: () => void;
  allSelected: boolean;
  someSelected: boolean;
  onSelectAll: (checked: boolean) => void;

  // Data
  job: ParsedJob;
  projection: JobProjection | ProcessProjection;
  timeRanges: TimeRange[];

  // Notes
  showNotes: boolean;
  jobNotes: JobNote[];
  cellNotesMap: Map<string, JobNote[]>;
  // ... other notes props

  // Row context (for ProcessProjectionTableRow)
  isFirstInGroup?: boolean;
}
```

### Unified Render Functions

```typescript
// In columnConfig.ts - define render functions per column type
const COLUMN_RENDERERS = {
  header: {
    checkbox: (ctx) => <th>...</th>,
    static: (ctx, config) => <th>...</th>,
    time_range: (ctx, range) => <th>...</th>,
    total: (ctx) => <th>...</th>,
    notes: (ctx) => <th>...</th>,
  },
  cell: {
    checkbox: (ctx) => <td>...</td>,
    static: (ctx, config, value) => <td>...</td>,
    time_range: (ctx, range, quantity) => <td>...</td>,
    total: (ctx, totalQuantity) => <td>...</td>,
    notes: (ctx) => <td>...</td>,
  }
};
```

---

## Implementation Steps

### Phase 1: Update Column Config (columnConfig.ts)

1. Add `type` field to `ProjectionColumnConfig`
2. Add `reorderable` field (default true, false for checkbox/notes)
3. Add `externalControl` field for notes column
4. Create a special `TIME_RANGES_PLACEHOLDER` config entry
5. Update `DEFAULT_COLUMNS` with new fields

```typescript
export const DEFAULT_COLUMNS: ProjectionColumnConfig[] = [
  { key: "checkbox", type: "checkbox", label: "", required: true, reorderable: false, ... },
  { key: "job_number", type: "static", label: "Job #", reorderable: true, ... },
  { key: "facility", type: "static", label: "Facility", reorderable: true, ... },
  // ... other static columns
  { key: "time_ranges", type: "time_range", label: "Time Periods", required: true, reorderable: false },
  { key: "total", type: "total", label: "Total", reorderable: true, ... },
  { key: "notes", type: "notes", label: "Notes", reorderable: false, externalControl: "showNotes", ... },
];
```

### Phase 2: Update useColumnSettings Hook

1. Handle the special `time_ranges` placeholder in order array
2. Update visibility logic to respect `externalControl` fields
3. Update reorder logic to respect `reorderable` field
4. Export helper to get ordered columns with all metadata

```typescript
// New return type
interface UseColumnSettingsReturn {
  // ... existing
  getOrderedColumns: () => Array<{
    config: ProjectionColumnConfig;
    isVisible: boolean;
    // For time_range type, includes the actual ranges
    timeRanges?: TimeRange[];
  }>;
}
```

### Phase 3: Create Unified Renderers (new file: columnRenderers.tsx)

1. Create `renderColumnHeader(config, context)` that handles ALL column types
2. Create `renderCell(config, context)` that handles ALL column types
3. Move all the switch/case logic into these centralized functions
4. Handle the time_range type specially (iterates over actual ranges)

```typescript
// columnRenderers.tsx
export function renderColumnHeader(
  config: ProjectionColumnConfig,
  context: HeaderRenderContext
): React.ReactNode {
  switch (config.type) {
    case "checkbox":
      return <th key="checkbox">...</th>;
    case "static":
      return renderStaticHeader(config, context);
    case "time_range":
      return context.timeRanges.map(range =>
        <th key={range.label}>...</th>
      );
    case "total":
      return <th key="total">...</th>;
    case "notes":
      return <th key="notes">...</th>;
  }
}

export function renderCell(
  config: ProjectionColumnConfig,
  context: CellRenderContext
): React.ReactNode {
  // Similar pattern
}
```

### Phase 4: Update ColumnSettingsPopover

1. Show columns based on `reorderable` field (not hardcoded exclusions)
2. Show visibility toggle based on `required` field
3. Handle `externalControl` columns differently (show info about external control)
4. Remove hardcoded filtering of checkbox/notes

### Phase 5: Update ProjectionsTable.tsx

1. Remove the hardcoded checkbox header/cell rendering
2. Remove the hardcoded time range header/cell rendering
3. Remove the hardcoded notes header/cell rendering
4. Remove the special total column handling
5. Replace `orderedColumnKeys` with `getOrderedColumns()`
6. Single loop over ordered columns calling unified renderers

**Before:**
```tsx
<tr>
  {/* Checkbox column is always first */}
  <th>...</th>
  {/* Render columns in configured order */}
  {orderedColumnKeys.map((columnKey) => {
    if (columnKey === "total") return null;
    return renderColumnHeader(columnKey);
  })}
  {/* Time ranges */}
  {timeRanges.map((range) => <th>...</th>)}
  {/* Total */}
  {isColumnVisible("total") && renderColumnHeader("total")}
  {/* Notes */}
  {showNotes && <th>Notes</th>}
</tr>
```

**After:**
```tsx
<tr>
  {getOrderedColumns().map((col) => {
    if (!col.isVisible) return null;
    return renderColumnHeader(col.config, context);
  })}
</tr>
```

### Phase 6: Update Row Components

1. Update `ProjectionTableRow` to use unified `renderCell()`
2. Update `ProcessProjectionTableRow` to use unified `renderCell()`
3. Pass full context object instead of individual props
4. Handle `isFirstInGroup` in context for ProcessProjectionTableRow

### Phase 7: Cleanup

1. Remove duplicate filtering logic
2. Remove `showNotes` prop dependency for notes visibility (use column system)
3. Update any tests
4. Verify localStorage migration for existing users

---

## File Changes Summary

| File | Changes |
|------|---------|
| `columnConfig.ts` | Add type, reorderable, externalControl fields; add TIME_RANGES placeholder |
| `useColumnSettings.ts` | Add getOrderedColumns(); handle time_ranges; respect reorderable |
| `columnRenderers.tsx` | **NEW FILE** - Unified render functions for headers and cells |
| `ColumnSettingsPopover.tsx` | Remove hardcoded exclusions; use config fields |
| `ProjectionsTable.tsx` | Remove hardcoded rendering; use unified loop; simplify row components |

---

## Migration Notes

- Existing localStorage settings should still work (order array contains same keys)
- The `time_ranges` key is new but optional in the order array
- If not present, insert it at the expected position (after due_date)

---

## Benefits

1. **Single source of truth** for column configuration
2. **Consistent visibility control** - all columns use `isColumnVisible()`
3. **Consistent ordering** - all columns participate in the order array
4. **Easier to add new columns** - just add config, renderers handle the rest
5. **Cleaner code** - no more special cases scattered throughout
6. **Better maintainability** - changes in one place affect all columns consistently
