import { ClientRevenue, ServiceTypeRevenue, PeriodComparison } from '@/lib/cfoUtils';
import { Job } from '@/types';

interface JobWithCost extends Job {
  costPer1000?: number;
  actualCost?: number;
  profit?: number;
  profitMargin?: number;
}

interface FinancialsPDFTablesRevisedProps {
  topClients: ClientRevenue[];
  serviceTypes: ServiceTypeRevenue[];
  periodComparison?: PeriodComparison[];
  jobsWithCosts?: JobWithCost[];
}

export default function FinancialsPDFTablesRevised({
  topClients,
  serviceTypes,
  periodComparison,
  jobsWithCosts,
}: FinancialsPDFTablesRevisedProps) {
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

  const getRiskColor = (percentage: number) => {
    if (percentage > 30) return { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' };
    if (percentage > 20) return { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
    return { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' };
  };

  const getChangeColor = (change: number) => {
    if (change >= 0) return { bg: 'bg-green-100', text: 'text-green-800' };
    return { bg: 'bg-red-100', text: 'text-red-800' };
  };

  const getRiskLabel = (percentage: number) => {
    if (percentage > 30) return 'High Risk';
    if (percentage > 20) return 'Medium';
    return 'Healthy';
  };

  return (
    <div className="pdf-tables space-y-8">
      {/* Top Client Analysis */}
      <div className="page-break-before">
        <div className="mb-4 pb-3 border-b-2 border-blue-600">
          <div className="flex items-center">
            <div className="bg-blue-600 rounded-lg p-2 mr-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Top Client Revenue Analysis</h2>
              <p className="text-sm text-gray-600">Client concentration and revenue distribution by account</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden shadow-md">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <th className="px-4 py-3 text-left font-bold border-r border-blue-500">Rank</th>
                <th className="px-4 py-3 text-left font-bold border-r border-blue-500">Client Name</th>
                <th className="px-4 py-3 text-right font-bold border-r border-blue-500">Revenue</th>
                <th className="px-4 py-3 text-right font-bold border-r border-blue-500">Jobs</th>
                <th className="px-4 py-3 text-right font-bold border-r border-blue-500">Volume (pcs)</th>
                <th className="px-4 py-3 text-right font-bold border-r border-blue-500">Profit</th>
                <th className="px-4 py-3 text-right font-bold border-r border-blue-500">% of Total</th>
                <th className="px-4 py-3 text-center font-bold">Risk Assessment</th>
              </tr>
            </thead>
            <tbody>
              {topClients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500 bg-gray-50">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                      </svg>
                      <p className="text-sm font-medium">No client data available for this period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                topClients.map((client, index) => {
                  const riskColors = getRiskColor(client.percentageOfTotal);
                  return (
                    <tr
                      key={client.clientId}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-blue-50'} border-b border-gray-200 hover:bg-blue-100 transition-colors`}
                    >
                      <td className="px-4 py-3 border-r border-gray-200">
                        <div className="flex items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full font-bold text-xs">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-900 font-semibold border-r border-gray-200">
                        {client.clientName}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-bold border-r border-gray-200">
                        {formatCurrency(client.revenue)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 border-r border-gray-200">
                        <span className="bg-gray-100 px-2 py-1 rounded font-medium">{client.jobCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 border-r border-gray-200">
                        {formatNumber(client.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold border-r border-gray-200">
                        <span className={client.profit >= 0 ? 'text-green-700' : 'text-red-700'}>
                          {formatCurrency(client.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right border-r border-gray-200">
                        <span className="bg-blue-100 text-blue-900 px-3 py-1 rounded-full font-bold">
                          {formatPercentage(client.percentageOfTotal)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`${riskColors.bg} ${riskColors.text} px-3 py-1 rounded-full font-bold text-xs border ${riskColors.border}`}>
                          {getRiskLabel(client.percentageOfTotal)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {topClients.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Showing top {topClients.length} clients by revenue</span>
            </div>
            <div className="flex gap-3">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded mr-1"></div>
                <span className="text-gray-600">&lt;20% (Healthy)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded mr-1"></div>
                <span className="text-gray-600">20-30% (Medium)</span>
              </div>
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded mr-1"></div>
                <span className="text-gray-600">&gt;30% (High Risk)</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Service Type Mix Analysis */}
      <div className="page-break-before">
        <div className="mb-4 pb-3 border-b-2 border-purple-600">
          <div className="flex items-center">
            <div className="bg-purple-600 rounded-lg p-2 mr-3">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Service Type Revenue Mix</h2>
              <p className="text-sm text-gray-600">Revenue distribution across different process types and services</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden shadow-md">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-gradient-to-r from-purple-600 to-purple-700 text-white">
                <th className="px-4 py-3 text-left font-bold border-r border-purple-500">Service Type</th>
                <th className="px-4 py-3 text-right font-bold border-r border-purple-500">Revenue</th>
                <th className="px-4 py-3 text-right font-bold border-r border-purple-500">Jobs</th>
                <th className="px-4 py-3 text-right font-bold border-r border-purple-500">Volume (pcs)</th>
                <th className="px-4 py-3 text-right font-bold border-r border-purple-500">Profit</th>
                <th className="px-4 py-3 text-right font-bold border-r border-purple-500">Avg/Job</th>
                <th className="px-4 py-3 text-right font-bold">% of Total</th>
              </tr>
            </thead>
            <tbody>
              {serviceTypes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500 bg-gray-50">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <p className="text-sm font-medium">No service type data available for this period</p>
                    </div>
                  </td>
                </tr>
              ) : (
                serviceTypes.map((service, index) => (
                  <tr
                    key={service.serviceType}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-purple-50'} border-b border-gray-200 hover:bg-purple-100 transition-colors`}
                  >
                    <td className="px-4 py-3 text-gray-900 font-semibold border-r border-gray-200">
                      <div className="flex items-center">
                        <div className="w-2 h-8 bg-purple-600 rounded mr-2"></div>
                        {service.serviceType}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-bold border-r border-gray-200">
                      {formatCurrency(service.revenue)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 border-r border-gray-200">
                      <span className="bg-gray-100 px-2 py-1 rounded font-medium">{service.jobCount}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 border-r border-gray-200">
                      {formatNumber(service.quantity)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold border-r border-gray-200">
                      <span className={service.profit >= 0 ? 'text-green-700' : 'text-red-700'}>
                        {formatCurrency(service.profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 border-r border-gray-200">
                      {formatCurrency(service.revenue / service.jobCount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-purple-100 text-purple-900 px-3 py-1 rounded-full font-bold">
                        {formatPercentage(service.percentageOfTotal)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {serviceTypes.length > 0 && (
          <div className="mt-3 text-xs text-gray-600 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Total service types: {serviceTypes.length} | Revenue concentration in top service: {formatPercentage(serviceTypes[0]?.percentageOfTotal || 0)}</span>
          </div>
        )}
      </div>

      {/* Period Comparison */}
      {periodComparison && periodComparison.length > 0 && (
        <div className="page-break-before">
          <div className="mb-4 pb-3 border-b-2 border-green-600">
            <div className="flex items-center">
              <div className="bg-green-600 rounded-lg p-2 mr-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Period-Over-Period Comparison</h2>
                <p className="text-sm text-gray-600">Performance trends and variance analysis</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden shadow-md">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                  <th className="px-4 py-3 text-left font-bold border-r border-green-500">Metric</th>
                  <th className="px-4 py-3 text-right font-bold border-r border-green-500">Current Period</th>
                  <th className="px-4 py-3 text-right font-bold border-r border-green-500">Previous Period</th>
                  <th className="px-4 py-3 text-right font-bold border-r border-green-500">Variance</th>
                  <th className="px-4 py-3 text-right font-bold">% Change</th>
                </tr>
              </thead>
              <tbody>
                {periodComparison.map((comparison, index) => {
                  const changeColors = getChangeColor(comparison.change);
                  return (
                    <tr
                      key={comparison.metric}
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-green-50'} border-b border-gray-200`}
                    >
                      <td className="px-4 py-3 text-gray-900 font-semibold border-r border-gray-200">
                        {comparison.metric}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-bold border-r border-gray-200">
                        {comparison.metric === 'Revenue' || comparison.metric === 'Avg Job Value'
                          ? formatCurrency(comparison.current)
                          : formatNumber(comparison.current)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 border-r border-gray-200">
                        {comparison.metric === 'Revenue' || comparison.metric === 'Avg Job Value'
                          ? formatCurrency(comparison.previous)
                          : formatNumber(comparison.previous)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold border-r border-gray-200 ${changeColors.text}`}>
                        <span className={`${changeColors.bg} px-2 py-1 rounded`}>
                          {comparison.change >= 0 ? '+' : ''}
                          {comparison.metric === 'Revenue' || comparison.metric === 'Avg Job Value'
                            ? formatCurrency(comparison.change)
                            : formatNumber(comparison.change)}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${changeColors.text}`}>
                        <div className="flex items-center justify-end">
                          {comparison.percentChange >= 0 ? (
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                          <span className={`${changeColors.bg} px-2 py-1 rounded`}>
                            {comparison.percentChange >= 0 ? '+' : ''}{formatPercentage(comparison.percentChange)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Job Profitability Analysis */}
      {jobsWithCosts && jobsWithCosts.length > 0 && (
        <div className="page-break-before">
          <div className="mb-4 pb-3 border-b-2 border-indigo-600">
            <div className="flex items-center">
              <div className="bg-indigo-600 rounded-lg p-2 mr-3">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Job-Level Profitability Analysis</h2>
                <p className="text-sm text-gray-600">Detailed cost and margin analysis by individual job</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden shadow-md">
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white">
                  <th className="px-3 py-3 text-left font-bold border-r border-indigo-500">Job #</th>
                  <th className="px-3 py-3 text-left font-bold border-r border-indigo-500">Client</th>
                  <th className="px-3 py-3 text-right font-bold border-r border-indigo-500">Revenue</th>
                  <th className="px-3 py-3 text-right font-bold border-r border-indigo-500">Cost</th>
                  <th className="px-3 py-3 text-right font-bold border-r border-indigo-500">Profit</th>
                  <th className="px-3 py-3 text-right font-bold">Margin %</th>
                </tr>
              </thead>
              <tbody>
                {jobsWithCosts.map((job, index) => (
                  <tr
                    key={job.id}
                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-indigo-50'} border-b border-gray-200`}
                  >
                    <td className="px-3 py-2 text-gray-900 font-semibold border-r border-gray-200">
                      {job.job_number || 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-gray-700 border-r border-gray-200 text-xs">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {typeof job.client === 'object' && job.client ? (job.client as any).name : job.client || 'Unknown'}
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(job as any).sub_client && ` / ${(job as any).sub_client.name}`}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-900 font-bold border-r border-gray-200">
                      {formatCurrency(parseFloat(job.total_billing || '0'))}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 border-r border-gray-200">
                      {job.actualCost ? formatCurrency(job.actualCost) : '-'}
                    </td>
                    <td className={`px-3 py-2 text-right font-bold border-r border-gray-200`}>
                      {job.profit !== undefined ? (
                        <span className={`${(job.profit || 0) >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-1 rounded`}>
                          {formatCurrency(job.profit)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-bold">
                      {job.profitMargin !== undefined ? (
                        <span className={`${(job.profitMargin || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                          {formatPercentage(job.profitMargin)}
                        </span>
                      ) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-600 flex items-center">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">Showing {jobsWithCosts.length} jobs with complete cost data</span>
          </div>
        </div>
      )}

      {/* Footer Note */}
      <div className="mt-8 pt-6 border-t-2 border-gray-300">
        <div className="flex items-start text-xs text-gray-500">
          <svg className="w-4 h-4 mr-2 text-gray-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            <span className="font-semibold">Note:</span> All financial data presented in this report is based on current projections
            and recorded transactions as of the report generation date. Figures may be subject to adjustment pending final reconciliation
            and invoice processing.
          </p>
        </div>
      </div>
    </div>
  );
}
