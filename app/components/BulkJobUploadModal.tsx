"use client";

import { useState, useEffect } from "react";
import {
  X,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Edit2,
} from "lucide-react";
import ExcelUploadZone from "./ExcelUploadZone";
import { parseJobCsv, type ParsedBulkJob } from "@/lib/jobCsvParser";
import { downloadJobTemplate } from "@/lib/jobCsvTemplate";
import { batchCreateJobs, getToken } from "@/lib/api";
import type { Job } from "@/types";

interface BulkJobUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ClientMapping {
  subClient: string;
  clientId: number | null;
  subClientName: string;
}

interface Client {
  id: number;
  name: string;
  created_at: number;
}

type UploadStep = "upload" | "mapping" | "preview" | "uploading" | "complete";

export default function BulkJobUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkJobUploadModalProps) {
  const [step, setStep] = useState<UploadStep>("upload");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [file, setFile] = useState<File | null>(null);
  const [parsedJobs, setParsedJobs] = useState<ParsedBulkJob[]>([]);
  const [subClients, setSubClients] = useState<string[]>([]);
  const [clientMappings, setClientMappings] = useState<ClientMapping[]>([]);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [uploadResults, setUploadResults] = useState<{
    success: Job[];
    failures: { job: Partial<Job>; error: string }[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [editingJob, setEditingJob] = useState<number | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);

  // Fetch clients from API
  useEffect(() => {
    const fetchClients = async () => {
      setLoadingClients(true);
      try {
        const token = getToken();
        const response = await fetch(
          "https://xnpm-iauo-ef2d.n7e.xano.io/api:a2ap84-I/clients",
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          setClients(data);
        } else {
          console.error(
            "Error fetching clients:",
            response.status,
            await response.text(),
          );
        }
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setLoadingClients(false);
      }
    };

    if (isOpen) {
      fetchClients();
    }
  }, [isOpen]);

  const handleFileUpload = async (uploadedFile: File) => {
    setFile(uploadedFile);
    setErrorMessage("");

    try {
      const result = await parseJobCsv(uploadedFile);

      if (result.errors.length > 0) {
        setErrorMessage(result.errors.join("\n"));
        return;
      }

      setParsedJobs(result.jobs);
      setSubClients(result.subClients);

      // Initialize client mappings with automatic matching
      const mappings: ClientMapping[] = result.subClients.map((sc) => {
        // Try to find an existing client with matching name (case-insensitive)
        const existingClient = clients.find(
          (c) => c.name.toLowerCase() === sc.toLowerCase(),
        );

        return {
          subClient: sc,
          clientId: existingClient?.id || null,
          subClientName: sc,
        };
      });
      setClientMappings(mappings);

      // If no sub-clients to map, skip to preview
      if (result.subClients.length === 0) {
        setStep("preview");
      } else {
        setStep("mapping");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to parse file",
      );
    }
  };

  const handleMappingComplete = () => {
    setErrorMessage("");
    setStep("preview");
  };

  const handleUpload = async () => {
    setStep("uploading");
    setUploadProgress({ current: 0, total: parsedJobs.length });

    // Filter out jobs with errors
    const validJobs = parsedJobs.filter((job) => job.errors.length === 0);

    if (validJobs.length === 0) {
      setErrorMessage("No valid jobs to upload");
      setStep("preview");
      return;
    }

    // First, create any new clients that don't exist yet
    const token = getToken();
    const updatedMappings = [...clientMappings];

    for (let i = 0; i < updatedMappings.length; i++) {
      const mapping = updatedMappings[i];

      // If no client is mapped, create a new client with the sub-client name
      if (!mapping.clientId) {
        try {
          const response = await fetch(
            "https://xnpm-iauo-ef2d.n7e.xano.io/api:a2ap84-I/clients",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: mapping.subClient,
              }),
            },
          );

          if (response.ok) {
            const newClient = await response.json();
            updatedMappings[i].clientId = newClient.id;
            console.log(
              `[BulkJobUpload] Created new client: ${mapping.subClient} with ID ${newClient.id}`,
            );
          } else {
            console.error(
              `[BulkJobUpload] Failed to create client ${mapping.subClient}:`,
              await response.text(),
            );
          }
        } catch (error) {
          console.error(
            `[BulkJobUpload] Error creating client ${mapping.subClient}:`,
            error,
          );
        }
      }
    }

    // Update the mappings state with new client IDs
    setClientMappings(updatedMappings);

    // Convert parsed jobs to API format
    const jobsToCreate: Partial<Job>[] = validJobs.map((pj) => {
      // Find client mapping for this job's sub_client (use updatedMappings which now has new client IDs)
      const mapping = updatedMappings.find(
        (m) => m.subClient === pj.sub_client,
      );

      console.log(`[BulkJobUpload] Job ${pj.job_number}:`, {
        sub_client_from_csv: pj.sub_client,
        found_mapping: mapping,
        mapped_client_id: mapping?.clientId,
        all_mappings: updatedMappings,
      });

      // Warn if no client mapping found
      if (!mapping && pj.sub_client) {
        console.warn(
          `[BulkJobUpload] WARNING: No client mapping found for job ${pj.job_number}, sub_client: "${pj.sub_client}"`,
        );
      }

      // Calculate weekly split if dates are provided
      let weekly_split: number[] | undefined;
      if (pj.start_date && pj.end_date) {
        const weeks = Math.ceil(
          (pj.end_date.getTime() - pj.start_date.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        );

        // Handle invalid date ranges (end before start)
        if (weeks <= 0) {
          console.warn(
            `[BulkJobUpload] Job ${pj.job_number}: Invalid date range - end date before start date. Start: ${pj.start_date}, End: ${pj.end_date}`,
          );
        } else {
          const perWeek = Math.floor(pj.quantity / Math.max(weeks, 1));
          weekly_split = Array(Math.max(weeks, 1)).fill(perWeek);
          // Add remainder to last week
          const remainder = pj.quantity - perWeek * weeks;
          if (remainder > 0 && weekly_split.length > 0) {
            weekly_split[weekly_split.length - 1] += remainder;
          }
          console.log(
            `[BulkJobUpload] Job ${pj.job_number}: Created weekly split for ${weeks} weeks:`,
            weekly_split,
          );
        }
      } else {
        console.warn(
          `[BulkJobUpload] Job ${pj.job_number}: Missing dates - Start: ${pj.start_date}, End: ${pj.end_date}`,
        );
      }

      // Convert weekly split to daily split (7 days per week, all on Monday for simplicity)
      const daily_split = weekly_split?.map((weekTotal) => {
        const days = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
        days[1] = weekTotal; // Put all pieces on Monday
        return days;
      });

      // Calculate total billing from requirements (if any)
      const totalBilling =
        pj.requirements.length > 0
          ? pj.requirements
              .reduce(
                (sum, req) => sum + (pj.quantity / 1000) * req.price_per_m,
                0,
              )
              .toFixed(2)
          : "0";

      return {
        job_number: pj.job_number,
        clients_id: mapping?.clientId || undefined,
        client: { name: "" },
        sub_clients_id: undefined, // Will be created if needed
        facilities_id: pj.facility
          ? pj.facility.toLowerCase().includes("lemont") ||
            pj.facility.toLowerCase().includes("shakopee")
            ? 2
            : 1
          : 1,
        job_name: pj.description || undefined,
        description: pj.description || undefined,
        quantity: pj.quantity,
        start_date: pj.start_date?.getTime(),
        due_date: pj.end_date?.getTime(),
        service_type: pj.process_types[0] || "insert", // Default to insert if no process type
        pockets: pj.requirements[0]?.pockets?.toString() || "2",
        csr: undefined,
        prgm: undefined,
        machines_id: "",
        requirements:
          pj.requirements.length > 0
            ? JSON.stringify(pj.requirements)
            : JSON.stringify([]), // Empty array if no requirements
        price_per_m: pj.requirements[0]?.price_per_m?.toString() || "0",
        add_on_charges: "0",
        ext_price: "0",
        total_billing: totalBilling,
        daily_split,
        confirmed: pj.schedule_type
          ? pj.schedule_type.toLowerCase().includes("hard")
          : false,
      };
    });

    try {
      const results = await batchCreateJobs(jobsToCreate, (current, total) => {
        setUploadProgress({ current, total });
      });

      setUploadResults(results);
      setStep("complete");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setStep("preview");
    }
  };

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRows(newExpanded);
  };

  const handleEditJob = (index: number, field: string, value: any) => {
    const newJobs = [...parsedJobs];
    const job = newJobs[index];

    // Update the field
    switch (field) {
      case "job_number":
        job.job_number = parseInt(value) || 0;
        job.errors = job.errors.filter((e) => !e.includes("job_number"));
        if (isNaN(job.job_number)) {
          job.errors.push("Invalid job_number");
        }
        break;
      case "quantity":
        job.quantity = parseInt(value) || 0;
        job.errors = job.errors.filter((e) => !e.includes("quantity"));
        if (isNaN(job.quantity) || job.quantity <= 0) {
          job.errors.push("Invalid quantity");
        }
        break;
      case "sub_client":
        job.sub_client = value;
        if (value && !subClients.includes(value)) {
          setSubClients([...subClients, value]);
          setClientMappings([
            ...clientMappings,
            { subClient: value, clientId: null, subClientName: value },
          ]);
        }
        break;
      case "description":
        job.description = value;
        break;
      case "facility":
        job.facility = value;
        break;
      case "schedule_type":
        job.schedule_type = value;
        break;
      case "start_date":
        job.start_date = value ? new Date(value) : undefined;
        break;
      case "end_date":
        job.end_date = value ? new Date(value) : undefined;
        break;
    }

    setParsedJobs(newJobs);
  };

  const handleClose = () => {
    // Reset all state
    setStep("upload");
    setFile(null);
    setParsedJobs([]);
    setSubClients([]);
    setClientMappings([]);
    setUploadProgress({ current: 0, total: 0 });
    setUploadResults(null);
    setErrorMessage("");
    setExpandedRows(new Set());
    setEditingJob(null);
    onClose();
  };

  const handleComplete = () => {
    onSuccess();
    handleClose();
  };

  if (!isOpen) return null;

  const validJobsCount = parsedJobs.filter((j) => j.errors.length === 0).length;
  const invalidJobsCount = parsedJobs.filter((j) => j.errors.length > 0).length;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-[var(--dark-blue)]">
            Bulk Job Upload
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload CSV or Excel File
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Upload a CSV or Excel file containing your jobs. Download the
                  template if you need a starting point.
                </p>
                <button
                  onClick={() => downloadJobTemplate("xlsx")}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              <ExcelUploadZone onFileSelect={handleFileUpload} />

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Error</p>
                      <p className="text-sm text-red-600 whitespace-pre-wrap">
                        {errorMessage}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Client Mapping */}
          {step === "mapping" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Map Sub-Clients to Clients
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Match the sub-clients from your CSV file to existing clients,
                  or leave blank to create new clients automatically. Clients
                  are automatically matched by name where possible.
                </p>
              </div>

              <div className="space-y-4">
                {clientMappings.map((mapping, index) => (
                  <div
                    key={mapping.subClient}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          CSV Sub-Client
                        </label>
                        <div className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-900">
                          {mapping.subClient}
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Select Client
                        </label>
                        <select
                          value={mapping.clientId || ""}
                          onChange={(e) => {
                            const newMappings = [...clientMappings];
                            newMappings[index].clientId = e.target.value
                              ? parseInt(e.target.value)
                              : null;
                            setClientMappings(newMappings);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          disabled={loadingClients}
                        >
                          <option value="">
                            {loadingClients
                              ? "Loading clients..."
                              : "Create new client"}
                          </option>
                          {clients.map((client) => (
                            <option key={client.id} value={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                        {!mapping.clientId && (
                          <p className="text-xs text-blue-600 mt-1">
                            ✓ Will create new client: &quot;{mapping.subClient}
                            &quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Error</p>
                      <p className="text-sm text-red-600">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setStep("upload")}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleMappingComplete}
                  className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Continue to Preview
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === "preview" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Preview Jobs
                  </h3>
                  <p className="text-sm text-gray-600">
                    Review the jobs before uploading. Jobs with errors will be
                    skipped.
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{validJobsCount} Valid</span>
                  </div>
                  {invalidJobsCount > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span>{invalidJobsCount} Invalid</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-y-auto max-h-[500px]">
                  <div className="space-y-2 p-2">
                    {parsedJobs.map((job, index) => {
                      const hasErrors = job.errors.length > 0;
                      const hasWarnings = job.warnings.length > 0;
                      const isExpanded = expandedRows.has(index);
                      const mapping = clientMappings.find(
                        (m) => m.subClient === job.sub_client,
                      );
                      const clientName = mapping
                        ? clients.find((c) => c.id === mapping.clientId)?.name
                        : job.sub_client;

                      return (
                        <div
                          key={index}
                          className={`border rounded-lg ${hasErrors ? "border-red-300 bg-red-50" : hasWarnings ? "border-yellow-300 bg-yellow-50" : "border-gray-200 bg-white"}`}
                        >
                          {/* Collapsed Row */}
                          <div
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-opacity-75"
                            onClick={() => toggleRowExpansion(index)}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              <div className="flex items-center gap-2">
                                {hasErrors ? (
                                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                                ) : hasWarnings ? (
                                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                                ) : (
                                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                                )}
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                )}
                              </div>
                              <div className="flex-1 grid grid-cols-6 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">
                                    Job #
                                    {isNaN(job.job_number)
                                      ? "N/A"
                                      : job.job_number}
                                  </span>
                                </div>
                                <div className="text-gray-600">
                                  {clientName || "-"}
                                </div>
                                <div className="text-gray-600">
                                  {isNaN(job.quantity)
                                    ? "0"
                                    : job.quantity.toLocaleString()}{" "}
                                  pcs
                                </div>
                                <div className="text-gray-600">
                                  {job.process_types.length > 0
                                    ? job.process_types.join(", ")
                                    : "None"}
                                </div>
                                <div className="text-gray-600">
                                  {job.start_date
                                    ? job.start_date.toLocaleDateString()
                                    : "-"}
                                </div>
                                <div className="text-gray-600">
                                  {job.end_date
                                    ? job.end_date.toLocaleDateString()
                                    : "-"}
                                </div>
                              </div>
                            </div>
                            {(hasErrors || hasWarnings) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingJob(
                                    editingJob === index ? null : index,
                                  );
                                }}
                                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                            )}
                          </div>

                          {/* Expanded Details */}
                          {isExpanded && (
                            <div className="border-t border-gray-200 p-4 bg-white">
                              {/* Errors */}
                              {hasErrors && (
                                <div className="mb-4">
                                  <p className="font-semibold text-red-800 mb-2">
                                    Errors:
                                  </p>
                                  <ul className="list-disc list-inside space-y-1">
                                    {job.errors.map((error, i) => (
                                      <li
                                        key={i}
                                        className="text-sm text-red-700"
                                      >
                                        {error}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Warnings */}
                              {hasWarnings && (
                                <div className="mb-4">
                                  <p className="font-semibold text-yellow-800 mb-2">
                                    Warnings:
                                  </p>
                                  <ul className="list-disc list-inside space-y-1">
                                    {job.warnings.map((warning, i) => (
                                      <li
                                        key={i}
                                        className="text-sm text-yellow-700"
                                      >
                                        {warning}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Edit Form */}
                              {editingJob === index && (
                                <div className="space-y-4 pt-4 border-t border-gray-200">
                                  <p className="font-semibold text-gray-900">
                                    Edit Job Details:
                                  </p>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Job Number *
                                      </label>
                                      <input
                                        type="number"
                                        value={
                                          isNaN(job.job_number)
                                            ? ""
                                            : job.job_number
                                        }
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "job_number",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Quantity *
                                      </label>
                                      <input
                                        type="number"
                                        value={
                                          isNaN(job.quantity)
                                            ? ""
                                            : job.quantity
                                        }
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "quantity",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Sub-Client
                                      </label>
                                      <input
                                        type="text"
                                        value={job.sub_client}
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "sub_client",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Facility
                                      </label>
                                      <select
                                        value={job.facility || "Bolingbrook"}
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "facility",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="Bolingbrook">
                                          Bolingbrook
                                        </option>
                                        <option value="Lemont">Lemont</option>
                                        <option value="Shakopee">
                                          Shakopee
                                        </option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Schedule Type
                                      </label>
                                      <select
                                        value={
                                          job.schedule_type || "Soft Schedule"
                                        }
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "schedule_type",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="Hard Schedule">
                                          Hard Schedule
                                        </option>
                                        <option value="Soft Schedule">
                                          Soft Schedule
                                        </option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                      </label>
                                      <input
                                        type="text"
                                        value={job.description || ""}
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "description",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Start Date
                                      </label>
                                      <input
                                        type="date"
                                        value={
                                          job.start_date
                                            ? job.start_date
                                                .toISOString()
                                                .split("T")[0]
                                            : ""
                                        }
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "start_date",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        End Date
                                      </label>
                                      <input
                                        type="date"
                                        value={
                                          job.end_date
                                            ? job.end_date
                                                .toISOString()
                                                .split("T")[0]
                                            : ""
                                        }
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "end_date",
                                            e.target.value,
                                          )
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Error</p>
                      <p className="text-sm text-red-600">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() =>
                    setStep(subClients.length > 0 ? "mapping" : "upload")
                  }
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
                >
                  Back
                </button>
                <button
                  onClick={handleUpload}
                  disabled={validJobsCount === 0}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload {validJobsCount} Job{validJobsCount !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Uploading */}
          {step === "uploading" && (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Uploading Jobs...
                </h3>
                <p className="text-sm text-gray-600">
                  {uploadProgress.current} of {uploadProgress.total} jobs
                  processed
                </p>
              </div>
              <div className="w-full max-w-md">
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(uploadProgress.current / uploadProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === "complete" && uploadResults && (
            <div className="space-y-6">
              <div className="text-center">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Upload Complete!
                </h3>
                <p className="text-sm text-gray-600">
                  {uploadResults.success.length} job
                  {uploadResults.success.length !== 1 ? "s" : ""} created
                  successfully
                  {uploadResults.failures.length > 0 && (
                    <>, {uploadResults.failures.length} failed</>
                  )}
                </p>
              </div>

              {uploadResults.failures.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-semibold text-red-800 mb-2">
                    Failed Jobs:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {uploadResults.failures.map((failure, index) => (
                      <div key={index} className="text-sm text-red-700">
                        Job #{failure.job.job_number}: {failure.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={handleComplete}
                  className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
