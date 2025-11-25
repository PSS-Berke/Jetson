"use client";

import { useState } from "react";
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
import { parseJobCsv, type ParsedBulkJob, type SkippedRow } from "@/lib/jobCsvParser";
import { downloadJobTemplate } from "@/lib/jobCsvTemplate";
import { batchCreateJobs } from "@/lib/api";
import type { Job } from "@/types";

interface BulkJobUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadStep = "upload" | "preview" | "uploading" | "complete";

export default function BulkJobUploadModal({
  isOpen,
  onClose,
  onSuccess,
}: BulkJobUploadModalProps) {
  const [step, setStep] = useState<UploadStep>("upload");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [file, setFile] = useState<File | null>(null);
  const [parsedJobs, setParsedJobs] = useState<ParsedBulkJob[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
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
      setSkippedRows(result.skippedRows || []);

      // Log skipped rows summary
      if (result.skippedRows && result.skippedRows.length > 0) {
        console.log(`[BulkJobUpload] ${result.skippedRows.length} rows were skipped during parsing:`, result.skippedRows);
      }

      // Go directly to preview - no client mapping step
      setStep("preview");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to parse file",
      );
    }
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

    // Convert parsed jobs to API format
    const jobsToCreate: Partial<Job>[] = validJobs.map((pj) => {
      console.log(`[BulkJobUpload] Job ${pj.job_number}:`, {
        client_from_csv: pj.client,
        sub_client_from_csv: pj.sub_client,
        will_set_client_to: pj.client || pj.sub_client || "",
        will_set_sub_client_to: pj.sub_client || undefined,
      });

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

      const csvClientName = pj.client?.trim();
      const subClientName = pj.sub_client?.trim();
      const clientPayloadName = csvClientName || subClientName;

      const clientPayload = clientPayloadName
        ? JSON.stringify({ id: null, name: clientPayloadName })
        : undefined;

      const subClientPayload = subClientName
        ? JSON.stringify({ id: null, name: subClientName })
        : undefined;

      return {
        job_number: pj.job_number,
        clients_id: undefined, // Not setting clients_id - using sub_client instead
        client: clientPayload,
        sub_client: subClientPayload,
        facilities_id: pj.facility
          ? pj.facility.toLowerCase().includes("lemont") ||
            pj.facility.toLowerCase().includes("shakopee")
            ? 2
            : 1
          : 1,
        job_name: pj.name || undefined,
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
      console.log(`[BulkJobUpload] Starting upload of ${jobsToCreate.length} jobs`);
      console.log(`[BulkJobUpload] ${invalidJobsCount} jobs were excluded due to validation errors`);
      console.log(`[BulkJobUpload] ${skippedRows.length} rows were skipped during parsing`);

      const results = await batchCreateJobs(jobsToCreate, (current, total) => {
        setUploadProgress({ current, total });
      });

      console.log(`[BulkJobUpload] Upload complete:`, {
        successful: results.success.length,
        failed: results.failures.length,
        skippedDuringParsing: skippedRows.length,
        invalidJobs: invalidJobsCount,
        totalProcessed: results.success.length + results.failures.length + skippedRows.length + invalidJobsCount
      });

      if (results.failures.length > 0) {
        console.log(`[BulkJobUpload] Failed jobs:`, results.failures);
      }

      setUploadResults(results);
      setStep("complete");
    } catch (error) {
      console.error(`[BulkJobUpload] Upload failed:`, error);
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
        job.job_number = value;
        job.errors = job.errors.filter((e) => !e.includes("job_number"));
        if (!value || value.trim() === "") {
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
        break;
      case "client":
        job.client = value;
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

          {/* Step 2: Preview */}
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

              {/* Summary Banner */}
              {(invalidJobsCount > 0 || skippedRows.length > 0) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2 text-sm">
                    Upload Summary
                  </h4>
                  <div className="space-y-1 text-sm text-blue-800">
                    <p>
                      <span className="font-semibold">{validJobsCount}</span> jobs ready to upload
                    </p>
                    {invalidJobsCount > 0 && (
                      <p className="text-red-700">
                        <span className="font-semibold">{invalidJobsCount}</span> jobs have validation errors (won&apos;t be uploaded)
                      </p>
                    )}
                    {skippedRows.length > 0 && (
                      <p className="text-orange-700">
                        <span className="font-semibold">{skippedRows.length}</span> rows were skipped during CSV parsing
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="overflow-y-auto max-h-[500px]">
                  <div className="space-y-2 p-2">
                    {parsedJobs.map((job, index) => {
                      const hasErrors = job.errors.length > 0;
                      const hasWarnings = job.warnings.length > 0;
                      const isExpanded = expandedRows.has(index);

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
                              <div className="flex-1 grid grid-cols-7 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">
                                    Job #
                                    {!job.job_number || job.job_number === ""
                                      ? "N/A"
                                      : job.job_number}
                                  </span>
                                </div>
                                <div className="text-gray-600">
                                  {job.client || "-"}
                                </div>
                                <div className="text-gray-600">
                                  {job.sub_client || "-"}
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
                                        type="text"
                                        value={job.job_number || ""}
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
                                        Client
                                      </label>
                                      <input
                                        type="text"
                                        value={job.client || ""}
                                        onChange={(e) =>
                                          handleEditJob(
                                            index,
                                            "client",
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
                  onClick={() => setStep("upload")}
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

                {/* Summary Statistics */}
                <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold text-green-700">
                      {uploadResults.success.length} job{uploadResults.success.length !== 1 ? "s" : ""}
                    </span>
                    {" "}created successfully
                  </div>

                  {uploadResults.failures.length > 0 && (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-red-700">
                        {uploadResults.failures.length} job{uploadResults.failures.length !== 1 ? "s" : ""}
                      </span>
                      {" "}failed to upload
                    </div>
                  )}

                  {skippedRows.length > 0 && (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold text-orange-700">
                        {skippedRows.length} row{skippedRows.length !== 1 ? "s" : ""}
                      </span>
                      {" "}skipped during parsing
                    </div>
                  )}

                  <div className="pt-2 border-t border-gray-200 mt-2">
                    <p className="text-xs text-gray-500">
                      Total rows processed: {uploadResults.success.length + uploadResults.failures.length + skippedRows.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Skipped Rows Section */}
              {skippedRows.length > 0 && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="font-semibold text-orange-800 mb-2">
                    Skipped Rows:
                  </p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {skippedRows.map((skipped, index) => (
                      <div key={index} className="text-sm text-orange-700">
                        Row {skipped.row}: {skipped.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Jobs Section */}
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
