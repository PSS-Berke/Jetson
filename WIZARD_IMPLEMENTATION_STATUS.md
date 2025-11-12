# Machine Creation Wizard - Implementation Status

## ✅ Completed Components

### 1. Foundation (100% Complete)
- ✅ **Type Definitions** ([types/index.ts](types/index.ts))
  - `MachineCategory` type
  - Updated `Machine` interface with `machine_category` and `machine_group_id`
  - Complete `MachineGroup` interface
  - Updated `MachineRule` with `machine_group_id`

### 2. API Layer (100% Complete)
- ✅ **Machine Groups API** ([lib/api.ts](lib/api.ts))
  - `getMachineGroups()` - List with filters
  - `getMachineGroup()` - Get single
  - `createMachineGroup()` - Create new
  - `updateMachineGroup()` - Update existing
  - `deleteMachineGroup()` - Delete
  - `addMachineToGroup()` - Add machine
  - `removeMachineFromGroup()` - Remove machine
  - Error suppression for new endpoint

### 3. State Management (100% Complete)
- ✅ **Wizard State Hook** ([hooks/useWizardState.ts](hooks/useWizardState.ts))
  - Complete state management with useReducer
  - All 5 steps' data structures
  - Validation functions for each step
  - localStorage persistence
  - Navigation helpers (nextStep, prevStep, goToStep)
  - Reset and cleanup functions

### 4. UI Components (40% Complete)
- ✅ **WizardStepIndicator** ([app/components/wizard/WizardStepIndicator.tsx](app/components/wizard/WizardStepIndicator.tsx))
  - Progress bar visualization
  - Step completion indicators
  - Responsive design (full labels on desktop, short on mobile)
  - Animated transitions

- ✅ **WizardNavigation** ([app/components/wizard/WizardNavigation.tsx](app/components/wizard/WizardNavigation.tsx))
  - Back/Next/Submit buttons
  - Conditional rendering based on step
  - Loading states
  - Disabled states based on validation

---

## 🔨 Remaining Work

### Components Needed (60% remaining)

#### 1. Step Components (5 files, ~800 lines)
- ❌ **StepCategorySelection.tsx** - Step 1: Choose Conveyance/Ancillary
- ❌ **StepBasicInfo.tsx** - Step 2: Line, Name, Facility
- ❌ **StepCapabilities.tsx** - Step 3: Process Type & Capabilities
- ❌ **StepGroupsAndRules.tsx** - Step 4: Groups & Rules
- ❌ **StepReview.tsx** - Step 5: Review & Submit

#### 2. Support Components (2 files, ~400 lines)
- ❌ **MachineGroupSelector.tsx** - Select/Create machine groups
- ❌ **ProcessTypeSelector.tsx** - Select existing or create new process type

#### 3. Main Wizard (1 file, ~600 lines)
- ❌ **CreateMachineWizard.tsx** - Main orchestrator component

#### 4. Page Integration (1 file, ~20 lines)
- ❌ Update [app/machines/page.tsx](app/machines/page.tsx) to add "+ Machine" button

---

## 📋 Implementation Guide for Remaining Components

### Priority Order
1. **StepCategorySelection** (Simplest, 200x400px modal)
2. **StepBasicInfo** (Simple form, uses existing FacilityToggle)
3. **ProcessTypeSelector** (Moderate, reuses existing logic)
4. **StepCapabilities** (Uses existing DynamicMachineCapabilityFields)
5. **MachineGroupSelector** (New component, moderate complexity)
6. **StepGroupsAndRules** (Most complex, combines groups + rules)
7. **StepReview** (Display only, moderate)
8. **CreateMachineWizard** (Orchestrator, ties everything together)
9. **Page Integration** (Simple, just add button)

---

## 🎯 Component Specifications

### 1. StepCategorySelection.tsx

**Purpose:** First step - user selects Conveyance or Ancillary

**Size:** 200px × 400px centered modal

**Props:**
```typescript
interface StepCategorySelectionProps {
  selected: MachineCategory | null;
  onSelect: (category: MachineCategory) => void;
  error?: string;
}
```

**UI Structure:**
```
┌─────────────────────────┐
│  Select Machine Category │
├─────────────────────────┤
│                           │
│  ┌───────────────────┐   │
│  │   🏭 Conveyance   │   │
│  │                   │   │
│  │  Primary machines │   │
│  │  that process     │   │
│  │  materials        │   │
│  └───────────────────┘   │
│                           │
│  ┌───────────────────┐   │
│  │   🔧 Ancillary    │   │
│  │                   │   │
│  │  Attachable       │   │
│  │  systems that     │   │
│  │  connect to       │   │
│  │  conveyances      │   │
│  └───────────────────┘   │
│                           │
└─────────────────────────┘
```

**Key Features:**
- Two large clickable cards
- Icons for each category
- Brief descriptions
- Selected state with border/background change
- Keyboard navigation (Arrow keys, Enter)

---

### 2. StepBasicInfo.tsx

**Purpose:** Collect line number, machine name, and facility

**Props:**
```typescript
interface StepBasicInfoProps {
  line: string;
  machineName: string;
  facilities_id: number | null;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}
```

**UI Structure:**
```
┌─────────────────────────────────────┐
│  Basic Information                   │
├─────────────────────────────────────┤
│                                       │
│  Line Number *                        │
│  [___________]                        │
│  (numeric input)                      │
│                                       │
│  Machine Name *                       │
│  [___________________________]        │
│  (text input)                         │
│                                       │
│  Facility *                           │
│  ○ Bolingbrook  ○ Lemont             │
│  (FacilityToggle component)           │
│                                       │
└─────────────────────────────────────┘
```

**Reuses:**
- `FacilityToggle` component from [app/components/FacilityToggle.tsx](app/components/FacilityToggle.tsx)
- Set `showAll={false}` (no "All" option)

---

### 3. ProcessTypeSelector.tsx

**Purpose:** Select existing process type or create custom

**Props:**
```typescript
interface ProcessTypeSelectorProps {
  selectedProcessType: string;
  isCustom: boolean;
  customName: string;
  onSelectExisting: (key: string) => void;
  onSelectCustom: (name: string) => void;
  error?: string;
}
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  Process Type                            │
├─────────────────────────────────────────┤
│                                           │
│  Select Existing:                         │
│  ┌─────────────────────────────────┐     │
│  │ Insert (Blue) ▼                 │     │
│  ├─────────────────────────────────┤     │
│  │ Insert                           │     │
│  │ Sort                             │     │
│  │ Inkjet                           │     │
│  │ Label/Apply                      │     │
│  │ Fold                             │     │
│  │ Laser                            │     │
│  │ HP Press                         │     │
│  └─────────────────────────────────┘     │
│                                           │
│  OR                                       │
│                                           │
│  Create Custom:                           │
│  [+ Create New Process Type]              │
│  (opens inline form builder)              │
│                                           │
└─────────────────────────────────────────┘
```

**Reuses:**
- `PROCESS_TYPE_CONFIGS` from [lib/processTypeConfig.ts](lib/processTypeConfig.ts)
- Inline form builder based on [DynamicFormBuilderModal](app/components/DynamicFormBuilderModal.tsx)

---

### 4. StepCapabilities.tsx

**Purpose:** Configure machine capabilities based on selected process type

**Props:**
```typescript
interface StepCapabilitiesProps {
  processTypeKey: string;
  isCustom: boolean;
  capabilities: Record<string, MachineCapabilityValue>;
  onCapabilityChange: (field: string, value: MachineCapabilityValue) => void;
  errors: Record<string, string>;
}
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  Machine Capabilities                    │
├─────────────────────────────────────────┤
│                                           │
│  [ProcessTypeSelector component]          │
│                                           │
│  ───────────────────────────────────     │
│                                           │
│  Capabilities for [Process Type]:         │
│                                           │
│  [DynamicMachineCapabilityFields]         │
│  (renders based on process type)          │
│                                           │
│  ───────────────────────────────────     │
│                                           │
│  [+ Add Custom Field]                     │
│  (optional, for machine-specific fields)  │
│                                           │
└─────────────────────────────────────────┘
```

**Reuses:**
- `ProcessTypeSelector` (created above)
- `DynamicMachineCapabilityFields` from [app/components/DynamicMachineCapabilityFields.tsx](app/components/DynamicMachineCapabilityFields.tsx)

---

### 5. MachineGroupSelector.tsx

**Purpose:** Select existing group or create new group

**Props:**
```typescript
interface MachineGroupSelectorProps {
  processTypeKey: string;
  facilitiesId: number | null;
  option: 'none' | 'existing' | 'new';
  existingGroupId: number | null;
  newGroupName: string;
  newGroupDescription: string;
  onOptionChange: (option: 'none' | 'existing' | 'new') => void;
  onExistingGroupChange: (groupId: number) => void;
  onNewGroupChange: (name: string, description: string) => void;
  errors: Record<string, string>;
}
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  Machine Grouping (Optional)             │
├─────────────────────────────────────────┤
│                                           │
│  ○ No group (standalone machine)          │
│                                           │
│  ○ Add to existing group                  │
│    ┌─────────────────────────────┐       │
│    │ Select group...       ▼     │       │
│    └─────────────────────────────┘       │
│    Group description: [shown here]        │
│    Machines in group: [list]              │
│                                           │
│  ○ Create new group                       │
│    Group Name *                           │
│    [___________________________]          │
│    Description (optional)                 │
│    [___________________________]          │
│                                           │
└─────────────────────────────────────────┘
```

**Key Features:**
- Fetches groups via `getMachineGroups(processTypeKey, facilitiesId)`
- Shows group details when existing group selected
- Validation for new group name

---

### 6. StepGroupsAndRules.tsx

**Purpose:** Configure machine groups and create rules

**Props:**
```typescript
interface StepGroupsAndRulesProps {
  processTypeKey: string;
  machineId?: number; // Available after machine created (Phase 2)
  [all MachineGroupSelector props]
  rules: RuleFormData[];
  onAddRule: (rule: RuleFormData) => void;
  onUpdateRule: (index: number, rule: RuleFormData) => void;
  onRemoveRule: (index: number) => void;
  errors: Record<string, string>;
}
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  Groups & Rules                          │
├─────────────────────────────────────────┤
│                                           │
│  [MachineGroupSelector component]         │
│                                           │
│  ───────────────────────────────────     │
│                                           │
│  Performance Rules (Optional)             │
│                                           │
│  ┌───────────────────────────────────┐   │
│  │ Rule 1: Large Envelope            │   │
│  │ Conditions: paper_size in [...]   │   │
│  │ Speed: 80% | People: 2            │   │
│  │ [Edit] [Delete]                   │   │
│  └───────────────────────────────────┘   │
│                                           │
│  [+ Add Rule]                             │
│                                           │
│  (Rule creation form similar to           │
│   MachineRulesModal "Create Rule" tab)    │
│                                           │
└─────────────────────────────────────────┘
```

**Reuses:**
- `MachineGroupSelector` (created above)
- Rule condition builder logic from [app/components/MachineRulesModal.tsx](app/components/MachineRulesModal.tsx)

---

### 7. StepReview.tsx

**Purpose:** Review all entered data before submission

**Props:**
```typescript
interface StepReviewProps {
  wizardState: WizardState;
  onEditStep: (step: number) => void;
  machines?: Machine[]; // For showing group info
  groups?: MachineGroup[]; // For showing group details
}
```

**UI Structure:**
```
┌─────────────────────────────────────────┐
│  Review & Create                         │
├─────────────────────────────────────────┤
│                                           │
│  Machine Details                 [Edit]  │
│  ├─ Category: Conveyance                 │
│  ├─ Line: 101                            │
│  ├─ Name: Inserter A                     │
│  ├─ Facility: Bolingbrook                │
│  └─ Status: Available (default)          │
│                                           │
│  Process Type & Capabilities     [Edit]  │
│  ├─ Type: Insert                         │
│  ├─ Supported Paper Sizes:               │
│  │   6x9, 9x12, 10x13                   │
│  └─ Pocket Range: 0-12                   │
│                                           │
│  Machine Group                   [Edit]  │
│  ├─ Group: Inserters with Affixers       │
│  ├─ Description: ...                     │
│  └─ Other machines: Machine B, C         │
│                                           │
│  Performance Rules               [Edit]  │
│  ├─ Rule 1: Large Envelope               │
│  │   • Conditions: paper_size in [...]   │
│  │   • Speed: 80% | People: 2            │
│  └─ Rule 2: High Pocket Count            │
│      • Conditions: pockets > 6           │
│      • Speed: 70% | People: 3            │
│                                           │
└─────────────────────────────────────────┘
```

**Key Features:**
- Read-only display with clear sections
- [Edit] buttons that call `onEditStep(stepNumber)`
- Color-coded process type badge
- Formatted rule conditions (use `formatConditions` from rulesEngine)
- Summary counts (e.g., "2 rules configured")

---

### 8. CreateMachineWizard.tsx

**Purpose:** Main orchestrator component

**Props:**
```typescript
interface CreateMachineWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (machineId: number) => void;
}
```

**Structure:**
```typescript
export default function CreateMachineWizard({ isOpen, onClose, onSuccess }: CreateMachineWizardProps) {
  const { state, dispatch, nextStep, prevStep, goToStep, canProceed, reset, clearStorage } = useWizardState();
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  const steps = [
    { number: 1, label: 'Category', shortLabel: 'Cat' },
    { number: 2, label: 'Basic Info', shortLabel: 'Info' },
    { number: 3, label: 'Capabilities', shortLabel: 'Cap' },
    { number: 4, label: 'Groups & Rules', shortLabel: 'Rules' },
    { number: 5, label: 'Review', shortLabel: 'Review' },
  ];

  const handleSubmit = async () => {
    // Submission logic (see below)
  };

  const handleClose = () => {
    if (confirm('Are you sure? Your progress will be saved as a draft.')) {
      onClose();
    }
  };

  return (
    <Modal open={isOpen} onClose={handleClose} size={state.currentStep === 1 ? 'sm' : 'xl'}>
      {/* Step Indicator */}
      <WizardStepIndicator currentStep={state.currentStep} steps={steps} />

      {/* Step Content */}
      <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
        {state.currentStep === 1 && <StepCategorySelection ... />}
        {state.currentStep === 2 && <StepBasicInfo ... />}
        {state.currentStep === 3 && <StepCapabilities ... />}
        {state.currentStep === 4 && <StepGroupsAndRules ... />}
        {state.currentStep === 5 && <StepReview ... />}
      </div>

      {/* Navigation */}
      <WizardNavigation
        currentStep={state.currentStep}
        totalSteps={5}
        onBack={prevStep}
        onNext={nextStep}
        onSubmit={handleSubmit}
        canProceed={canProceed(state.currentStep)}
        isSubmitting={submitting}
        onCancel={handleClose}
      />

      {/* Success Toast */}
      {showSuccessToast && <Toast message="Machine created successfully!" type="success" />}
    </Modal>
  );
}
```

**Submission Logic:**
```typescript
const handleSubmit = async () => {
  setSubmitting(true);
  try {
    // Phase 1: Create Machine Group (if new)
    let groupId: number | undefined;
    if (state.machineGroupOption === 'new') {
      const newGroup = await createMachineGroup({
        name: state.newGroupName,
        description: state.newGroupDescription,
        process_type_key: state.process_type_key,
        machine_ids: [],
        facilities_id: state.facilities_id || undefined,
      });
      groupId = newGroup.id;
    } else if (state.machineGroupOption === 'existing') {
      groupId = state.existingGroupId || undefined;
    }

    // Phase 2: Create Machine
    const machineData = {
      line: parseInt(state.line),
      type: state.machineName,
      machine_category: state.machineCategory,
      facilities_id: state.facilities_id,
      status: 'available' as MachineStatus,
      process_type_key: state.process_type_key,
      speed_hr: 0, // Placeholder - determined by rules
      shift_capacity: 0, // Placeholder
      capabilities: state.capabilities,
      machine_group_id: groupId,
    };

    const createdMachine = await createMachine(machineData);
    const machineId = createdMachine.id;

    // Phase 3: Update Machine Group (if joining existing)
    if (state.machineGroupOption === 'existing' && groupId) {
      await addMachineToGroup(groupId, machineId);
    }

    // Phase 4: Create Rules
    for (const rule of state.rules) {
      await createMachineRule({
        name: rule.name,
        process_type_key: state.process_type_key,
        machine_id: machineId,
        machine_group_id: groupId,
        priority: rule.priority,
        conditions: rule.conditions,
        outputs: rule.outputs,
        active: true,
      });
    }

    // Success!
    setShowSuccessToast(true);
    clearStorage();
    reset();

    setTimeout(() => {
      onClose();
      if (onSuccess) {
        onSuccess(machineId);
      }
    }, 1500);
  } catch (error) {
    console.error('[CreateMachineWizard] Error creating machine:', error);
    alert('Failed to create machine. Please try again.');
  } finally {
    setSubmitting(false);
  }
};
```

---

## 🔧 Backend Requirements

Before the wizard can work, create these Xano endpoints:

### 1. Machine Groups Table
```sql
CREATE TABLE machine_groups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  process_type_key TEXT NOT NULL,
  machine_ids JSON, -- Array of machine IDs
  facilities_id INT,
  created_at BIGINT,
  updated_at BIGINT
);
```

### 2. Update Machines Table
```sql
ALTER TABLE machines
ADD COLUMN machine_category TEXT, -- 'conveyance' or 'ancillary'
ADD COLUMN machine_group_id INT;
```

### 3. Update Machine Rules Table
```sql
ALTER TABLE machine_rules
ADD COLUMN machine_group_id INT;
```

### 4. API Endpoints
- `GET /machine_groups` - List with filters
- `GET /machine_groups/:id` - Get single
- `POST /machine_groups` - Create
- `PATCH /machine_groups/:id` - Update
- `DELETE /machine_groups/:id` - Delete

---

## 📦 Page Integration

Update [app/machines/page.tsx](app/machines/page.tsx):

```typescript
// Add import
const CreateMachineWizard = dynamic(() => import('../components/CreateMachineWizard'), {
  ssr: false,
});

// Add state
const [isWizardOpen, setIsWizardOpen] = useState(false);

// Replace the three buttons with one
<button
  onClick={() => setIsWizardOpen(true)}
  className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors flex items-center gap-2"
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
  </svg>
  <span>+ Machine</span>
</button>

// Add wizard component
<CreateMachineWizard
  isOpen={isWizardOpen}
  onClose={() => setIsWizardOpen(false)}
  onSuccess={(machineId) => {
    console.log('Machine created:', machineId);
    // Optionally refresh machine list or navigate
  }}
/>
```

---

## ✅ Testing Checklist

- [ ] Step 1: Both category buttons work, selection persists
- [ ] Step 2: All validations work (line numeric, all required)
- [ ] Step 2: FacilityToggle works correctly
- [ ] Step 3: Can select existing process types
- [ ] Step 3: Can create custom process type
- [ ] Step 3: Capabilities render correctly per process type
- [ ] Step 4: Can skip groups entirely
- [ ] Step 4: Can create new machine group
- [ ] Step 4: Can join existing machine group
- [ ] Step 4: Can add multiple rules
- [ ] Step 4: Rule conditions work with AND/OR logic
- [ ] Step 5: All data displays correctly in review
- [ ] Step 5: Edit buttons navigate to correct steps
- [ ] Step 5: Can edit and return to review
- [ ] Navigation: Back/Next buttons work correctly
- [ ] Navigation: Validation prevents proceeding with errors
- [ ] Submission: Machine created successfully
- [ ] Submission: Group created/joined successfully
- [ ] Submission: Rules created and associated correctly
- [ ] Persistence: Draft saved to localStorage on each step
- [ ] Persistence: Draft restored on page reload
- [ ] Persistence: Draft cleared on successful submission
- [ ] Error Handling: API failures handled gracefully
- [ ] Mobile: Responsive on all screen sizes
- [ ] Accessibility: Keyboard navigation works
- [ ] Accessibility: Screen reader friendly

---

## 🚀 Estimated Effort

- **Step Components**: 6-8 hours
- **Support Components**: 3-4 hours
- **Main Wizard**: 3-4 hours
- **Testing & Bug Fixes**: 3-4 hours
- **Total**: ~15-20 hours of development

---

## 📚 Resources

### Existing Components to Reference:
1. [AddMachineModal.tsx](app/components/AddMachineModal.tsx) - Form patterns
2. [MachineRulesModal.tsx](app/components/MachineRulesModal.tsx) - Rule creation UI
3. [DynamicFormBuilderModal.tsx](app/components/DynamicFormBuilderModal.tsx) - Custom process types
4. [DynamicMachineCapabilityFields.tsx](app/components/DynamicMachineCapabilityFields.tsx) - Capabilities rendering
5. [FacilityToggle.tsx](app/components/FacilityToggle.tsx) - Facility selection

### Files Already Created:
1. [types/index.ts](types/index.ts) - All types
2. [lib/api.ts](lib/api.ts) - All API functions
3. [hooks/useWizardState.ts](hooks/useWizardState.ts) - State management
4. [wizard/WizardStepIndicator.tsx](app/components/wizard/WizardStepIndicator.tsx) - Progress indicator
5. [wizard/WizardNavigation.tsx](app/components/wizard/WizardNavigation.tsx) - Navigation buttons

---

This documentation provides everything needed to complete the wizard implementation. Follow the component specifications and reuse existing patterns for consistency.
