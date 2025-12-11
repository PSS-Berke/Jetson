"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getDataHealth, type DataHealth, type DataHealthIssueType } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  CalendarX,
  Activity,
  DollarSign,
} from "lucide-react";
import DataHealthBulkFixModal from "./DataHealthBulkFixModal";

interface DataHealthPopupProps {
  facilitiesId: number | null;
}

export default function DataHealthPopup({
  facilitiesId,
}: DataHealthPopupProps) {
  const [dataHealth, setDataHealth] = useState<DataHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [bulkFixModalOpen, setBulkFixModalOpen] = useState(false);
  const [selectedIssueType, setSelectedIssueType] = useState<DataHealthIssueType | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Fetch data health function
  const fetchDataHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const health = await getDataHealth(facilitiesId || 0);
      setDataHealth(health);
    } catch (err) {
      console.error("[DataHealthPopup] Error fetching data health:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load data health"
      );
    } finally {
      setIsLoading(false);
    }
  }, [facilitiesId]);

  // Fetch data when popup opens
  useEffect(() => {
    if (!isOpen) return;
    fetchDataHealth();
  }, [isOpen, fetchDataHealth]);

  // Handle tile click
  const handleTileClick = (issueType: DataHealthIssueType, count: number) => {
    if (count === 0) return;
    setSelectedIssueType(issueType);
    setBulkFixModalOpen(true);
    setIsOpen(false); // Close the popup when opening the modal
  };

  // Handle modal success - refresh data health stats
  const handleModalSuccess = () => {
    fetchDataHealth();
  };

  const healthyPercentage = dataHealth
    ? parseFloat(dataHealth.healthy_percentage)
    : 0;
  const isHealthy = healthyPercentage >= 80;
  const isWarning = healthyPercentage >= 60 && healthyPercentage < 80;
  const isCritical = healthyPercentage < 60;

  // Determine button color based on health status (only when we have data)
  const getButtonClasses = () => {
    if (!dataHealth) {
      return "bg-gray-200 text-gray-700 hover:bg-gray-300";
    }
    if (isHealthy) {
      return "bg-green-600 text-white hover:bg-green-700";
    }
    if (isWarning) {
      return "bg-yellow-500 text-white hover:bg-yellow-600";
    }
    return "bg-red-600 text-white hover:bg-red-700";
  };

  return (
    <>
      <div className="relative" ref={popupRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`px-6 py-2 rounded-lg font-medium text-sm whitespace-nowrap flex items-center gap-2 transition-colors ${getButtonClasses()}`}
        >
          <Activity className="w-4 h-4" />
          Data Health
          {dataHealth && (
            <span className="text-xs opacity-90">
              ({dataHealth.healthy_percentage}%)
            </span>
          )}
        </button>

        {isOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-80 bg-white rounded-lg shadow-lg border border-[var(--border)] z-50">
            {/* Arrow pointing down */}
            <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-r border-b border-[var(--border)] transform rotate-45"></div>

            <div className="p-4">
              {isLoading ? (
                <div className="text-sm text-[var(--text-light)] text-center py-4">
                  Loading data health...
                </div>
              ) : error ? (
                <div className="text-sm text-red-600 text-center py-4">
                  Error: {error}
                </div>
              ) : dataHealth ? (
                <>
                  {/* Header with health percentage */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border)]">
                    <h3 className="text-base font-semibold text-[var(--dark-blue)]">
                      Data Health
                    </h3>
                    <div className="flex items-center gap-2">
                      {isHealthy && (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <CheckCircle2 className="w-5 h-5" />
                          <span className="font-semibold">
                            {dataHealth.healthy_percentage}%
                          </span>
                        </div>
                      )}
                      {isWarning && (
                        <div className="flex items-center gap-1.5 text-yellow-600">
                          <AlertCircle className="w-5 h-5" />
                          <span className="font-semibold">
                            {dataHealth.healthy_percentage}%
                          </span>
                        </div>
                      )}
                      {isCritical && (
                        <div className="flex items-center gap-1.5 text-red-600">
                          <XCircle className="w-5 h-5" />
                          <span className="font-semibold">
                            {dataHealth.healthy_percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Click hint */}
                  <p className="text-xs text-gray-500 mb-3">
                    Click on a tile to fix issues
                  </p>

                  {/* Metrics grid */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Missing Due Dates */}
                    <button
                      onClick={() => handleTileClick("missing_due_dates", dataHealth.missing_due_dates)}
                      disabled={dataHealth.missing_due_dates === 0}
                      className={`bg-gray-50 rounded-lg p-3 text-left transition-all ${
                        dataHealth.missing_due_dates > 0
                          ? "hover:bg-gray-100 hover:shadow-md cursor-pointer"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <CalendarX className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">
                          Missing Due Dates
                        </span>
                      </div>
                      <div className="text-xl font-bold text-[var(--text-dark)]">
                        {dataHealth.missing_due_dates}
                      </div>
                    </button>

                    {/* Missing Start Dates */}
                    <button
                      onClick={() => handleTileClick("missing_start_date", dataHealth.missing_start_date)}
                      disabled={dataHealth.missing_start_date === 0}
                      className={`bg-gray-50 rounded-lg p-3 text-left transition-all ${
                        dataHealth.missing_start_date > 0
                          ? "hover:bg-gray-100 hover:shadow-md cursor-pointer"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <Calendar className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">
                          Missing Start Dates
                        </span>
                      </div>
                      <div className="text-xl font-bold text-[var(--text-dark)]">
                        {dataHealth.missing_start_date}
                      </div>
                    </button>

                    {/* Start After Due */}
                    <button
                      onClick={() => handleTileClick("start_is_after_due", dataHealth.start_is_after_due)}
                      disabled={dataHealth.start_is_after_due === 0}
                      className={`bg-gray-50 rounded-lg p-3 text-left transition-all ${
                        dataHealth.start_is_after_due > 0
                          ? "hover:bg-gray-100 hover:shadow-md cursor-pointer"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                        <span className="text-xs font-medium text-gray-600">
                          Start After Due
                        </span>
                      </div>
                      <div className="text-xl font-bold text-[var(--text-dark)]">
                        {dataHealth.start_is_after_due}
                      </div>
                    </button>

                    {/* Missing Cost Per Thousand */}
                    <button
                      onClick={() => handleTileClick("missing_cost_per_m", dataHealth.missing_price_per_m)}
                      disabled={dataHealth.missing_price_per_m === 0}
                      className={`bg-gray-50 rounded-lg p-3 text-left transition-all ${
                        dataHealth.missing_price_per_m > 0
                          ? "hover:bg-gray-100 hover:shadow-md cursor-pointer"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <DollarSign className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-xs font-medium text-gray-600">
                          Missing Cost/M
                        </span>
                      </div>
                      <div className="text-xl font-bold text-[var(--text-dark)]">
                        {dataHealth.missing_price_per_m}
                      </div>
                    </button>

                    {/* Total Records - not clickable */}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium text-gray-600">
                          Total Records
                        </span>
                      </div>
                      <div className="text-xl font-bold text-[var(--text-dark)]">
                        {dataHealth.total_records}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dataHealth.total_issues} issues
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Bulk Fix Modal */}
      {selectedIssueType && (
        <DataHealthBulkFixModal
          isOpen={bulkFixModalOpen}
          onClose={() => {
            setBulkFixModalOpen(false);
            setSelectedIssueType(null);
          }}
          onSuccess={handleModalSuccess}
          issueType={selectedIssueType}
          facilitiesId={facilitiesId}
        />
      )}
    </>
  );
}
