# Process View Integration Guide

## Status: Partially Complete

### ✅ Completed
1. **ProcessProjection type** created in `lib/projectionUtils.ts`
2. **expandJobProjectionsToProcesses()** function implemented
3. **ViewModeToggle component** created
4. **ProjectionFilters updated** with viewMode props and toggle UI
5. **ProjectionsTable** has viewMode prop added

### 🔄 Remaining Work

The core remaining work is to update **ProjectionsTable.tsx** to:
1. Transform data based on viewMode
2. Render process rows with visual grouping
3. Handle selection at job level (even in process view)
4. Update mobile views to show process breakdown

## Quick Integration Steps

### Step 1: Add viewMode to ProjectionsTable function signature

```typescript
export default function ProjectionsTable({
  // ... existing props
  dataDisplayMode = 'pieces',
  viewMode = 'jobs',  // ADD THIS
}: ProjectionsTableProps) {
```

### Step 2: Transform data based on viewMode

Add this near the top of the component, before sorting:

```typescript
// Transform data for process view
const displayProjections = useMemo(() => {
  if (viewMode === 'processes') {
    return expandJobProjectionsToProcesses(jobProjections);
  }
  return jobProjections;
}, [viewMode, jobProjections]);
```

### Step 3: Update sorting to handle both types

The existing `sortedJobProjections` needs to be aware of the viewMode:

```typescript
const sortedProjections = useMemo(() => {
  if (viewMode === 'processes') {
    const processProjections = displayProjections as ProcessProjection[];
    return [...processProjections].sort((a, b) => {
      // Primary sort: by job
      const jobCompare = a.jobNumber - b.jobNumber;
      if (jobCompare !== 0) return jobCompare;

      // Secondary sort: by process type within job
      return a.processType.localeCompare(b.processType);
    });
  }

  // Existing job sorting logic...
  return [...displayProjections].sort((a, b) => {
    // existing code
  });
}, [displayProjections, sortField, sortDirection, viewMode]);
```

### Step 4: Create ProcessProjectionTableRow component

Add this component before the main function:

```typescript
// Memoized process table row component
const ProcessProjectionTableRow = memo(({
  processProjection,
  timeRanges,
  isFirstInGroup,
  onJobClick,
  dataDisplayMode,
  isSelected,
  onToggleSelect
}: {
  processProjection: ProcessProjection;
  timeRanges: TimeRange[];
  isFirstInGroup: boolean;
  onJobClick: (job: ParsedJob) => void;
  dataDisplayMode: 'pieces' | 'revenue';
  isSelected: boolean;
  onToggleSelect: () => void;
}) => {
  const job = processProjection.job;

  return (
    <tr
      key={`${job.id}-${processProjection.processType}`}
      className={`cursor-pointer border-l-4 ${
        isSelected ? 'bg-blue-100 border-l-blue-500' : 'border-l-gray-300'
      } ${isFirstInGroup ? 'border-t-2 border-t-gray-400' : ''}`}
      onClick={() => onJobClick(job)}
    >
      {/* Checkbox - only show on first row of group */}
      <td
        className="px-2 py-2 w-12"
        onClick={(e) => e.stopPropagation()}
      >
        {isFirstInGroup && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="w-4 h-4 cursor-pointer"
          />
        )}
      </td>

      {/* Job details - only show on first row */}
      {isFirstInGroup ? (
        <>
          <td className="px-2 py-2 whitespace-nowrap text-xs font-medium text-[var(--text-dark)]">
            {job.job_number}
          </td>
          <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-dark)]">
            {job.client?.name || 'Unknown'}
          </td>
          <td className="px-2 py-2 whitespace-nowrap text-xs text-[var(--text-light)]">
            {job.sub_client?.name || '-'}
          </td>
        </>
      ) : (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
        </>
      )}

      {/* Process Type - single badge */}
      <td className="px-2 py-2 text-xs text-[var(--text-dark)] pl-6">
        <ProcessTypeBadge processType={processProjection.processType} />
      </td>

      {/* Description - only on first row */}
      <td className="px-2 py-2 text-xs text-[var(--text-dark)] max-w-[200px] truncate">
        {isFirstInGroup ? (job.description || 'N/A') : ''}
      </td>

      {/* Quantity - per process */}
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)]">
        {processProjection.totalQuantity.toLocaleString()}
      </td>

      {/* Dates - only on first row */}
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
        {isFirstInGroup && job.start_date
          ? new Date(job.start_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
          : ''}
      </td>
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center text-[var(--text-dark)]">
        {isFirstInGroup && job.due_date
          ? new Date(job.due_date).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
          : ''}
      </td>

      {/* Time period columns - per process */}
      {timeRanges.map((range, index) => {
        const quantity = processProjection.weeklyQuantities.get(range.label) || 0;
        const revenue = processProjection.weeklyRevenues.get(range.label) || 0;
        const displayValue = dataDisplayMode === 'revenue'
          ? revenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : formatQuantity(quantity);

        return (
          <td
            key={range.label}
            className={`px-2 py-2 whitespace-nowrap text-xs text-center font-medium text-[var(--text-dark)] ${
              index % 2 === 0 ? 'bg-gray-100' : 'bg-gray-50'
            }`}
          >
            {displayValue}
          </td>
        );
      })}

      {/* Total - per process */}
      <td className="px-2 py-2 whitespace-nowrap text-xs text-center font-bold text-[var(--text-dark)]">
        {dataDisplayMode === 'revenue'
          ? processProjection.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 })
          : formatQuantity(processProjection.totalQuantity)}
      </td>
    </tr>
  );
});

ProcessProjectionTableRow.displayName = 'ProcessProjectionTableRow';
```

### Step 5: Update table body rendering

In the desktop table's `<tbody>`, add conditional rendering:

```typescript
<tbody className="divide-y divide-[var(--border)]">
  {sortedProjections.length === 0 ? (
    <tr>
      <td colSpan={10 + timeRanges.length} className="px-4 py-8 text-center text-[var(--text-light)]">
        No jobs found for the selected criteria
      </td>
    </tr>
  ) : viewMode === 'processes' ? (
    // Process view
    (sortedProjections as ProcessProjection[]).map((processProjection, index, array) => {
      // Determine if this is the first row for this job
      const isFirstInGroup = index === 0 ||
        processProjection.jobId !== (array[index - 1] as ProcessProjection).jobId;

      return (
        <ProcessProjectionTableRow
          key={`${processProjection.jobId}-${processProjection.processType}`}
          processProjection={processProjection}
          timeRanges={timeRanges}
          isFirstInGroup={isFirstInGroup}
          onJobClick={handleJobClick}
          dataDisplayMode={dataDisplayMode}
          isSelected={selectedJobIds.has(processProjection.jobId)}
          onToggleSelect={() => handleToggleSelect(processProjection.jobId)}
        />
      );
    })
  ) : (
    // Jobs view (existing code)
    (sortedProjections as JobProjection[]).map((projection) => (
      <ProjectionTableRow
        key={projection.job.id}
        projection={projection}
        timeRanges={timeRanges}
        onJobClick={handleJobClick}
        dataDisplayMode={dataDisplayMode}
        isSelected={selectedJobIds.has(projection.job.id)}
        onToggleSelect={() => handleToggleSelect(projection.job.id)}
      />
    ))
  )}
</tbody>
```

### Step 6: Update column header

Change "Processes" to "Process" when in process view:

```typescript
<th className="px-2 py-2 text-left text-[10px] font-medium text-[var(--text-dark)] uppercase tracking-wider">
  {viewMode === 'processes' ? 'Process' : 'Processes'}
</th>
```

### Step 7: Wire up in projections page

In `app/projections/page.tsx`, add:

```typescript
const [viewMode, setViewMode] = useState<'jobs' | 'processes'>('jobs');

// Pass to filters
<ProjectionFilters
  // ...existing props
  viewMode={viewMode}
  onViewModeChange={setViewMode}
/>

// Pass to table
<ProjectionsTable
  // ...existing props
  viewMode={viewMode}
/>
```

## Mobile View Notes

For mobile views, you can either:
1. **Simple approach**: Keep jobs view only on mobile (disable process toggle)
2. **Full approach**: Add process breakdown section within each card

### Simple Approach (Recommended for V1)

In ProjectionFilters, only show ViewModeToggle on desktop:

```typescript
{onViewModeChange && (
  <div className="hidden md:flex">
    <ViewModeToggle
      currentMode={viewMode}
      onModeChange={onViewModeChange}
    />
  </div>
)}
```

## Visual Design

### Process View Visual Grouping

The process rows use:
- **Left border (4px)**: Blue when selected, gray otherwise
- **Top border (2px)**: Thicker border on first row of each job group
- **Empty cells**: Job details only show on first row
- **Indentation**: Process badge indented slightly (pl-6)
- **Alternating groups**: Could add alternating bg colors per job group

Example rendering:

```
┌────────────────────────────────────────────────┐
│ ☑ | 12345 | ABC Corp | Sub | Insert  | ... │  ← First row (full details)
│   |       |          |     | Sort    | ... │  ← Same job (minimal)
│   |       |          |     | Inkjet  | ... │  ← Same job (minimal)
├────────────────────────────────────────────────┤  ← Visual separator
│ ☐ | 12346 | XYZ Inc  | -   | Fold    | ... │  ← New job
│   |       |          |     | Laser   | ... │  ← Same job
└────────────────────────────────────────────────┘
```

## Testing Checklist

- [ ] Toggle switches between Jobs and Processes view
- [ ] Process view shows correct quantities (divided equally)
- [ ] Process view shows correct revenue per process
- [ ] Selection works by job (all processes highlight together)
- [ ] Bulk actions work correctly (operate on whole jobs)
- [ ] Sorting keeps processes grouped by job
- [ ] Visual grouping is clear
- [ ] Time period columns show correct per-process data
- [ ] Mobile view works (either disabled or with cards)
- [ ] Empty states handled (jobs with no processes)

## Known Limitations

1. **Equal distribution**: Quantities are split equally across processes
   - Future enhancement: Allow per-process quantity allocation

2. **No per-process filtering**: Process type filters still affect entire jobs
   - This is intentional - we show/hide whole jobs

3. **Desktop only** (recommended): Process view complexity better suited for desktop
   - Mobile stays in jobs view for simplicity

## Benefits

- See detailed breakdown by process
- Understand capacity by process type
- Better visibility into multi-process jobs
- Maintains all existing functionality (selection, bulk actions, filtering)
- Clean visual grouping

