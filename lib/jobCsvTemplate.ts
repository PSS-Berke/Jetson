import * as XLSX from "xlsx";

/**
 * Generate a downloadable CSV/Excel template for bulk job uploads
 */
export function generateJobTemplate(format: "csv" | "xlsx" = "xlsx"): Blob {
  // Define headers
  const headers = [
    "schedule_type",
    "facility",
    "job_number",
    "sub_client",
    "description",
    "quantity",
    "start_date",
    "end_date",
    "process_type",
    "price_per_m",
    // Insert fields
    "paper_size",
    "pockets",
    // Sort fields
    "sort_type",
    // Inkjet fields
    "print_coverage",
    "num_addresses",
    // Label/Apply fields
    "application_type",
    "label_size",
    // Fold fields
    "fold_type",
    "paper_stock",
    // Laser/HP Press fields
    "print_type",
    "color",
  ];

  // Sample data rows
  const sampleData = [
    {
      schedule_type: "Hard Schedule",
      facility: "Bolingbrook",
      job_number: 33579,
      sub_client: "INDEED",
      description: "Oct 25 - ins 2 into 6x9 window",
      quantity: 9400000,
      start_date: "9/30/2025",
      end_date: "10/20/2025",
      process_type: "insert",
      price_per_m: 12.5,
      paper_size: "6x9",
      pockets: 2,
      sort_type: "",
      print_coverage: "",
      num_addresses: "",
      application_type: "",
      label_size: "",
      fold_type: "",
      paper_stock: "",
      print_type: "",
      color: "",
    },
    {
      schedule_type: "Soft Schedule",
      facility: "Lemont",
      job_number: 7006,
      sub_client: "CLEAN CHOICE",
      description: "INS 3 INTO #10",
      quantity: 3572000,
      start_date: "10/24/2025",
      end_date: "10/31/2025",
      process_type: "insert,sort",
      price_per_m: 15.0,
      paper_size: "#10",
      pockets: 3,
      sort_type: "Standard Sort",
      print_coverage: "",
      num_addresses: "",
      application_type: "",
      label_size: "",
      fold_type: "",
      paper_stock: "",
      print_type: "",
      color: "",
    },
    {
      schedule_type: "Hard Schedule",
      facility: "Bolingbrook",
      job_number: 31014,
      sub_client: "CAPITAL ONE",
      description: "CapOne, Wk 233, #77659, cell 1, #10 window",
      quantity: 2095000,
      start_date: "9/24/2025",
      end_date: "10/15/2025",
      process_type: "insert,inkjet",
      price_per_m: 18.75,
      paper_size: "#10",
      pockets: 1,
      sort_type: "",
      print_coverage: "Black & White",
      num_addresses: 2095000,
      application_type: "",
      label_size: "",
      fold_type: "",
      paper_stock: "",
      print_type: "",
      color: "",
    },
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Add instructions sheet
  const instructions = [
    ["Bulk Job Upload Template - Instructions"],
    [""],
    ["REQUIRED COLUMNS:"],
    ["- job_number: Unique job identifier (number)"],
    ["- quantity: Total quantity of pieces (number)"],
    [""],
    ["OPTIONAL COLUMNS (can be added later in the system):"],
    [
      "- process_type: Type of process - can be multiple separated by commas (insert, sort, inkjet, labelApply, fold, laser, hpPress)",
    ],
    ["- price_per_m: Price per thousand (decimal, defaults to 0)"],
    ['- schedule_type: "Hard Schedule" or "Soft Schedule" (defaults to Soft)'],
    ['- facility: "Bolingbrook" or "Lemont" (defaults to Bolingbrook)'],
    [
      "- sub_client: Client name - you will map this to actual clients during upload",
    ],
    ["- description: Job description"],
    [
      "- start_date: Start date (flexible formats: MM/DD/YYYY, YYYY-MM-DD, etc.)",
    ],
    ["- end_date: Due date (flexible formats)"],
    [""],
    ["PROCESS-SPECIFIC COLUMNS:"],
    ["Insert: paper_size (required), pockets (optional)"],
    ["  - paper_size options: 6x9, 6x12, 9x12, 10x13, 12x15, #10, 11x17"],
    [""],
    ["Sort: sort_type (required), paper_size (required)"],
    ["  - sort_type options: Standard Sort, Presort, EDDM, Full Service"],
    [""],
    [
      "Inkjet: print_coverage (required), paper_size (required), num_addresses (optional)",
    ],
    ["  - print_coverage options: Black & White, Full Color, Spot Color"],
    [""],
    [
      "Label/Apply: application_type (required), label_size (required), paper_size (required)",
    ],
    ["  - application_type options: Label Application, Affix, Wafer Seal"],
    ["  - label_size options: 1x2.625, 2x3, 3x5, 4x6, Custom"],
    [""],
    [
      "Fold: fold_type (required), paper_stock (required), paper_size (required)",
    ],
    [
      "  - fold_type options: Half Fold, Tri-fold, Z-fold, Double Parallel, Roll Fold",
    ],
    [
      "  - paper_stock options: 20# Bond, 24# Bond, 60# Text, 80# Text, 100# Text, Cardstock",
    ],
    [""],
    [
      "Laser: print_type (required), paper_stock (required), paper_size (required), color (required)",
    ],
    ["  - print_type options: Simplex (1-sided), Duplex (2-sided)"],
    ["  - color options: Black & White, Full Color"],
    [""],
    [
      "HP Press: print_type (required), paper_stock (required), paper_size (required)",
    ],
    ["  - print_type options: Simplex, Duplex"],
    [
      "  - paper_stock options: 80# Text, 100# Text, 80# Cover, 100# Cover, 12pt Cardstock",
    ],
    [""],
    ["NOTES:"],
    [
      '- Multiple process types: Separate with commas (e.g., "insert,sort,inkjet")',
    ],
    ["- Sub-clients will be auto-created if they don't exist"],
    ["- Dates will be parsed flexibly (MM/DD/YYYY recommended)"],
    ["- All numeric quantities should NOT include commas"],
  ];

  const wsInstructions = XLSX.utils.aoa_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

  // Add data sheet
  const wsData = XLSX.utils.json_to_sheet(sampleData, { header: headers });

  // Set column widths
  const colWidths = [
    { wch: 15 }, // schedule_type
    { wch: 12 }, // facility
    { wch: 12 }, // job_number
    { wch: 15 }, // sub_client
    { wch: 40 }, // description
    { wch: 12 }, // quantity
    { wch: 12 }, // start_date
    { wch: 12 }, // end_date
    { wch: 20 }, // process_type
    { wch: 12 }, // price_per_m
    { wch: 12 }, // paper_size
    { wch: 10 }, // pockets
    { wch: 15 }, // sort_type
    { wch: 15 }, // print_coverage
    { wch: 12 }, // num_addresses
    { wch: 15 }, // application_type
    { wch: 12 }, // label_size
    { wch: 15 }, // fold_type
    { wch: 15 }, // paper_stock
    { wch: 15 }, // print_type
    { wch: 15 }, // color
  ];
  wsData["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, wsData, "Jobs");

  // Generate file
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(wsData);
    return new Blob([csv], { type: "text/csv;charset=utf-8;" });
  } else {
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  }
}

/**
 * Trigger download of the template file
 */
export function downloadJobTemplate(format: "csv" | "xlsx" = "xlsx"): void {
  const blob = generateJobTemplate(format);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `job_upload_template.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
