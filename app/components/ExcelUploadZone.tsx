import React, { useCallback, useState } from "react";
import { validateFile } from "@/lib/excelParser";
import { downloadExcelTemplate } from "@/lib/excelTemplate";

interface ExcelUploadZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  disabled?: boolean;
}

/**
 * Drag-and-drop file upload zone for Excel files
 */
export default function ExcelUploadZone({
  onFileSelect,
  isLoading,
  disabled,
}: ExcelUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (disabled || isLoading) return;

      // Reset error
      setError(null);

      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        setError(validation.error || "Invalid file");
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect, disabled, isLoading],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && !isLoading) {
        setIsDragOver(true);
      }
    },
    [disabled, isLoading],
  );

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || isLoading) return;

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile, disabled, isLoading],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = "";
    },
    [handleFile],
  );

  const handleClick = useCallback(() => {
    if (disabled || isLoading) return;
    document.getElementById("excel-file-input")?.click();
  }, [disabled, isLoading]);

  const handleDownloadTemplate = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering file input
    downloadExcelTemplate();
  }, []);

  return (
    <div className="w-full">
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"}
          ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : ""}
          ${error ? "border-red-500 bg-red-50" : ""}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
          className="hidden"
          disabled={disabled || isLoading}
        />

        <div className="flex flex-col items-center space-y-4">
          {/* Upload Icon */}
          <svg
            className={`w-12 h-12 ${error ? "text-red-400" : "text-gray-400"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          {/* Upload Text */}
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isLoading ? "Processing..." : "Drop your Excel file here"}
            </p>
            <p className="text-sm text-gray-500 mt-1">or click to browse</p>
          </div>

          {/* File Format Info */}
          <div className="text-xs text-gray-400">
            Supported formats: .xlsx, .xls, .csv (max 5MB)
          </div>

          {/* Loading Spinner */}
          {isLoading && (
            <div className="flex items-center space-x-2 text-blue-600">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
              <span className="text-sm">Parsing file...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">Error</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Download Template Button */}
      <div className="mt-3 flex justify-center">
        <button
          onClick={handleDownloadTemplate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium flex items-center gap-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Download Excel Template
        </button>
      </div>

      {/* Expected Format Guide */}
      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900 mb-2">
          Expected Excel Format:
        </p>
        <div className="text-xs text-gray-600 font-mono bg-white p-3 rounded border border-gray-200 overflow-x-auto">
          <div className="grid grid-cols-4 gap-4 mb-1 font-bold">
            <div>Job Number</div>
            <div>Production Quantity</div>
            <div>Date (Optional)</div>
            <div>Notes (Optional)</div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-gray-500">
            <div>12345</div>
            <div>5000</div>
            <div>2025-01-15</div>
            <div>First batch</div>
          </div>
          <div className="grid grid-cols-4 gap-4 text-gray-500">
            <div>12346</div>
            <div>3200</div>
            <div></div>
            <div></div>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          * Job Number and Production Quantity are required
          <br />* Date will default to today if not provided
        </p>
      </div>
    </div>
  );
}
