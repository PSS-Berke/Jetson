# Dynamic Form Builder Feature

## Overview

A comprehensive form builder that allows users to dynamically create input forms with live preview and backend integration. This feature enables users to define custom forms for machine variables, job requirements, or any other data collection needs.

## Location

- **Entry Point**: `/machines` page
- **Component**: `app/components/DynamicFormBuilderModal.tsx`
- **Button**: "Build Form" button (purple, with wrench emoji 🔧) appears in the filter bar when viewing a specific facility

## Features

### 1. Form Type/Category Definition
- Define a form type or category at the top of the builder (e.g., "Machine Variables", "Job Requirements")
- Required field that describes the purpose of the form

### 2. Dynamic Field Creation
Users can add fields with the following properties:

#### Required Properties:
- **Field ID**: Unique identifier for the field (e.g., `max_speed`, `paper_size`)
- **Field Type**: Choose from:
  - `text` - Single-line text input
  - `number` - Numeric input
  - `select` - Dropdown selection
- **Label**: Display name for the field (e.g., "Maximum Speed", "Paper Size")

#### Optional Properties:
- **Placeholder**: Helper text shown when field is empty
- **Required**: Toggle to make the field mandatory
- **Options**: Comma-separated list of options (for select fields only)

### 3. Field Management
- **Add Field**: Create new fields with the "Add Field" button
- **Edit Field**: Click the ✏️ (pencil) icon to edit an existing field
- **Remove Field**: Click the 🗑️ (trash) icon to delete a field
- **Duplicate Field**: Click the 📋 (clipboard) icon to create a copy
- **Reorder Fields**: Use ↑/↓ arrows to change field order

### 4. Live Preview
- Real-time preview on the right side of the screen
- Shows exactly how the form will appear to users
- Interactive - you can test filling out the form
- Updates instantly as you add/edit/remove fields

### 5. Save Functionality

#### API Endpoint
```
POST https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb/machine_variables
```

#### Request Format
```json
{
  "type": "Machine Variables",
  "variables": {
    "fields": [
      {
        "id": "max_speed",
        "type": "number",
        "label": "Maximum Speed",
        "placeholder": "Enter speed in units/hour",
        "required": true
      },
      {
        "id": "paper_size",
        "type": "select",
        "label": "Paper Size",
        "required": true,
        "options": ["Letter", "Legal", "Tabloid", "A4"]
      },
      {
        "id": "notes",
        "type": "text",
        "label": "Additional Notes",
        "placeholder": "Any additional information",
        "required": false
      }
    ]
  }
}
```

#### Response Handling
- **Loading State**: Button shows spinner and "Saving..." text
- **Success**: Green banner with "Form saved successfully!" message
- **Error**: Red banner with error message
- **Auto-close**: Modal closes automatically 2 seconds after successful save

## User Interface

### Layout
```
┌─────────────────────────────────────────────────────────────┐
│  Dynamic Form Builder                                    ×  │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│  Form Builder (Left)     │  Live Preview (Right)            │
│  ─────────────────       │  ─────────────────               │
│  • Form Type Input       │  • Shows form type as title      │
│  • Field Editor Panel    │  • Displays all added fields     │
│  • Field List            │  • Interactive form preview      │
│    - Edit controls       │  • Updates in real-time          │
│    - Reorder arrows      │                                  │
│    - Duplicate/Delete    │                                  │
│                          │                                  │
├──────────────────────────┴──────────────────────────────────┤
│  [Success/Error Message]              [Cancel] [Save Form]  │
└─────────────────────────────────────────────────────────────┘
```

### Color Scheme
- **Primary Button**: Blue (`var(--primary-blue)`)
- **Form Builder Button**: Purple (#7C3AED)
- **Success Messages**: Green background
- **Error Messages**: Red background
- **Field Editor**: Gray background (`bg-gray-50`)

## Usage Examples

### Example 1: Machine Variables Form

**Form Type**: Machine Variables

**Fields**:
1. **Max Speed**
   - ID: `max_speed`
   - Type: `number`
   - Required: Yes
   - Placeholder: "Enter speed in units/hour"

2. **Supported Formats**
   - ID: `supported_formats`
   - Type: `select`
   - Required: Yes
   - Options: "Letter, Legal, Tabloid, A4"

3. **Notes**
   - ID: `notes`
   - Type: `text`
   - Required: No
   - Placeholder: "Additional information"

### Example 2: Job Requirements Form

**Form Type**: Custom Job Requirements

**Fields**:
1. **Client Name**
   - ID: `client_name`
   - Type: `text`
   - Required: Yes

2. **Quantity**
   - ID: `quantity`
   - Type: `number`
   - Required: Yes

3. **Priority Level**
   - ID: `priority`
   - Type: `select`
   - Options: "Low, Medium, High, Urgent"
   - Required: Yes

## Technical Implementation

### Component Structure
```
DynamicFormBuilderModal/
├── State Management
│   ├── formType (string)
│   ├── fields (FormField[])
│   ├── editingFieldIndex (number | null)
│   ├── fieldEditor states (id, type, label, etc.)
│   └── previewValues (object)
│
├── UI Sections
│   ├── Header (with close button)
│   ├── Form Builder (left panel)
│   │   ├── Form Type Input
│   │   ├── Field Editor Panel
│   │   └── Field List with controls
│   ├── Live Preview (right panel)
│   └── Footer (status + action buttons)
│
└── Functions
    ├── handleAddField()
    ├── handleEditField()
    ├── handleRemoveField()
    ├── handleDuplicateField()
    ├── handleMoveField()
    ├── handleSaveForm()
    └── handleClose()
```

### API Integration
```typescript
// Import in components
import { api } from '@/lib/api';

// POST request
const response = await api.post('/machine_variables', {
  type: formType,
  variables: { fields }
});
```

### Type Definitions
```typescript
interface FormField {
  id: string;
  type: 'text' | 'number' | 'select';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: string[];
}
```

## Validation & Error Handling

### Client-Side Validation
1. **Form Type**: Must not be empty
2. **Field ID**: Required for each field
3. **Field Label**: Required for each field
4. **Select Options**: Required when field type is 'select'
5. **At least one field**: Must have at least one field before saving

### Error Messages
- Field validation errors: Inline alerts
- API errors: Red banner at bottom of modal
- Network errors: Error message with retry option

### Unsaved Changes Warning
- Confirms with user before closing if fields exist
- Prevents accidental data loss

## Best Practices

### Field ID Naming
- Use snake_case (e.g., `max_speed`, `paper_size`)
- Be descriptive but concise
- Avoid spaces and special characters
- Keep consistent with backend expectations

### Field Labels
- Use Title Case (e.g., "Maximum Speed", "Paper Size")
- Be clear and user-friendly
- Include units if applicable (e.g., "Speed (units/hour)")

### Select Options
- Separate with commas
- Keep options concise
- Order logically (alphabetical or by importance)
- Avoid too many options (consider text input for 10+ options)

### Form Organization
- Group related fields together using the reorder feature
- Put required fields first
- Use logical field order that matches user workflow

## Future Enhancements

### Potential Nice-to-Haves
1. ✅ **Drag and Drop Reordering**: Currently using arrow buttons
2. ✅ **Duplicate Field**: Implemented with clipboard button
3. **Field Groups/Sections**: Add dividers and section headers
4. **Conditional Fields**: Show/hide fields based on other field values
5. **Advanced Validation**: Min/max values, regex patterns
6. **Field Help Text**: Additional description below labels
7. **Import/Export**: Save form templates as JSON files
8. **Multi-column Layout**: Support for 2-3 column forms
9. **Field Templates**: Pre-built common field configurations
10. **Version History**: Track and restore previous form versions

## Troubleshooting

### Form Won't Save
- Check that form type is filled in
- Ensure at least one field exists
- Verify network connection
- Check browser console for API errors

### Preview Not Updating
- Ensure changes are saved to field list
- Click "Add Field" or "Update Field" button
- Check that field list shows your changes

### Duplicate Field IDs
- Field IDs must be unique
- System doesn't prevent duplicates (backend should validate)
- Use descriptive, unique IDs

## Integration with Machines Page

### Access
1. Navigate to `/machines`
2. Select a specific facility (B2 or Shakopee)
3. Click purple "Build Form" button in filter bar

### Context
- Opens modal overlay
- Doesn't affect current machine view
- Can be closed and reopened without losing unsaved work (with confirmation)

### Data Flow
```
User Input → Form Builder → JSON Payload → API → Xano Database
```

## Browser Compatibility

- Modern browsers with ES6+ support
- Tested on Chrome, Firefox, Safari, Edge
- Mobile responsive (stacks vertically on small screens)

## Security

- Uses Bearer token authentication from cookies
- All API calls include auth token
- Validates token on backend
- Redirects to login on 401 errors

## Performance

- Modal loads dynamically (code-split with Next.js dynamic import)
- Only loaded when "Build Form" button is clicked
- Lightweight component with minimal dependencies
- Fast re-renders with React state management

