# Machine Rules System - Implementation Summary

## Overview

A comprehensive rules engine has been implemented that allows users to define how machine parameters (envelope size, pockets, fold type, etc.) affect machine speed output and staffing requirements.

## What Was Built

### 1. Type System
**File:** [types/index.ts](types/index.ts)

Added comprehensive TypeScript types:
- `RuleOperator` - Comparison operators (equals, greater_than, less_than, between, in, etc.)
- `LogicOperator` - AND/OR logic for combining conditions
- `RuleCondition` - Individual condition structure
- `RuleOutputs` - Speed modifier and people required
- `MachineRule` - Complete rule entity
- `RuleEvaluationResult` - Result of rule evaluation

### 2. API Layer
**File:** [lib/api.ts](lib/api.ts)

Added API functions:
- `getMachineRules(processTypeKey?, machineId?, active?)` - Fetch rules with filters
- `getMachineRule(ruleId)` - Get single rule
- `createMachineRule(ruleData)` - Create new rule
- `updateMachineRule(ruleId, ruleData)` - Update existing rule
- `deleteMachineRule(ruleId)` - Delete rule

### 3. Rules Engine
**File:** [lib/rulesEngine.ts](lib/rulesEngine.ts)

Core evaluation logic:
- `evaluateCondition(condition, parameters)` - Evaluate single condition
- `evaluateConditions(conditions, parameters)` - Evaluate with AND/OR logic
- `findMatchingRules(rules, parameters, machineId?)` - Find all matching rules
- `selectMostRestrictiveRule(matchingRules)` - Choose lowest speed modifier
- `evaluateRulesForMachine(processTypeKey, baseSpeed, parameters, machineId?)` - Main evaluation function
- `evaluateRulesForMachineObject(machine, parameters)` - Convenience wrapper
- `formatCondition(condition)` - Human-readable condition format
- `formatConditions(conditions)` - Format all conditions

### 4. UI Components

#### MachineRulesModal
**File:** [app/components/MachineRulesModal.tsx](app/components/MachineRulesModal.tsx)

Full-featured modal for rule management:
- **Create/Edit Tab:**
  - Rule name, process type, machine scope (all or specific)
  - Dynamic condition builder with AND/OR logic
  - Parameter selection based on process type
  - Multiple operator types (equals, greater than, between, in, etc.)
  - Visual selection for multi-value conditions
  - Speed modifier input (percentage)
  - People required with fractional options (.25, .5, .75)
  - Optional notes
  - Priority setting
- **View/Manage Tab:**
  - List all existing rules
  - Edit and delete actions
  - Color-coded by process type
  - Shows conditions in readable format

#### RulesEvaluationDisplay
**File:** [app/components/RulesEvaluationDisplay.tsx](app/components/RulesEvaluationDisplay.tsx)

Display component for showing evaluation results:
- Shows calculated speed vs base speed
- Displays people required
- Indicates if rule was applied
- Shows which rule matched
- Displays rule notes and explanation

### 5. React Hooks
**File:** [hooks/useRulesEvaluation.ts](hooks/useRulesEvaluation.ts)

Custom hooks for easy integration:
- `useRulesEvaluation(machine, parameters)` - Evaluate for specific machine
- `useRulesEvaluationByProcessType(processTypeKey, baseSpeed, parameters)` - Evaluate by type

### 6. Integration Points

#### Main Machines Page
**File:** [app/machines/page.tsx](app/machines/page.tsx)

Added "Manage Rules" button (green) that opens the MachineRulesModal.

#### Machine Type Pages
**File:** [app/machines/[type]/page.tsx](app/machines/[type]/page.tsx)

Added "Active Rules" section that displays all rules applicable to that machine type:
- Shows rule name, conditions, and outputs
- Color-coded display (green background)
- Appears above the machines table

## Key Features

### Rule Conditions
- **Complex Logic:** Support for AND/OR combinations
- **Multiple Operators:** equals, not_equals, greater_than, less_than, between, in, not_in
- **Dynamic Parameters:** Based on process type configuration
- **Multi-Value Support:** Select multiple values for "in" operator

### Rule Outputs
- **Speed Modifier:** Percentage of base speed (e.g., 80% = 0.8 * base speed)
- **People Required:** Integer or fractional (0.25, 0.5, 0.75, 1, 2, 3, etc.)
- **Notes:** Optional explanation of why rule affects performance

### Rule Evaluation
- **Most Restrictive:** When multiple rules match, uses lowest speed modifier
- **Priority-Based:** Tie-breaking using priority field
- **Machine-Specific:** Rules can target individual machines or all machines of a type
- **Real-Time:** Evaluates instantly as parameters change

### User Experience
- **Visual Form Builder:** Drag-and-drop-like condition building
- **Fractional People:** Radio buttons for .25, .5, .75 for partial staffing
- **Process Type Aware:** Only shows relevant parameters for selected process
- **Machine Filtering:** Only shows machines matching selected process type
- **Live Preview:** View all rules in dedicated tab

## Usage Example

```tsx
// In any component where you need speed calculations:
import { useRulesEvaluation } from '@/hooks/useRulesEvaluation';
import RulesEvaluationDisplay from '@/app/components/RulesEvaluationDisplay';

function JobPlanner() {
  const machine = selectedMachine; // Your machine state
  const parameters = {
    paper_size: '10x13',
    pockets: 8,
    // ... other params
  };

  const { result, loading } = useRulesEvaluation(machine, parameters);

  return (
    <div>
      <RulesEvaluationDisplay result={result} loading={loading} />

      {result && (
        <div>
          Speed: {result.calculatedSpeed}/hr
          Staff: {result.peopleRequired} people
          Time: {quantity / result.calculatedSpeed} hours
        </div>
      )}
    </div>
  );
}
```

## Backend Requirements

You need to create these in your Xano backend:

### Database Table: `machine_rules`
```
- id (int, primary key, auto-increment)
- name (text)
- process_type_key (text)
- machine_id (int, nullable, foreign key to machines)
- priority (int, default: 1)
- conditions (json)
- outputs (json)
- active (boolean, default: true)
- created_at (timestamp)
- updated_at (timestamp)
```

### API Endpoints
1. `GET /machine_rules` - List with filters
2. `GET /machine_rules/:id` - Get single
3. `POST /machine_rules` - Create
4. `PATCH /machine_rules/:id` - Update
5. `DELETE /machine_rules/:id` - Delete

## Files Created/Modified

### New Files:
1. `lib/rulesEngine.ts` - Core evaluation logic
2. `app/components/MachineRulesModal.tsx` - UI for managing rules
3. `app/components/RulesEvaluationDisplay.tsx` - Display component
4. `hooks/useRulesEvaluation.ts` - React hooks
5. `RULES_INTEGRATION_GUIDE.md` - Detailed integration guide
6. `MACHINE_RULES_SUMMARY.md` - This file

### Modified Files:
1. `types/index.ts` - Added rule types
2. `lib/api.ts` - Added rule API functions
3. `app/machines/page.tsx` - Added "Manage Rules" button
4. `app/machines/[type]/page.tsx` - Added active rules display

## Next Steps

1. **Backend Setup:** Create the Xano table and endpoints
2. **Testing:** Create sample rules and test evaluation
3. **Integration:** Add rules evaluation to job creation flows
4. **Refinement:** Adjust based on user feedback

## Examples of Rules You Can Create

1. **Large Envelopes:** `paper_size in ['10x13', '12x15']` → 80% speed, 2 people
2. **High Pocket Count:** `pockets > 6` → 70% speed, 3 people
3. **Complex Fold:** `fold_type = 'Z-fold'` → 75% speed, 2 people
4. **Heavy Stock:** `paper_stock = '80# Cover'` → 85% speed, 1.5 people
5. **High Volume:** `quantity > 50000` → 95% speed, 2 people (efficiency at scale)

## Architecture Highlights

- **Type-Safe:** Full TypeScript support
- **Reactive:** Uses React hooks for automatic updates
- **Modular:** Easy to extend with new operators or conditions
- **Performant:** Client-side evaluation, minimal API calls
- **User-Friendly:** Visual rule builder, no code required
- **Flexible:** Supports both machine-specific and type-wide rules

## Documentation

See [RULES_INTEGRATION_GUIDE.md](RULES_INTEGRATION_GUIDE.md) for:
- Detailed API reference
- Integration examples
- Troubleshooting guide
- Backend setup instructions
