import React from "react";
import {
  PeriodComparison,
  formatCurrency,
  formatPercentage,
  formatNumber,
  getTrendIndicator,
} from "@/lib/cfoUtils";

interface CFOPeriodComparisonProps {
  comparisons: PeriodComparison[];
  title?: string;
  currentPeriodLabel?: string;
  previousPeriodLabel?: string;
}

export default function CFOPeriodComparison({
  comparisons,
  title = "Period Comparison",
  currentPeriodLabel = "Current Period",
  previousPeriodLabel = "Previous Period",
}: CFOPeriodComparisonProps) {
  // Format values based on metric type
  const formatMetricValue = (metric: string, value: number): string => {
    if (metric === "Revenue" || metric === "Avg Job Value") {
      return formatCurrency(value);
    } else if (metric.includes("%") || metric === "Capacity") {
      return formatPercentage(value);
    } else if (metric === "Total Pieces") {
      return formatNumber(value);
    } else {
      return formatNumber(value);
    }
  };

  // Get color for change value
  const getChangeColor = (
    isPositive: boolean,
    percentChange: number,
  ): string => {
    if (Math.abs(percentChange) < 1) return "text-gray-500";
    return isPositive ? "text-green-600" : "text-red-600";
  };

  // Get background color for change badge
  const getChangeBgColor = (
    isPositive: boolean,
    percentChange: number,
  ): string => {
    if (Math.abs(percentChange) < 1) return "bg-gray-100";
    return isPositive ? "bg-green-100" : "bg-red-100";
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">Performance metrics comparison</p>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Metric
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {currentPeriodLabel}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {previousPeriodLabel}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Change
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                % Change
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {comparisons.map((comparison, index) => (
              <tr key={index} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {comparison.metric}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                  {formatMetricValue(comparison.metric, comparison.current)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-600">
                  {formatMetricValue(comparison.metric, comparison.previous)}
                </td>
                <td
                  className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${getChangeColor(comparison.isPositive, comparison.percentChange)}`}
                >
                  {getTrendIndicator(comparison.percentChange)}{" "}
                  {formatMetricValue(
                    comparison.metric,
                    Math.abs(comparison.change),
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getChangeBgColor(comparison.isPositive, comparison.percentChange)} ${getChangeColor(comparison.isPositive, comparison.percentChange)}`}
                  >
                    {getTrendIndicator(comparison.percentChange)}{" "}
                    {formatPercentage(Math.abs(comparison.percentChange))}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {comparisons.map((comparison, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="font-semibold text-gray-900 mb-3">
              {comparison.metric}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {currentPeriodLabel}:
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatMetricValue(comparison.metric, comparison.current)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  {previousPeriodLabel}:
                </span>
                <span className="text-sm text-gray-600">
                  {formatMetricValue(comparison.metric, comparison.previous)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Change:</span>
                <div className="text-right">
                  <div
                    className={`text-sm font-medium ${getChangeColor(comparison.isPositive, comparison.percentChange)}`}
                  >
                    {getTrendIndicator(comparison.percentChange)}{" "}
                    {formatMetricValue(
                      comparison.metric,
                      Math.abs(comparison.change),
                    )}
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${getChangeBgColor(comparison.isPositive, comparison.percentChange)} ${getChangeColor(comparison.isPositive, comparison.percentChange)}`}
                  >
                    {getTrendIndicator(comparison.percentChange)}{" "}
                    {formatPercentage(Math.abs(comparison.percentChange))}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overall Assessment */}
      {comparisons.length > 0 && (
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">
            Overall Assessment
          </h4>
          <div className="space-y-1 text-sm text-gray-700">
            {(() => {
              const positiveMetrics = comparisons.filter(
                (c) => c.isPositive && Math.abs(c.percentChange) > 1,
              ).length;
              const negativeMetrics = comparisons.filter(
                (c) => !c.isPositive && Math.abs(c.percentChange) > 1,
              ).length;
              const revenueComparison = comparisons.find(
                (c) => c.metric === "Revenue",
              );

              return (
                <>
                  <p>
                    {positiveMetrics > negativeMetrics ? (
                      <span className="text-green-700 font-medium">
                        ✓ Positive trend:
                      </span>
                    ) : negativeMetrics > positiveMetrics ? (
                      <span className="text-red-700 font-medium">
                        ⚠ Concerning trend:
                      </span>
                    ) : (
                      <span className="text-gray-700 font-medium">
                        → Stable trend:
                      </span>
                    )}{" "}
                    {positiveMetrics} metrics improving, {negativeMetrics}{" "}
                    declining
                  </p>

                  {revenueComparison && (
                    <p>
                      Revenue is{" "}
                      <span
                        className={
                          revenueComparison.isPositive
                            ? "text-green-700 font-medium"
                            : "text-red-700 font-medium"
                        }
                      >
                        {revenueComparison.isPositive ? "up" : "down"}{" "}
                        {formatPercentage(
                          Math.abs(revenueComparison.percentChange),
                        )}
                      </span>{" "}
                      compared to previous period
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
