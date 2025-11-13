import * as XLSX from "xlsx";

/**
 * Generates and downloads an Excel template file for production data import
 */
export function downloadExcelTemplate() {
  // Create sample data
  const data = [
    // Header row
    ["Job Number", "Production Quantity", "Date", "Notes"],
    // Example rows with instructions
    ["12345", 5000, "2025-01-15", "First batch completed"],
    ["12346", 3200, "2025-01-15", ""],
    ["12347", 1500, "", "Date will default to today if empty"],
  ];

  // Create a new workbook
  const workbook = XLSX.utils.book_new();

  // Create worksheet from data
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths for better readability
  worksheet["!cols"] = [
    { wch: 15 }, // Job Number
    { wch: 20 }, // Production Quantity
    { wch: 15 }, // Date
    { wch: 40 }, // Notes
  ];

  // Style the header row (row 1)
  const headerRange = XLSX.utils.decode_range(worksheet["!ref"] || "A1:D1");
  for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;

    // Add bold styling to header (note: styling support varies by library version)
    worksheet[cellAddress].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: "D3E4F7" } },
      alignment: { horizontal: "center" },
    };
  }

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Production Data");

  // Create instructions sheet
  const instructions = [
    ["Excel Import Instructions"],
    [""],
    ["Column Descriptions:"],
    [""],
    ["Job Number", "Required", "The job number from your system (e.g., 12345)"],
    [
      "Production Quantity",
      "Required",
      "Number of units produced (must be positive)",
    ],
    [
      "Date",
      "Optional",
      "Production date in YYYY-MM-DD or MM/DD/YYYY format. If empty, uses today's date.",
    ],
    ["Notes", "Optional", "Any additional notes about the production entry"],
    [""],
    ["Important Notes:"],
    [""],
    [
      "1. The job number must exist in your system",
      "Missing job numbers will show as errors",
    ],
    [
      "2. Production quantity must be a positive number",
      "Negative or zero values will be rejected",
    ],
    [
      "3. Date format should be YYYY-MM-DD or MM/DD/YYYY",
      "Other formats may cause errors",
    ],
    [
      "4. Remove these example rows before importing",
      "Only keep your actual data",
    ],
    [
      "5. Do not change the column headers",
      "The system expects these exact names",
    ],
    [""],
    ["Tips:"],
    [""],
    [
      "- You can have as many rows as needed",
      "The system will process all valid entries",
    ],
    [
      "- Invalid rows will be highlighted in the preview",
      "You can remove them before final upload",
    ],
    [
      "- The system checks for duplicate entries",
      "Warnings will be shown but upload is allowed",
    ],
    ["- Maximum file size is 5MB", "Consider splitting very large imports"],
  ];

  const instructionsWs = XLSX.utils.aoa_to_sheet(instructions);

  // Set column widths for instructions
  instructionsWs["!cols"] = [{ wch: 30 }, { wch: 50 }];

  // Add instructions sheet
  XLSX.utils.book_append_sheet(workbook, instructionsWs, "Instructions");

  // Generate Excel file
  const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  // Create blob and download
  const blob = new Blob([excelBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `production_import_template_${new Date().toISOString().split("T")[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates a CSV template as an alternative to Excel
 */
export function downloadCSVTemplate() {
  const csvContent = [
    "Job Number,Production Quantity,Date,Notes",
    "12345,5000,2025-01-15,First batch completed",
    "12346,3200,2025-01-15,",
    "12347,1500,,Date will default to today if empty",
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `production_import_template_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
