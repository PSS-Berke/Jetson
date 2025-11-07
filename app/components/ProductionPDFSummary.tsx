interface ProductionSummary {
  total_jobs: number;
  total_projected: number;
  total_actual: number;
  total_variance: number;
  average_variance_percentage: number;
  jobs_ahead: number;
  jobs_on_track: number;
  jobs_behind: number;
  completion_rate: number;
  total_revenue: number;
}

interface ProductionPDFSummaryProps {
  summary: ProductionSummary;
}

export default function ProductionPDFSummary({ summary }: ProductionPDFSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="pdf-summary mb-6">
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Summary Statistics
      </h2>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {/* Total Jobs */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-blue-600 font-medium mb-1 uppercase tracking-wide">Total Jobs Tracked</div>
          <div className="text-2xl font-bold text-blue-900">{summary.total_jobs}</div>
        </div>

        {/* Total Quantity */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-purple-600 font-medium mb-1 uppercase tracking-wide">Total Quantity Produced</div>
          <div className="text-2xl font-bold text-purple-900">{formatNumber(summary.total_actual)}</div>
          <div className="text-xs text-purple-600 mt-1">
            Projected: {formatNumber(summary.total_projected)}
          </div>
        </div>

        {/* Overall Variance */}
        <div className={`bg-gradient-to-br ${
          summary.total_variance >= 0 ? 'from-green-50 to-green-100 border-green-500' : 'from-red-50 to-red-100 border-red-500'
        } border-l-4 p-3 rounded-lg shadow-sm`}>
          <div className={`text-xs font-medium mb-1 uppercase tracking-wide ${
            summary.total_variance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>Overall Variance</div>
          <div className={`text-2xl font-bold ${
            summary.total_variance >= 0 ? 'text-green-900' : 'text-red-900'
          }`}>
            {summary.total_variance >= 0 ? '+' : ''}{formatNumber(summary.total_variance)}
          </div>
          <div className={`text-xs mt-1 ${
            summary.total_variance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {formatPercentage(summary.average_variance_percentage)}
          </div>
        </div>

        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-indigo-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-indigo-600 font-medium mb-1 uppercase tracking-wide">Completion Rate</div>
          <div className="text-2xl font-bold text-indigo-900">
            {formatPercentage(summary.completion_rate)}
          </div>
        </div>

        {/* Jobs Ahead/On Target */}
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 border-l-4 border-teal-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-teal-600 font-medium mb-1 uppercase tracking-wide">Jobs Ahead/On Target</div>
          <div className="text-2xl font-bold text-teal-900">
            {summary.jobs_ahead + summary.jobs_on_track}
          </div>
          <div className="text-xs text-teal-600 mt-1">
            {formatPercentage(((summary.jobs_ahead + summary.jobs_on_track) / summary.total_jobs) * 100)}
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-green-600 font-medium mb-1 uppercase tracking-wide">Revenue Generated</div>
          <div className="text-2xl font-bold text-green-900">
            {formatCurrency(summary.total_revenue)}
          </div>
        </div>
      </div>

      {/* Performance Breakdown */}
      <div className="mt-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
          <div className="w-1 h-5 bg-blue-500 rounded mr-2"></div>
          Performance Breakdown
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-green-600 font-medium uppercase tracking-wide mb-1">Ahead</div>
            <div className="text-xl font-bold text-green-900">
              {summary.jobs_ahead}
            </div>
            <div className="text-xs text-green-600 mt-1">
              {formatPercentage((summary.jobs_ahead / summary.total_jobs) * 100)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-yellow-600 font-medium uppercase tracking-wide mb-1">On Track</div>
            <div className="text-xl font-bold text-yellow-900">
              {summary.jobs_on_track}
            </div>
            <div className="text-xs text-yellow-600 mt-1">
              {formatPercentage((summary.jobs_on_track / summary.total_jobs) * 100)}
            </div>
          </div>
          <div className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-red-600 font-medium uppercase tracking-wide mb-1">Behind</div>
            <div className="text-xl font-bold text-red-900">
              {summary.jobs_behind}
            </div>
            <div className="text-xs text-red-600 mt-1">
              {formatPercentage((summary.jobs_behind / summary.total_jobs) * 100)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
