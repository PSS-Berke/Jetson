import type { ProductionComparison } from "@/types";

interface ProductionPDFTableProps {
  comparisons: ProductionComparison[];
}

export default function ProductionPDFTable({
  comparisons,
}: ProductionPDFTableProps) {
  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  const getVarianceColor = (percentage: number) => {
    if (percentage >= 0) return "text-green-700 bg-green-50";
    if (percentage > -10) return "text-yellow-700 bg-yellow-50";
    return "text-red-700 bg-red-50";
  };

  return (
    <div className="pdf-table mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        Production Details
      </h2>

      <table className="w-full border-collapse border border-gray-300 text-[10px]">
        <thead>
          <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Job #
            </th>
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Job Name
            </th>
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Client
            </th>
            <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
              Date Entered
            </th>
            <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
              Projected
            </th>
            <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
              Actual
            </th>
            <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
              Variance
            </th>
            <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
              Variance %
            </th>
          </tr>
        </thead>
        <tbody>
          {comparisons.length === 0 ? (
            <tr>
              <td
                colSpan={8}
                className="border border-gray-300 px-3 py-8 text-center text-gray-500"
              >
                No production data available
              </td>
            </tr>
          ) : (
            comparisons.map((comparison, index) => (
              <tr
                key={comparison.job.id || index}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="border border-gray-300 px-2 py-2 text-gray-900 font-medium">
                  {comparison.job.job_number || "N/A"}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-gray-900">
                  {comparison.job.job_name || "Unnamed Job"}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-gray-900">
                  {comparison.job.client?.name || "Unknown Client"}
                  {comparison.job.sub_client &&
                    ` / ${comparison.job.sub_client.name}`}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-gray-900">
                  {comparison.last_updated_at
                    ? new Date(comparison.last_updated_at).toLocaleDateString(
                        "en-US",
                        { month: "numeric", day: "numeric" },
                      )
                    : "-"}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                  {formatNumber(comparison.projected_quantity)}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-medium">
                  {formatNumber(comparison.actual_quantity)}
                </td>
                <td
                  className={`border border-gray-300 px-2 py-2 text-right font-semibold ${
                    comparison.variance >= 0 ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {comparison.variance >= 0 ? "+" : ""}
                  {formatNumber(comparison.variance)}
                </td>
                <td
                  className={`border border-gray-300 px-2 py-2 text-right font-semibold ${getVarianceColor(comparison.variance_percentage)}`}
                >
                  {formatPercentage(comparison.variance_percentage)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <span className="font-medium">
            Total records: {comparisons.length}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-green-100 border border-green-500 rounded"></span>
            Ahead
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-yellow-100 border border-yellow-500 rounded"></span>
            On Track
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-red-100 border border-red-500 rounded"></span>
            Behind
          </span>
        </div>
      </div>
    </div>
  );
}
