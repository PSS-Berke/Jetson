"use client";

import { useState, useEffect } from "react";
import type { Machine } from "@/types";
import { getMachines, getJobs } from "@/lib/api";

interface DayCapacity {
  date: string; // YYYY-MM-DD
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
  jobCount: number;
  jobIds: number[];
}

interface MachineCapacityData {
  machine: Machine;
  dailyCapacity: DayCapacity[];
}

interface CapacityHeatmapProps {
  startDate?: Date;
  endDate?: Date;
  facilityId?: number | null;
  processType?: string | null;
}

export default function CapacityHeatmap({
  startDate = new Date(),
  endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  facilityId = null,
  processType = null,
}: CapacityHeatmapProps) {
  const [machineCapacityData, setMachineCapacityData] = useState<MachineCapacityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{
    machineId: number;
    date: string;
  } | null>(null);

  useEffect(() => {
    loadCapacityData();
  }, [startDate, endDate, facilityId, processType]);

  const loadCapacityData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load machines and jobs
      const allMachines = await getMachines();
      const allJobs = await getJobs();

      // Filter machines
      const filteredMachines = allMachines.filter((machine) => {
        const matchesFacility = !facilityId || machine.facilities_id === facilityId;
        const matchesProcessType = !processType || machine.process_type_key === processType;
        return matchesFacility && matchesProcessType;
      });

      // Generate date range
      const dates: string[] = [];
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        dates.push(currentDate.toISOString().split("T")[0]);
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Calculate capacity for each machine and date
      const capacityData: MachineCapacityData[] = filteredMachines.map((machine) => {
        const dailyCapacity: DayCapacity[] = dates.map((date) => {
          // Default capacity: 16 hours/day (2 shifts × 8 hours)
          const availableHours = 16;
          let allocatedHours = 0;
          const assignedJobIds: number[] = [];

          // Find jobs assigned to this machine on this date
          const dateTimestamp = new Date(date).getTime();

          allJobs.forEach((job: any) => {
            // Parse machines_id (could be array or JSON string)
            let machineIds: number[] = [];
            if (Array.isArray(job.machines_id)) {
              machineIds = job.machines_id;
            } else if (typeof job.machines_id === "string") {
              try {
                machineIds = JSON.parse(job.machines_id);
              } catch {
                machineIds = [];
              }
            }

            // Check if this job is assigned to this machine
            if (!machineIds.includes(machine.id)) {
              return;
            }

            // Check if job overlaps with this date
            const jobStart = job.start_date;
            const jobEnd = job.due_date;

            if (dateTimestamp >= jobStart && dateTimestamp <= jobEnd) {
              // Estimate hours for this day (simplified: total hours / total days)
              const totalDays = Math.max(
                1,
                Math.ceil((jobEnd - jobStart) / (24 * 60 * 60 * 1000))
              );
              const estimatedSpeed = machine.speed_hr || 1000;
              const totalHours = (job.quantity || 0) / estimatedSpeed;
              const hoursPerDay = totalHours / totalDays;

              allocatedHours += hoursPerDay;
              assignedJobIds.push(job.id);
            }
          });

          const utilizationPercent = Math.min(
            100,
            Math.round((allocatedHours / availableHours) * 100)
          );

          return {
            date,
            allocatedHours,
            availableHours,
            utilizationPercent,
            jobCount: assignedJobIds.length,
            jobIds: assignedJobIds,
          };
        });

        return {
          machine,
          dailyCapacity,
        };
      });

      setMachineCapacityData(capacityData);
    } catch (err) {
      console.error("[CapacityHeatmap] Error loading capacity data:", err);
      setError(err instanceof Error ? err.message : "Failed to load capacity data");
    } finally {
      setLoading(false);
    }
  };

  const getColorForUtilization = (percent: number): string => {
    if (percent === 0) return "bg-gray-100";
    if (percent < 50) return "bg-green-200";
    if (percent < 70) return "bg-green-400";
    if (percent < 85) return "bg-yellow-300";
    if (percent < 95) return "bg-orange-400";
    return "bg-red-500";
  };

  const getTextColorForUtilization = (percent: number): string => {
    if (percent >= 85) return "text-white";
    return "text-gray-800";
  };

  // Generate week boundaries for better visual grouping
  const getWeekBoundaries = (dates: string[]): number[] => {
    const boundaries: number[] = [];
    dates.forEach((date, index) => {
      const dayOfWeek = new Date(date).getDay();
      if (dayOfWeek === 1 && index > 0) {
        // Monday (start of week)
        boundaries.push(index);
      }
    });
    return boundaries;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary-blue)]"></div>
          <p className="mt-4 text-gray-600">Loading capacity data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-bold text-red-800 mb-2">Error</h3>
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  if (machineCapacityData.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <p className="text-yellow-800">
          No machines found matching the selected filters.
        </p>
      </div>
    );
  }

  const dates = machineCapacityData[0]?.dailyCapacity.map((d) => d.date) || [];
  const weekBoundaries = getWeekBoundaries(dates);

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--dark-blue)]">
              Machine Capacity Heatmap
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-200 border border-gray-300"></div>
              <span>&lt;50%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-300 border border-gray-300"></div>
              <span>70-85%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-400 border border-gray-300"></div>
              <span>85-95%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 border border-gray-300"></div>
              <span>&gt;95%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Date headers */}
          <div className="flex sticky top-0 bg-gray-50 z-10">
            <div className="w-32 flex-shrink-0 px-4 py-2 font-semibold text-xs text-gray-700 border-r border-b border-gray-200">
              Machine
            </div>
            {dates.map((date, index) => {
              const dayOfWeek = new Date(date).toLocaleDateString("en-US", {
                weekday: "short",
              });
              const dayOfMonth = new Date(date).getDate();
              const isWeekStart = weekBoundaries.includes(index);

              return (
                <div
                  key={date}
                  className={`w-12 flex-shrink-0 px-1 py-2 text-center border-b border-gray-200 ${
                    isWeekStart ? "border-l-2 border-l-gray-400" : ""
                  }`}
                >
                  <div className="text-xs font-semibold text-gray-700">
                    {dayOfWeek}
                  </div>
                  <div className="text-xs text-gray-500">{dayOfMonth}</div>
                </div>
              );
            })}
          </div>

          {/* Machine rows */}
          {machineCapacityData.map((data) => (
            <div key={data.machine.id} className="flex hover:bg-gray-50">
              <div className="w-32 flex-shrink-0 px-4 py-3 border-r border-b border-gray-200">
                <div className="text-sm font-bold text-gray-900">
                  Line {data.machine.line}
                </div>
                <div className="text-xs text-gray-500">
                  {data.machine.type}
                </div>
              </div>
              {data.dailyCapacity.map((dayData, index) => {
                const isWeekStart = weekBoundaries.includes(index);
                const isSelected =
                  selectedCell?.machineId === data.machine.id &&
                  selectedCell?.date === dayData.date;

                return (
                  <div
                    key={dayData.date}
                    className={`w-12 flex-shrink-0 border-b border-gray-200 ${
                      isWeekStart ? "border-l-2 border-l-gray-400" : ""
                    } ${isSelected ? "ring-2 ring-[var(--primary-blue)]" : ""}`}
                  >
                    <button
                      onClick={() =>
                        setSelectedCell({
                          machineId: data.machine.id,
                          date: dayData.date,
                        })
                      }
                      className={`w-full h-full p-1 ${getColorForUtilization(
                        dayData.utilizationPercent
                      )} ${getTextColorForUtilization(
                        dayData.utilizationPercent
                      )} hover:opacity-80 transition-opacity`}
                      title={`${dayData.utilizationPercent}% utilized (${dayData.jobCount} jobs)`}
                    >
                      <div className="text-xs font-bold">
                        {dayData.utilizationPercent}%
                      </div>
                      {dayData.jobCount > 0 && (
                        <div className="text-xs opacity-75">
                          {dayData.jobCount}j
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Cell Details */}
      {selectedCell && (
        <div className="border-t border-gray-200 bg-blue-50 p-4">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">
                {
                  machineCapacityData.find(
                    (d) => d.machine.id === selectedCell.machineId
                  )?.machine.line
                }{" "}
                - {new Date(selectedCell.date).toLocaleDateString()}
              </h4>
              {(() => {
                const data = machineCapacityData
                  .find((d) => d.machine.id === selectedCell.machineId)
                  ?.dailyCapacity.find((d) => d.date === selectedCell.date);
                return data ? (
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-gray-600">Utilization:</span>{" "}
                      <span className="font-semibold">
                        {data.utilizationPercent}%
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Allocated:</span>{" "}
                      <span className="font-semibold">
                        {data.allocatedHours.toFixed(1)} hours
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Available:</span>{" "}
                      <span className="font-semibold">
                        {data.availableHours} hours
                      </span>
                    </p>
                    <p>
                      <span className="text-gray-600">Jobs:</span>{" "}
                      <span className="font-semibold">{data.jobCount}</span>
                    </p>
                  </div>
                ) : null;
              })()}
            </div>
            <button
              onClick={() => setSelectedCell(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
