import { useState, useEffect } from "react";
import { getServiceTypeLoad, type ServiceTypeLoadItem } from "@/lib/api";

export interface ParsedServiceTypeLoadItem extends Omit<ServiceTypeLoadItem, "weekly" | "monthly" | "quarterly"> {
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  quarterly: Record<string, number>;
}

// Map toggle granularity to property name
const granularityToProperty = (granularity: "week" | "month" | "quarter"): "weekly" | "monthly" | "quarterly" => {
  switch (granularity) {
    case "week": return "weekly";
    case "month": return "monthly";
    case "quarter": return "quarterly";
  }
};

export interface ServiceTypeGroup {
  serviceType: string;
  serviceTotal: number;
  items: ParsedServiceTypeLoadItem[];
}

export function useServiceTypeLoad(facilitiesId: number | null, granularity: "week" | "month" | "quarter") {
  const [data, setData] = useState<ParsedServiceTypeLoadItem[]>([]);
  const [groupedData, setGroupedData] = useState<ServiceTypeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const facilities_id = facilitiesId ?? 0;
        const response = await getServiceTypeLoad(facilities_id);
        
        // Parse JSON strings in the response
        const parsed: ParsedServiceTypeLoadItem[] = response.map((item) => ({
          ...item,
          weekly: JSON.parse(item.weekly || "{}"),
          monthly: JSON.parse(item.monthly || "{}"),
          quarterly: JSON.parse(item.quarterly || "{}"),
        }));

        setData(parsed);

        // Group by service_type
        const grouped = parsed.reduce((acc, item) => {
          const existing = acc.find((g) => g.serviceType === item.service_type);
          if (existing) {
            existing.items.push(item);
          } else {
            acc.push({
              serviceType: item.service_type,
              serviceTotal: item.service_total,
              items: [item],
            });
          }
          return acc;
        }, [] as ServiceTypeGroup[]);

        setGroupedData(grouped);
      } catch (err) {
        console.error("[useServiceTypeLoad] Error fetching data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch service type load data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [facilitiesId]);

  // Get date columns based on granularity
  const getDateColumns = (): string[] => {
    if (data.length === 0) return [];

    const allDates = new Set<string>();
    const propertyKey = granularityToProperty(granularity);
    data.forEach((item) => {
      const timeData = item[propertyKey];
      Object.keys(timeData).forEach((date) => allDates.add(date));
    });

    return Array.from(allDates).sort((a, b) => {
      // Sort dates appropriately based on format
      if (granularity === "week") {
        // Format: "MM/DD" - need to handle year transitions
        const [monthA, dayA] = a.split("/").map(Number);
        const [monthB, dayB] = b.split("/").map(Number);
        
        // Handle year wrap-around (e.g., 12/28 comes before 1/4)
        // For simplicity, assume dates are within a reasonable range
        // If monthA > monthB by more than 6, assume A is from previous year
        let monthDiff = monthA - monthB;
        if (monthDiff > 6) monthDiff -= 12;
        if (monthDiff < -6) monthDiff += 12;
        
        if (monthDiff !== 0) return monthDiff;
        return dayA - dayB;
      } else if (granularity === "month") {
        // Format: "YYYY-MM"
        return a.localeCompare(b);
      } else {
        // Format: "YYYY-QN"
        return a.localeCompare(b);
      }
    });
  };

  const dateColumns = getDateColumns();

  return {
    data,
    groupedData,
    dateColumns,
    isLoading,
    error,
  };
}

