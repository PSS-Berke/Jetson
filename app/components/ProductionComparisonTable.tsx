'use client';

import { useState } from 'react';
import { getVarianceStatus } from '@/lib/productionUtils';
import type { ProductionComparison } from '@/types';

interface ProductionComparisonTableProps {
  comparisons: ProductionComparison[];
  onEdit?: (comparison: ProductionComparison) => void;
}

type SortField = 'job_number' | 'job_name' | 'client' | 'projected' | 'actual' | 'variance';
type SortDirection = 'asc' | 'desc';

export default function ProductionComparisonTable({
  comparisons,
  onEdit,
}: ProductionComparisonTableProps) {
  const [sortField, setSortField] = useState<SortField>('job_number');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Sort comparisons
  const sortedComparisons = [...comparisons].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    switch (sortField) {
      case 'job_number':
        aValue = a.job.job_number;
        bValue = b.job.job_number;
        break;
      case 'job_name':
        aValue = a.job.job_name.toLowerCase();
        bValue = b.job.job_name.toLowerCase();
        break;
      case 'client':
        aValue = a.job.client?.name.toLowerCase() || '';
        bValue = b.job.client?.name.toLowerCase() || '';
        break;
      case 'projected':
        aValue = a.projected_quantity;
        bValue = b.projected_quantity;
        break;
      case 'actual':
        aValue = a.actual_quantity;
        bValue = b.actual_quantity;
        break;
      case 'variance':
        aValue = a.variance_percentage;
        bValue = b.variance_percentage;
        break;
      default:
        aValue = a.job.job_number;
        bValue = b.job.job_number;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedComparisons.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedComparisons = sortedComparisons.slice(startIndex, endIndex);

  // Reset to page 1 when items per page changes
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Get status class for variance
  const getStatusClass = (variance_percentage: number): string => {
    const status = getVarianceStatus(variance_percentage);
    switch (status) {
      case 'ahead':
        return 'text-green-700 bg-green-50';
      case 'on-track':
        return 'text-yellow-700 bg-yellow-50';
      case 'behind':
        return 'text-red-700 bg-red-50';
    }
  };

  // Render sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-gray-400">⇅</span>;
    return <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
  };

  if (comparisons.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">No production data available for this period</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                onClick={() => handleSort('job_number')}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Job # <SortIcon field="job_number" />
                </div>
              </th>
              <th
                onClick={() => handleSort('job_name')}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Job Name <SortIcon field="job_name" />
                </div>
              </th>
              <th
                onClick={() => handleSort('client')}
                className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-2">
                  Client <SortIcon field="client" />
                </div>
              </th>
              <th
                onClick={() => handleSort('projected')}
                className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-2">
                  Projected <SortIcon field="projected" />
                </div>
              </th>
              <th
                onClick={() => handleSort('actual')}
                className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-2">
                  Actual <SortIcon field="actual" />
                </div>
              </th>
              <th
                onClick={() => handleSort('variance')}
                className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-2">
                  Variance <SortIcon field="variance" />
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Variance %
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedComparisons.map((comparison) => (
              <tr
                key={comparison.job.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onEdit && onEdit(comparison)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {comparison.job.job_number}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {comparison.job.job_name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {comparison.job.client?.name || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                  {comparison.projected_quantity.toLocaleString()}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-semibold ${
                  comparison.actual_quantity > 0 ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {comparison.actual_quantity.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span className={comparison.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {comparison.variance >= 0 ? '+' : ''}
                    {comparison.variance.toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                  <span
                    className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                      comparison.variance_percentage
                    )}`}
                  >
                    {comparison.variance_percentage >= 0 ? '+' : ''}
                    {comparison.variance_percentage.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-200">
        {paginatedComparisons.map((comparison) => (
          <div
            key={comparison.job.id}
            className="p-4 hover:bg-gray-50 cursor-pointer"
            onClick={() => onEdit && onEdit(comparison)}
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-semibold text-gray-900">
                  Job #{comparison.job.job_number}
                </div>
                <div className="text-sm text-gray-600">{comparison.job.job_name}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {comparison.job.client?.name || 'Unknown'}
                </div>
              </div>
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                  comparison.variance_percentage
                )}`}
              >
                {comparison.variance_percentage >= 0 ? '+' : ''}
                {comparison.variance_percentage.toFixed(1)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
              <div>
                <span className="text-gray-500">Projected:</span>
                <span className="ml-2 font-medium">
                  {comparison.projected_quantity.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Actual:</span>
                <span className={`ml-2 font-semibold ${
                  comparison.actual_quantity > 0 ? 'text-blue-600' : 'text-gray-900'
                }`}>
                  {comparison.actual_quantity.toLocaleString()}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-500">Variance:</span>
                <span
                  className={`ml-2 font-medium ${
                    comparison.variance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {comparison.variance >= 0 ? '+' : ''}
                  {comparison.variance.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {comparisons.length > 10 && (
        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Items per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-700">Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-700">per page</span>
            </div>

            {/* Page info and navigation */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(endIndex, sortedComparisons.length)} of{' '}
                {sortedComparisons.length} jobs
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
