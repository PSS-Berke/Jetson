import { format } from "date-fns";

interface FinancialsPDFHeaderRevisedProps {
  dateRange: { start: Date; end: Date };
  granularity: "weekly" | "monthly" | "quarterly";
  facility: number | null;
  selectedClients: string[];
  selectedServiceTypes: string[];
  searchQuery: string;
  filterMode: "AND" | "OR";
}

export default function FinancialsPDFHeaderRevised({
  dateRange,
  granularity,
  facility,
  selectedClients,
  selectedServiceTypes,
  searchQuery,
  filterMode,
}: FinancialsPDFHeaderRevisedProps) {
  const formatDateRange = () => {
    return `${format(dateRange.start, "MMM d, yyyy")} - ${format(dateRange.end, "MMM d, yyyy")}`;
  };

  const getFacilityName = () => {
    if (facility === null) return "All Facilities";
    if (facility === 1) return "Bolingbrook";
    if (facility === 2) return "Lemont";
    return "Unknown Facility";
  };

  const getGranularityLabel = () => {
    if (granularity === "weekly") return "Weekly";
    if (granularity === "monthly") return "Monthly";
    if (granularity === "quarterly") return "Quarterly";
    return "Monthly";
  };

  const hasFilters =
    selectedClients.length > 0 ||
    selectedServiceTypes.length > 0 ||
    searchQuery ||
    facility !== null;

  return (
    <div className="pdf-header mb-8">
      {/* Modern Header with Gradient */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white px-8 py-8 rounded-xl mb-6 shadow-lg">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white opacity-5 rounded-full -ml-24 -mb-24"></div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                Financial Analysis Report
              </h1>
              <p className="text-blue-100 text-base">
                Comprehensive revenue and profitability analysis
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm px-6 py-4 rounded-lg border border-white/20">
              <div className="text-sm text-blue-100 mb-1">Report Generated</div>
              <div className="text-lg font-semibold">
                {format(new Date(), "MMM d, yyyy")}
              </div>
              <div className="text-xs text-blue-200 mt-1">
                {format(new Date(), "h:mm a")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Report Period & Settings */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start">
            <div className="bg-blue-600 rounded-lg p-3 mr-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">
                Analysis Period
              </div>
              <div className="text-lg font-bold text-blue-900">
                {formatDateRange()}
              </div>
              <div className="text-xs text-blue-600 mt-1">
                {getGranularityLabel()} Breakdown
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start">
            <div className="bg-purple-600 rounded-lg p-3 mr-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs text-purple-600 font-semibold uppercase tracking-wide mb-1">
                Facility
              </div>
              <div className="text-lg font-bold text-purple-900">
                {getFacilityName()}
              </div>
              <div className="text-xs text-purple-600 mt-1">
                Operating Location
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start">
            <div className="bg-green-600 rounded-lg p-3 mr-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">
                Report Type
              </div>
              <div className="text-lg font-bold text-green-900">
                Financial Analysis
              </div>
              <div className="text-xs text-green-600 mt-1">
                Executive Summary
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Applied Filters Section */}
      {hasFilters && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-orange-500 rounded-lg p-6 shadow-sm">
          <div className="flex items-start mb-4">
            <div className="bg-orange-100 rounded-lg p-2 mr-3">
              <svg
                className="w-5 h-5 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-orange-900 text-base mb-1">
                Active Filters Applied
              </h3>
              <p className="text-sm text-orange-700">
                This report reflects filtered data based on the criteria below
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {facility !== null && (
              <div className="bg-white rounded-lg px-4 py-3 border border-orange-200 shadow-sm">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                  Facility Filter
                </div>
                <div className="text-sm text-orange-900 font-bold">
                  {getFacilityName()}
                </div>
              </div>
            )}
            {selectedClients.length > 0 && (
              <div className="bg-white rounded-lg px-4 py-3 border border-orange-200 shadow-sm col-span-2">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                  Selected Clients ({selectedClients.length})
                </div>
                <div className="text-sm text-orange-900 font-medium line-clamp-2">
                  {selectedClients.join(", ")}
                </div>
              </div>
            )}
            {selectedServiceTypes.length > 0 && (
              <div className="bg-white rounded-lg px-4 py-3 border border-orange-200 shadow-sm col-span-2">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                  Service Types ({selectedServiceTypes.length})
                </div>
                <div className="text-sm text-orange-900 font-medium line-clamp-2">
                  {selectedServiceTypes.join(", ")}
                </div>
              </div>
            )}
            {searchQuery && (
              <div className="bg-white rounded-lg px-4 py-3 border border-orange-200 shadow-sm">
                <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                  Search Query
                </div>
                <div className="text-sm text-orange-900 font-mono">
                  &quot;{searchQuery}&quot;
                </div>
              </div>
            )}
            <div className="bg-white rounded-lg px-4 py-3 border border-orange-200 shadow-sm">
              <div className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-1">
                Filter Mode
              </div>
              <div className="text-sm text-orange-900 font-bold">
                {filterMode === "AND"
                  ? "Match All Criteria"
                  : "Match Any Criteria"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Report Disclaimer */}
      <div className="mt-6 pt-4 border-t-2 border-gray-200">
        <div className="flex items-start text-xs text-gray-600">
          <svg
            className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>
            <span className="font-semibold">Confidential:</span> This financial
            report contains sensitive business data. All figures are based on
            current projections and actual recorded costs. Data accuracy is
            subject to ongoing updates and reconciliation.
          </p>
        </div>
      </div>
    </div>
  );
}
