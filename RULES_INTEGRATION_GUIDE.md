# Machine Rules Integration Guide

This guide explains how to integrate the machine rules system into your job workflows to provide real-time speed and staffing calculations.

## Overview

The rules system allows you to define how job parameters (envelope size, pockets, fold type, etc.) affect machine speed and staffing requirements. The system automatically evaluates rules and provides calculated speeds and people required.

## Components Created

### 1. Core Files

- **`types/index.ts`** - Type definitions for rules (`MachineRule`, `RuleCondition`, `RuleEvaluationResult`)
- **`lib/api.ts`** - API functions for managing rules (CRUD operations)
- **`lib/rulesEngine.ts`** - Core evaluation logic for rules
- **`app/components/MachineRulesModal.tsx`** - UI for creating and managing rules
- **`hooks/useRulesEvaluation.ts`** - React hooks for evaluating rules
- **`app/components/RulesEvaluationDisplay.tsx`** - Display component for evaluation results

### 2. Integration Points

- **Main Machines Page** (`app/machines/page.tsx`) - "Manage Rules" button added
- **Machine Type Pages** (`app/machines/[type]/page.tsx`) - Active rules displayed

## How to Use in Job Flows

### Option 1: Using the Hook (Recommended)

Use the `useRulesEvaluation` hook to automatically evaluate rules as job parameters change:

```tsx
import { useRulesEvaluation } from '@/hooks/useRulesEvaluation';
import RulesEvaluationDisplay from './RulesEvaluationDisplay';

function JobForm() {
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [jobParameters, setJobParameters] = useState({
    paper_size: '10x13',
    pockets: 8,
    // other parameters...
  });

  // Automatically evaluates rules whenever machine or parameters change
  const { result, loading, error } = useRulesEvaluation(selectedMachine, jobParameters);

  return (
    <div>
      {/* Your job form fields */}

      {/* Display calculated speed and people */}
      <RulesEvaluationDisplay result={result} loading={loading} error={error} />

      {result && (
        <div>
          <p>Estimated Time: {calculateTime(quantity, result.calculatedSpeed)} hours</p>
          <p>Staff Needed: {result.peopleRequired} people</p>
        </div>
      )}
    </div>
  );
}
```

### Option 2: Manual Evaluation

For more control, directly call the evaluation functions:

```tsx
import { evaluateRulesForMachine } from '@/lib/rulesEngine';

async function calculateJobMetrics(machine: Machine, parameters: Record<string, any>) {
  const result = await evaluateRulesForMachine(
    machine.process_type_key!,
    machine.speed_hr,
    parameters,
    machine.id
  );

  console.log('Base Speed:', result.baseSpeed);
  console.log('Calculated Speed:', result.calculatedSpeed);
  console.log('People Required:', result.peopleRequired);
  console.log('Matched Rule:', result.matchedRule?.name);

  return result;
}
```

### Option 3: By Process Type (No Specific Machine)

When you don't have a specific machine selected yet:

```tsx
import { useRulesEvaluationByProcessType } from '@/hooks/useRulesEvaluation';

function ProcessTypeSelector() {
  const [processType, setProcessType] = useState('insert');
  const [parameters, setParameters] = useState({ paper_size: '9x12', pockets: 4 });
  const baseSpeed = 5000; // Default base speed

  const { result } = useRulesEvaluationByProcessType(processType, baseSpeed, parameters);

  return (
    <div>
      <select onChange={(e) => setProcessType(e.target.value)}>
        <option value="insert">Insert</option>
        <option value="fold">Fold</option>
      </select>

      {result && <p>Expected Speed: {result.calculatedSpeed}/hr</p>}
    </div>
  );
}
```

## Example Integration in AddJobModal

Here's how you could integrate rules evaluation into the existing AddJobModal:

```tsx
// In AddJobModal.tsx, add these imports:
import { useRulesEvaluation } from '@/hooks/useRulesEvaluation';
import RulesEvaluationDisplay from './RulesEvaluationDisplay';

// Add state for selected machine
const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);

// Convert requirements to parameters format
const jobParameters = useMemo(() => {
  const firstRequirement = formData.requirements[0];
  if (!firstRequirement) return {};

  // Convert requirement to parameter format (remove process_type)
  const { process_type, ...params } = firstRequirement;
  return params;
}, [formData.requirements]);

// Evaluate rules
const { result, loading } = useRulesEvaluation(selectedMachine, jobParameters);

// Display in the form (add this in Step 2 - Job Details):
{selectedMachine && (
  <div className="mt-4">
    <RulesEvaluationDisplay
      result={result}
      loading={loading}
      className="mb-4"
    />

    {result && (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="text-sm">
          <strong>Time Estimate:</strong> {
            formData.quantity
              ? Math.round(parseInt(formData.quantity) / result.calculatedSpeed)
              : 'N/A'
          } hours
        </div>
      </div>
    )}
  </div>
)}
```

## API Reference

### Core Functions

#### `evaluateRulesForMachine(processTypeKey, baseSpeed, parameters, machineId?)`
Evaluates rules for a given process type and parameters.

**Parameters:**
- `processTypeKey` - Process type (e.g., 'insert', 'fold')
- `baseSpeed` - Machine's base speed (speed_hr)
- `parameters` - Job parameters as object (e.g., `{ paper_size: '10x13', pockets: 6 }`)
- `machineId` - Optional machine ID for machine-specific rules

**Returns:** `Promise<RuleEvaluationResult>`

#### `evaluateRulesForMachineObject(machine, parameters)`
Convenience wrapper that extracts data from Machine object.

**Parameters:**
- `machine` - Machine object
- `parameters` - Job parameters as object

**Returns:** `Promise<RuleEvaluationResult>`

### Hooks

#### `useRulesEvaluation(machine, parameters)`
React hook that automatically evaluates rules when inputs change.

**Returns:**
```typescript
{
  result: RuleEvaluationResult | null;
  loading: boolean;
  error: Error | null;
}
```

#### `useRulesEvaluationByProcessType(processTypeKey, baseSpeed, parameters)`
Similar to above but uses process type instead of machine object.

## Creating Rules via UI

1. Go to `/machines` page
2. Click "Manage Rules" button (green button in top right)
3. In the modal:
   - **Create Rule Tab:**
     - Enter rule name (e.g., "Large Envelope Speed Reduction")
     - Select process type
     - Optionally select specific machine (or leave blank for all machines)
     - Add conditions using the "Add Condition" button
     - Set speed modifier (percentage of base speed)
     - Set people required (with fractional options: .25, .5, .75)
     - Add optional notes
   - **View Rules Tab:**
     - See all existing rules
     - Edit or delete rules

### Example Rules

1. **Large Envelope Speed Reduction**
   - Condition: `paper_size in ['10x13', '12x15']`
   - Speed: 80% of base
   - People: 2

2. **High Pocket Count**
   - Condition: `pockets > 6`
   - Speed: 70% of base
   - People: 3

3. **Complex Job**
   - Condition: `paper_size = '12x15' AND pockets > 8`
   - Speed: 60% of base
   - People: 3

## Rule Evaluation Logic

- **Multiple Rules Match:** The most restrictive rule (lowest speed modifier) is applied
- **Priority:** When speeds are equal, higher priority rules win
- **Machine-Specific Rules:** If a rule targets a specific machine, it only applies to that machine
- **Type-Wide Rules:** Rules without a machine_id apply to all machines of that process type

## Backend Setup Required

The frontend is ready, but you need to create the backend API endpoints in Xano:

### Database Table: `machine_rules`

```
Fields:
- id (int, auto-increment)
- name (text)
- process_type_key (text)
- machine_id (int, nullable)
- priority (int)
- conditions (json)
- outputs (json)
- active (boolean)
- created_at (int, timestamp)
- updated_at (int, timestamp)
```

### API Endpoints Needed

1. **GET /machine_rules** - List all rules (with optional filters)
2. **GET /machine_rules/:id** - Get single rule
3. **POST /machine_rules** - Create new rule
4. **PATCH /machine_rules/:id** - Update rule
5. **DELETE /machine_rules/:id** - Delete rule

### Query Parameters for GET /machine_rules:
- `process_type_key` - Filter by process type
- `machine_id` - Filter by machine ID
- `active` - Filter by active status

## Next Steps

1. **Set up Xano database and endpoints** as described above
2. **Test the rules modal** by creating a few sample rules
3. **Integrate into AddJobModal** using the example code above
4. **Add to other job-related forms** where speed/staffing estimates are needed
5. **Consider adding:**
   - Rule simulation/testing tool
   - Rule conflict detection
   - Historical rule performance tracking
   - Bulk import/export of rules

## Troubleshooting

### Rules not showing up
- Check that rules have `active: true`
- Verify the `process_type_key` matches your machines
- Check browser console for API errors

### Evaluation not working
- Ensure parameters match the field names in `processTypeConfig.ts`
- Verify the machine has a valid `process_type_key`
- Check that the machine has a `speed_hr` value set

### Performance issues
- Rules are fetched only when needed (lazy loading)
- Evaluation is async but cached
- Consider implementing client-side caching if needed

## Support

For questions or issues with the rules system:
1. Check the browser console for error messages
2. Verify API endpoints are working via network tab
3. Test rules evaluation in isolation using the hooks
4. Review the `rulesEngine.ts` file for evaluation logic
