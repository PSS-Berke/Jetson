'use client';

import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ClientRevenue, formatCurrency, formatPercentage } from '@/lib/cfoUtils';
import CFOClientSortToggle, { ClientSortType } from './CFOClientSortToggle';

interface CFOClientAnalysisProps {
  clientData: ClientRevenue[];
  title?: string;
  topN?: number;
}

export default function CFOClientAnalysis({
  clientData,
  // title = 'Top Clients by Revenue',
  topN = 10,
}: CFOClientAnalysisProps) {
  const [sortBy, setSortBy] = useState<ClientSortType>('revenue');

  // Sort and take top N clients based on selected sort type
  const topClients = useMemo(() => {
    const sorted = [...clientData].sort((a, b) => {
      switch (sortBy) {
        case 'revenue':
          return b.revenue - a.revenue;
        case 'volume':
          return b.quantity - a.quantity;
        case 'profit':
          return b.profit - a.profit;
        default:
          return 0;
      }
    });
    return sorted.slice(0, topN);
  }, [clientData, sortBy, topN]);

  // Map sortBy to the actual data key in ClientRevenue interface
  const chartDataKey = sortBy === 'volume' ? 'quantity' : sortBy;

  // Dynamic subtitle based on active metric
  const subtitle = sortBy === 'revenue'
    ? 'Client concentration and distribution by revenue'
    : sortBy === 'volume'
    ? 'Client concentration and distribution by volume (pieces)'
    : 'Client concentration and distribution by profitability';

  // Calculate concentration risk color for each client
  const getClientColor = (percentage: number): string => {
    if (percentage >= 20) return '#dc2626'; // Red - high risk
    if (percentage >= 10) return '#f59e0b'; // Yellow - moderate risk
    return '#10b981'; // Green - healthy
  };

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{data.clientName}</p>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-600">Revenue:</span>{' '}
              <span className="font-semibold">{formatCurrency(data.revenue)}</span>
            </div>
            <div>
              <span className="text-gray-600">Profit:</span>{' '}
              <span className="font-semibold">{formatCurrency(data.profit)}</span>
            </div>
            <div>
              <span className="text-gray-600">Volume:</span>{' '}
              <span className="font-semibold">{data.quantity.toLocaleString()} pieces</span>
            </div>
            <div>
              <span className="text-gray-600">% of Total Revenue:</span>{' '}
              <span className="font-semibold">{formatPercentage(data.percentageOfTotal)}</span>
            </div>
            <div>
              <span className="text-gray-600">Jobs:</span>{' '}
              <span className="font-semibold">{data.jobCount}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Format X-axis based on current sort metric
  const formatXAxis = (value: number) => {
    if (sortBy === 'volume') {
      // Format volume as number with commas
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `${(value / 1000).toFixed(0)}K`;
      }
      return value.toLocaleString();
    } else {
      // Format revenue/profit as currency
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      }
      if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      }
      return `$${value}`;
    }
  };

  // Calculate risk assessment
  const highRiskClients = topClients.filter(c => c.percentageOfTotal >= 20).length;
  const moderateRiskClients = topClients.filter(c => c.percentageOfTotal >= 10 && c.percentageOfTotal < 20).length;
  const top3Concentration = topClients.slice(0, 3).reduce((sum, c) => sum + c.percentageOfTotal, 0);

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Top Clients</h3>
            <p className="text-sm text-gray-500">{subtitle}</p>
          </div>
          <CFOClientSortToggle currentSort={sortBy} onSortChange={setSortBy} />
        </div>
      </div>

      {/* Horizontal Bar Chart */}
      <div style={{ height: Math.max(300, topClients.length * 45) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={topClients}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatXAxis}
            />
            <YAxis
              dataKey="clientName"
              type="category"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              width={90}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />
            <Bar dataKey={chartDataKey} radius={[0, 4, 4, 0]}>
              {topClients.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getClientColor(entry.percentageOfTotal)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div>
          <div className="text-xs text-gray-500">Total Clients</div>
          <div className="text-sm font-semibold text-gray-900">
            {clientData.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Top Client</div>
          <div className="text-sm font-semibold text-gray-900">
            {topClients[0] ? formatPercentage(topClients[0].percentageOfTotal) : 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Top 3 Total</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatPercentage(top3Concentration)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Concentration Risk</div>
          <div className={`text-sm font-semibold ${
            top3Concentration >= 60 ? 'text-red-600' :
            top3Concentration >= 50 ? 'text-yellow-600' :
            'text-green-600'
          }`}>
            {top3Concentration >= 60 ? 'High' :
             top3Concentration >= 50 ? 'Moderate' :
             'Low'}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-sm bg-red-600 mr-2"></div>
          <span className="text-gray-600">≥20% (High Risk)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-sm bg-yellow-500 mr-2"></div>
          <span className="text-gray-600">10-20% (Moderate)</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-sm bg-green-500 mr-2"></div>
          <span className="text-gray-600">&lt;10% (Healthy)</span>
        </div>
      </div>
    </div>
  );
}
