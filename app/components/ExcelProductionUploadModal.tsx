import React, { useState, useCallback } from "react";
import { ParsedJob } from "@/hooks/useJobs";
import { ProductionEntry } from "@/types";
import { parseExcelFile, ExcelParseResult } from "@/lib/excelParser";
import {
  validateProductionRows,
  ValidatedProductionRow,
  getValidationSummary,
  ValidationSummary,
} from "@/lib/productionValidator";
import { batchCreateProductionEntries } from "@/lib/api";
import ExcelUploadZone from "./ExcelUploadZone";
import ExcelPreviewTable from "./ExcelPreviewTable";
import Toast from "./Toast";

interface ExcelProductionUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  jobs: ParsedJob[];
  facilitiesId?: number;
  existingEntries?: ProductionEntry[];
}

type Step = "upload" | "preview" | "confirm" | "uploading" | "complete";

/**
 * Main modal component for uploading production data from Excel
 */
export default function ExcelProductionUploadModal({
  isOpen,
  onClose,
  onSuccess,
  jobs,
  facilitiesId,
  existingEntries,
}: ExcelProductionUploadModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [validatedRows, setValidatedRows] = useState<ValidatedProductionRow[]>(
    [],
  );
  const [summary, setSummary] = useState<ValidationSummary | null>(null);
  const [uploadProgress, setUploadProgress] = useState({
    current: 0,
    total: 0,
  });
  const [uploadedCount, setUploadedCount] = useState(0);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep("upload");
        setIsProcessing(false);
        setParseResult(null);
        setValidatedRows([]);
        setSummary(null);
        setUploadProgress({ current: 0, total: 0 });
        setUploadedCount(0);
      }, 300); // Wait for modal close animation
    }
  }, [isOpen]);

  const handleFileSelect = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setParseResult(null);
      setValidatedRows([]);

      try {
        // Parse Excel file
        const result = await parseExcelFile(file);
        setParseResult(result);

        // If parsing failed, show errors
        if (result.errors.length > 0 && result.data.length === 0) {
          setIsProcessing(false);
          return;
        }

        // Validate parsed data against jobs
        const validated = validateProductionRows(result.data, jobs, {
          facilitiesId,
          checkDuplicates: true,
          existingEntries,
        });

        setValidatedRows(validated);

        // Generate summary
        const validationSummary = getValidationSummary(validated);
        setSummary(validationSummary);

        // Move to preview step
        setStep("preview");
      } catch (error) {
        console.error("Error processing file:", error);
        setToast({
          type: "error",
          message: `Failed to process file: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [jobs, facilitiesId, existingEntries],
  );

  const handleRemoveRow = useCallback((rowIndex: number) => {
    setValidatedRows((prev) => {
      const updated = prev.filter((_, index) => index !== rowIndex);
      setSummary(getValidationSummary(updated));
      return updated;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setStep("confirm");
  }, []);

  const handleBack = useCallback(() => {
    if (step === "preview") {
      setStep("upload");
    } else if (step === "confirm") {
      setStep("preview");
    }
  }, [step]);

  const handleUpload = useCallback(async () => {
    if (!summary || summary.valid === 0) {
      setToast({
        type: "error",
        message: "No valid entries to upload",
      });
      return;
    }

    setStep("uploading");
    setUploadProgress({ current: 0, total: summary.valid });

    try {
      // Filter only valid rows and extract production entries
      const entriesToCreate = validatedRows
        .filter((row) => row.validation.isValid && row.productionEntry)
        .map((row) => row.productionEntry!);

      if (entriesToCreate.length === 0) {
        throw new Error("No valid entries to upload");
      }

      // Batch create in chunks to avoid overwhelming the API
      const CHUNK_SIZE = 50;
      let totalCreated = 0;

      for (let i = 0; i < entriesToCreate.length; i += CHUNK_SIZE) {
        const chunk = entriesToCreate.slice(i, i + CHUNK_SIZE);
        await batchCreateProductionEntries(chunk);
        totalCreated += chunk.length;
        setUploadProgress({
          current: totalCreated,
          total: entriesToCreate.length,
        });
      }

      setUploadedCount(totalCreated);
      setStep("complete");

      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess?.();
      }, 1500);
    } catch (error) {
      console.error("Error uploading production entries:", error);
      setToast({
        type: "error",
        message: `Failed to upload entries: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
      setStep("preview"); // Go back to preview on error
    }
  }, [summary, validatedRows, onSuccess]);

  const handleReset = useCallback(() => {
    setStep("upload");
    setParseResult(null);
    setValidatedRows([]);
    setSummary(null);
    setUploadedCount(0);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Import Production Data from Excel
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {step === "upload" &&
                    "Upload an Excel file with production data"}
                  {step === "preview" && "Review and validate the data"}
                  {step === "confirm" && "Confirm before uploading"}
                  {step === "uploading" && "Uploading production entries..."}
                  {step === "complete" && "Upload complete!"}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={step === "uploading"}
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Upload Step */}
              {step === "upload" && (
                <div>
                  <ExcelUploadZone
                    onFileSelect={handleFileSelect}
                    isLoading={isProcessing}
                  />

                  {/* Parse Errors */}
                  {parseResult && parseResult.errors.length > 0 && (
                    <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h3 className="text-sm font-medium text-red-800 mb-2">
                        Parsing Errors:
                      </h3>
                      <ul className="space-y-1">
                        {parseResult.errors.map((error, index) => (
                          <li key={index} className="text-sm text-red-700">
                            Row {error.rowIndex}: {error.message}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Preview Step */}
              {step === "preview" && summary && (
                <div>
                  <ExcelPreviewTable
                    validatedRows={validatedRows}
                    summary={summary}
                    onRemoveRow={handleRemoveRow}
                  />

                  {summary.invalid > 0 && (
                    <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> {summary.invalid} row(s) have
                        errors and will not be uploaded. You can remove them or
                        fix the issues in your Excel file and re-upload.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Confirm Step */}
              {step === "confirm" && summary && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-blue-900 mb-4">
                      Ready to Upload
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-3xl font-bold text-blue-700">
                          {summary.valid}
                        </div>
                        <div className="text-sm text-blue-600">
                          Production entries will be created
                        </div>
                      </div>
                      <div>
                        <div className="text-3xl font-bold text-blue-700">
                          {summary.totalQuantity.toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-600">Total units</div>
                      </div>
                    </div>
                  </div>

                  {summary.warnings > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Warning:</strong> {summary.warnings} row(s) have
                        warnings but will still be uploaded.
                      </p>
                    </div>
                  )}

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm text-gray-700">
                      This action cannot be undone. Production entries will be
                      created in the system.
                    </p>
                  </div>
                </div>
              )}

              {/* Uploading Step */}
              {step === "uploading" && (
                <div className="flex flex-col items-center justify-center py-12">
                  <svg
                    className="animate-spin h-12 w-12 text-blue-600 mb-4"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Uploading Production Entries
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    {uploadProgress.current} of {uploadProgress.total} entries
                    uploaded
                  </p>
                  <div className="w-full max-w-md bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${uploadProgress.total > 0 ? (uploadProgress.current / uploadProgress.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Complete Step */}
              {step === "complete" && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-green-600"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Upload Complete!
                  </h3>
                  <p className="text-sm text-gray-600 mb-6">
                    Successfully created {uploadedCount} production entries
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleReset}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Upload Another File
                    </button>
                    <button
                      onClick={onClose}
                      className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {(step === "preview" || step === "confirm") && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  {step === "preview" && (
                    <button
                      onClick={handleConfirm}
                      disabled={!summary || summary.valid === 0}
                      className="px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Continue ({summary?.valid || 0} valid entries)
                    </button>
                  )}
                  {step === "confirm" && (
                    <button
                      onClick={handleUpload}
                      className="px-4 py-2 bg-green-600 rounded-lg text-sm font-medium text-white hover:bg-green-700"
                    >
                      Upload {summary?.valid} Entries
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast Notifications */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
