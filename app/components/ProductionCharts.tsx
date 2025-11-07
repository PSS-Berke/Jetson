'use client';

import { getVarianceStatus } from '@/lib/productionUtils';
import type { ProductionComparison } from '@/types';

interface ProductionChartsProps {
  comparisons: ProductionComparison[];
}

export default function ProductionCharts({ comparisons }: ProductionChartsProps) {
  if (comparisons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">No data available for charts</p>
      </div>
    );
  }

  // Calculate totals
  const totalProjected = comparisons.reduce((sum, c) => sum + c.projected_quantity, 0);
  const totalActual = comparisons.reduce((sum, c) => sum + c.actual_quantity, 0);
  const completionPercentage = totalProjected > 0 ? (totalActual / totalProjected) * 100 : 0;

  // Get top 10 jobs by projected quantity for bar chart
  const topJobs = [...comparisons]
    .sort((a, b) => b.projected_quantity - a.projected_quantity)
    .slice(0, 10);

  // Find max value for scaling
  const maxValue = Math.max(
    ...topJobs.map((c) => Math.max(c.projected_quantity, c.actual_quantity))
  );

  // Calculate variance distribution
  const ahead = comparisons.filter((c) => getVarianceStatus(c.variance_percentage) === 'ahead').length;
  const onTrack = comparisons.filter((c) => getVarianceStatus(c.variance_percentage) === 'on-track').length;
  const behind = comparisons.filter((c) => getVarianceStatus(c.variance_percentage) === 'behind').length;
  const total = comparisons.length;

  return (
    <div className="space-y-6">
      {/* Overall Completion Progress */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Completion Rate</h3>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Projected</span>
              <span className="font-semibold">{totalProjected.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600">Total Actual</span>
              <span className="font-semibold">{totalActual.toLocaleString()}</span>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-700 font-medium">Completion Rate</span>
              <span className="text-lg font-bold text-blue-600">{completionPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  completionPercentage >= 95
                    ? 'bg-green-500'
                    : completionPercentage >= 80
                    ? 'bg-yellow-500'
                    : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(completionPercentage, 100)}%` }}
              >
                <div className="flex items-center justify-center h-full text-white text-sm font-semibold">
                  {completionPercentage > 10 && `${completionPercentage.toFixed(1)}%`}
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
            const projectedWidth = (comparison.projected_quantity / maxValue) * 100;
            const actualWidth = (comparison.actual_quantity / maxValue) * 100;

            return (
              <div key={comparison.job.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-700 truncate max-w-[60%]">
                    {comparison.job.job_number} - {comparison.job.job_name}
                  </span>
                  <span className="text-gray-500 text-xs">
                    {comparison.actual_quantity.toLocaleString()} / {comparison.projected_quantity.toLocaleString()}
                  </span>
                </div>
                <div className="relative h-8">
                  {/* Projected bar (background) */}
                  <div
                    className="absolute h-8 bg-blue-200 rounded"
                    style={{ width: `${projectedWidth}%` }}
                  >
                    <div className="flex items-center h-full px-2 text-xs text-blue-700">
                      Projected
                    </div>
                  </div>
                  {/* Actual bar (foreground) */}
                  <div
                    className={`absolute h-8 rounded ${
                      actualWidth >= projectedWidth * 0.95
                        ? 'bg-green-500'
                        : actualWidth >= projectedWidth * 0.8
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${actualWidth}%` }}
                  >
                    <div className="flex items-center h-full px-2 text-xs text-white font-semibold">
                      Actual
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Variance Distribution Pie Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Performance Distribution</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Simple pie visualization using flex */}
          <div className="flex items-center justify-center">
            <div className="w-48 h-48 rounded-full flex items-center justify-center relative overflow-hidden">
              {/* Create segments */}
              <div
                className="absolute inset-0 bg-green-500"
                style={{
                  clipPath: `polygon(50% 50%, 50% 0%, ${50 + (ahead / total) * 50}% 0%, 50% 50%)`,
                  transform: 'rotate(0deg)',
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
              {/* Center circle */}
              <div className="absolute w-24 h-24 bg-white rounded-full flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-800">{total}</div>
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
                <span className="text-sm font-medium text-gray-700">Ahead/On Target</span>
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
                <span className="text-sm font-medium text-gray-700">Slightly Behind</span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-yellow-700">{onTrack}</div>
                <div className="text-xs text-gray-500">
                  {total > 0 ? ((onTrack / total) * 100).toFixed(1) : 0}%
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-red-500 rounded" />
                <span className="text-sm font-medium text-gray-700">Behind Schedule</span>
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
