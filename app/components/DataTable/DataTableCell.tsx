import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { ColumnConfig } from "./DataTableTypes";

interface DataTableCellProps<T> {
  row: T;
  column: ColumnConfig<T>;
  value: any;
  isEditable: boolean;
  onSave?: (value: any) => Promise<void>;
  onCancel?: () => void;
}

export function DataTableCell<T>({
  row,
  column,
  value,
  isEditable,
  onSave,
  onCancel,
}: DataTableCellProps<T>) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const alignClass =
    column.align === "right"
      ? "text-right"
      : column.align === "center"
        ? "text-center"
        : "text-left";

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    if (!isEditable) return;

    // Convert value to string for editing
    let initialValue = value ?? "";
    if (column.editType === "currency" && typeof value === "number") {
      initialValue = value.toString();
    } else if (column.editType === "number" && typeof value === "number") {
      initialValue = value.toString();
    }

    setEditValue(initialValue);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!onSave) return;

    // Validate
    if (column.editValidator && !column.editValidator(editValue)) {
      return;
    }

    // Parse value based on type
    let parsedValue: any = editValue;
    if (column.editType === "number" || column.editType === "currency") {
      const num = parseFloat(editValue);
      if (isNaN(num)) {
        return;
      }
      parsedValue = num;
    }

    setIsSaving(true);
    try {
      await onSave(parsedValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving cell:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValue("");
    onCancel?.();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  // Render custom content
  if (column.render && !isEditing) {
    return (
      <td
        className={`px-3 py-2 ${alignClass} ${isEditable ? "cursor-pointer hover:bg-gray-50" : ""}`}
        onClick={handleStartEdit}
        style={{ width: column.width }}
      >
        {column.render(value, row)}
      </td>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <td className={`px-3 py-2 ${alignClass}`} style={{ width: column.width }}>
        <input
          ref={inputRef}
          type={
            column.editType === "number" || column.editType === "currency"
              ? "number"
              : "text"
          }
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isSaving}
          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          step={column.editType === "currency" ? "0.01" : undefined}
        />
      </td>
    );
  }

  // Display mode
  let displayValue = value;
  if (column.editType === "currency" && typeof value === "number") {
    displayValue = `$${value.toFixed(2)}`;
  } else if (column.editType === "number" && typeof value === "number") {
    displayValue = value.toLocaleString();
  } else if (value === null || value === undefined) {
    displayValue = "-";
  }

  return (
    <td
      className={`px-3 py-2 ${alignClass} ${isEditable ? "cursor-pointer hover:bg-gray-50" : ""}`}
      onClick={handleStartEdit}
      style={{ width: column.width }}
    >
      {displayValue}
    </td>
  );
}
