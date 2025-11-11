# Dynamic Form Builder - Quick Start Guide

## How to Access

1. Navigate to the Machines page: `/machines`
2. Select a facility from the toggle (B2 or Shakopee)
3. Look for the purple **"🔧 Build Form"** button in the filter bar
4. Click to open the Form Builder modal

## Quick Example: Create a Machine Variables Form

### Step 1: Set Form Type
```
Enter in the "Form Type / Category" field: Machine Variables
```

### Step 2: Add Your First Field
Fill in the Field Editor:
- **Field ID**: `max_speed`
- **Field Type**: `number`
- **Label**: `Maximum Speed (units/hr)`
- **Placeholder**: `Enter speed`
- **Required**: ✓ (checked)

Click **"Add Field"**

### Step 3: Add a Select Field
- **Field ID**: `paper_size`
- **Field Type**: `select`
- **Label**: `Supported Paper Sizes`
- **Options**: `Letter, Legal, Tabloid, A4, Custom`
- **Required**: ✓ (checked)

Click **"Add Field"**

### Step 4: Add a Text Field
- **Field ID**: `notes`
- **Field Type**: `text`
- **Label**: `Additional Notes`
- **Placeholder**: `Any special notes...`
- **Required**: ✗ (unchecked)

Click **"Add Field"**

### Step 5: Preview & Test
- Look at the right side - your form is shown in real-time
- Try interacting with the preview form
- Reorder fields using ↑/↓ arrows if needed

### Step 6: Save
Click **"Save Form"** button at the bottom right

## The Saved JSON

Your form will be saved to the backend as:

```json
{
  "type": "Machine Variables",
  "variables": {
    "fields": [
      {
        "id": "max_speed",
        "type": "number",
        "label": "Maximum Speed (units/hr)",
        "placeholder": "Enter speed",
        "required": true
      },
      {
        "id": "paper_size",
        "type": "select",
        "label": "Supported Paper Sizes",
        "required": true,
        "options": ["Letter", "Legal", "Tabloid", "A4", "Custom"]
      },
      {
        "id": "notes",
        "type": "text",
        "label": "Additional Notes",
        "placeholder": "Any special notes...",
        "required": false
      }
    ]
  }
}
```

## API Endpoint

```
POST https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb/machine_variables
```

## Testing Tips

### Test Field Reordering
1. Create 3-4 fields
2. Use the ↑/↓ arrows to reorder
3. Watch the preview update in real-time

### Test Field Duplication
1. Create a field with all properties filled
2. Click the 📋 icon
3. Edit the duplicated field's ID and label

### Test Field Editing
1. Click the ✏️ icon on any field
2. Modify properties
3. Click "Update Field"
4. See changes in preview immediately

### Test Validation
- Try saving without a form type (should show alert)
- Try saving without any fields (should show alert)
- Try adding a field without ID or label (should show alert)
- Try adding a select field without options (will work but not ideal)

### Test Error Handling
- Disconnect internet and try saving (should show error message)
- Check browser console for API responses

## Common Use Cases

### 1. Machine Configuration Form
```
Form Type: Machine Configuration
Fields:
- machine_id (text, required)
- line_number (number, required)
- status (select: Available, Running, Maintenance)
- speed_per_hour (number, required)
- max_capacity (number)
```

### 2. Job Requirements Form
```
Form Type: Custom Job Requirements
Fields:
- client_name (text, required)
- quantity (number, required)
- priority (select: Low, Medium, High, Urgent)
- delivery_date (text, required)
- special_instructions (text)
```

### 3. Quality Check Form
```
Form Type: Quality Control Checklist
Fields:
- inspector_name (text, required)
- pass_fail (select: Pass, Fail)
- defect_count (number)
- defect_type (select: Paper Jam, Misalignment, Smudge, Other)
- notes (text)
```

## Keyboard Shortcuts

- **Tab**: Navigate between fields in the editor
- **Enter**: Submit current field (equivalent to clicking "Add Field")
- **Escape**: Close modal (with confirmation if changes exist)

## Mobile Responsiveness

- On smaller screens, the form builder and preview stack vertically
- Builder appears on top, preview below
- All functionality remains the same
- Optimized for tablets and mobile devices

## Troubleshooting

### "Can't see the Build Form button"
→ Make sure you've selected a facility (B2 or Shakopee). The button only appears when viewing a specific facility.

### "Preview not updating"
→ Click "Add Field" or "Update Field" to commit changes to the field list.

### "Form won't save"
→ Check:
  1. Form type is filled in
  2. At least one field exists
  3. Network connection is active
  4. Check browser console for errors

### "Duplicate field IDs"
→ Each field must have a unique ID. Edit one of the fields to use a different ID.

## Next Steps

After saving forms, you can use the JSON structure to:
1. Dynamically render forms in your application
2. Validate user input against the schema
3. Store form data in a structured way
4. Generate reports based on form definitions

## Advanced Features

### Reorder Multiple Fields
1. Click the first field's ↑ arrow to move up
2. Click multiple times to move to desired position
3. Field order in preview matches field list order

### Complex Select Options
For select fields with many options, consider:
- Using a text field with validation instead
- Breaking into multiple select fields
- Using a hierarchical structure

### Form Templates
Save commonly used field configurations:
1. Create a form with standard fields
2. Save it
3. Use duplicate feature to create variations
4. Only change specific fields as needed

## Support

For issues or questions:
1. Check the full documentation: `docs/DYNAMIC_FORM_BUILDER.md`
2. Review browser console for error messages
3. Verify API endpoint is accessible
4. Check authentication token is valid

