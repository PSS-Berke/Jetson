# Process Type Quantity Calculation - Backend Migration Guide

This document explains how quantity per service type (process type) is calculated in the frontend, to help migrate this logic to the backend.

## Overview

The calculation happens in three main steps:
1. **Job-level quantity distribution** - Distribute each job's total quantity across time periods
2. **Process type splitting** - Divide each job's quantity equally among its process types
3. **Process type aggregation** - Sum quantities by process type across all jobs

## Step 1: Job-Level Quantity Distribution

**Location**: `lib/projectionUtils.ts` → `calculateJobDistribution()`

### Method 1: Using `time_split` data (preferred)
If the job has `time_split` data from the v2 API, use it directly:

```typescript
// Structure from API:
time_split: {
  weekly: Array<{
    week_start: string; // "YYYY-MM-DD"
    year: number;
    quantity: number;
  }>;
  monthly: Array<{
    month_start: string; // "YYYY-MM-DD"
    year: number;
    quantity: number;
  }>;
  quarterly: Array<{
    quarter: number; // 1-4
    year: number;
    quantity: number;
  }>;
}
```

Match time periods by:
- **Weekly**: Match `week_start` date to time range start date
- **Monthly**: Match year and month (1-12)
- **Quarterly**: Match year and quarter (1-4)

### Method 2: Date-based calculation (fallback)
If no `time_split` data exists, calculate based on job dates:

```typescript
// Algorithm:
1. Get job start_date and due_date
2. Calculate total days between dates (inclusive)
3. Calculate daily quantity = job.quantity / total_days
4. For each time period:
   - Count how many job days fall within the period
   - period_quantity = Math.round(daily_quantity * days_in_period)
```

**Example**:
- Job quantity: 10,000
- Start date: 2024-01-01
- Due date: 2024-01-10 (10 days total)
- Daily quantity: 1,000
- Week 1 (Jan 1-7): 7 days → 7,000 pieces
- Week 2 (Jan 8-14): 3 days → 3,000 pieces

## Step 2: Process Type Splitting

**Location**: `lib/projectionUtils.ts` → `calculateProcessTypeSummaries()`

For each job, the quantity is **divided equally** among all process types in the job's requirements:

```typescript
// Algorithm:
1. Get job's requirements array (each requirement has a process_type)
2. Count number of process types: numProcesses = requirements.length
3. For each time period:
   - process_quantity = Math.round(job_quantity / numProcesses)
4. For total quantity:
   - process_total = Math.round(job_total / numProcesses)
```

**Important**: Process types are normalized to lowercase for grouping (case-insensitive).

**Example**:
- Job has 3 requirements: ["Insert", "Laser", "Fold"]
- Job quantity in Week 1: 9,000
- Each process type gets: Math.round(9000 / 3) = 3,000

## Step 3: Process Type Aggregation

**Location**: `lib/projectionUtils.ts` → `calculateProcessTypeSummaries()`

Aggregate quantities across all jobs for each process type:

```typescript
// Algorithm:
1. Group jobs by normalized process type (case-insensitive)
2. For each process type:
   - Sum quantities for each time period
   - Sum total quantities
   - Count unique jobs (a job can contribute to multiple process types)
3. Calculate revenue per process type:
   - For each requirement: revenue = (job.quantity / 1000) * requirement.price_per_m
   - Distribute job revenue proportionally: process_revenue = job_revenue / numProcesses
```

## Complete Calculation Flow

```
Job 1 (10,000 pieces, 2 process types: Insert, Laser)
├─ Week 1: 6,000 pieces
│  ├─ Insert: 3,000 pieces
│  └─ Laser: 3,000 pieces
└─ Week 2: 4,000 pieces
   ├─ Insert: 2,000 pieces
   └─ Laser: 2,000 pieces

Job 2 (5,000 pieces, 1 process type: Insert)
├─ Week 1: 3,000 pieces
│  └─ Insert: 3,000 pieces
└─ Week 2: 2,000 pieces
   └─ Insert: 2,000 pieces

Aggregated by Process Type:
Insert:
├─ Week 1: 3,000 + 3,000 = 6,000 pieces
├─ Week 2: 2,000 + 2,000 = 4,000 pieces
└─ Total: 5,000 + 5,000 = 10,000 pieces
└─ Job Count: 2 jobs

Laser:
├─ Week 1: 3,000 pieces
├─ Week 2: 2,000 pieces
└─ Total: 5,000 pieces
└─ Job Count: 1 job
```

## Revenue Calculation

**Location**: `lib/projectionUtils.ts` → `getProcessRevenue()`

For each process type, revenue is calculated based on the requirement's `price_per_m`:

```typescript
// For a single requirement:
process_revenue = (job.quantity / 1000) * requirement.price_per_m

// If job has multiple processes, revenue is distributed proportionally:
process_revenue_per_period = (job_revenue_per_period / numProcesses)
```

**Note**: If `price_per_m` is not available or invalid, the job's `total_billing` is used and distributed equally.

## Facility Grouping (Optional)

**Location**: `lib/projectionUtils.ts` → `calculateProcessTypeSummariesByFacility()`

When `groupByFacility` is enabled, summaries are grouped by both process type AND facility:

```typescript
// Composite key: "processType-facilityId"
// Example: "insert-1", "insert-2", "laser-1"
```

## Key Functions Reference

### Frontend Functions (to replicate in backend):

1. **`calculateJobDistribution(job, timeRanges)`**
   - Distributes job quantity across time periods
   - Returns: `Map<periodLabel, quantity>`

2. **`calculateGenericJobProjections(jobs, timeRanges)`**
   - Creates JobProjection objects with quantities and revenues per period
   - Returns: `JobProjection[]`

3. **`calculateProcessTypeSummaries(jobProjections, timeRanges)`**
   - Main function that aggregates by process type
   - Returns: `ProcessTypeSummary[]`

4. **`normalizeProcessType(processType)`**
   - Normalizes process type names (handles variations like "HP Press" → "hpPress")
   - Location: `lib/processTypeConfig.ts`

## Data Structures

### ProcessTypeSummary
```typescript
{
  processType: string;           // Display name (first occurrence's casing)
  weeklyTotals: Map<string, number>;  // periodLabel -> total quantity
  weeklyRevenues: Map<string, number>; // periodLabel -> total revenue
  grandTotal: number;            // Sum of all quantities
  grandRevenue: number;          // Sum of all revenues
  jobCount: number;              // Unique jobs contributing to this process type
}
```

### ProcessTypeFacilitySummary (when grouped by facility)
```typescript
{
  processType: string;
  facilityId: number | null;
  facilityName: string;
  weeklyTotals: Map<string, number>;
  weeklyRevenues: Map<string, number>;
  grandTotal: number;
  grandRevenue: number;
  jobCount: number;
}
```

## Edge Cases

1. **Jobs with no requirements**: Skipped entirely
2. **Empty process type**: Treated as "Unknown"
3. **Zero quantity jobs**: Still counted in jobCount but contribute 0 quantity
4. **Rounding**: Uses `Math.round()` which may cause slight discrepancies from job.quantity
5. **Multiple requirements with same process type**: Each requirement is counted separately (quantity is divided by total number of requirements, not unique process types)

## Production Adjustments

**Location**: `hooks/useProjections.ts` → `adjustedJobProjections`

If production entries exist, quantities are adjusted:

```typescript
// Algorithm:
1. Get actual production quantity for job
2. Calculate remaining quantity = job.quantity - actual_production
3. If remaining <= 0: set all periods to 0
4. Otherwise: scale all periods proportionally
   - adjustment_factor = remaining / job.quantity
   - adjusted_period_quantity = period_quantity * adjustment_factor
```

This adjustment happens **before** process type splitting, so the adjusted quantities are then divided among process types.

## Backend Implementation Recommendations

1. **Reuse time_split calculation**: If you already calculate `time_split` on the backend, use it directly
2. **Batch processing**: Calculate all process type summaries in a single query/operation
3. **Caching**: Consider caching summaries since they're expensive to recalculate
4. **Database aggregation**: If possible, use SQL aggregation for better performance
5. **Normalization**: Implement the same process type normalization logic for consistency

## Testing Checklist

When implementing in backend, verify:
- [ ] Quantities match frontend calculations exactly
- [ ] Process types are normalized correctly (case-insensitive)
- [ ] Jobs with multiple process types split quantities equally
- [ ] Revenue calculations match (using price_per_m or total_billing)
- [ ] Job counts are correct (unique jobs per process type)
- [ ] Facility grouping works when enabled
- [ ] Production adjustments are applied correctly
- [ ] Edge cases handled (no requirements, zero quantity, etc.)

