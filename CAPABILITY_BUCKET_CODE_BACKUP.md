# Capability Bucket Implementation - Code Backup

This file contains the capability bucket implementation that was removed from DynamicRequirementFields.tsx on 2025-11-22.
This code can be restored when needed.

## Capability Bucket Features Removed

### 1. State Management (lines 28-29, 34-55)

```typescript
const [capabilityBuckets, setCapabilityBuckets] = useState<CapabilityBucket[]>([]);
const [isLoadingBuckets, setIsLoadingBuckets] = useState(false);

// Fetch capability buckets when process_type changes
useEffect(() => {
  if (!requirement.process_type) {
    setCapabilityBuckets([]);
    return;
  }

  const fetchBuckets = async () => {
    setIsLoadingBuckets(true);
    try {
      const buckets = await getCapabilityBuckets();
      setCapabilityBuckets(buckets);
    } catch (error) {
      console.error("[DynamicRequirementFields] Error fetching capability buckets:", error);
      setCapabilityBuckets([]);
    } finally {
      setIsLoadingBuckets(false);
    }
  };

  fetchBuckets();
}, [requirement.process_type]);
```

### 2. Bucket Change Handler (lines 193-251)

```typescript
// Handle bucket selection - clear existing fields and populate with bucket capabilities
const handleBucketChange = (bucketId: string) => {
  if (!bucketId) {
    onChange("capability_bucket_id", "");
    populatedBucketRef.current = null;
    return;
  }

  const bucketIdNum = parseInt(bucketId);
  const selectedBucket = capabilityBuckets.find(b => b.id === bucketIdNum);

  if (selectedBucket) {
    onChange("capability_bucket_id", bucketIdNum);

    // Clear dynamicFields so machine_variables fields are not displayed
    setDynamicFields([]);

    // Clear all existing capability fields (except process_type, price_per_m, and capability_bucket_id)
    // Get all keys from the requirement object
    const fieldsToClear = Object.keys(requirement);

    // Clear each field
    fieldsToClear.forEach(fieldName => {
      // Skip process_type, price_per_m, and capability_bucket_id
      if (fieldName !== "process_type" && fieldName !== "price_per_m" && fieldName !== "capability_bucket_id") {
        // Check if this field is in dynamicFields to determine its type
        const field = dynamicFields.find(f => f.name === fieldName);
        if (field) {
          const isBoolean = (field as any).originalType === "boolean";
          if (isBoolean) {
            onChange(fieldName, false);
          } else if (field.type === "number") {
            onChange(fieldName, 0);
          } else {
            onChange(fieldName, "");
          }
        } else {
          // For fields not in dynamicFields, clear to empty string
          onChange(fieldName, "");
        }
      }
    });

    // Populate fields with bucket capabilities
    // Only populate if we haven't already populated from this bucket
    if (populatedBucketRef.current !== bucketIdNum) {
      Object.entries(selectedBucket.capabilities).forEach(([key, value]) => {
        // Extract the actual value if it's an object with a "value" property
        let actualValue = value;
        if (typeof value === "object" && value !== null && !Array.isArray(value) && "value" in value) {
          actualValue = (value as any).value;
        }

        // Set the field value
        onChange(key, actualValue);
      });
      populatedBucketRef.current = bucketIdNum;
    }
  }
};
```

### 3. Capability Bucket UI (lines 458-623)

```typescript
{/* Capability Bucket Selector - shown after process type is selected */}
{requirement.process_type && (
  <div className="w-full">
    <label
      htmlFor="capability-bucket"
      className="block text-sm font-semibold text-[var(--text-dark)] mb-2"
    >
      Capability Bucket <span className="text-gray-500 text-xs font-normal">(optional)</span>
    </label>
    {isLoadingBuckets ? (
      <div className="flex items-center gap-2 text-sm text-[var(--text-light)]">
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        <span>Loading buckets...</span>
      </div>
    ) : (
      <select
        id="capability-bucket"
        value={requirement.capability_bucket_id ? String(requirement.capability_bucket_id) : ""}
        onChange={(e) => handleBucketChange(e.target.value)}
        className="w-full px-4 py-3 text-base border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)] transition-colors"
      >
        <option value="">Select a bucket (optional)...</option>
        {capabilityBuckets.map((bucket) => (
          <option key={bucket.id} value={bucket.id}>
            {bucket.name}
          </option>
        ))}
      </select>
    )}
    {capabilityBuckets.length === 0 && !isLoadingBuckets && (
      <p className="mt-1 text-xs text-gray-500 italic">
        No capability buckets available
      </p>
    )}

    {/* Display selected bucket capabilities */}
    {requirement.capability_bucket_id && !isLoadingBuckets && (() => {
      const selectedBucket = capabilityBuckets.find(
        b => b.id === requirement.capability_bucket_id
      );

      if (selectedBucket && selectedBucket.capabilities) {
        const capabilities = selectedBucket.capabilities;
        const capabilityEntries = Object.entries(capabilities);

        if (capabilityEntries.length > 0) {
          return (
            <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h5 className="text-sm font-semibold text-[var(--text-dark)] mb-2">
                Bucket Capabilities:
              </h5>
              <div className="space-y-1">
                {capabilityEntries.map(([key, value]) => {
                  // ... [full capability display logic here]
                  // See original file for complete implementation
                })}
              </div>
            </div>
          );
        }
      }
      return null;
    })()}
  </div>
)}
```

### 4. Conditional Logic Changes

**Line 66-70:** Don't fetch machine_variables if bucket is selected
```typescript
// Don't fetch machine_variables if a bucket is selected
if (requirement.capability_bucket_id) {
  setDynamicFields([]);
  return;
}
```

**Line 136:** Don't populate if bucket was selected
```typescript
if (populatedProcessTypeRef.current !== requirement.process_type && !requirement.capability_bucket_id) {
```

**Line 190:** Include capability_bucket_id in dependencies
```typescript
}, [requirement.process_type, requirement.capability_bucket_id]);
```

**Line 626-660:** Conditional rendering based on bucket selection
```typescript
{/* Dynamic Fields Based on Selected Process Type - Don't show if bucket is selected */}
{!requirement.capability_bucket_id && (
  // ... dynamic fields rendering
)}
```

**Line 670:** Don't show info badge if bucket is selected
```typescript
{!requirement.capability_bucket_id && dynamicFields.length > 0 && !isLoadingFields && (
```

**Line 435-437:** Clear bucket when process type changes
```typescript
// Clear bucket selection when process type changes
onChange("capability_bucket_id", "");
populatedBucketRef.current = null;
```

## API Import to Remove

From line 8:
```typescript
import { getMachineVariables, getCapabilityBuckets, type CapabilityBucket } from "@/lib/api";
```

Should become:
```typescript
import { getMachineVariables } from "@/lib/api";
```

## Ref to Remove

From line 31:
```typescript
const populatedBucketRef = useRef<number | null>(null);
```

---

## Restoration Instructions

To restore capability buckets:
1. Add back the imports from line 8
2. Add back state variables (lines 28-29)
3. Add back the bucket fetching useEffect (lines 34-55)
4. Add back handleBucketChange function (lines 193-251)
5. Add back the UI sections (lines 458-623)
6. Add back all conditional logic changes listed above
7. Restore the populatedBucketRef

This will fully restore the capability bucket functionality.
