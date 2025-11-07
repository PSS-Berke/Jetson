'use client';

interface PDFSummaryProps {
  totalJobs: number;
  totalRevenue: number;
  totalQuantity: number;
  processTypeCounts: {
    insert: { jobs: number; pieces: number };
    sort: { jobs: number; pieces: number };
    inkjet: { jobs: number; pieces: number };
    labelApply: { jobs: number; pieces: number };
    fold: { jobs: number; pieces: number };
    laser: { jobs: number; pieces: number };
    hpPress: { jobs: number; pieces: number };
  };
}

export default function PDFSummary({
  totalJobs,
  totalRevenue,
  totalQuantity,
  processTypeCounts,
}: PDFSummaryProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  const processTypeLabels: Record<string, string> = {
    insert: 'Insert',
    sort: 'Sort',
    inkjet: 'Inkjet',
    labelApply: 'Label/Apply',
    fold: 'Fold',
    laser: 'Laser',
    hpPress: 'HP Press',
  };

  return (
    <div className="pdf-summary">
      {/* Main Statistics */}
      <h3 className="font-semibold text-[var(--text-dark)] mb-4 mt-6">Summary Statistics</h3>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-[var(--border)] rounded-lg p-4 bg-white">
          <p className="text-xs text-[var(--text-light)] mb-1">Total Jobs</p>
          <p className="text-2xl font-bold text-[var(--dark-blue)]">{formatNumber(totalJobs)}</p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4 bg-white">
          <p className="text-xs text-[var(--text-light)] mb-1">Total Revenue</p>
          <p className="text-2xl font-bold text-[var(--primary-blue)]">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="border border-[var(--border)] rounded-lg p-4 bg-white">
          <p className="text-xs text-[var(--text-light)] mb-1">Total Quantity</p>
          <p className="text-2xl font-bold text-[var(--dark-blue)]">{formatNumber(totalQuantity)}</p>
        </div>
      </div>

      {/* Process Type Breakdown */}
      <h3 className="font-semibold text-[var(--text-dark)] mb-3">Process Type Breakdown</h3>
      <div className="border border-[var(--border)] rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-[var(--text-dark)] uppercase">Process Type</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-dark)] uppercase">Jobs</th>
              <th className="px-4 py-2 text-center text-xs font-medium text-[var(--text-dark)] uppercase">Pieces</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {Object.entries(processTypeCounts).map(([key, value]) => (
              value.jobs > 0 && (
                <tr key={key}>
                  <td className="px-4 py-2 text-[var(--text-dark)]">{processTypeLabels[key]}</td>
                  <td className="px-4 py-2 text-center font-medium text-[var(--text-dark)]">{formatNumber(value.jobs)}</td>
                  <td className="px-4 py-2 text-center font-medium text-[var(--text-dark)]">{formatNumber(value.pieces)}</td>
                </tr>
              )
            ))}
            {Object.values(processTypeCounts).every(v => v.jobs === 0) && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-[var(--text-light)]">
                  No process type data available
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
