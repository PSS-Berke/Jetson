import { format } from 'date-fns';

interface ProductionPDFHeaderProps {
  dateRange: { start: Date; end: Date };
  granularity: 'day' | 'week' | 'month';
  facility: number | null;
  selectedClients: string[];
  selectedProcessTypes: string[];
  searchQuery: string;
  filterMode: 'AND' | 'OR';
}

export default function ProductionPDFHeader({
  dateRange,
  granularity,
  facility,
  selectedClients,
  selectedProcessTypes,
  searchQuery,
  filterMode,
}: ProductionPDFHeaderProps) {
  const formatDateRange = () => {
    if (granularity === 'day') {
      return format(dateRange.start, 'EEEE, MMMM d, yyyy');
    } else if (granularity === 'month') {
      return format(dateRange.start, 'MMMM yyyy');
    } else {
      return `${format(dateRange.start, 'MMM d, yyyy')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    }
  };

  const getFacilityName = () => {
    if (facility === null) return 'All Facilities';
    if (facility === 1) return 'Bolingbrook';
    if (facility === 2) return 'Lemont';
    return 'Unknown Facility';
  };

  const hasFilters = selectedClients.length > 0 || selectedProcessTypes.length > 0 || searchQuery || facility !== null;

  return (
    <div className="pdf-header mb-6">
      {/* Header with brand colors */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4 rounded-t-lg mb-4">
        <h1 className="text-2xl font-bold">Production Report</h1>
        <p className="text-sm text-blue-100 mt-1">
          Generated on {format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}
        </p>
      </div>

      {/* Key Information */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-lg p-3 mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Date Range</div>
              <div className="text-sm font-semibold text-gray-900">{formatDateRange()}</div>
            </div>
          </div>
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-lg p-3 mr-3">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide">Granularity</div>
              <div className="text-sm font-semibold text-gray-900">
                {granularity === 'day' ? 'Daily' : granularity === 'week' ? 'Weekly' : 'Monthly'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Applied Filters */}
      {hasFilters && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Applied Filters
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {facility !== null && (
              <div className="bg-white rounded px-3 py-2">
                <span className="font-medium text-gray-600">Facility:</span>
                <span className="ml-2 text-blue-800 font-semibold">{getFacilityName()}</span>
              </div>
            )}
            {selectedClients.length > 0 && (
              <div className="bg-white rounded px-3 py-2 col-span-2">
                <span className="font-medium text-gray-600">Clients:</span>
                <span className="ml-2 text-blue-800 font-semibold">{selectedClients.join(', ')}</span>
              </div>
            )}
            {selectedProcessTypes.length > 0 && (
              <div className="bg-white rounded px-3 py-2 col-span-2">
                <span className="font-medium text-gray-600">Process Types:</span>
                <span className="ml-2 text-blue-800 font-semibold">{selectedProcessTypes.join(', ')}</span>
              </div>
            )}
            {searchQuery && (
              <div className="bg-white rounded px-3 py-2">
                <span className="font-medium text-gray-600">Search:</span>
                <span className="ml-2 text-blue-800 font-semibold">{searchQuery}</span>
              </div>
            )}
            <div className="bg-white rounded px-3 py-2">
              <span className="font-medium text-gray-600">Filter Mode:</span>
              <span className="ml-2 text-blue-800 font-semibold">{filterMode === 'AND' ? 'Match All' : 'Match Any'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
