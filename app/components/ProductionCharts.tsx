"use client";

import { getVarianceStatus } from "@/lib/productionUtils";
import type { ProductionComparison } from "@/types";

interface ProductionChartsProps {
  comparisons: ProductionComparison[];
}

export default function ProductionCharts({
  comparisons,
}: ProductionChartsProps) {
  if (comparisons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12">
        <div className="text-center space-y-6">
          {/* Icon/Visual indicator */}
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-gray-400"
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
            </div>
          </div>

          {/* Message */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              No Production Data Yet
            </h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Start tracking production by adding actual quantities to your
              jobs. Charts will appear here showing projected vs actual
              comparisons.
            </p>
          </div>

          {/* Placeholder preview */}
          <div className="max-w-2xl mx-auto pt-4 space-y-4">
            <div className="text-xs text-gray-400 font-medium text-left">
              Preview: What you&apos;ll see
            </div>

            {/* Sample bar chart preview */}
            <div className="space-y-2 opacity-40">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Example Job 1</span>
                <span>0 / 0</span>
              </div>
              <div className="relative h-6">
                <div className="absolute h-6 bg-blue-200 rounded w-3/4"></div>
                <div className="absolute h-6 bg-green-500 rounded w-1/2"></div>
              </div>

              <div className="flex justify-between text-xs text-gray-400">
                <span>Example Job 2</span>
                <span>0 / 0</span>
              </div>
              <div className="relative h-6">
                <div className="absolute h-6 bg-blue-200 rounded w-2/3"></div>
                <div className="absolute h-6 bg-yellow-500 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Calculate totals
  const totalProjected = comparisons.reduce(
    (sum, c) => sum + c.projected_quantity,
    0,
  );
  const totalActual = comparisons.reduce(
    (sum, c) => sum + c.actual_quantity,
    0,
  );
  const completionPercentage =
    totalProjected > 0 ? (totalActual / totalProjected) * 100 : 0;

  // Get top 10 jobs by projected quantity for bar chart
  const topJobs = [...comparisons]
    .sort((a, b) => b.projected_quantity - a.projected_quantity)
    .slice(0, 10);

  // Find max value for scaling - ensure it's never 0 to prevent division by zero
  const maxValue = Math.max(
    ...topJobs.map((c) => Math.max(c.projected_quantity, c.actual_quantity)),
    1, // Minimum value of 1 to prevent division by zero
  );

  // Calculate variance distribution
  const ahead = comparisons.filter(
    (c) => getVarianceStatus(c.variance_percentage) === "ahead",
  ).length;
  const onTrack = comparisons.filter(
    (c) => getVarianceStatus(c.variance_percentage) === "on-track",
  ).length;
  const behind = comparisons.filter(
    (c) => getVarianceStatus(c.variance_percentage) === "behind",
  ).length;
  const total = comparisons.length;

  return (
    <div className="space-y-6">
      {/* Overall Completion Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Overall Completion Rate
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Projected</span>
              <span className="font-semibold">
                {totalProjected.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Actual</span>
              <span className="font-semibold">
                {totalActual.toLocaleString()}
              </span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 font-medium">Completion Rate</span>
              <span className="text-lg font-bold text-blue-600">
                {completionPercentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completionPercentage >= 95
                    ? "bg-green-500"
                    : completionPercentage >= 80
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${Math.min(completionPercentage, 100)}%` }}
              >
                <div className="flex items-center justify-center h-full text-white text-sm font-semibold">
                  {completionPercentage > 10 &&
                    `${completionPercentage.toFixed(1)}%`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Projected vs Actual Bar Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Top Jobs: Projected vs Actual
        </h3>
        <div className="space-y-4">
          {topJobs.map((comparison) => {
            // Calculate widths as percentages with minimum 2% for visibility
            const projectedWidth = Math.max(
              (comparison.projected_quantity / maxValue) * 100,
              2,
            );
            const actualWidth = Math.max(
              (comparison.actual_quantity / maxValue) * 100,
              2,
            );

            // Determine if we should show the bar at all (only if there's any data)
            const hasProjected = comparison.projected_quantity > 0;
            const hasActual = comparison.actual_quantity > 0;

            return (
              <div key={comparison.job.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700 truncate max-w-[60%]">
                    {comparison.job.job_number} - {comparison.job.job_name}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {comparison.actual_quantity.toLocaleString()} /{" "}
                    {comparison.projected_quantity.toLocaleString()}
                  </span>
                </div>
                <div className="relative h-8">
                  {hasProjected || hasActual ? (
                    <>
                      {/* Projected bar (background) */}
                      {hasProjected && (
                        <div
                          className="absolute h-8 bg-blue-200 rounded"
                          style={{ width: `${projectedWidth}%` }}
                        >
                          <div className="flex items-center h-full px-2 text-xs text-blue-700">
                            {projectedWidth > 10 && "Projected"}
                          </div>
                        </div>
                      )}
                      {/* Actual bar (foreground) */}
                      {hasActual && (
                        <div
                          className={`absolute h-8 rounded ${
                            actualWidth >= projectedWidth * 0.95
                              ? "bg-green-500"
                              : actualWidth >= projectedWidth * 0.8
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${actualWidth}%` }}
                        >
                          <div className="flex items-center h-full px-2 text-xs text-white font-semibold">
                            {actualWidth > 10 && "Actual"}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    /* No data placeholder */
                    <div className="h-8 bg-gray-100 rounded flex items-center px-2">
                      <span className="text-xs text-gray-400 italic">
                        No data yet
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Variance Distribution Pie Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          Performance Distribution
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Simple pie visualization using flex */}
          <div className="flex items-center justify-center">
            <div className="w-48 h-48 rounded-full flex items-center justify-center relative overflow-hidden">
              {/* Create segments - only if we have data */}
              {total > 0 ? (
                <>
                  <div
                    className="absolute inset-0 bg-green-500"
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${50 + (ahead / total) * 50}% 0%, 50% 50%)`,
                      transform: "rotate(0deg)",
                    }}
                  />
                  <div
                    className="absolute inset-0 bg-yellow-500"
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${50 + (onTrack / total) * 50}% 0%, 50% 50%)`,
                      transform: `rotate(${(ahead / total) * 360}deg)`,
                    }}
                  />
                  <div
                    className="absolute inset-0 bg-red-500"
                    style={{
                      clipPath: `polygon(50% 50%, 50% 0%, ${50 + (behind / total) * 50}% 0%, 50% 50%)`,
                      transform: `rotate(${((ahead + onTrack) / total) * 360}deg)`,
                    }}
                  />
                </>
              ) : (
                /* Show a neutral circle when no data */
                <div className="absolute inset-0 bg-gray-200" />
              )}
              {/* Center circle */}
              <div className="absolute w-24 h-24 bg-white rounded-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">
                    {total}
                  </div>
                  <div className="text-xs text-gray-500">Jobs</div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-col justify-center space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded" />
                <span className="text-sm font-medium text-gray-700">
                  Ahead/On Target
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-700">{ahead}</div>
                <div className="text-xs text-gray-500">
                  {total > 0 ? ((ahead / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-yellow-500 rounded" />
                <span className="text-sm font-medium text-gray-700">
                  Slightly Behind
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-yellow-700">
                  {onTrack}
                </div>
                <div className="text-xs text-gray-500">
                  {total > 0 ? ((onTrack / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-500 rounded" />
                <span className="text-sm font-medium text-gray-700">
                  Behind Schedule
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-red-700">{behind}</div>
                <div className="text-xs text-gray-500">
                  {total > 0 ? ((behind / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
