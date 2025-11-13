# DataTable Component

A flexible, reusable table component with bulk selection, inline editing, sorting, pagination, and mobile responsiveness.

## Features

- ✅ **Selection & Bulk Actions**: Select individual rows or all rows, perform bulk operations
- ✅ **Inline Editing**: Click cells to edit values directly in the table
- ✅ **Sorting**: Click column headers to sort ascending/descending
- ✅ **Pagination**: Navigate large datasets with configurable page sizes
- ✅ **Mobile Responsive**: Automatic card view on mobile devices
- ✅ **TypeScript**: Full type safety with comprehensive interfaces
- ✅ **Customizable**: Extensive configuration options for columns, actions, and behavior

## Basic Usage

```tsx
import { DataTable } from "@/app/components/DataTable";
import { Trash } from "lucide-react";

function MyComponent() {
  const [data, setData] = useState([
    { id: 1, name: "Item 1", quantity: 100, status: "active" },
    { id: 2, name: "Item 2", quantity: 200, status: "inactive" },
  ]);

  return (
    <DataTable
      data={data}
      columns={[
        { key: "id", label: "ID", sortable: true, width: "80px" },
        { key: "name", label: "Name", sortable: true },
        { key: "quantity", label: "Quantity", sortable: true, align: "right" },
        { key: "status", label: "Status", sortable: true },
      ]}
      pagination={{ enabled: true, pageSize: 25 }}
    />
  );
}
```

## Advanced Example: Jobs Table with Bulk Actions

```tsx
import { DataTable, BulkAction } from "@/app/components/DataTable";
import { Trash, Edit, CheckCircle } from "lucide-react";
import { bulkDeleteJobs, bulkUpdateJobs } from "@/lib/api";
import { ParsedJob } from "@/types";

function JobsTable() {
  const { data: jobs } = useSWR<ParsedJob[]>("/jobs", getJobs);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedJobs, setSelectedJobs] = useState<ParsedJob[]>([]);

  const handleBulkDelete = async (rows: ParsedJob[]) => {
    if (!confirm(`Delete ${rows.length} jobs?`)) return;

    try {
      const result = await bulkDeleteJobs(rows.map((j) => j.id));

      if (result.failures.length > 0) {
        alert(
          `Deleted ${result.success} jobs. ${result.failures.length} failed.`,
        );
      } else {
        alert(`Successfully deleted ${result.success} jobs`);
      }

      mutate("/jobs"); // Refresh data
    } catch (error) {
      alert("Error deleting jobs");
    }
  };

  const handleBulkStatusChange = async (
    rows: ParsedJob[],
    isHardScheduled: boolean,
  ) => {
    try {
      // Update status field based on your schema
      const updates = {
        // Adjust this based on your actual Job schema
        // For example: locked_weeks, or a specific status field
      };

      const result = await bulkUpdateJobs(
        rows.map((j) => j.id),
        updates,
      );

      if (result.failures.length > 0) {
        alert(
          `Updated ${result.success.length} jobs. ${result.failures.length} failed.`,
        );
      } else {
        alert(`Successfully updated ${result.success.length} jobs`);
      }

      mutate("/jobs"); // Refresh data
    } catch (error) {
      alert("Error updating jobs");
    }
  };

  const bulkActions: BulkAction<ParsedJob>[] = [
    {
      label: "Set Hard Scheduled",
      icon: <CheckCircle className="w-4 h-4" />,
      onClick: (rows) => handleBulkStatusChange(rows, true),
      variant: "primary",
    },
    {
      label: "Set Soft Scheduled",
      icon: <Edit className="w-4 h-4" />,
      onClick: (rows) => handleBulkStatusChange(rows, false),
      variant: "secondary",
    },
    {
      label: "Delete Selected",
      icon: <Trash className="w-4 h-4" />,
      onClick: handleBulkDelete,
      variant: "danger",
    },
  ];

  return (
    <DataTable<ParsedJob>
      data={jobs || []}
      columns={[
        {
          key: "job_number",
          label: "Job #",
          sortable: true,
          width: "100px",
          align: "left",
        },
        {
          key: "client.name",
          label: "Client",
          sortable: true,
          getValue: (row) => row.client?.name || "N/A",
        },
        {
          key: "job_name",
          label: "Job Name",
          sortable: true,
        },
        {
          key: "quantity",
          label: "Quantity",
          sortable: true,
          align: "right",
          render: (value) => value.toLocaleString(),
        },
        {
          key: "start_date",
          label: "Start Date",
          sortable: true,
          render: (value) => new Date(value).toLocaleDateString(),
        },
        {
          key: "due_date",
          label: "Due Date",
          sortable: true,
          render: (value) => new Date(value).toLocaleDateString(),
        },
      ]}
      selection={{
        enabled: true,
        selectAllEnabled: true,
        bulkActions,
        onSelectionChange: (ids, rows) => {
          setSelectedIds(ids);
          setSelectedJobs(rows);
        },
      }}
      pagination={{
        enabled: true,
        pageSize: 50,
        pageSizeOptions: [25, 50, 100, 200],
      }}
      mobile={{
        viewMode: "cards",
        cardTemplate: (job, isSelected, onToggle) => (
          <div>
            <div className="flex justify-between mb-2">
              <input type="checkbox" checked={isSelected} onChange={onToggle} />
              <span className="font-bold">#{job.job_number}</span>
            </div>
            <div className="space-y-1">
              <div>
                <strong>Client:</strong> {job.client?.name}
              </div>
              <div>
                <strong>Name:</strong> {job.job_name}
              </div>
              <div>
                <strong>Qty:</strong> {job.quantity.toLocaleString()}
              </div>
            </div>
          </div>
        ),
      }}
      striped
      hover
      emptyMessage="No jobs found"
    />
  );
}
```

## Inline Editing Example

```tsx
<DataTable
  data={data}
  columns={[
    { key: "id", label: "ID", sortable: true },
    {
      key: "actual_quantity",
      label: "Actual Quantity",
      sortable: true,
      editable: true,
      editType: "number",
      align: "right",
    },
    {
      key: "price",
      label: "Price",
      sortable: true,
      editable: true,
      editType: "currency",
      align: "right",
    },
  ]}
  inlineEdit={{
    enabled: true,
    onSave: async (rowId, field, value, row) => {
      // Save to API
      await updateProductionEntry(rowId, { [field]: value });
      mutate("/production"); // Refresh data
    },
  }}
/>
```

## Configuration Options

### Column Configuration

```typescript
interface ColumnConfig<T> {
  key: string; // Data field key (supports nested: 'client.name')
  label: string; // Column header text
  sortable?: boolean; // Enable sorting
  render?: (value, row) => ReactNode; // Custom cell renderer
  editable?: boolean; // Enable inline editing
  editType?: "text" | "number" | "currency" | "date";
  editValidator?: (value: string) => boolean;
  width?: string; // Column width (e.g., '100px', '20%')
  align?: "left" | "center" | "right";
  mobileHidden?: boolean; // Hide on mobile card view
  getValue?: (row: T) => any; // Custom value getter for nested data
}
```

### Selection Configuration

```typescript
interface SelectionConfig<T> {
  enabled: boolean;
  selectAllEnabled?: boolean; // Show "Select All" checkbox
  bulkActions?: BulkAction<T>[];
  onSelectionChange?: (selectedIds: number[], selectedRows: T[]) => void;
}

interface BulkAction<T> {
  label: string;
  icon?: ReactNode;
  onClick: (selectedRows: T[]) => void | Promise<void>;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
}
```

### Pagination Configuration

```typescript
interface PaginationConfig {
  enabled: boolean;
  pageSize: number;
  pageSizeOptions?: number[]; // Default: [10, 25, 50, 100]
  onPageChange?: (page: number, pageSize: number) => void;
}
```

### Mobile Configuration

```typescript
interface MobileConfig<T> {
  viewMode?: "cards" | "table"; // Default: 'cards'
  cardTemplate?: (
    row: T,
    isSelected: boolean,
    onToggle: () => void,
  ) => ReactNode;
  visibleColumns?: string[]; // Limit columns in mobile table view
}
```

## API Methods

### Bulk Operations

```typescript
import { bulkDeleteJobs, bulkUpdateJobs } from "@/lib/api";

// Bulk delete
const result = await bulkDeleteJobs([1, 2, 3, 4, 5]);
console.log(`Deleted ${result.success} jobs`);
console.log(`Failed: ${result.failures.length}`);

// Bulk update
const result = await bulkUpdateJobs(
  [1, 2, 3, 4, 5],
  { status: "completed" }, // Updates to apply
);
console.log(`Updated ${result.success.length} jobs`);
```

## Styling

The DataTable uses Tailwind CSS classes and follows the existing design system:

- Uses CSS variables: `--primary-blue`, `--dark-blue`, `--text-dark`, `--text-light`, `--border`
- Responsive breakpoint: `768px` (mobile < 768px)
- Hover states on rows and buttons
- Selected row highlighting with blue background
- Stripe pattern for better readability

## Integration with Existing Tables

To migrate existing tables to use DataTable:

1. **ProductionComparisonTable** → Use DataTable with inline editing for actual_quantity
2. **ProjectionsTable** → Use DataTable with custom render for time periods
3. **JobCostComparisonTable** → Use DataTable with inline editing for actual_cost

Example migration:

```tsx
// Before: Custom table implementation
<table>
  <thead>...</thead>
  <tbody>...</tbody>
</table>

// After: DataTable
<DataTable
  data={jobs}
  columns={columns}
  selection={{ enabled: true, bulkActions }}
  pagination={{ enabled: true, pageSize: 50 }}
/>
```

## Notes

- The component automatically handles mobile responsiveness
- Selection state is managed internally but exposed via `onSelectionChange`
- Sorting is client-side by default (for server-side sorting, use `onSortChange`)
- All bulk actions show confirmation UI via the DataTableBulkActions toolbar
- Inline editing shows visual feedback (blue border) and saves on blur or Enter key
