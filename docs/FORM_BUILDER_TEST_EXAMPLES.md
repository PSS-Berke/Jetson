# Form Builder Test Examples

Ready-to-use examples for testing the Dynamic Form Builder feature.

## Test Example 1: Machine Configuration Form

### Input Values
```
Form Type: Machine Configuration

Field 1:
- ID: machine_name
- Type: text
- Label: Machine Name
- Placeholder: Enter machine name
- Required: ✓

Field 2:
- ID: line_number
- Type: number
- Label: Line Number
- Placeholder: Enter line number
- Required: ✓

Field 3:
- ID: status
- Type: select
- Label: Current Status
- Options: Available, Running, Maintenance, Offline
- Required: ✓

Field 4:
- ID: speed_per_hour
- Type: number
- Label: Speed Per Hour
- Placeholder: Units per hour
- Required: ✓

Field 5:
- ID: notes
- Type: text
- Label: Additional Notes
- Placeholder: Any special notes
- Required: ✗
```

### Expected JSON Output
```json
{
  "type": "Machine Configuration",
  "variables": {
    "fields": [
      {
        "id": "machine_name",
        "type": "text",
        "label": "Machine Name",
        "placeholder": "Enter machine name",
        "required": true
      },
      {
        "id": "line_number",
        "type": "number",
        "label": "Line Number",
        "placeholder": "Enter line number",
        "required": true
      },
      {
        "id": "status",
        "type": "select",
        "label": "Current Status",
        "required": true,
        "options": ["Available", "Running", "Maintenance", "Offline"]
      },
      {
        "id": "speed_per_hour",
        "type": "number",
        "label": "Speed Per Hour",
        "placeholder": "Units per hour",
        "required": true
      },
      {
        "id": "notes",
        "type": "text",
        "label": "Additional Notes",
        "placeholder": "Any special notes"
      }
    ]
  }
}
```

---

## Test Example 2: Job Requirements Form

### Input Values
```
Form Type: Custom Job Requirements

Field 1:
- ID: client_name
- Type: text
- Label: Client Name
- Required: ✓

Field 2:
- ID: quantity
- Type: number
- Label: Quantity
- Placeholder: Number of units
- Required: ✓

Field 3:
- ID: priority
- Type: select
- Label: Priority Level
- Options: Low, Medium, High, Urgent
- Required: ✓

Field 4:
- ID: due_date
- Type: text
- Label: Due Date
- Placeholder: MM/DD/YYYY
- Required: ✓

Field 5:
- ID: special_instructions
- Type: text
- Label: Special Instructions
- Placeholder: Enter any special requirements
- Required: ✗
```

### Expected JSON Output
```json
{
  "type": "Custom Job Requirements",
  "variables": {
    "fields": [
      {
        "id": "client_name",
        "type": "text",
        "label": "Client Name",
        "required": true
      },
      {
        "id": "quantity",
        "type": "number",
        "label": "Quantity",
        "placeholder": "Number of units",
        "required": true
      },
      {
        "id": "priority",
        "type": "select",
        "label": "Priority Level",
        "required": true,
        "options": ["Low", "Medium", "High", "Urgent"]
      },
      {
        "id": "due_date",
        "type": "text",
        "label": "Due Date",
        "placeholder": "MM/DD/YYYY",
        "required": true
      },
      {
        "id": "special_instructions",
        "type": "text",
        "label": "Special Instructions",
        "placeholder": "Enter any special requirements"
      }
    ]
  }
}
```

---

## Test Example 3: Quality Control Checklist

### Input Values
```
Form Type: Quality Control Checklist

Field 1:
- ID: inspector_name
- Type: text
- Label: Inspector Name
- Required: ✓

Field 2:
- ID: inspection_date
- Type: text
- Label: Inspection Date
- Placeholder: MM/DD/YYYY
- Required: ✓

Field 3:
- ID: pass_fail
- Type: select
- Label: Overall Result
- Options: Pass, Fail, Conditional Pass
- Required: ✓

Field 4:
- ID: defect_count
- Type: number
- Label: Number of Defects
- Placeholder: 0
- Required: ✗

Field 5:
- ID: defect_type
- Type: select
- Label: Primary Defect Type
- Options: None, Paper Jam, Misalignment, Smudge, Tear, Other
- Required: ✗

Field 6:
- ID: corrective_action
- Type: text
- Label: Corrective Action Taken
- Placeholder: Describe actions taken
- Required: ✗
```

### Expected JSON Output
```json
{
  "type": "Quality Control Checklist",
  "variables": {
    "fields": [
      {
        "id": "inspector_name",
        "type": "text",
        "label": "Inspector Name",
        "required": true
      },
      {
        "id": "inspection_date",
        "type": "text",
        "label": "Inspection Date",
        "placeholder": "MM/DD/YYYY",
        "required": true
      },
      {
        "id": "pass_fail",
        "type": "select",
        "label": "Overall Result",
        "required": true,
        "options": ["Pass", "Fail", "Conditional Pass"]
      },
      {
        "id": "defect_count",
        "type": "number",
        "label": "Number of Defects",
        "placeholder": "0"
      },
      {
        "id": "defect_type",
        "type": "select",
        "label": "Primary Defect Type",
        "options": ["None", "Paper Jam", "Misalignment", "Smudge", "Tear", "Other"]
      },
      {
        "id": "corrective_action",
        "type": "text",
        "label": "Corrective Action Taken",
        "placeholder": "Describe actions taken"
      }
    ]
  }
}
```

---

## Test Example 4: Simple Contact Form

### Input Values
```
Form Type: Contact Information

Field 1:
- ID: full_name
- Type: text
- Label: Full Name
- Required: ✓

Field 2:
- ID: email
- Type: text
- Label: Email Address
- Placeholder: user@example.com
- Required: ✓

Field 3:
- ID: phone
- Type: text
- Label: Phone Number
- Placeholder: (555) 555-5555
- Required: ✗

Field 4:
- ID: contact_method
- Type: select
- Label: Preferred Contact Method
- Options: Email, Phone, Text
- Required: ✓
```

### Expected JSON Output
```json
{
  "type": "Contact Information",
  "variables": {
    "fields": [
      {
        "id": "full_name",
        "type": "text",
        "label": "Full Name",
        "required": true
      },
      {
        "id": "email",
        "type": "text",
        "label": "Email Address",
        "placeholder": "user@example.com",
        "required": true
      },
      {
        "id": "phone",
        "type": "text",
        "label": "Phone Number",
        "placeholder": "(555) 555-5555"
      },
      {
        "id": "contact_method",
        "type": "select",
        "label": "Preferred Contact Method",
        "required": true,
        "options": ["Email", "Phone", "Text"]
      }
    ]
  }
}
```

---

## Testing Scenarios

### Scenario 1: Basic Form Creation
1. Open the form builder
2. Enter "Test Form" as type
3. Add one text field with ID "test_field"
4. Save and verify success message
5. Check that the modal closes after 2 seconds

### Scenario 2: Field Editing
1. Create a form with 3 fields
2. Click edit (✏️) on the second field
3. Change the label
4. Click "Update Field"
5. Verify the change appears in both the list and preview

### Scenario 3: Field Reordering
1. Create a form with 5 fields
2. Move the last field to the top using ↑ arrows
3. Verify the preview reflects the new order
4. Save and check the JSON has the correct order

### Scenario 4: Field Duplication
1. Create a complex field with all properties
2. Click duplicate (📋)
3. Edit the duplicated field's ID
4. Verify both fields exist independently

### Scenario 5: Validation Testing
1. Try to save without entering a form type (should show alert)
2. Try to save with no fields (should show alert)
3. Try to add a field without ID (should show alert)
4. Try to add a field without label (should show alert)

### Scenario 6: Select Field Options
1. Create a select field
2. Enter options: "Option 1, Option 2, Option 3"
3. Check preview shows dropdown with all options
4. Verify JSON has options as array

### Scenario 7: Required Fields
1. Create 3 fields
2. Make 2 required, 1 optional
3. Check preview shows asterisks (*) on required fields
4. Verify JSON has correct "required" boolean values

### Scenario 8: Empty States
1. Open form builder with no fields
2. Check that empty state message appears in preview
3. Add a field
4. Verify empty state disappears

### Scenario 9: Unsaved Changes Warning
1. Create a form with fields
2. Try to close the modal
3. Verify confirmation dialog appears
4. Cancel and make sure data is preserved

### Scenario 10: Error Handling
1. Disconnect from internet
2. Try to save a form
3. Verify error message appears
4. Reconnect and retry successfully

---

## API Testing with cURL

### Test the Endpoint Directly

```bash
# Replace YOUR_AUTH_TOKEN with actual token from cookies
curl -X POST https://xnpm-iauo-ef2d.n7e.xano.io/api:DMF6LqEb/machine_variables \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "type": "Test Form",
    "variables": {
      "fields": [
        {
          "id": "test_field",
          "type": "text",
          "label": "Test Field",
          "required": true
        }
      ]
    }
  }'
```

### Expected Response
```json
{
  "id": 1,
  "type": "Test Form",
  "variables": {
    "fields": [...]
  },
  "created_at": 1699999999999
}
```

---

## Browser Console Testing

### Check Form Data Before Save

```javascript
// Open browser console while in the form builder
// This is the exact data structure being sent

const formData = {
  type: "Machine Configuration",
  variables: {
    fields: [
      {
        id: "machine_name",
        type: "text",
        label: "Machine Name",
        required: true
      }
    ]
  }
};

console.log('Form Data:', JSON.stringify(formData, null, 2));
```

### Monitor Network Requests

1. Open DevTools → Network tab
2. Filter by "machine_variables"
3. Create and save a form
4. Check the request payload and response

---

## Performance Testing

### Load Test
1. Create a form with 50+ fields
2. Verify preview still updates quickly
3. Check that save completes successfully
4. Monitor memory usage in DevTools

### Stress Test
1. Rapidly add/remove fields
2. Quickly reorder multiple fields
3. Spam edit/duplicate buttons
4. Verify UI remains responsive

---

## Accessibility Testing

### Keyboard Navigation
1. Open form builder
2. Tab through all inputs
3. Use Enter to add fields
4. Use Escape to close modal

### Screen Reader
1. Use VoiceOver (Mac) or NVDA (Windows)
2. Navigate through the form
3. Verify all labels are announced
4. Check button descriptions

---

## Browser Compatibility Testing

Test in these browsers:
- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ✅ Mobile Safari (iOS)
- ✅ Chrome Mobile (Android)

---

## Regression Testing Checklist

After any changes to the form builder:

- [ ] Can open modal from machines page
- [ ] Form type input works
- [ ] Can add text field
- [ ] Can add number field
- [ ] Can add select field
- [ ] Can edit fields
- [ ] Can remove fields
- [ ] Can duplicate fields
- [ ] Can reorder fields
- [ ] Preview updates in real-time
- [ ] Required checkbox works
- [ ] Placeholder text appears
- [ ] Select options parse correctly
- [ ] Save button posts to API
- [ ] Loading state displays
- [ ] Success message appears
- [ ] Error handling works
- [ ] Modal closes after save
- [ ] Unsaved changes warning works
- [ ] Responsive on mobile

---

## Debugging Tips

### Common Issues

**Preview not updating?**
- Click "Add Field" or "Update Field" to commit changes

**Save button disabled?**
- Check form type is filled in
- Ensure at least one field exists

**API error on save?**
- Check network tab for details
- Verify auth token is valid
- Check API endpoint is accessible

**Fields not reordering?**
- Make sure field is not at boundary (top/bottom)
- Click multiple times to move multiple positions

**Duplicate button creating identical IDs?**
- This is expected - you must edit the ID manually
- Update the ID before saving

---

## Success Criteria

✅ All test examples can be created  
✅ JSON output matches expected format  
✅ API receives correct data structure  
✅ UI is responsive and intuitive  
✅ No console errors during operation  
✅ All features work as documented  

---

**Ready to Test!** Use these examples to thoroughly test the Dynamic Form Builder feature.

