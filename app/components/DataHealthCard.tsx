"use client";

import { useEffect, useState } from "react";
import { getDataHealth, type DataHealth } from "@/lib/api";
import { AlertCircle, CheckCircle2, XCircle, Calendar, CalendarX } from "lucide-react";

interface DataHealthCardProps {
  facilitiesId: number | null;
}

export default function DataHealthCard({ facilitiesId }: DataHealthCardProps) {
  const [dataHealth, setDataHealth] = useState<DataHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDataHealth = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const health = await getDataHealth(facilitiesId || 0);
        setDataHealth(health);
      } catch (err) {
        console.error("[DataHealthCard] Error fetching data health:", err);
        setError(err instanceof Error ? err.message : "Failed to load data health");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDataHealth();
  }, [facilitiesId]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4 mb-6 no-print">
        <div className="text-sm text-[var(--text-light)]">Loading data health...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 no-print">
        <div className="text-sm text-red-800">Error loading data health: {error}</div>
      </div>
    );
  }

  if (!dataHealth) {
    return null;
  }

  const healthyPercentage = parseFloat(dataHealth.healthy_percentage);
  const isHealthy = healthyPercentage >= 80;
  const isWarning = healthyPercentage >= 60 && healthyPercentage < 80;
  const isCritical = healthyPercentage < 60;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 mb-6 no-print">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--dark-blue)]">Data Health</h3>
        <div className="flex items-center gap-2">
          {isHealthy && (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{dataHealth.healthy_percentage}%</span>
            </div>
          )}
          {isWarning && (
            <div className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="w-5 h-5" />
              <span className="font-medium">{dataHealth.healthy_percentage}%</span>
            </div>
          )}
          {isCritical && (
            <div className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">{dataHealth.healthy_percentage}%</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarX className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Missing Due Dates</span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-dark)]">
            {dataHealth.missing_due_dates}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Missing Start Dates</span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-dark)]">
            {dataHealth.missing_start_date}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Start After Due</span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-dark)]">
            {dataHealth.start_is_after_due}
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-700">Total Records</span>
          </div>
          <div className="text-2xl font-bold text-[var(--text-dark)]">
            {dataHealth.total_records}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {dataHealth.total_issues} total issues
          </div>
        </div>
      </div>
    </div>
  );
}

