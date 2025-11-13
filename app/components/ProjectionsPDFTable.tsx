import type {
  TimeRange,
  JobProjection,
  ServiceTypeSummary,
} from "@/lib/projectionUtils";
import { formatQuantity } from "@/lib/projectionUtils";

interface ProjectionsPDFTableProps {
  timeRanges: TimeRange[];
  jobProjections: JobProjection[];
  serviceSummaries: ServiceTypeSummary[];
  grandTotals: {
    grandTotal: number;
  };
}

export default function ProjectionsPDFTable({
  timeRanges,
  jobProjections,
  // serviceSummaries,
  // grandTotals,
}: ProjectionsPDFTableProps) {
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  return (
    <div className="pdf-table mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Job Projections Detail
      </h2>

      {/* Main Jobs Table */}
      <table className="w-full border-collapse border border-gray-300 text-[10px] mb-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Job #
            </th>
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Client
            </th>
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 min-w-[80px]">
              Process Types
            </th>
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Description
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700">
              Qty
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700">
              Start
            </th>
            <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700">
              End
            </th>
            {timeRanges.map((range, idx) => (
              <th
                key={idx}
                className={`border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700 ${
                  idx % 2 === 0 ? "bg-gray-200" : "bg-gray-100"
                }`}
              >
                {range.label}
              </th>
            ))}
            <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700 bg-gray-200">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {jobProjections.length === 0 ? (
            <tr>
              <td
                colSpan={8 + timeRanges.length}
                className="border border-gray-300 px-2 py-4 text-center text-gray-500"
              >
                No projection data available
              </td>
            </tr>
          ) : (
            jobProjections.map((projection, index) => {
              const job = projection.job;
              // Get unique process types
              const processTypes =
                job.requirements && job.requirements.length > 0
                  ? [
                      ...new Set(
                        job.requirements
                          .map((req) => req.process_type)
                          .filter(Boolean),
                      ),
                    ]
                  : [];

              return (
                <tr
                  key={job.id || index}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 font-medium">
                    {job.job_number}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-900">
                    {job.client?.name || "Unknown"}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 min-w-[80px] max-w-[100px]">
                    <div className="break-words whitespace-normal leading-tight">
                      {processTypes.length > 0 ? processTypes.join(", ") : "-"}
                    </div>
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 max-w-[150px] truncate">
                    {job.description || "N/A"}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center text-gray-900">
                    {job.quantity.toLocaleString()}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center text-gray-900">
                    {job.start_date
                      ? new Date(job.start_date).toLocaleDateString("en-US", {
                          month: "numeric",
                          day: "numeric",
                        })
                      : "N/A"}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-center text-gray-900">
                    {job.due_date
                      ? new Date(job.due_date).toLocaleDateString("en-US", {
                          month: "numeric",
                          day: "numeric",
                        })
                      : "N/A"}
                  </td>
                  {timeRanges.map((range, idx) => {
                    const quantity =
                      projection.weeklyQuantities.get(range.label) || 0;
                    return (
                      <td
                        key={idx}
                        className={`border border-gray-300 px-2 py-2 text-center text-gray-900 font-medium ${
                          idx % 2 === 0 ? "bg-gray-100" : "bg-gray-50"
                        }`}
                      >
                        {formatQuantity(quantity)}
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 px-2 py-2 text-center text-gray-900 font-bold bg-gray-100">
                    {formatQuantity(projection.totalQuantity)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Process Type Summary Table */}
      <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center">
        <div className="w-1 h-5 bg-purple-500 rounded mr-2"></div>
        Process Type Summary
      </h3>
      <table className="w-full border-collapse border border-gray-300 text-xs">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">
              Process Type
            </th>
            {timeRanges.map((range, idx) => (
              <th
                key={idx}
                className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700"
              >
                {range.label}
              </th>
            ))}
            <th className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-700 bg-gray-200">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Calculate process type quantities by period */}
          {(() => {
            const processTypeData: {
              [key: string]: { byPeriod: Map<string, number>; total: number };
            } = {
              Insert: { byPeriod: new Map(), total: 0 },
              Sort: { byPeriod: new Map(), total: 0 },
              Inkjet: { byPeriod: new Map(), total: 0 },
              "Label/Apply": { byPeriod: new Map(), total: 0 },
              Fold: { byPeriod: new Map(), total: 0 },
              Laser: { byPeriod: new Map(), total: 0 },
              "HP Press": { byPeriod: new Map(), total: 0 },
            };

            // Aggregate quantities by process type and period
            jobProjections.forEach((projection) => {
              const job = projection.job;
              if (job.requirements) {
                job.requirements.forEach((req) => {
                  if (req.process_type) {
                    const processType = req.process_type;
                    if (!processTypeData[processType]) {
                      processTypeData[processType] = {
                        byPeriod: new Map(),
                        total: 0,
                      };
                    }

                    timeRanges.forEach((range) => {
                      const quantity =
                        projection.weeklyQuantities.get(range.label) || 0;
                      const currentPeriodTotal =
                        processTypeData[processType].byPeriod.get(
                          range.label,
                        ) || 0;
                      processTypeData[processType].byPeriod.set(
                        range.label,
                        currentPeriodTotal + quantity,
                      );
                    });

                    processTypeData[processType].total +=
                      projection.totalQuantity;
                  }
                });
              }
            });

            return Object.entries(processTypeData)
              .filter(([, data]) => data.total > 0)
              .map(([processType, data], index) => (
                <tr
                  key={processType}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-3 py-2 font-medium text-gray-900">
                    {processType}
                  </td>
                  {timeRanges.map((range, idx) => (
                    <td
                      key={idx}
                      className="border border-gray-300 px-3 py-2 text-right text-gray-900"
                    >
                      {formatNumber(data.byPeriod.get(range.label) || 0)}
                    </td>
                  ))}
                  <td className="border border-gray-300 px-3 py-2 text-right font-semibold text-gray-900 bg-gray-50">
                    {formatNumber(data.total)}
                  </td>
                </tr>
              ));
          })()}
        </tbody>
      </table>

      <div className="mt-2 text-xs text-gray-600">
        Total jobs: {jobProjections.length}
      </div>
    </div>
  );
}
