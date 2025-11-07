import { CFOSummaryMetrics } from '@/lib/cfoUtils';

interface FinancialsPDFSummaryProps {
  summary: CFOSummaryMetrics;
  totalClients: number;
  primaryProcessType: string;
  revenuePerJob: number;
  periodGrowth?: number;
}

export default function FinancialsPDFSummary({
  summary,
  totalClients,
  primaryProcessType,
  revenuePerJob,
  periodGrowth
}: FinancialsPDFSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(value));
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="pdf-summary mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Executive Summary
      </h2>

      {/* Primary Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Revenue Pipeline */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-blue-600 font-medium mb-1 uppercase tracking-wide">Revenue Pipeline</div>
          <div className="text-2xl font-bold text-blue-900">{formatCurrency(summary.totalRevenue)}</div>
          <div className="text-xs text-blue-600 mt-1">Total Projected Revenue</div>
        </div>

        {/* Total Jobs */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-purple-600 font-medium mb-1 uppercase tracking-wide">Total Jobs</div>
          <div className="text-2xl font-bold text-purple-900">{summary.totalJobs}</div>
          <div className="text-xs text-purple-600 mt-1">{totalClients} Clients</div>
        </div>

        {/* Average Job Value */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-green-600 font-medium mb-1 uppercase tracking-wide">Avg Job Value</div>
          <div className="text-2xl font-bold text-green-900">{formatCurrency(summary.averageJobValue)}</div>
          <div className="text-xs text-green-600 mt-1">Revenue Per Job: {formatCurrency(revenuePerJob)}</div>
        </div>

        {/* Total Pieces */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-indigo-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-indigo-600 font-medium mb-1 uppercase tracking-wide">Total Pieces</div>
          <div className="text-2xl font-bold text-indigo-900">{formatNumber(summary.totalQuantity)}</div>
          <div className="text-xs text-indigo-600 mt-1">Projected Volume</div>
        </div>
      </div>

      {/* Risk & Performance Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        {/* Capacity Utilization */}
        <div className={`bg-gradient-to-br ${
          summary.capacityUtilization > 85 ? 'from-orange-50 to-orange-100 border-orange-500' :
          summary.capacityUtilization < 40 ? 'from-yellow-50 to-yellow-100 border-yellow-500' :
          'from-teal-50 to-teal-100 border-teal-500'
        } border-l-4 p-3 rounded-lg shadow-sm`}>
          <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
            summary.capacityUtilization > 85 ? 'text-orange-600' :
            summary.capacityUtilization < 40 ? 'text-yellow-600' :
            'text-teal-600'
          }`}>Capacity Utilization</div>
          <div className={`text-2xl font-bold ${
            summary.capacityUtilization > 85 ? 'text-orange-900' :
            summary.capacityUtilization < 40 ? 'text-yellow-900' :
            'text-teal-900'
          }`}>
            {formatPercentage(summary.capacityUtilization)}
          </div>
          <div className={`text-xs mt-1 ${
            summary.capacityUtilization > 85 ? 'text-orange-600' :
            summary.capacityUtilization < 40 ? 'text-yellow-600' :
            'text-teal-600'
          }`}>
            {summary.capacityUtilization > 85 ? 'High Load' : summary.capacityUtilization < 40 ? 'Low Load' : 'Optimal'}
          </div>
        </div>

        {/* Top Client Risk */}
        <div className={`bg-gradient-to-br ${
          summary.topClientConcentration > 30 ? 'from-red-50 to-red-100 border-red-500' :
          summary.topClientConcentration > 20 ? 'from-yellow-50 to-yellow-100 border-yellow-500' :
          'from-green-50 to-green-100 border-green-500'
        } border-l-4 p-3 rounded-lg shadow-sm`}>
          <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
            summary.topClientConcentration > 30 ? 'text-red-600' :
            summary.topClientConcentration > 20 ? 'text-yellow-600' :
            'text-green-600'
          }`}>Top Client Risk</div>
          <div className={`text-2xl font-bold ${
            summary.topClientConcentration > 30 ? 'text-red-900' :
            summary.topClientConcentration > 20 ? 'text-yellow-900' :
            'text-green-900'
          }`}>
            {formatPercentage(summary.topClientConcentration)}
          </div>
          <div className={`text-xs mt-1 ${
            summary.topClientConcentration > 30 ? 'text-red-600' :
            summary.topClientConcentration > 20 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {summary.topClientName}
          </div>
        </div>

        {/* Jobs At Risk */}
        <div className={`bg-gradient-to-br ${
          (summary.jobsAtRisk || 0) > 5 ? 'from-red-50 to-red-100 border-red-500' :
          (summary.jobsAtRisk || 0) > 0 ? 'from-yellow-50 to-yellow-100 border-yellow-500' :
          'from-gray-50 to-gray-100 border-gray-500'
        } border-l-4 p-3 rounded-lg shadow-sm`}>
          <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
            (summary.jobsAtRisk || 0) > 5 ? 'text-red-600' :
            (summary.jobsAtRisk || 0) > 0 ? 'text-yellow-600' :
            'text-gray-600'
          }`}>Jobs At Risk</div>
          <div className={`text-2xl font-bold ${
            (summary.jobsAtRisk || 0) > 5 ? 'text-red-900' :
            (summary.jobsAtRisk || 0) > 0 ? 'text-yellow-900' :
            'text-gray-900'
          }`}>
            {summary.jobsAtRisk || 0}
          </div>
          <div className={`text-xs mt-1 ${
            (summary.jobsAtRisk || 0) > 5 ? 'text-red-600' :
            (summary.jobsAtRisk || 0) > 0 ? 'text-yellow-600' :
            'text-gray-600'
          }`}>
            {summary.revenueAtRisk ? formatCurrency(summary.revenueAtRisk) : 'No Risk'}
          </div>
        </div>

        {/* Period Growth */}
        {periodGrowth !== undefined && (
          <div className={`bg-gradient-to-br ${
            periodGrowth >= 0 ? 'from-green-50 to-green-100 border-green-500' : 'from-red-50 to-red-100 border-red-500'
          } border-l-4 p-3 rounded-lg shadow-sm`}>
            <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
              periodGrowth >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>Period Growth</div>
            <div className={`text-2xl font-bold ${
              periodGrowth >= 0 ? 'text-green-900' : 'text-red-900'
            }`}>
              {periodGrowth >= 0 ? '+' : ''}{formatPercentage(periodGrowth)}
            </div>
            <div className={`text-xs mt-1 ${
              periodGrowth >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              vs Previous Period
            </div>
          </div>
        )}
      </div>

      {/* Key Business Insights */}
      <div className="mt-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
          <div className="w-1 h-5 bg-blue-500 rounded mr-2"></div>
          Key Business Insights
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Total Clients</div>
            <div className="text-xl font-bold text-blue-900">
              {totalClients}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              Top client: {formatPercentage(summary.topClientConcentration)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-purple-600 font-medium uppercase tracking-wide mb-1">Primary Process</div>
            <div className="text-xl font-bold text-purple-900">
              {primaryProcessType}
            </div>
            <div className="text-xs text-purple-600 mt-1">
              Most common service
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Revenue/Job</div>
            <div className="text-xl font-bold text-green-900">
              {formatCurrency(revenuePerJob)}
            </div>
            <div className="text-xs text-green-600 mt-1">
              Average value
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
