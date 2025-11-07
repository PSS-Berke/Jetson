import React from 'react';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  CFOSummaryMetrics,
} from '@/lib/cfoUtils';

interface CFOSummaryCardsProps {
  metrics: CFOSummaryMetrics;
  revenueTrend?: {
    current: number;
    previous: number;
    change: number;
    percentChange: number;
  };
}

export default function CFOSummaryCards({ metrics, revenueTrend }: CFOSummaryCardsProps) {
  // Helper function to get concentration risk color
  const getConcentrationColor = (concentration: number): string => {
    if (concentration >= 30) return 'text-red-600';
    if (concentration >= 20) return 'text-yellow-600';
    return 'text-green-600';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Revenue Pipeline Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Revenue Pipeline</h3>
        </div>
        <div className="mt-2">
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(metrics.totalRevenue, true)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {metrics.totalJobs} jobs
          </div>
        </div>
      </div>

      {/* Average Job Profit Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-green-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Avg Job Profit</h3>
        </div>
        <div className="mt-2">
          <div className={`text-3xl font-bold ${metrics.averageJobProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(metrics.averageJobProfit, true)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            per job
          </div>
        </div>
      </div>

      {/* Average Job Value Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-purple-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Avg Job Value</h3>
        </div>
        <div className="mt-2">
          <div className="text-3xl font-bold text-gray-900">
            {formatCurrency(metrics.averageJobValue, true)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {formatNumber(metrics.totalQuantity / metrics.totalJobs)} pcs/job
          </div>
        </div>
      </div>

      {/* Top 3 Profitable Jobs Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-indigo-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Top Profitable Jobs</h3>
        </div>
        <div className="mt-2 space-y-2">
          {metrics.topProfitableJobs.length > 0 ? (
            metrics.topProfitableJobs.map((job, index) => (
              <div key={index} className="flex justify-between items-start text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate" title={job.jobNumber}>
                    {job.jobNumber}
                  </div>
                  <div className="text-xs text-gray-500 truncate" title={job.client}>
                    {job.client}
                  </div>
                </div>
                <div className={`font-bold ml-2 ${job.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(job.profit, true)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-sm">No jobs available</div>
          )}
        </div>
      </div>

      {/* Top Client Concentration Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-orange-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Top Client Risk</h3>
        </div>
        <div className="mt-2">
          <div className={`text-3xl font-bold ${getConcentrationColor(metrics.topClientConcentration)}`}>
            {formatPercentage(metrics.topClientConcentration)}
          </div>
          <div className="text-sm text-gray-500 mt-1 truncate" title={metrics.topClientName}>
            {metrics.topClientName}
          </div>
        </div>
      </div>

      {/* Jobs at Risk Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-red-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Jobs At Risk</h3>
        </div>
        <div className="mt-2">
          <div className={`text-3xl font-bold ${metrics.jobsAtRisk && metrics.jobsAtRisk > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {metrics.jobsAtRisk || 0}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {metrics.revenueAtRisk ? formatCurrency(metrics.revenueAtRisk, true) : '$0'} at risk
          </div>
        </div>
      </div>

      {/* Total Quantity Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-cyan-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Total Pieces</h3>
        </div>
        <div className="mt-2">
          <div className="text-3xl font-bold text-gray-900">
            {formatNumber(metrics.totalQuantity)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            pieces projected
          </div>
        </div>
      </div>

      {/* Forecast Accuracy Card (optional) */}
      {metrics.forecastAccuracy !== undefined && (
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Forecast Accuracy</h3>
          </div>
          <div className="mt-2">
            <div className={`text-3xl font-bold ${metrics.forecastAccuracy >= 90 ? 'text-green-600' : metrics.forecastAccuracy >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
              {formatPercentage(metrics.forecastAccuracy)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {metrics.forecastAccuracy >= 90 ? 'Excellent' : metrics.forecastAccuracy >= 80 ? 'Good' : 'Needs improvement'}
            </div>
          </div>
        </div>
      )}

      {/* Top 4 Highest Cost Per Piece by Process Type Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200 border-l-4 border-l-amber-500">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Cost Per M (Top 4)</h3>
        </div>
        <div className="mt-2 space-y-2">
          {metrics.topCostPerPieceByProcess.length > 0 ? (
            metrics.topCostPerPieceByProcess.map((process, index) => (
              <div key={index} className="flex justify-between items-center text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 truncate" title={process.processType}>
                    {process.processType}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatNumber(process.totalPieces)} pieces
                  </div>
                </div>
                <div className="font-bold text-gray-900 ml-2">
                  ${process.costPerPiece.toFixed(2)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-gray-400 text-sm">No data available</div>
          )}
        </div>
      </div>
    </div>
  );
}
