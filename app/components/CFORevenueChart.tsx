import React, { useState, useMemo } from 'react';
import {
  // AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Line,
  ComposedChart,
} from 'recharts';
import { RevenueByPeriod, formatCurrency } from '@/lib/cfoUtils';
import CFOClientSortToggle, { ClientSortType } from './CFOClientSortToggle';

interface CFORevenueChartProps {
  currentPeriodData: RevenueByPeriod[];
  previousPeriodData?: RevenueByPeriod[];
  title?: string;
}

export default function CFORevenueChart({
  currentPeriodData,
  previousPeriodData,
  title = 'Revenue Trend',
}: CFORevenueChartProps) {
  const [viewMode, setViewMode] = useState<ClientSortType>('revenue');

  // Get the current metric display name and data key
  const metricName = viewMode === 'revenue' ? 'Revenue' : viewMode === 'volume' ? 'Volume' : 'Profit';

  // Merge current and previous period data for comparison
  const chartData = useMemo(() => {
    return currentPeriodData.map((current, index) => {
      const previous = previousPeriodData ? previousPeriodData[index] : undefined;

      return {
        period: current.period,
        currentRevenue: current.revenue,
        previousRevenue: previous?.revenue || 0,
        currentVolume: current.quantity,
        previousVolume: previous?.quantity || 0,
        currentProfit: current.profit,
        previousProfit: previous?.profit || 0,
        currentJobs: current.jobCount,
        previousJobs: previous?.jobCount || 0,
      };
    });
  }, [currentPeriodData, previousPeriodData]);

  // Get current values based on view mode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getCurrentValue = (data: any) => {
    switch (viewMode) {
      case 'revenue':
        return data.currentRevenue;
      case 'volume':
        return data.currentVolume;
      case 'profit':
        return data.currentProfit;
      default:
        return data.currentRevenue;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getPreviousValue = (data: any) => {
    switch (viewMode) {
      case 'revenue':
        return data.previousRevenue;
      case 'volume':
        return data.previousVolume;
      case 'profit':
        return data.previousProfit;
      default:
        return data.previousRevenue;
    }
  };

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payload.map((entry: any, index: number) => {
            const data = entry.payload;
            const isCurrent = entry.name === 'current';

            let displayValue = '';
            if (viewMode === 'volume') {
              displayValue = isCurrent
                ? data.currentVolume.toLocaleString() + ' pcs'
                : data.previousVolume.toLocaleString() + ' pcs';
            } else {
              displayValue = formatCurrency(entry.value);
            }

            return (
              <div key={index} className="text-sm">
                <span style={{ color: entry.color }} className="font-medium">
                  {isCurrent ? 'Current Period' : 'Previous Period'}:
                </span>{' '}
                <span className="font-semibold">{displayValue}</span>
                <span className="text-gray-500 ml-2">
                  ({isCurrent ? data.currentJobs : data.previousJobs} jobs)
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Format Y-axis ticks based on view mode
  const formatYAxis = (value: number) => {
    if (viewMode === 'volume') {
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

  const hasPreviousData = previousPeriodData && previousPeriodData.length > 0;

  // Calculate summary stats based on current view mode
  const peakPeriod = chartData.reduce((max, curr) => {
    const maxValue = getCurrentValue(max);
    const currValue = getCurrentValue(curr);
    return currValue > maxValue ? curr : max;
  }, chartData[0]);

  const peakValue = Math.max(...chartData.map(d => getCurrentValue(d)));
  const avgValue = chartData.reduce((sum, d) => sum + getCurrentValue(d), 0) / chartData.length;

  const formatValue = (value: number) => {
    if (viewMode === 'volume') {
      return value.toLocaleString() + ' pcs';
    }
    return formatCurrency(value);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">{metricName} projections across time periods</p>
        </div>
        <CFOClientSortToggle currentSort={viewMode} onSortChange={setViewMode} />
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="period"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            tickFormatter={formatYAxis}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            formatter={(value) => {
              if (value === 'current') return 'Current Period';
              if (value === 'previous') return 'Previous Period';
              return value;
            }}
          />

          {/* Previous period line (if available) */}
          {hasPreviousData && (
            <Line
              type="monotone"
              dataKey={(data) => getPreviousValue(data)}
              name="previous"
              stroke="#9ca3af"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: '#9ca3af', r: 4 }}
              activeDot={{ r: 6 }}
            />
          )}

          {/* Current period area */}
          <Area
            type="monotone"
            dataKey={(data) => getCurrentValue(data)}
            name="current"
            stroke="#3b82f6"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorCurrent)"
            dot={{ fill: '#3b82f6', r: 5 }}
            activeDot={{ r: 7 }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Summary stats below chart */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div>
          <div className="text-xs text-gray-500">Peak Period</div>
          <div className="text-sm font-semibold text-gray-900">
            {peakPeriod?.period || 'N/A'}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Peak {metricName}</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatValue(peakValue)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Average Period</div>
          <div className="text-sm font-semibold text-gray-900">
            {formatValue(avgValue)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total Jobs</div>
          <div className="text-sm font-semibold text-gray-900">
            {chartData.reduce((sum, d) => sum + d.currentJobs, 0)}
          </div>
        </div>
      </div>
    </div>
  );
}
