import React from 'react';
import {
  formatCurrency,
  formatPercentage,
  formatNumber,
  getTrendIndicator,
  getChangeColor,
  CFOSummaryMetrics,
} from '@/lib/cfoUtils';

interface CFOSummaryCardsProps {
  metrics: CFOSummaryMetrics;
  revenueTrend?: {
    percentChange: number;
    change: number;
  };
}

export default function CFOSummaryCards({ metrics, revenueTrend }: CFOSummaryCardsProps) {
  // Helper function to get capacity utilization color
  const getCapacityColor = (utilization: number): string => {
    if (utilization >= 95) return 'bg-red-500';
    if (utilization >= 85) return 'bg-yellow-500';
    if (utilization >= 60) return 'bg-green-500';
    if (utilization >= 40) return 'bg-blue-500';
    return 'bg-gray-400';
  };

  // Helper function to get concentration risk color
  const getConcentrationColor = (concentration: number): string => {
    if (concentration >= 30) return 'text-red-600';
    if (concentration >= 20) return 'text-yellow-600';
    return 'text-green-600';
  };

  // Helper function to get concentration risk icon
  const getConcentrationIcon = (concentration: number): string => {
    if (concentration >= 30) return '🔴';
    if (concentration >= 20) return '⚠️';
    return '✓';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Revenue Pipeline Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Revenue Pipeline</h3>
          <span className="text-2xl">💰</span>
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

      {/* Revenue Trend Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Revenue Trend</h3>
          <span className="text-2xl">📈</span>
        </div>
        <div className="mt-2">
          {revenueTrend ? (
            <>
              <div className={`text-3xl font-bold ${getChangeColor(revenueTrend.percentChange)}`}>
                {getTrendIndicator(revenueTrend.percentChange)} {formatPercentage(Math.abs(revenueTrend.percentChange))}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                vs previous period
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-gray-400">
                N/A
              </div>
              <div className="text-sm text-gray-500 mt-1">
                No comparison data
              </div>
            </>
          )}
        </div>
      </div>

      {/* Average Job Value Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Avg Job Value</h3>
          <span className="text-2xl">💵</span>
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

      {/* Capacity Utilization Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Capacity Usage</h3>
          <span className="text-2xl">⚙️</span>
        </div>
        <div className="mt-2">
          <div className="text-3xl font-bold text-gray-900">
            {formatPercentage(metrics.capacityUtilization)}
          </div>
          <div className="mt-2">
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${getCapacityColor(metrics.capacityUtilization)}`}
                style={{ width: `${Math.min(100, metrics.capacityUtilization)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Client Concentration Card */}
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Top Client Risk</h3>
          <span className="text-2xl">{getConcentrationIcon(metrics.topClientConcentration)}</span>
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
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Jobs At Risk</h3>
          <span className="text-2xl">{metrics.jobsAtRisk && metrics.jobsAtRisk > 0 ? '⚡' : '✓'}</span>
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
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-600">Total Pieces</h3>
          <span className="text-2xl">📦</span>
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
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Forecast Accuracy</h3>
            <span className="text-2xl">{metrics.forecastAccuracy >= 90 ? '🎯' : '📊'}</span>
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
    </div>
  );
}
