"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import {
  ServiceTypeRevenue,
  formatCurrency,
  formatPercentage,
  formatNumber,
} from "@/lib/cfoUtils";
import {
  getProcessTypeColor,
  normalizeProcessType,
} from "@/lib/processTypeConfig";
import CFOClientSortToggle, { ClientSortType } from "./CFOClientSortToggle";

interface CFOServiceMixProps {
  serviceData: ServiceTypeRevenue[];
  title?: string;
}

/**
 * Get color for a process type label (handles label variations)
 * Maps display labels to processTypeConfig keys for consistent coloring
 */
const getProcessColor = (processType: string): string => {
  // Handle common label variations that appear in service data
  const labelToKeyMap: { [key: string]: string } = {
    Insert: "insert",
    Sort: "sort",
    Inkjet: "inkjet",
    "Label/Apply": "labelApply",
    Affix: "labelApply",
    Fold: "fold",
    Laser: "laser",
    "HP Press": "hpPress",
  };

  // Try direct mapping first
  const key = labelToKeyMap[processType];
  if (key) {
    return getProcessTypeColor(key);
  }

  // Fall back to normalization for edge cases
  const normalizedKey = normalizeProcessType(processType);
  return getProcessTypeColor(normalizedKey);
};

export default function CFOServiceMix({
  serviceData,
  // title = 'Process Mix Analysis',
}: CFOServiceMixProps) {
  const [sortBy, setSortBy] = useState<ClientSortType>("revenue");
  const [chartType, setChartType] = useState<"bar" | "pie">("bar");

  // Sort data based on selected metric
  const sortedData = useMemo(() => {
    return [...serviceData].sort((a, b) => {
      switch (sortBy) {
        case "revenue":
          return b.revenue - a.revenue;
        case "volume":
          return b.quantity - a.quantity;
        case "profit":
          return b.profit - a.profit;
        default:
          return 0;
      }
    });
  }, [serviceData, sortBy]);

  // Get the current metric display name and data key
  const metricName =
    sortBy === "revenue"
      ? "Revenue"
      : sortBy === "volume"
        ? "Volume"
        : "Profit";
  const chartDataKey = sortBy === "volume" ? "quantity" : sortBy;

  // Prepare data for pie chart
  const pieData = sortedData.map((service) => ({
    name: service.serviceType,
    value:
      sortBy === "volume"
        ? service.quantity
        : sortBy === "revenue"
          ? service.revenue
          : service.profit,
    percentage: service.percentageOfTotal,
    ...service,
  }));

  // Custom tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-4 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{data.serviceType}</p>
          <div className="text-sm space-y-1">
            <div>
              <span className="text-gray-600">Revenue:</span>{" "}
              <span className="font-semibold">
                {formatCurrency(data.revenue)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Profit:</span>{" "}
              <span className="font-semibold">
                {formatCurrency(data.profit)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Volume:</span>{" "}
              <span className="font-semibold">
                {formatNumber(data.quantity)} pcs
              </span>
            </div>
            <div>
              <span className="text-gray-600">% of Revenue:</span>{" "}
              <span className="font-semibold">
                {formatPercentage(data.percentageOfTotal)}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Jobs:</span>{" "}
              <span className="font-semibold">{data.jobCount}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Format axis values based on current sort metric
  const formatValue = (value: number) => {
    if (sortBy === "volume") {
      // Format volume as number
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toString();
    } else {
      // Format revenue/profit as currency
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value}`;
    }
  };

  // Custom legend formatter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-col gap-1 text-xs">
        {payload.map(
          (entry: { color: string; value: string }, index: number) => (
            <div key={`legend-${index}`} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700">{entry.value}</span>
            </div>
          ),
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Process Mix by {metricName}
          </h3>
          <p className="text-sm text-gray-500">
            Distribution analysis by process type
          </p>
        </div>

        {/* View Controls */}
        <div className="flex gap-2">
          {/* Sort Toggle */}
          <CFOClientSortToggle currentSort={sortBy} onSortChange={setSortBy} />

          {/* Chart Type Toggle */}
          <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-1">
            <button
              onClick={() => setChartType("bar")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                chartType === "bar"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Bar
            </button>
            <button
              onClick={() => setChartType("pie")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                chartType === "pie"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Pie
            </button>
          </div>
        </div>
      </div>

      {/* Chart Display */}
      <div style={{ height: 350 }}>
        {chartType === "bar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="serviceType"
                stroke="#6b7280"
                style={{ fontSize: "12px" }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#6b7280"
                style={{ fontSize: "12px" }}
                tickFormatter={formatValue}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={chartDataKey} radius={[4, 4, 0, 0]}>
                {sortedData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getProcessColor(entry.serviceType)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={false}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getProcessColor(entry.name)}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                content={renderLegend}
                layout="vertical"
                align="right"
                verticalAlign="bottom"
                wrapperStyle={{ paddingLeft: "20px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
        <div>
          <div className="text-xs text-gray-500">Process Types</div>
          <div className="text-sm font-semibold text-gray-900">
            {sortedData.length}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Top Process</div>
          <div
            className="text-sm font-semibold text-gray-900 truncate"
            title={sortedData[0]?.serviceType}
          >
            {sortedData[0]?.serviceType || "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Top % of {metricName}</div>
          <div className="text-sm font-semibold text-gray-900">
            {sortedData[0]
              ? formatPercentage(sortedData[0].percentageOfTotal)
              : "N/A"}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Avg/Process</div>
          <div className="text-sm font-semibold text-gray-900">
            {sortBy === "revenue"
              ? formatCurrency(
                  sortedData.reduce((sum, s) => sum + s.revenue, 0) /
                    sortedData.length,
                )
              : sortBy === "volume"
                ? formatNumber(
                    sortedData.reduce((sum, s) => sum + s.quantity, 0) /
                      sortedData.length,
                  )
                : formatCurrency(
                    sortedData.reduce((sum, s) => sum + s.profit, 0) /
                      sortedData.length,
                  )}
          </div>
        </div>
      </div>
    </div>
  );
}
