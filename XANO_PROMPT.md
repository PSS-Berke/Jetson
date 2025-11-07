# Xano Database Assistant Prompt - Job Cost Tracking

Copy and paste this entire prompt into Xano's database assistant:

---

I need you to create a complete database table and API endpoints for tracking job costs in my print production management system.

## Database Table

Create a table named `job_cost_entries` with the following structure:

**Table Name:** `job_cost_entries`

**Fields:**
1. `id` - integer, primary key, auto-increment
2. `job` - integer, required, foreign key to `jobs` table (ON DELETE CASCADE)
3. `date` - bigint, required (stores Unix timestamp in milliseconds)
4. `actual_cost_per_m` - decimal(10,2), required (actual cost per thousand pieces)
5. `notes` - text, nullable (optional notes about the cost entry)
6. `created_at` - bigint, required, default to current timestamp
7. `updated_at` - bigint, required, default to current timestamp
8. `facilities_id` - integer, nullable (for multi-facility support)

**Indexes:**
- Add index on `job` field
- Add index on `date` field
- Add index on `facilities_id` field

## API Endpoints

Create 4 API endpoints:

### 1. GET /job_cost_entries
**Purpose:** Fetch job cost entries with optional filtering

**Query Parameters:**
- `facilities_id` (integer, optional)
- `start_date` (bigint, optional)
- `end_date` (bigint, optional)

**Logic:**
- Query all records from `job_cost_entries` table
- If `facilities_id` is provided, filter where `facilities_id` equals the parameter
- If `start_date` is provided, filter where `date` >= `start_date`
- If `end_date` is provided, filter where `date` <= `end_date`
- Return the filtered results as JSON array

**Response:** 200 OK with array of job cost entries

---

### 2. POST /job_cost_entries
**Purpose:** Create a new job cost entry

**Request Body:**
- `job` (integer, required) - job ID
- `date` (bigint, required) - timestamp
- `actual_cost_per_m` (decimal, required) - cost per thousand
- `notes` (text, optional) - notes
- `facilities_id` (integer, optional) - facility ID

**Logic:**
- Set `created_at` to current timestamp
- Set `updated_at` to current timestamp
- Create new record in `job_cost_entries` table with all provided fields
- Return the created record

**Response:** 201 Created with the new job cost entry object

---

### 3. PATCH /job_cost_entries/{id}
**Purpose:** Update an existing job cost entry

**Path Parameter:**
- `id` (integer, required) - the cost entry ID to update

**Request Body:**
- `actual_cost_per_m` (decimal, optional) - new cost value
- `notes` (text, optional) - updated notes

**Logic:**
- Get the record from `job_cost_entries` where `id` equals path parameter
- If record not found, return 404 error
- Set `updated_at` to current timestamp
- Update the record with provided fields (only update fields that are provided)
- Return the updated record

**Response:** 200 OK with updated job cost entry, or 404 Not Found if entry doesn't exist

---

### 4. DELETE /job_cost_entries/{id}
**Purpose:** Delete a job cost entry

**Path Parameter:**
- `id` (integer, required) - the cost entry ID to delete

**Logic:**
- Get the record from `job_cost_entries` where `id` equals path parameter
- If record not found, return 404 error with message "Cost entry not found"
- Delete the record
- Return success response

**Response:** 204 No Content on success, or 404 Not Found if entry doesn't exist

---

## Additional Requirements

- All endpoints should require authentication
- Use the same authentication method as the existing `jobs` API endpoints
- Ensure proper error handling for foreign key violations (if job_id doesn't exist)
- All timestamp fields should use Unix time in milliseconds
- The `actual_cost_per_m` decimal field should accept values like 25.50, 100.00, etc.

Please create this table and all 4 endpoints now.
