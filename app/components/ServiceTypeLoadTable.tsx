"use client";

import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useServiceTypeLoad, type ServiceTypeGroup } from "@/hooks/useServiceTypeLoad";
import { generateWeekRanges } from "@/lib/projectionUtils";
import { generateMonthRanges, generateQuarterRanges } from "@/lib/dateUtils";

// Map toggle granularity to property name
const granularityToProperty = (granularity: "week" | "month" | "quarter"): "weekly" | "monthly" | "quarterly" => {
  switch (granularity) {
    case "week": return "weekly";
    case "month": return "monthly";
    case "quarter": return "quarterly";
  }
};

interface ServiceTypeLoadTableProps {
  facilitiesId: number | null;
  granularity: "week" | "month" | "quarter";
  startDate?: Date; // Optional start date for calculating date range
}

function formatNumber(num: number): string {
  return num.toLocaleString("en-US");
}

function formatKeyLabel(key: string, value: string): string {
  // Convert snake_case to Title Case
  const formattedKey = key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return `${formattedKey}: ${value}`;
}

export default function ServiceTypeLoadTable({
  facilitiesId,
  granularity,
  startDate,
}: ServiceTypeLoadTableProps) {
  // Calculate date range based on granularity and startDate
  const { from, to } = useMemo(() => {
    console.log("[ServiceTypeLoadTable] Calculating date range:", {
      startDate,
      granularity,
      hasStartDate: !!startDate,
    });
    
    if (!startDate) {
      console.log("[ServiceTypeLoadTable] No startDate provided, using null for from/to");
      return { from: null, to: null };
    }

    let timeRanges;
    switch (granularity) {
      case "week":
        timeRanges = generateWeekRanges(startDate);
        break;
      case "month":
        timeRanges = generateMonthRanges(startDate, 6);
        break;
      case "quarter":
        timeRanges = generateQuarterRanges(startDate, 6);
        break;
      default:
        timeRanges = generateWeekRanges(startDate);
    }

    if (timeRanges.length === 0) {
      return { from: null, to: null };
    }

    // Get the first range's start date and last range's end date
    const firstRange = timeRanges[0];
    const lastRange = timeRanges[timeRanges.length - 1];
    
    const result = {
      from: firstRange.startDate.getTime(),
      to: lastRange.endDate.getTime(),
    };
    console.log("[ServiceTypeLoadTable] Calculated date range:", result);
    return result;
  }, [granularity, startDate]);

  console.log("[ServiceTypeLoadTable] Rendering with:", {
    facilitiesId,
    granularity,
    from,
    to,
  });

  const { groupedData, dateColumns, isLoading, error } = useServiceTypeLoad(
    facilitiesId,
    granularity,
    from,
    to,
  );
  const [expandedServiceTypes, setExpandedServiceTypes] = useState<Set<string>>(
    new Set(),
  );

  const toggleServiceType = (serviceType: string) => {
    setExpandedServiceTypes((prev) => {
      const next = new Set(prev);
      if (next.has(serviceType)) {
        next.delete(serviceType);
      } else {
        next.add(serviceType);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12 text-[var(--text-light)]">
        Loading service type load data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-2xl mx-auto">
          <div className="text-red-800 font-semibold text-lg mb-2">
            Error Loading Data
          </div>
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  if (groupedData.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--text-light)]">
        No service type load data available.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left py-3 px-4 font-semibold text-[var(--dark-blue)] sticky left-0 bg-white z-10">
              Service Type / Attribute
            </th>
            {dateColumns.map((date) => (
              <th
                key={date}
                className="text-right py-3 px-4 font-semibold text-[var(--dark-blue)] whitespace-nowrap"
              >
                {date}
              </th>
            ))}
            <th className="text-right py-3 px-4 font-semibold text-[var(--dark-blue)] whitespace-nowrap">
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {groupedData.map((group) => {
            const isExpanded = expandedServiceTypes.has(group.serviceType);
            const timeDataKey = granularityToProperty(granularity);

            return (
              <React.Fragment key={group.serviceType}>
                {/* Parent row - Service Type */}
                <tr
                  className="bg-blue-50 hover:bg-blue-100 cursor-pointer transition-colors"
                  onClick={() => toggleServiceType(group.serviceType)}
                >
                  <td className="py-3 px-4 font-semibold sticky left-0 bg-blue-50 z-10">
                    <div className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                      <span>{group.serviceType}</span>
                    </div>
                  </td>
                  {dateColumns.map((date) => {
                    // Sum up values for this date across all items in the group
                    const value = group.items.reduce((sum, item) => {
                      return sum + (item[timeDataKey][date] || 0);
                    }, 0);
                    return (
                      <td key={date} className="py-3 px-4 text-right">
                        {value > 0 ? formatNumber(value) : ""}
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right font-semibold">
                    {formatNumber(group.serviceTotal)}
                  </td>
                </tr>

                {/* Child rows - Key-Value pairs */}
                {isExpanded &&
                  group.items.map((item, idx) => (
                    <tr
                      key={`${item.service_type}-${item.key}-${item.value}-${idx}`}
                      className="border-b border-[var(--border)] hover:bg-gray-50"
                    >
                      <td className="py-2 px-4 pl-12 sticky left-0 bg-white z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">└</span>
                          <span>
                            {formatKeyLabel(item.key, item.value)} (
                            {item.job_count} {item.job_count === 1 ? "job" : "jobs"})
                          </span>
                        </div>
                      </td>
                      {dateColumns.map((date) => {
                        const value = item[timeDataKey][date] || 0;
                        return (
                          <td key={date} className="py-2 px-4 text-right">
                            {value > 0 ? formatNumber(value) : ""}
                          </td>
                        );
                      })}
                      <td className="py-2 px-4 text-right font-semibold">
                        {formatNumber(item.key_total)}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

