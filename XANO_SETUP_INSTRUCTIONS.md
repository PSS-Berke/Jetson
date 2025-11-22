# Xano Backend Setup Instructions for Groups & Rules Feature

This guide walks you through configuring the existing `is_grouped` field in your Xano backend to support the Groups & Rules filtering functionality.

## Overview

Good news! The `is_grouped` boolean field already exists in your `variable_combinations` table. We just need to:
1. ✅ ~~Add field~~ (Already exists!)
2. Verify the GET endpoint returns this field
3. Verify the POST endpoint accepts this field
4. Set existing groups to `is_grouped = true`

---

## Step 1: Verify the `is_grouped` Field Exists

### 1.1 Navigate to Your Database
1. Log in to your Xano workspace
2. Click on **Database** in the left sidebar
3. Find and click on the **variable_combinations** table

### 1.2 Confirm the Field
- You should see an `is_grouped` column in your `variable_combinations` table
- It should be a **boolean** type field
- Most/all existing records likely have `is_grouped = false` or `null`

---

## Step 2: Verify the GET Endpoint (Read Groups)

The `/variable_combinations/groups` endpoint needs to return the `is_grouped` field.

### 2.1 Navigate to the API Endpoint
1. Click on **API** in the left sidebar
2. Find the API group that contains your variable combinations endpoints (likely named something like `DMF6LqEb` based on your API URL)
3. Find and click on the **GET /variable_combinations/groups** endpoint

### 2.2 Check the Response
1. Look at the **Response** section of the endpoint
2. If you're using **"Get All Records"** or **"Query All Records"** function:
   - The `is_grouped` field should automatically be included since it's in the table
3. If you have a custom **Function Stack**:
   - Ensure the response includes all fields from the table, or specifically add `is_grouped` to the response

### 2.3 Test the Endpoint
1. Click the **Run & Debug** button (play icon)
2. Check the output to ensure `is_grouped` appears in the response
3. Example expected output:
```json
[
  {
    "id": 1,
    "rule_name": "My Group",
    "description": "Group description",
    "process_type": "insert",
    "is_grouped": false,
    "created_at": 1234567890
  }
]
```

---

## Step 3: Verify the POST Endpoint (Create Variable Combination)

The POST `/variable_combinations` endpoint needs to accept and save the `is_grouped` field.

### 3.1 Navigate to the POST Endpoint
1. In the **API** section
2. Find and click on **POST /variable_combinations**

### 3.2 Check Input Parameter
1. Click on **Inputs** section
2. Check if `is_grouped` is already listed as an input parameter
3. If NOT listed, click **+ Add Input** and configure:
   - **Name**: `is_grouped`
   - **Type**: **boolean**
   - **Required**: Uncheck (make it optional)
   - **Default Value**: `false`
4. Click **Save**

### 3.3 Verify the Create/Add Record Function
1. In the **Function Stack**, find the function that creates the record (likely "Add Record" or "Create variable_combinations")
2. Click on that function to open it
3. In the **Inputs** mapping section, you should see a list of fields
4. Check if the `is_grouped` field mapping exists:
   - **Field**: `is_grouped`
   - **Value**: Should be mapped to `inputs.is_grouped`
5. If not mapped, add the mapping to ensure the value from the API request is saved to the database

### 3.4 Test the Endpoint
1. Click **Run & Debug**
2. In the debug panel, add test data:
```json
{
  "rule_name": "Test Group",
  "description": "Testing is_grouped field",
  "process_type": "insert",
  "is_grouped": true
}
```
3. Click **Run**
4. Verify the response includes `"is_grouped": true`
5. Check the database table to confirm the record was created with `is_grouped = true`

---

## Step 4: Mark Existing Groups as `is_grouped = true`

If you have existing groups in your database that should be displayed in the Groups & Rules tab, you need to manually mark them as groups.

### 4.1 Identify Legitimate Groups
1. Go to **Database** > **variable_combinations**
2. Review your records to identify which ones are actual groups (not auto-generated configurations)
3. Look for records that:
   - Have meaningful `rule_name` values (not auto-generated)
   - Are intended to be reusable groups
   - Have multiple machines assigned to them

### 4.2 Update Records
For each legitimate group:
1. Click on the record row
2. Find the `is_grouped` field
3. Check the box to set it to `true`
4. Click **Save**

### 4.3 Bulk Update (Advanced)
If you have many groups to update, you can create a temporary endpoint:

1. Create a new **POST** endpoint (e.g., `/admin/mark-groups`)
2. Add a **Query All Records** function for `variable_combinations`
3. Add a **For Each** loop
4. Inside the loop, add an **Edit Record** function:
   - **Table**: variable_combinations
   - **Record ID**: `loop.item.id`
   - **Set Field**: `is_grouped` = `true`
   - **Condition**: Add a condition to only update records that match your criteria (e.g., specific rule_name patterns)
5. Run this endpoint once, then delete it

---

## Step 5: Verify the Integration

### 5.1 Test from the Frontend
1. Make sure your frontend code is deployed with the changes
2. Navigate to the **Machines** page
3. Click on the **Groups & Rules** tab
4. You should now see:
   - ✅ Only groups where `is_grouped = true`
   - ❌ No individual machines or auto-generated configurations

### 5.2 Test Creating a New Group
1. In your app, use the **Create Machine Wizard**
2. Go through the steps and select **"Create new group"** in Step 4
3. Enter a group name and description
4. Complete the wizard
5. Go back to **Groups & Rules** tab
6. Verify your new group appears in the list
7. Check Xano database to confirm `is_grouped = true` for the new record

---

## Troubleshooting

### Issue: `is_grouped` field not appearing in GET response
**Solution**:
- Verify the field exists in the database table
- Check if the endpoint is caching - try clearing cache or running in debug mode
- Verify the response includes all table fields

### Issue: POST endpoint returns error when including `is_grouped`
**Solution**:
- Make sure the input parameter exists in the endpoint inputs
- Verify the input type is set to `boolean`
- Check that the field mapping in the Add Record function is correct

### Issue: Groups still not showing in frontend
**Solution**:
- Verify existing groups have `is_grouped = true` in the database
- Check browser console for API errors
- Ensure the frontend filtering logic is deployed
- Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### Issue: All groups disappeared from the tab
**Solution**:
- This means no groups have `is_grouped = true` yet
- Follow Step 4 to mark existing groups
- Create a new group through the wizard to test

---

## Summary

After completing these steps:
- ✅ Your `variable_combinations` table has the `is_grouped` field (already existed!)
- ✅ The GET endpoint returns `is_grouped` for all records
- ✅ The POST endpoint accepts and saves `is_grouped` values
- ✅ Existing legitimate groups are marked with `is_grouped = true`
- ✅ The frontend only displays explicitly created groups

---

## Questions or Issues?

If you encounter any problems:
1. Check the Xano debugger logs for error messages
2. Verify field names match exactly (case-sensitive)
3. Ensure API endpoints are published (not just saved)
4. Test each endpoint individually using Xano's Run & Debug feature

