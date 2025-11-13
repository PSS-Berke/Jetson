"use client";

import { calculateProductionSummary } from "@/lib/productionUtils";
import type { ProductionComparison } from "@/types";

interface ProductionSummaryCardsProps {
  comparisons: ProductionComparison[];
}

export default function ProductionSummaryCards({
  comparisons,
}: ProductionSummaryCardsProps) {
  const summary =
    comparisons.length > 0 ? calculateProductionSummary(comparisons) : null;

  if (!summary) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No summary data available</p>
      </div>
    );
  }

  const cards = [
    {
      title: "Total Jobs Tracked",
      value: summary.total_jobs.toString(),
      subtitle: "Active jobs in period",
      color: "blue",
    },
    {
      title: "Total Quantity Produced",
      value: summary.total_actual.toLocaleString(),
      subtitle: `of ${summary.total_projected.toLocaleString()} projected`,
      color: "green",
    },
    {
      title: "Overall Variance",
      value: `${summary.total_variance >= 0 ? "+" : ""}${summary.total_variance.toLocaleString()}`,
      subtitle: `${summary.average_variance_percentage >= 0 ? "+" : ""}${summary.average_variance_percentage.toFixed(1)}%`,
      color: summary.total_variance >= 0 ? "green" : "red",
    },
    {
      title: "Completion Rate",
      value: `${summary.completion_rate.toFixed(1)}%`,
      subtitle: "Actual vs Projected",
      color:
        summary.completion_rate >= 95
          ? "green"
          : summary.completion_rate >= 80
            ? "yellow"
            : "red",
    },
    {
      title: "Jobs Ahead/On Target",
      value: summary.jobs_ahead.toString(),
      subtitle: `${((summary.jobs_ahead / summary.total_jobs) * 100).toFixed(1)}% of total`,
      color: "green",
    },
    {
      title: "Revenue Generated",
      value: `$${summary.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      subtitle: "Based on actual production",
      color: "green",
    },
  ];

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-50 border-blue-200 text-blue-700";
      case "green":
        return "bg-green-50 border-green-200 text-green-700";
      case "red":
        return "bg-red-50 border-red-200 text-red-700";
      case "yellow":
        return "bg-yellow-50 border-yellow-200 text-yellow-700";
      case "gray":
        return "bg-gray-50 border-gray-200 text-gray-700";
      default:
        return "bg-gray-50 border-gray-200 text-gray-700";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {cards.map((card, index) => (
        <div
          key={index}
          className={`bg-white rounded-lg shadow border-l-4 ${getColorClasses(card.color)} p-6 transition-transform hover:scale-105`}
        >
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-1">
              {card.title}
            </p>
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {card.value}
            </p>
            <p className="text-xs text-gray-500">{card.subtitle}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
