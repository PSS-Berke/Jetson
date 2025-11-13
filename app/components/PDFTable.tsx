"use client";

import { JobProjection, TimeRange } from "@/hooks/useProjections";
import { formatQuantity } from "@/lib/projectionUtils";
import ProcessTypeBadge from "./ProcessTypeBadge";

interface PDFTableProps {
  timeRanges: TimeRange[];
  jobProjections: JobProjection[];
}

export default function PDFTable({
  timeRanges,
  jobProjections,
}: PDFTableProps) {
  return (
    <div className="pdf-table-container mt-6">
      <h3 className="font-semibold text-[var(--text-dark)] mb-4">
        Job Projections
      </h3>
      <table className="pdf-table w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="pdf-table-cell">Job #</th>
            <th className="pdf-table-cell">Client</th>
            <th className="pdf-table-cell">Process Types</th>
            <th className="pdf-table-cell">Description</th>
            <th className="pdf-table-cell text-center">Quantity</th>
            <th className="pdf-table-cell text-center">Start Date</th>
            <th className="pdf-table-cell text-center">End Date</th>
            {timeRanges.map((range, index) => (
              <th
                key={range.label}
                className={`pdf-table-cell text-center ${
                  index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
                }`}
              >
                {range.label}
              </th>
            ))}
            <th className="pdf-table-cell text-center">Total</th>
          </tr>
        </thead>
        <tbody>
          {jobProjections.length === 0 ? (
            <tr>
              <td
                colSpan={8 + timeRanges.length}
                className="pdf-table-cell text-center text-[var(--text-light)]"
              >
                No jobs found for the selected criteria
              </td>
            </tr>
          ) : (
            jobProjections.map((projection) => {
              const job = projection.job;
              return (
                <tr key={job.id}>
                  <td className="pdf-table-cell font-medium">
                    {job.job_number}
                  </td>
                  <td className="pdf-table-cell">
                    {job.client?.name || "Unknown"}
                  </td>
                  <td className="pdf-table-cell">
                    <div className="flex flex-wrap gap-1">
                      {job.requirements && job.requirements.length > 0 ? (
                        [
                          ...new Set(
                            job.requirements
                              .map((req) => req.process_type)
                              .filter(Boolean),
                          ),
                        ].map((processType, idx) => (
                          <ProcessTypeBadge
                            key={idx}
                            processType={processType as string}
                          />
                        ))
                      ) : (
                        <span className="text-gray-400 text-xs">
                          No processes
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="pdf-table-cell max-w-xs truncate">
                    {job.description || "N/A"}
                  </td>
                  <td className="pdf-table-cell text-center font-medium">
                    {job.quantity.toLocaleString()}
                  </td>
                  <td className="pdf-table-cell text-center">
                    {job.start_date
                      ? new Date(job.start_date).toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td className="pdf-table-cell text-center">
                    {job.due_date
                      ? new Date(job.due_date).toLocaleDateString()
                      : "N/A"}
                  </td>
                  {timeRanges.map((range, index) => {
                    const quantity =
                      projection.weeklyQuantities.get(range.label) || 0;
                    return (
                      <td
                        key={range.label}
                        className={`pdf-table-cell text-center font-medium ${
                          index % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
                        }`}
                      >
                        {formatQuantity(quantity)}
                      </td>
                    );
                  })}
                  <td className="pdf-table-cell text-center font-bold">
                    {formatQuantity(projection.totalQuantity)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
