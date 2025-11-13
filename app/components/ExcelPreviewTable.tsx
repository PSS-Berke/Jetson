import React from "react";
import {
  ValidatedProductionRow,
  ValidationSummary,
} from "@/lib/productionValidator";

interface ExcelPreviewTableProps {
  validatedRows: ValidatedProductionRow[];
  summary: ValidationSummary;
  onRemoveRow?: (rowIndex: number) => void;
}

/**
 * Preview table showing validated Excel data with visual indicators
 */
export default function ExcelPreviewTable({
  validatedRows,
  summary,
  onRemoveRow,
}: ExcelPreviewTableProps) {
  if (validatedRows.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">No data to preview</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-blue-700">
            {summary.total}
          </div>
          <div className="text-xs text-blue-600 mt-1">Total Rows</div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-700">
            {summary.valid}
          </div>
          <div className="text-xs text-green-600 mt-1">Valid</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-700">
            {summary.invalid}
          </div>
          <div className="text-xs text-red-600 mt-1">Invalid</div>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-2xl font-bold text-yellow-700">
            {summary.warnings}
          </div>
          <div className="text-xs text-yellow-600 mt-1">Warnings</div>
        </div>
      </div>

      {/* Total Quantity */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
        <div className="text-sm text-gray-600">
          Total Production Quantity:{" "}
          <span className="font-bold text-gray-900">
            {summary.totalQuantity.toLocaleString()}
          </span>{" "}
          units
        </div>
      </div>

      {/* Table */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  Row
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Number
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                {onRemoveRow && (
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {validatedRows.map((row, index) => {
                const isValid = row.validation.isValid;
                const hasWarnings = row.validation.warnings.length > 0;
                const hasErrors = row.validation.errors.length > 0;

                return (
                  <React.Fragment key={index}>
                    <tr
                      className={`
                        ${isValid && !hasWarnings ? "bg-green-50" : ""}
                        ${hasErrors ? "bg-red-50" : ""}
                        ${hasWarnings && !hasErrors ? "bg-yellow-50" : ""}
                        hover:bg-opacity-75
                      `}
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                        {row.rowIndex}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {isValid && !hasWarnings && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Valid
                          </span>
                        )}
                        {hasErrors && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Error
                          </span>
                        )}
                        {hasWarnings && !hasErrors && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <svg
                              className="w-3 h-3 mr-1"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            Warning
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {row.jobNumber}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                        {row.matchedJob?.job_name || "-"}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                        {row.quantity.toLocaleString()}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                        {row.productionEntry?.date
                          ? new Date(
                              row.productionEntry.date,
                            ).toLocaleDateString()
                          : "-"}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 max-w-xs truncate">
                        {row.notes || "-"}
                      </td>
                      {onRemoveRow && (
                        <td className="px-3 py-3 whitespace-nowrap text-sm">
                          <button
                            onClick={() => onRemoveRow(index)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove row"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                    {/* Error/Warning Details Row */}
                    {(hasErrors || hasWarnings) && (
                      <tr className={hasErrors ? "bg-red-50" : "bg-yellow-50"}>
                        <td colSpan={onRemoveRow ? 8 : 7} className="px-3 py-2">
                          <div className="space-y-1">
                            {row.validation.errors.map((error, errorIndex) => (
                              <div
                                key={`error-${errorIndex}`}
                                className="flex items-start text-xs text-red-700"
                              >
                                <svg
                                  className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                                <span>
                                  <strong>{error.field}:</strong>{" "}
                                  {error.message}
                                </span>
                              </div>
                            ))}
                            {row.validation.warnings.map(
                              (warning, warningIndex) => (
                                <div
                                  key={`warning-${warningIndex}`}
                                  className="flex items-start text-xs text-yellow-700"
                                >
                                  <svg
                                    className="w-4 h-4 mr-1 flex-shrink-0 mt-0.5"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                  <span>
                                    <strong>{warning.field}:</strong>{" "}
                                    {warning.message}
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-4 text-xs text-gray-600">
        <div className="flex items-center">
          <div className="w-4 h-4 bg-green-100 border border-green-200 rounded mr-1"></div>
          <span>Valid</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-yellow-100 border border-yellow-200 rounded mr-1"></div>
          <span>Warning</span>
        </div>
        <div className="flex items-center">
          <div className="w-4 h-4 bg-red-100 border border-red-200 rounded mr-1"></div>
          <span>Error</span>
        </div>
      </div>
    </div>
  );
}
