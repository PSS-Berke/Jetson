# Job Cost Tracking Implementation Guide

This document outlines the remaining steps to fully implement the Job Cost Analysis feature in the CFO/Financials tab.

## Overview

The Job Cost Analysis feature allows tracking actual costs per thousand and comparing them against billing rates to calculate profit margins. The UI components are complete, but database and API integration are required.

## Completed Components

✅ **Frontend Components:**
- `JobCostComparisonTable.tsx` - Main table showing job profitability
- `BatchJobCostEntryModal.tsx` - Batch entry modal for cost data
- `lib/jobCostUtils.ts` - Utility functions for calculations
- `CFODashboard.tsx` - Integrated into financials tab

## Required Database Implementation

### 1. Create `job_cost_entries` Table

Create a new table in Xano (or your database) with the following schema:

```sql
CREATE TABLE job_cost_entries (
  id INTEGER PRIMARY KEY AUTO_INCREMENT,
  job INTEGER NOT NULL,              -- Foreign key to jobs table
  date BIGINT NOT NULL,               -- Unix timestamp for the period
  actual_cost_per_m DECIMAL(10,2),   -- Actual cost per thousand
  notes TEXT,                         -- Optional notes
  created_at BIGINT NOT NULL,         -- Unix timestamp
  updated_at BIGINT NOT NULL,         -- Unix timestamp
  facilities_id INTEGER,              -- Foreign key to facilities

  INDEX idx_job (job),
  INDEX idx_date (date),
  INDEX idx_facilities (facilities_id),
  FOREIGN KEY (job) REFERENCES jobs(id) ON DELETE CASCADE
);
```

**Field Descriptions:**
- `id`: Primary key, auto-increment
- `job`: Foreign key referencing the jobs table
- `date`: Unix timestamp (milliseconds) for the cost entry period
- `actual_cost_per_m`: The actual cost per thousand pieces (decimal)
- `notes`: Optional notes about the cost entry
- `created_at`: Timestamp when record was created
- `updated_at`: Timestamp when record was last updated
- `facilities_id`: Optional facility identifier for multi-facility setups

## Required API Endpoints

### 2. Implement API Endpoints in `lib/api.ts`

Add the following functions to your API client:

#### A. Get Job Cost Entries
```typescript
/**
 * Fetch job cost entries for a date range
 */
export async function getJobCostEntries(
  facilitiesId?: number,
  startDate?: number,
  endDate?: number
): Promise<JobCostEntry[]> {
  const params = new URLSearchParams();

  if (facilitiesId) {
    params.append('facilities_id', facilitiesId.toString());
  }
  if (startDate) {
    params.append('start_date', startDate.toString());
  }
  if (endDate) {
    params.append('end_date', endDate.toString());
  }

  const response = await fetch(
    `${API_BASE_URL}/job_cost_entries?${params.toString()}`,
    {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch job cost entries');
  }

  return response.json();
}
```

#### B. Create Job Cost Entry
```typescript
/**
 * Create a single job cost entry
 */
export async function addJobCostEntry(
  entry: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'>
): Promise<JobCostEntry> {
  const response = await fetch(`${API_BASE_URL}/job_cost_entries`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      ...entry,
      created_at: Date.now(),
      updated_at: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create job cost entry');
  }

  return response.json();
}
```

#### C. Update Job Cost Entry
```typescript
/**
 * Update an existing job cost entry
 */
export async function updateJobCostEntry(
  id: number,
  updates: Partial<Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'>>
): Promise<JobCostEntry> {
  const response = await fetch(`${API_BASE_URL}/job_cost_entries/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify({
      ...updates,
      updated_at: Date.now(),
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update job cost entry');
  }

  return response.json();
}
```

#### D. Delete Job Cost Entry
```typescript
/**
 * Delete a job cost entry
 */
export async function deleteJobCostEntry(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/job_cost_entries/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to delete job cost entry');
  }
}
```

#### E. Batch Create Job Cost Entries
```typescript
/**
 * Create multiple job cost entries in a single request
 */
export async function batchCreateJobCostEntries(
  entries: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'>[]
): Promise<JobCostEntry[]> {
  const entriesWithTimestamps = entries.map(entry => ({
    ...entry,
    created_at: Date.now(),
    updated_at: Date.now(),
  }));

  const response = await fetch(`${API_BASE_URL}/job_cost_entries/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(entriesWithTimestamps),
  });

  if (!response.ok) {
    throw new Error('Failed to create batch job cost entries');
  }

  return response.json();
}
```

## Integration Steps

### 3. Update Component Implementations

#### A. Update `JobCostComparisonTable.tsx`

Replace the TODO in `handleSaveEdit`:

```typescript
// Current (line 162):
// TODO: Implement API call to save/update cost entry

// Replace with:
import { addJobCostEntry, deleteJobCostEntry } from '@/lib/api';
import type { JobCostEntry } from '@/lib/jobCostUtils';

// In handleSaveEdit function:
// Delete all existing entries for this job in this period
if (comparison.entry_ids && comparison.entry_ids.length > 0) {
  await Promise.all(
    comparison.entry_ids.map(entryId => deleteJobCostEntry(entryId))
  );
}

// Create a single new entry with the new value
const newEntry: Omit<JobCostEntry, 'id' | 'created_at' | 'updated_at'> = {
  job: comparison.job.id,
  date: Date.now(),
  actual_cost_per_m: newValue,
  facilities_id: comparison.job.facilities_id,
};
await addJobCostEntry(newEntry);
```

#### B. Update `BatchJobCostEntryModal.tsx`

Replace the TODO in `handleSubmit` (line 155):

```typescript
// Current:
// TODO: Submit batch entries via API

// Replace with:
import { batchCreateJobCostEntries, getJobCostEntries, deleteJobCostEntry } from '@/lib/api';

// Before submission, delete old entries for these jobs
const jobIds = entriesToSubmit.map(e => e.job);
const existingEntries = await getJobCostEntries(facilitiesId, startDate, endDate);
const entriesToDelete = existingEntries.filter(e => jobIds.includes(e.job));

if (entriesToDelete.length > 0) {
  await Promise.all(entriesToDelete.map(e => deleteJobCostEntry(e.id)));
}

// Create new entries
const createdEntries = await batchCreateJobCostEntries(entriesToSubmit);
console.log('[BatchJobCostEntryModal] Successfully created', createdEntries.length, 'entries');
```

Also update the initialization in `useEffect` (line 52):

```typescript
// Current:
// TODO: Fetch existing cost entries for this period from API

// Replace with:
import { getJobCostEntries } from '@/lib/api';

const existingEntries = await getJobCostEntries(facilitiesId, startDate, endDate);

// Create a map of job_id to current cost
const costsMap = new Map<number, number>();
existingEntries.forEach(entry => {
  costsMap.set(entry.job, entry.actual_cost_per_m);
});
```

#### C. Update `CFODashboard.tsx`

Replace the TODO in the `jobCostComparisons` useMemo (line 111):

```typescript
// Current:
// TODO: Fetch actual cost entries from API
const costEntries: any[] = [];

// Replace with:
import { getJobCostEntries } from '@/lib/api';

const [costEntries, setCostEntries] = useState<JobCostEntry[]>([]);

// Add useEffect to fetch cost entries:
useEffect(() => {
  if (startDate && endDate) {
    getJobCostEntries(facilitiesId, startDate, endDate)
      .then(entries => setCostEntries(entries))
      .catch(error => {
        console.error('Error fetching cost entries:', error);
        setCostEntries([]);
      });
  }
}, [startDate, endDate, facilitiesId, refreshCostData]);

// Then use costEntries in the useMemo
```

## Testing Checklist

### 4. Manual Testing Steps

Once API endpoints are implemented:

- [ ] **View Job Cost Table**
  - Navigate to Financials tab
  - Verify table displays with all jobs from selected period
  - Verify billing rate per M is calculated correctly (sum of price_per_m from requirements)
  - Verify "Click to enter" appears for jobs without cost data

- [ ] **Inline Cost Entry**
  - Click on "Actual Cost" cell
  - Enter a cost value (e.g., 25.50)
  - Press Enter or click outside
  - Verify cost is saved to database
  - Verify profit calculations appear immediately
  - Verify profit percentage color coding (green/yellow/red)

- [ ] **Batch Cost Entry**
  - Click "Batch Entry" button
  - Verify modal shows all jobs in period
  - Test "Add to Cost" mode - enter value, verify new total
  - Test "Set Total Cost" mode - enter value, verify it replaces
  - Verify profit % preview updates in real-time
  - Add notes to a job
  - Click "Save Cost Entries"
  - Verify success toast appears
  - Verify table updates with new costs

- [ ] **Profit Summary Cards**
  - Verify "Avg Profit Margin" shows correct percentage
  - Verify "Total Profit" shows correct dollar amount
  - Verify "Most Profitable" shows correct job number
  - Verify "Jobs at Risk" counts jobs with <10% margin

- [ ] **Date Range Filtering**
  - Change date range in parent page
  - Verify cost table filters to jobs in that range
  - Verify cost entries only show for selected period

- [ ] **Edge Cases**
  - Test with job that has zero billing rate
  - Test with negative cost (should not allow)
  - Test with very large numbers
  - Test with multiple decimal places
  - Test batch save with no entries (should show error)

## Data Flow Diagram

```
┌─────────────────┐
│   CFO Dashboard │
│  (Financials)   │
└────────┬────────┘
         │
         ├─── Fetches: jobs, timeRanges, date range
         │
         v
┌─────────────────────────┐
│ jobCostComparisons      │
│ (merges jobs + costs)   │
└────────┬────────────────┘
         │
         ├──> JobCostComparisonTable
         │    ├── Inline editing
         │    └── Batch mode button
         │
         └──> BatchJobCostEntryModal
              ├── Fetch existing costs
              ├── Calculate billing rates
              ├── Preview profit margins
              └── Save batch entries
                   │
                   v
              ┌──────────────┐
              │   Database   │
              │ job_cost_    │
              │   entries    │
              └──────────────┘
```

## Future Enhancements

Consider these future improvements:

1. **Cost Trends Over Time**
   - Track historical cost changes
   - Show cost trend charts
   - Alert on significant cost increases

2. **Budget vs Actual**
   - Set target profit margins per client/process
   - Alert when margins fall below targets
   - Dashboard for budget variance

3. **Process-Level Costs**
   - Break down costs by process type (Insert, Sort, etc.)
   - Compare costs across different processes
   - Identify most/least profitable processes

4. **Export/Reporting**
   - Export cost data to Excel/CSV
   - Generate PDF profitability reports
   - Integrate with accounting systems

5. **Bulk Import**
   - Import costs from CSV
   - Import from external cost tracking systems
   - Auto-calculate from supplier invoices

## Support

If you encounter issues during implementation:

1. Check TypeScript compilation: `npx tsc --noEmit`
2. Review browser console for errors
3. Verify API responses match expected format
4. Check database indexes for performance
5. Review this guide for missed steps

---

**Last Updated:** 2025-11-07
**Status:** Ready for database and API implementation
