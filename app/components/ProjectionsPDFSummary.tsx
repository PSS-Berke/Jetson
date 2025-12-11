interface ProcessTypeCounts {
  insert: { jobs: number; pieces: number };
  sort: { jobs: number; pieces: number };
  inkjet: { jobs: number; pieces: number };
  labelApply: { jobs: number; pieces: number };
  fold: { jobs: number; pieces: number };
  laser: { jobs: number; pieces: number };
  hpPress: { jobs: number; pieces: number };
}

interface ProjectionsPDFSummaryProps {
  totalJobs: number;
  totalRevenue: number;
  totalQuantity: number;
  serviceTypeCount: number;
  averagePerPeriod: number;
  granularity: "week" | "month" | "quarter";
  processTypeCounts: ProcessTypeCounts;
  serviceSummaries: Array<{
    serviceType: string;
    grandTotal: number;
    jobCount: number;
  }>;
}

export default function ProjectionsPDFSummary({
  totalJobs,
  totalRevenue,
  totalQuantity,
  serviceTypeCount,
  averagePerPeriod,
  granularity,
  processTypeCounts,
  serviceSummaries,
}: ProjectionsPDFSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
  };

  const getPeriodLabel = () => {
    if (granularity === "week") return "Week";
    if (granularity === "month") return "Month";
    return "Quarter";
  };

  return (
    <div className="pdf-summary mb-6">
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
        Summary Statistics
      </h2>

      {/* Key Metrics */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {/* Total Jobs */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-blue-600 font-medium mb-1 uppercase tracking-wide">
            Total Jobs
          </div>
          <div className="text-2xl font-bold text-blue-900">{totalJobs}</div>
        </div>

        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-l-4 border-green-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-green-600 font-medium mb-1 uppercase tracking-wide">
            Total Revenue
          </div>
          <div className="text-2xl font-bold text-green-900">
            {formatCurrency(totalRevenue)}
          </div>
        </div>

        {/* Total Quantity */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-l-4 border-purple-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-purple-600 font-medium mb-1 uppercase tracking-wide">
            Total Quantity
          </div>
          <div className="text-2xl font-bold text-purple-900">
            {formatNumber(totalQuantity)}
          </div>
        </div>

        {/* Service Types */}
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-orange-600 font-medium mb-1 uppercase tracking-wide">
            Service Types
          </div>
          <div className="text-2xl font-bold text-orange-900">
            {serviceTypeCount}
          </div>
        </div>

        {/* Average per Period */}
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-l-4 border-indigo-500 p-3 rounded-lg shadow-sm">
          <div className="text-xs text-indigo-600 font-medium mb-1 uppercase tracking-wide">
            Avg per {getPeriodLabel()}
          </div>
          <div className="text-2xl font-bold text-indigo-900">
            {formatNumber(averagePerPeriod)}
          </div>
        </div>
      </div>

      {/* Service Type Breakdown */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
          <div className="w-1 h-5 bg-blue-500 rounded mr-2"></div>
          Service Type Details
        </h3>
        <div className="grid grid-cols-4 gap-3">
          {serviceSummaries
            .filter((summary) => summary.serviceType.toLowerCase() !== "insert")
            .map((summary) => (
              <div
                key={summary.serviceType}
                className="bg-white border-2 border-gray-200 hover:border-blue-300 p-3 rounded-lg shadow-sm"
              >
                <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                  {summary.serviceType}
                </div>
                <div className="text-lg font-bold text-gray-900 mt-1">
                  {formatNumber(summary.grandTotal)} pcs
                </div>
                <div className="text-xs text-gray-600 mt-1 flex items-center">
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  {summary.jobCount} jobs
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Process Type Breakdown */}
      <div>
        <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center">
          <div className="w-1 h-5 bg-purple-500 rounded mr-2"></div>
          Process Type Details
        </h3>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Insert
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.insert.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.insert.jobs} jobs
            </div>
          </div>
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Sort
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.sort.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.sort.jobs} jobs
            </div>
          </div>
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Inkjet
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.inkjet.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.inkjet.jobs} jobs
            </div>
          </div>
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Label/Apply
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.labelApply.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.labelApply.jobs} jobs
            </div>
          </div>
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Fold
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.fold.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.fold.jobs} jobs
            </div>
          </div>
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              Laser
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.laser.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.laser.jobs} jobs
            </div>
          </div>
          <div className="bg-white border-2 border-gray-200 hover:border-purple-300 p-3 rounded-lg shadow-sm">
            <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">
              HP Press
            </div>
            <div className="text-lg font-bold text-gray-900 mt-1">
              {formatNumber(processTypeCounts.hpPress.pieces)} pcs
            </div>
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <svg
                className="w-3 h-3 mr-1"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
              </svg>
              {processTypeCounts.hpPress.jobs} jobs
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
