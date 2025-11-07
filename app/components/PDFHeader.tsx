'use client';

import { format } from 'date-fns';

interface PDFHeaderProps {
  granularity: 'weekly' | 'monthly' | 'quarterly';
  startDate: Date;
  filters: {
    facility: number | null;
    clients: number[];
    serviceTypes: string[];
    searchQuery: string;
  };
}

export default function PDFHeader({ granularity, startDate, filters }: PDFHeaderProps) {
  const getFacilityName = (facilityId: number | null) => {
    if (facilityId === 1) return 'Bolingbrook';
    if (facilityId === 2) return 'Lemont';
    return 'All Facilities';
  };

  const getGranularityLabel = () => {
    if (granularity === 'weekly') return '5-Week';
    if (granularity === 'monthly') return '3-Month';
    return '4-Quarter';
  };

  return (
    <div className="pdf-header mb-8">
      {/* Title */}
      <h1 className="text-3xl font-bold text-[var(--dark-blue)] mb-2">
        {getGranularityLabel()} Projections Report
      </h1>

      {/* Export Date */}
      <p className="text-sm text-[var(--text-light)] mb-6">
        Generated on {format(new Date(), 'MMMM dd, yyyy \'at\' h:mm a')}
      </p>

      {/* Filters Applied */}
      <div className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
        <h3 className="font-semibold text-[var(--text-dark)] mb-3">Filters Applied</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="font-medium text-[var(--text-light)]">Facility:</span>
            <span className="ml-2 text-[var(--text-dark)]">{getFacilityName(filters.facility)}</span>
          </div>
          <div>
            <span className="font-medium text-[var(--text-light)]">Start Date:</span>
            <span className="ml-2 text-[var(--text-dark)]">{format(startDate, 'MMM dd, yyyy')}</span>
          </div>
          <div>
            <span className="font-medium text-[var(--text-light)]">Clients:</span>
            <span className="ml-2 text-[var(--text-dark)]">
              {filters.clients.length > 0 ? `${filters.clients.length} selected` : 'All Clients'}
            </span>
          </div>
          <div>
            <span className="font-medium text-[var(--text-light)]">Service Types:</span>
            <span className="ml-2 text-[var(--text-dark)]">
              {filters.serviceTypes.length > 0 ? filters.serviceTypes.join(', ') : 'All Types'}
            </span>
          </div>
          {filters.searchQuery && (
            <div className="col-span-2">
              <span className="font-medium text-[var(--text-light)]">Search Query:</span>
              <span className="ml-2 text-[var(--text-dark)]">{filters.searchQuery}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
