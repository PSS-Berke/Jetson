import {
  ClientRevenue,
  ServiceTypeRevenue,
  PeriodComparison,
} from "@/lib/cfoUtils";
import { Job } from "@/types";

interface JobWithCost extends Job {
  costPer1000?: number;
  actualCost?: number;
  profit?: number;
  profitMargin?: number;
}

interface FinancialsPDFTablesProps {
  topClients: ClientRevenue[];
  serviceTypes: ServiceTypeRevenue[];
  periodComparison?: PeriodComparison[];
  jobsWithCosts?: JobWithCost[];
}

export default function FinancialsPDFTables({
  topClients,
  serviceTypes,
  periodComparison,
  jobsWithCosts,
}: FinancialsPDFTablesProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(Math.round(value));
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getRiskColor = (percentage: number) => {
    if (percentage > 30) return "text-red-700 bg-red-50";
    if (percentage > 20) return "text-yellow-700 bg-yellow-50";
    return "text-green-700 bg-green-50";
  };

  const getChangeColor = (change: number) => {
    if (change >= 0) return "text-green-700 bg-green-50";
    return "text-red-700 bg-red-50";
  };

  return (
    <div className="pdf-tables">
      {/* Client Analysis Table */}
      <div className="mb-6">
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
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
          Top Client Analysis
        </h2>

        <table className="w-full border-collapse border border-gray-300 text-[10px]">
          <thead>
            <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
                Client Name
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Revenue
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Jobs
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Volume
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Profit
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                % of Total
              </th>
              <th className="border border-gray-300 px-2 py-2 text-center font-semibold text-gray-700">
                Risk Level
              </th>
            </tr>
          </thead>
          <tbody>
            {topClients.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="border border-gray-300 px-3 py-8 text-center text-gray-500"
                >
                  No client data available
                </td>
              </tr>
            ) : (
              topClients.map((client, index) => (
                <tr
                  key={client.clientId}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 font-medium">
                    {client.clientName}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-semibold">
                    {formatCurrency(client.revenue)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {client.jobCount}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {formatNumber(client.quantity)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {formatCurrency(client.profit)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-semibold">
                    {formatPercentage(client.percentageOfTotal)}
                  </td>
                  <td
                    className={`border border-gray-300 px-2 py-2 text-center font-semibold ${getRiskColor(client.percentageOfTotal)}`}
                  >
                    {client.percentageOfTotal > 30
                      ? "High"
                      : client.percentageOfTotal > 20
                        ? "Medium"
                        : "Low"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-2 text-xs text-gray-600">
          <span className="font-medium">
            Showing top {topClients.length} clients
          </span>
        </div>
      </div>

      {/* Service Mix Table */}
      <div className="mb-6">
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
            />
          </svg>
          Service Type Mix
        </h2>

        <table className="w-full border-collapse border border-gray-300 text-[10px]">
          <thead>
            <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
              <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
                Service Type
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Revenue
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Jobs
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Volume
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                Profit
              </th>
              <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                % of Total
              </th>
            </tr>
          </thead>
          <tbody>
            {serviceTypes.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="border border-gray-300 px-3 py-8 text-center text-gray-500"
                >
                  No service data available
                </td>
              </tr>
            ) : (
              serviceTypes.map((service, index) => (
                <tr
                  key={service.serviceType}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 font-medium">
                    {service.serviceType}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-semibold">
                    {formatCurrency(service.revenue)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {service.jobCount}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {formatNumber(service.quantity)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {formatCurrency(service.profit)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-semibold">
                    {formatPercentage(service.percentageOfTotal)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-2 text-xs text-gray-600">
          <span className="font-medium">
            Total service types: {serviceTypes.length}
          </span>
        </div>
      </div>

      {/* Period Comparison Table */}
      {periodComparison && periodComparison.length > 0 && (
        <div className="mb-6">
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
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            Period Comparison
          </h2>

          <table className="w-full border-collapse border border-gray-300 text-[10px]">
            <thead>
              <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
                  Metric
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Current Period
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Previous Period
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Change
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  % Change
                </th>
              </tr>
            </thead>
            <tbody>
              {periodComparison.map((comparison, index) => (
                <tr
                  key={comparison.metric}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 font-medium">
                    {comparison.metric}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-semibold">
                    {comparison.metric === "Revenue" ||
                    comparison.metric === "Avg Job Value"
                      ? formatCurrency(comparison.current)
                      : formatNumber(comparison.current)}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {comparison.metric === "Revenue" ||
                    comparison.metric === "Avg Job Value"
                      ? formatCurrency(comparison.previous)
                      : formatNumber(comparison.previous)}
                  </td>
                  <td
                    className={`border border-gray-300 px-2 py-2 text-right font-semibold ${getChangeColor(comparison.change)}`}
                  >
                    {comparison.change >= 0 ? "+" : ""}
                    {comparison.metric === "Revenue" ||
                    comparison.metric === "Avg Job Value"
                      ? formatCurrency(comparison.change)
                      : formatNumber(comparison.change)}
                  </td>
                  <td
                    className={`border border-gray-300 px-2 py-2 text-right font-semibold ${getChangeColor(comparison.percentChange)}`}
                  >
                    {comparison.percentChange >= 0 ? "+" : ""}
                    {formatPercentage(comparison.percentChange)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Job Cost Comparison Table */}
      {jobsWithCosts && jobsWithCosts.length > 0 && (
        <div className="mb-6">
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
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Job Profitability Analysis
          </h2>

          <table className="w-full border-collapse border border-gray-300 text-[10px]">
            <thead>
              <tr className="bg-gradient-to-r from-blue-100 to-blue-50">
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
                  Job #
                </th>
                <th className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700">
                  Facility
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Revenue
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Cost
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Profit
                </th>
                <th className="border border-gray-300 px-2 py-2 text-right font-semibold text-gray-700">
                  Margin %
                </th>
              </tr>
            </thead>
            <tbody>
              {jobsWithCosts.map((job, index) => (
                <tr
                  key={job.id}
                  className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="border border-gray-300 px-2 py-2 text-gray-900 font-medium">
                    {job.job_number || "N/A"}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-gray-900">
                    {job.facilities_id === 1
                      ? "Bolingbrook"
                      : job.facilities_id === 2
                      ? "Lemont"
                      : "Unknown"}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900 font-semibold">
                    {(() => {
                      // Calculate revenue from requirements.price_per_m if available
                      if (
                        Array.isArray(job.requirements) &&
                        job.requirements.length > 0
                      ) {
                        const revenue = job.requirements.reduce(
                          (total: number, req: { price_per_m?: string }) => {
                            const pricePerMStr = req.price_per_m;
                            const isValidPrice =
                              pricePerMStr &&
                              pricePerMStr !== "undefined" &&
                              pricePerMStr !== "null";
                            const pricePerM = isValidPrice
                              ? parseFloat(pricePerMStr)
                              : 0;
                            return total + (job.quantity / 1000) * pricePerM;
                          },
                          0,
                        );
                        return formatCurrency(revenue);
                      }
                      // Fallback to total_billing
                      return formatCurrency(
                        parseFloat(job.total_billing || "0"),
                      );
                    })()}
                  </td>
                  <td className="border border-gray-300 px-2 py-2 text-right text-gray-900">
                    {job.actualCost ? formatCurrency(job.actualCost) : "-"}
                  </td>
                  <td
                    className={`border border-gray-300 px-2 py-2 text-right font-semibold ${
                      (job.profit || 0) >= 0
                        ? "text-green-700 bg-green-50"
                        : "text-red-700 bg-red-50"
                    }`}
                  >
                    {job.profit !== undefined
                      ? formatCurrency(job.profit)
                      : "-"}
                  </td>
                  <td
                    className={`border border-gray-300 px-2 py-2 text-right font-semibold ${
                      (job.profitMargin || 0) >= 0
                        ? "text-green-700"
                        : "text-red-700"
                    }`}
                  >
                    {job.profitMargin !== undefined
                      ? formatPercentage(job.profitMargin)
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-2 text-xs text-gray-600">
            <span className="font-medium">
              Showing {jobsWithCosts.length} jobs with cost data
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
