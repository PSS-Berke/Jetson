import { CFOSummaryMetrics } from '@/lib/cfoUtils';

interface FinancialsPDFSummaryRevisedProps {
  summary: CFOSummaryMetrics;
  totalClients: number;
  primaryProcessType: string;
  revenuePerJob: number;
  periodGrowth?: number;
}

export default function FinancialsPDFSummaryRevised({
  summary,
  totalClients,
  primaryProcessType,
  revenuePerJob,
  periodGrowth
}: FinancialsPDFSummaryRevisedProps) {
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

  // Determine overall business health score
  const getHealthScore = () => {
    let score = 0;
    if (summary.capacityUtilization >= 60 && summary.capacityUtilization <= 85) score += 25;
    else if (summary.capacityUtilization > 40) score += 15;

    if (summary.topClientConcentration < 20) score += 25;
    else if (summary.topClientConcentration < 30) score += 15;

    if ((summary.jobsAtRisk || 0) === 0) score += 25;
    else if ((summary.jobsAtRisk || 0) < 3) score += 15;

    if (periodGrowth && periodGrowth > 0) score += 25;
    else if (periodGrowth && periodGrowth > -10) score += 15;

    return score;
  };

  const healthScore = getHealthScore();
  const healthLabel = healthScore >= 80 ? 'Excellent' : healthScore >= 60 ? 'Good' : healthScore >= 40 ? 'Fair' : 'Needs Attention';
  const healthColor = healthScore >= 80 ? 'green' : healthScore >= 60 ? 'blue' : healthScore >= 40 ? 'yellow' : 'red';

  return (
    <div className="pdf-summary mb-8">
      {/* Executive Summary Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="bg-blue-600 rounded-lg p-3 mr-4">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Executive Summary</h2>
              <p className="text-sm text-gray-600 mt-1">Key performance metrics and business health indicators</p>
            </div>
          </div>

          {/* Overall Health Score */}
          <div className={`bg-gradient-to-br from-${healthColor}-50 to-${healthColor}-100 border-2 border-${healthColor}-300 rounded-lg px-6 py-4 text-center shadow-lg`}>
            <div className="text-xs font-semibold text-${healthColor}-600 uppercase tracking-wide mb-1">Business Health</div>
            <div className={`text-4xl font-bold text-${healthColor}-900 mb-1`}>{healthScore}</div>
            <div className={`text-sm font-semibold text-${healthColor}-700`}>{healthLabel}</div>
          </div>
        </div>
      </div>

      {/* Primary Financial Metrics */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center">
          <div className="w-1 h-5 bg-blue-600 rounded mr-2"></div>
          Revenue & Volume Metrics
        </h3>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Total Revenue</div>
              <svg className="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(summary.totalRevenue)}</div>
            <div className="text-xs opacity-75">Projected Pipeline</div>
          </div>

          <div className="bg-gradient-to-br from-purple-600 to-purple-700 text-white p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Active Jobs</div>
              <svg className="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div className="text-3xl font-bold mb-1">{summary.totalJobs}</div>
            <div className="text-xs opacity-75">{totalClients} Unique Clients</div>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-green-700 text-white p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Avg Job Value</div>
              <svg className="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(summary.averageJobValue)}</div>
            <div className="text-xs opacity-75">Per Job Revenue: {formatCurrency(revenuePerJob)}</div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white p-5 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Total Volume</div>
              <svg className="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="text-3xl font-bold mb-1">{formatNumber(summary.totalQuantity)}</div>
            <div className="text-xs opacity-75">Total Pieces</div>
          </div>
        </div>
      </div>

      {/* Risk & Performance Indicators */}
      <div className="mb-6">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center">
          <div className="w-1 h-5 bg-orange-600 rounded mr-2"></div>
          Risk Assessment & Performance
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {/* Capacity Utilization */}
          <div className={`relative overflow-hidden rounded-xl shadow-lg p-5 ${
            summary.capacityUtilization > 85 ? 'bg-gradient-to-br from-orange-500 to-red-600' :
            summary.capacityUtilization < 40 ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
            'bg-gradient-to-br from-teal-500 to-green-600'
          } text-white`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Capacity</div>
                <div className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                  {summary.capacityUtilization > 85 ? 'HIGH' : summary.capacityUtilization < 40 ? 'LOW' : 'OPTIMAL'}
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{formatPercentage(summary.capacityUtilization)}</div>
              <div className="text-xs opacity-75">Utilization Rate</div>
            </div>
          </div>

          {/* Client Concentration Risk */}
          <div className={`relative overflow-hidden rounded-xl shadow-lg p-5 ${
            summary.topClientConcentration > 30 ? 'bg-gradient-to-br from-red-500 to-red-700' :
            summary.topClientConcentration > 20 ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
            'bg-gradient-to-br from-green-500 to-teal-600'
          } text-white`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Top Client</div>
                <div className="bg-white/20 rounded-full px-2 py-0.5 text-xs font-bold">
                  {summary.topClientConcentration > 30 ? 'HIGH' : summary.topClientConcentration > 20 ? 'MED' : 'LOW'}
                </div>
              </div>
              <div className="text-3xl font-bold mb-1">{formatPercentage(summary.topClientConcentration)}</div>
              <div className="text-xs opacity-75 truncate" title={summary.topClientName}>{summary.topClientName}</div>
            </div>
          </div>

          {/* Jobs At Risk */}
          <div className={`relative overflow-hidden rounded-xl shadow-lg p-5 ${
            (summary.jobsAtRisk || 0) > 5 ? 'bg-gradient-to-br from-red-500 to-red-700' :
            (summary.jobsAtRisk || 0) > 0 ? 'bg-gradient-to-br from-yellow-500 to-orange-600' :
            'bg-gradient-to-br from-gray-500 to-gray-600'
          } text-white`}>
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold uppercase tracking-wide opacity-90">At Risk</div>
                <svg className="w-5 h-5 opacity-75" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="text-3xl font-bold mb-1">{summary.jobsAtRisk || 0}</div>
              <div className="text-xs opacity-75">
                {summary.revenueAtRisk ? formatCurrency(summary.revenueAtRisk) : 'No Risk'}
              </div>
            </div>
          </div>

          {/* Period Growth */}
          {periodGrowth !== undefined ? (
            <div className={`relative overflow-hidden rounded-xl shadow-lg p-5 ${
              periodGrowth >= 10 ? 'bg-gradient-to-br from-green-500 to-green-700' :
              periodGrowth >= 0 ? 'bg-gradient-to-br from-blue-500 to-blue-700' :
              'bg-gradient-to-br from-red-500 to-red-700'
            } text-white`}>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold uppercase tracking-wide opacity-90">Growth</div>
                  <svg className={`w-5 h-5 opacity-75 ${periodGrowth >= 0 ? '' : 'transform rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                </div>
                <div className="text-3xl font-bold mb-1">
                  {periodGrowth >= 0 ? '+' : ''}{formatPercentage(periodGrowth)}
                </div>
                <div className="text-xs opacity-75">vs Previous Period</div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-gray-400 to-gray-500 rounded-xl shadow-lg p-5 text-white">
              <div className="text-xs font-semibold uppercase tracking-wide opacity-90 mb-3">Growth</div>
              <div className="text-2xl font-bold mb-1">N/A</div>
              <div className="text-xs opacity-75">No Comparison Data</div>
            </div>
          )}
        </div>
      </div>

      {/* Key Business Insights */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 border-2 border-blue-200 rounded-xl p-6 shadow-md">
        <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Key Takeaways & Recommendations
        </h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border-2 border-blue-100 p-4 rounded-lg shadow-sm">
            <div className="text-xs text-blue-600 font-bold uppercase tracking-wide mb-2">Client Portfolio</div>
            <div className="text-2xl font-bold text-blue-900 mb-1">{totalClients}</div>
            <div className="text-xs text-gray-600 mb-2">Active Clients</div>
            <div className="text-xs text-gray-700">
              Top client represents {formatPercentage(summary.topClientConcentration)}
              {summary.topClientConcentration > 30 && (
                <span className="text-red-600 font-semibold"> - Diversification recommended</span>
              )}
            </div>
          </div>

          <div className="bg-white border-2 border-purple-100 p-4 rounded-lg shadow-sm">
            <div className="text-xs text-purple-600 font-bold uppercase tracking-wide mb-2">Service Mix</div>
            <div className="text-lg font-bold text-purple-900 mb-1 truncate" title={primaryProcessType}>
              {primaryProcessType}
            </div>
            <div className="text-xs text-gray-600 mb-2">Primary Process Type</div>
            <div className="text-xs text-gray-700">
              Most frequently requested service type
            </div>
          </div>

          <div className="bg-white border-2 border-green-100 p-4 rounded-lg shadow-sm">
            <div className="text-xs text-green-600 font-bold uppercase tracking-wide mb-2">Job Economics</div>
            <div className="text-2xl font-bold text-green-900 mb-1">{formatCurrency(revenuePerJob)}</div>
            <div className="text-xs text-gray-600 mb-2">Revenue Per Job</div>
            <div className="text-xs text-gray-700">
              Average value across all jobs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
