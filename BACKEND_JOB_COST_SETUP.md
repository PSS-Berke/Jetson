# Backend Setup Guide: Job Cost Tracking

This guide provides step-by-step instructions for setting up the Xano backend infrastructure to support the Job Cost Analysis feature in the CFO/Financials tab.

## Overview

The job cost tracking feature requires:
- 1 new database table (`job_cost_entries`)
- 5 API endpoints (GET, POST, PATCH, DELETE operations)
- Foreign key relationship to existing `jobs` table

## Part 1: Database Table Setup

### Step 1: Create the `job_cost_entries` Table

1. **Navigate to Database**
   - Log into your Xano workspace
   - Go to **Database** in the left sidebar
   - Click **Add Table** (+ button)

2. **Name the Table**
   - Table Name: `job_cost_entries`
   - Click **Create**

3. **Add Fields** (click "+ Add Field" for each)

   | Field Name | Type | Settings |
   |------------|------|----------|
   | `id` | integer | Auto-increment, Primary Key (created automatically) |
   | `job` | integer | **Required**, Add Foreign Key to `jobs` table |
   | `date` | bigint | **Required** (Unix timestamp in milliseconds) |
   | `actual_cost_per_m` | decimal | **Required**, Precision: 10, Scale: 2 |
   | `notes` | text | Optional, can be null |
   | `created_at` | bigint | **Required**, Default: Current timestamp |
   | `updated_at` | bigint | **Required**, Default: Current timestamp |
   | `facilities_id` | integer | Optional, can be null |

4. **Configure Foreign Key Relationship**
   - Click on the `job` field
   - Enable "Foreign Key"
   - Select table: `jobs`
   - Select field: `id`
   - On Delete: **CASCADE** (when job is deleted, remove cost entries)

5. **Add Indexes for Performance**
   - Click **Indexes** tab at the top
   - Add index on `job` field (for fast lookups by job)
   - Add index on `date` field (for date range filtering)
   - Add index on `facilities_id` field (for facility filtering)

### Step 2: Verify Table Structure

Your `job_cost_entries` table should look like this:

```
job_cost_entries
├── id (integer, primary key, auto-increment)
├── job (integer, required, foreign key → jobs.id, CASCADE on delete)
├── date (bigint, required)
├── actual_cost_per_m (decimal(10,2), required)
├── notes (text, nullable)
├── created_at (bigint, required, default: now)
├── updated_at (bigint, required, default: now)
└── facilities_id (integer, nullable)

Indexes:
- idx_job (on job field)
- idx_date (on date field)
- idx_facilities_id (on facilities_id field)
```

---

## Part 2: API Endpoints Setup

### Endpoint 1: GET Job Cost Entries

**Purpose**: Fetch cost entries with optional filtering by facility and date range

1. **Create New Endpoint**
   - Go to **API** in left sidebar
   - Click **Add API Endpoint**
   - Method: **GET**
   - Path: `/job_cost_entries`

2. **Add Query Parameters**
   - Click **Add Input** → **Query Parameter**
   - Name: `facilities_id`, Type: integer, Required: No
   - Name: `start_date`, Type: bigint, Required: No
   - Name: `end_date`, Type: bigint, Required: No

3. **Build the Function Stack**

   **Function 1: Query Database**
   - Add function: **Query all records**
   - Table: `job_cost_entries`
   - Click **Add Filter** to add conditional filters:

   ```
   IF facilities_id is provided:
     WHERE facilities_id = query.facilities_id

   IF start_date is provided:
     AND date >= query.start_date

   IF end_date is provided:
     AND date <= query.end_date
   ```

   In Xano, this looks like:
   - Filter 1: `facilities_id` equals `query.facilities_id` (conditional: only if facilities_id is not null)
   - Filter 2: `date` >= `query.start_date` (conditional: only if start_date is not null)
   - Filter 3: `date` <= `query.end_date` (conditional: only if end_date is not null)

   **Function 2: Return Response**
   - Add function: **Response**
   - Status: 200
   - Body: `query_all_records` (the result from Function 1)

4. **Test the Endpoint**
   - Click **Run & Debug**
   - Try with no parameters (should return all entries)
   - Try with `facilities_id=1` (should filter by facility)
   - Try with `start_date=1699900000000&end_date=1730000000000` (should filter by date range)

---

### Endpoint 2: POST Create Job Cost Entry

**Purpose**: Create a single new cost entry

1. **Create New Endpoint**
   - Method: **POST**
   - Path: `/job_cost_entries`

2. **Add Request Body Inputs**
   - Click **Add Input** → **Body**
   - Name: `job`, Type: integer, Required: Yes
   - Name: `date`, Type: bigint, Required: Yes
   - Name: `actual_cost_per_m`, Type: decimal, Required: Yes
   - Name: `notes`, Type: text, Required: No
   - Name: `facilities_id`, Type: integer, Required: No

3. **Build the Function Stack**

   **Function 1: Set Timestamps**
   - Add function: **Set Variable**
   - Variable name: `now`
   - Value: `timestamp()` (use the timestamp function from the function picker)

   **Function 2: Add Record**
   - Add function: **Add record**
   - Table: `job_cost_entries`
   - Map fields:
     - `job` → `body.job`
     - `date` → `body.date`
     - `actual_cost_per_m` → `body.actual_cost_per_m`
     - `notes` → `body.notes`
     - `facilities_id` → `body.facilities_id`
     - `created_at` → `var.now`
     - `updated_at` → `var.now`

   **Function 3: Return Response**
   - Add function: **Response**
   - Status: 201 (Created)
   - Body: `add_record` (the created record from Function 2)

4. **Test the Endpoint**
   - Click **Run & Debug**
   - Use test body:
   ```json
   {
     "job": 1,
     "date": 1699900000000,
     "actual_cost_per_m": 25.50,
     "notes": "Test entry",
     "facilities_id": 1
   }
   ```
   - Verify record is created in database

---

### Endpoint 3: PATCH Update Job Cost Entry

**Purpose**: Update an existing cost entry

1. **Create New Endpoint**
   - Method: **PATCH**
   - Path: `/job_cost_entries/{id}`

2. **Add Path Parameter**
   - Click **Add Input** → **Path Parameter**
   - Name: `id`, Type: integer, Required: Yes

3. **Add Request Body Inputs**
   - Click **Add Input** → **Body**
   - Name: `actual_cost_per_m`, Type: decimal, Required: No
   - Name: `notes`, Type: text, Required: No

4. **Build the Function Stack**

   **Function 1: Get Existing Record**
   - Add function: **Get record**
   - Table: `job_cost_entries`
   - Filter: `id` equals `path.id`

   **Function 2: Check if Record Exists**
   - Add function: **Conditional**
   - Condition: `get_record` is null
   - If TRUE:
     - Add function: **Response**
     - Status: 404
     - Body: `{ "error": "Cost entry not found" }`

   **Function 3: Set Updated Timestamp**
   - Add function: **Set Variable**
   - Variable name: `now`
   - Value: `timestamp()`

   **Function 4: Edit Record**
   - Add function: **Edit record**
   - Table: `job_cost_entries`
   - Record to edit: `get_record` (from Function 1)
   - Map fields (only update provided fields):
     - `actual_cost_per_m` → `body.actual_cost_per_m` (conditional: only if provided)
     - `notes` → `body.notes` (conditional: only if provided)
     - `updated_at` → `var.now`

   **Function 5: Return Response**
   - Add function: **Response**
   - Status: 200
   - Body: `edit_record` (the updated record from Function 4)

5. **Test the Endpoint**
   - Click **Run & Debug**
   - Use path: `/job_cost_entries/1` (use an actual ID from your database)
   - Use test body:
   ```json
   {
     "actual_cost_per_m": 30.00,
     "notes": "Updated cost"
   }
   ```
   - Verify record is updated in database

---

### Endpoint 4: DELETE Job Cost Entry

**Purpose**: Delete a cost entry

1. **Create New Endpoint**
   - Method: **DELETE**
   - Path: `/job_cost_entries/{id}`

2. **Add Path Parameter**
   - Click **Add Input** → **Path Parameter**
   - Name: `id`, Type: integer, Required: Yes

3. **Build the Function Stack**

   **Function 1: Get Existing Record**
   - Add function: **Get record**
   - Table: `job_cost_entries`
   - Filter: `id` equals `path.id`

   **Function 2: Check if Record Exists**
   - Add function: **Conditional**
   - Condition: `get_record` is null
   - If TRUE:
     - Add function: **Response**
     - Status: 404
     - Body: `{ "error": "Cost entry not found" }`

   **Function 3: Delete Record**
   - Add function: **Delete record**
   - Table: `job_cost_entries`
   - Record to delete: `get_record` (from Function 1)

   **Function 4: Return Response**
   - Add function: **Response**
   - Status: 204 (No Content)
   - Body: (leave empty)

4. **Test the Endpoint**
   - Click **Run & Debug**
   - Use path: `/job_cost_entries/1` (use an actual ID)
   - Verify record is deleted from database

---

## Part 3: Authentication & Security

### Step 1: Add Authentication to All Endpoints

For each of the 4 endpoints you created:

1. **Add Authentication**
   - Open the endpoint
   - Click **Authentication** tab
   - Enable authentication (select your auth method - likely JWT or similar)
   - This ensures only authenticated users can access cost data

### Step 2: Add Permission Checks (Optional)

If you have role-based access:

1. **Check User Permissions**
   - Add a function at the start of each endpoint
   - Check if user has permission to view/edit financial data
   - Return 403 Forbidden if not authorized

---

## Part 4: Testing the Integration

### Step 1: Update API Base URL (if needed)

In your frontend code, ensure `lib/api.ts` has the correct Xano base URL:

```typescript
const API_BASE_URL = 'https://your-workspace.xano.io/api:your-api-group';
```

### Step 2: Test Frontend → Backend Flow

1. **Open the Financials Tab**
   - Navigate to Projections page
   - Switch to "Financials" view
   - Select a date range with active jobs

2. **Test Data Fetching**
   - Open browser DevTools → Network tab
   - Look for `GET /job_cost_entries?...` request
   - Should return 200 status (empty array `[]` if no entries yet)
   - **If you see 404**: Endpoint doesn't exist, re-check endpoint creation
   - **If you see 401**: Authentication issue, check auth headers

3. **Test Inline Cost Entry**
   - Scroll to "Job Cost Overview" section
   - Find a job row
   - In the "Set Total Cost" column, enter a value (e.g., `25.50`)
   - Press Enter or Tab
   - Watch Network tab for:
     - `POST /job_cost_entries` request
     - Should return 201 Created with the new entry
   - The Profit % column should update immediately
   - Refresh the page - cost should persist

4. **Test Batch Entry Modal**
   - Click "Batch Entry" button
   - Modal should open showing all jobs
   - Enter costs for multiple jobs
   - Click "Save Cost Entries"
   - Watch Network tab for:
     - Multiple `POST /job_cost_entries` requests (one per job)
     - All should return 201 Created
   - Success toast should appear
   - Table should update with new costs

5. **Test Cost Updates**
   - Change a cost value that already exists
   - Should see:
     - `DELETE /job_cost_entries/{id}` (removing old entry)
     - `POST /job_cost_entries` (creating new entry)
   - This is intentional - we replace entries rather than update to maintain clean data

### Step 3: Verify Profit Calculations

Expected calculations (you can verify with calculator):

```
Job Details:
- Quantity: 10,000 pieces
- Total Billing: $500
- Billing Rate per M: ($500 / 10,000) * 1000 = $50.00 per thousand

Cost Entry:
- Actual Cost per M: $30.00 per thousand

Profit Calculations:
- Profit per M: $50.00 - $30.00 = $20.00
- Profit %: ($20.00 / $50.00) * 100 = 40%
- Total Profit: (10,000 / 1000) * $20.00 = $200.00

Color Coding:
- Green (Excellent): Profit % >= 25%
- Blue (Good): Profit % >= 10% and < 25%
- Yellow (Warning): Profit % >= 0% and < 10%
- Red (Loss): Profit % < 0%
```

---

## Part 5: Troubleshooting

### Issue: 404 Not Found

**Symptoms**: Network tab shows 404 for `/job_cost_entries`

**Solutions**:
1. Verify endpoint exists in Xano API section
2. Check endpoint path matches exactly: `/job_cost_entries` (no trailing slash)
3. Ensure API is published (click "Publish" in Xano if needed)
4. Check API base URL in frontend `lib/api.ts`

### Issue: 401 Unauthorized

**Symptoms**: Network tab shows 401 for requests

**Solutions**:
1. Verify you're logged into the app
2. Check authentication token is being sent in headers
3. In Xano, verify endpoint authentication settings
4. Check token hasn't expired

### Issue: 500 Internal Server Error

**Symptoms**: Network tab shows 500 error

**Solutions**:
1. Open Xano endpoint
2. Click **Run & Debug**
3. Look at error message in debug panel
4. Common causes:
   - Missing required field in request body
   - Type mismatch (sending string instead of integer)
   - Foreign key violation (job ID doesn't exist)

### Issue: Costs Not Persisting

**Symptoms**: Enter cost, page refreshes, cost is gone

**Solutions**:
1. Check Network tab - is POST request successful?
2. Check Xano database - is record actually created?
3. Verify `created_at` and `updated_at` are being set
4. Check if GET request is filtering out the entry (date range issue)

### Issue: Duplicate Entries

**Symptoms**: Multiple cost entries for same job in same period

**Solutions**:
1. Verify delete logic is working (should delete old entries first)
2. Check `entry_ids` are being populated correctly
3. Add unique constraint in database (optional):
   - Unique index on (`job`, `date`, `facilities_id`)

---

## Part 6: Data Migration (Optional)

If you have existing cost data in spreadsheets or other systems:

### Step 1: Prepare CSV File

Create a CSV with columns:
```
job_id,date,actual_cost_per_m,notes,facilities_id
123,1699900000000,25.50,"Imported from Excel",1
124,1699900000000,30.00,"Imported from Excel",1
```

### Step 2: Import via Xano

1. Go to Database → `job_cost_entries` table
2. Click **Import** button
3. Upload your CSV
4. Map columns to fields
5. Set `created_at` and `updated_at` to current timestamp
6. Click **Import**

---

## Part 7: Expected Behavior Summary

Once everything is set up, here's what should work:

✅ **On Page Load**:
- GET request fetches existing cost entries for date range
- Table displays jobs with billing rates calculated from `total_billing`
- Jobs with cost data show profit calculations
- Jobs without cost data show "Click to enter" placeholder

✅ **Inline Cost Entry**:
- Click cell, enter value, press Enter
- POST request creates new entry
- Table updates immediately with profit calculations
- Cost persists on page refresh

✅ **Batch Entry**:
- Modal opens with all jobs in period
- Shows current costs from database
- "Add to Cost" increments existing cost
- "Set Total Cost" replaces existing cost
- Save button creates/updates all entries at once
- Modal closes, table refreshes with new data

✅ **Profit Metrics**:
- Summary cards show aggregate statistics
- Color-coded profit indicators
- "Jobs at Risk" identifies low-margin work
- Calculations match expected formulas

---

## Part 8: Next Steps

After backend is working:

1. **Add Data Validation**
   - In Xano, add min/max constraints on `actual_cost_per_m` (e.g., 0-1000)
   - Add validation to ensure `date` is reasonable (not in future)

2. **Add Audit Trail**
   - Create `job_cost_audit` table to track changes
   - Log who changed what and when

3. **Performance Optimization**
   - If you have thousands of entries, add pagination to GET endpoint
   - Add caching for frequently accessed date ranges

4. **Reports & Exports**
   - Add endpoint to export cost data as CSV
   - Add endpoint to generate profit reports

---

## Support

If you encounter issues:

1. **Check the logs**:
   - Browser DevTools → Console tab (frontend errors)
   - Browser DevTools → Network tab (API errors)
   - Xano → Run & Debug (backend errors)

2. **Verify data**:
   - Check database directly to see what's stored
   - Compare frontend display with database values

3. **Test endpoints individually**:
   - Use Xano's Run & Debug to test endpoints in isolation
   - Use Postman or curl to test API calls independently

---

**Setup Complete!** 🎉

Once you've completed all steps, your job cost tracking feature will be fully functional. The frontend code is already complete and waiting for the backend - as soon as you create these endpoints, everything will start working automatically.
