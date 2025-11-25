import { format } from "date-fns";

interface ProjectionsPDFHeaderProps {
  startDate: Date;
  granularity: "weekly" | "monthly" | "quarterly";
  facility: number | null;
  selectedServiceTypes: string[];
  searchQuery: string;
  scheduleFilter: "all" | "confirmed" | "soft";
  filterMode: "AND" | "OR";
}

export default function ProjectionsPDFHeader({
  startDate,
  granularity,
  facility,
  selectedServiceTypes,
  searchQuery,
  scheduleFilter,
  filterMode,
}: ProjectionsPDFHeaderProps) {
  const formatStartDate = () => {
    return format(startDate, "MMMM d, yyyy");
  };

  const getGranularityLabel = () => {
    if (granularity === "weekly") return "5-Week Projections";
    if (granularity === "monthly") return "3-Month Projections";
    return "4-Quarter Projections";
  };

  const getFacilityName = () => {
    if (facility === null) return "All Facilities";
    if (facility === 1) return "Bolingbrook";
    if (facility === 2) return "Lemont";
    return "Unknown Facility";
  };

  const getScheduleFilterLabel = () => {
    if (scheduleFilter === "confirmed") return "Confirmed Only";
    if (scheduleFilter === "soft") return "Soft Schedule Only";
    return "All Schedules";
  };

  const hasFilters =
    selectedServiceTypes.length > 0 ||
    searchQuery ||
    facility !== null ||
    scheduleFilter !== "all";

  return (
    <div className="pdf-header mb-6">
      {/* Header with brand colors */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg mb-4">
        <h1 className="text-2xl font-bold">{getGranularityLabel()}</h1>
        <p className="text-sm text-blue-100 mt-1">
          Generated on {format(new Date(), "MMMM d, yyyy 'at' h:mm a")}
        </p>
      </div>

      {/* Key Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-lg p-3 mr-3">
              <svg
                className="w-5 h-5 text-blue-600"
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
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Start Date
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {formatStartDate()}
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-lg p-3 mr-3">
              <svg
                className="w-5 h-5 text-blue-600"
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
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                View Type
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {granularity === "weekly"
                  ? "Weekly"
                  : granularity === "monthly"
                    ? "Monthly"
                    : "Quarterly"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Applied Filters */}
      {hasFilters && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <svg
              className="w-4 h-4 mr-2"
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
            Applied Filters
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {facility !== null && (
              <div className="bg-white rounded px-3 py-2">
                <span className="font-medium text-gray-600">Facility:</span>
                <span className="ml-2 text-blue-800 font-semibold">
                  {getFacilityName()}
                </span>
              </div>
            )}
            {selectedServiceTypes.length > 0 && (
              <div className="bg-white rounded px-3 py-2 col-span-2">
                <span className="font-medium text-gray-600">
                  Service Types:
                </span>
                <span className="ml-2 text-blue-800 font-semibold">
                  {selectedServiceTypes.join(", ")}
                </span>
              </div>
            )}
            {searchQuery && (
              <div className="bg-white rounded px-3 py-2">
                <span className="font-medium text-gray-600">Search:</span>
                <span className="ml-2 text-blue-800 font-semibold">
                  {searchQuery}
                </span>
              </div>
            )}
            {scheduleFilter !== "all" && (
              <div className="bg-white rounded px-3 py-2">
                <span className="font-medium text-gray-600">Schedule:</span>
                <span className="ml-2 text-blue-800 font-semibold">
                  {getScheduleFilterLabel()}
                </span>
              </div>
            )}
            <div className="bg-white rounded px-3 py-2">
              <span className="font-medium text-gray-600">Filter Mode:</span>
              <span className="ml-2 text-blue-800 font-semibold">
                {filterMode === "AND" ? "Match All" : "Match Any"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
