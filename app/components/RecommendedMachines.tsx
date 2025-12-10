"use client";

import { useState, useEffect } from "react";
import type { Machine } from "@/types";
import type { MachineMatch } from "@/lib/machineMatching";
import { findMatchingMachines } from "@/lib/machineMatching";
import { getMachines, getJobs } from "@/lib/api";

interface RecommendedMachinesProps {
  processType: string;
  jobRequirements: Record<string, any>;
  quantity: number;
  startDate: string; // ISO format
  dueDate: string; // ISO format
  facilityId?: number | null;
  selectedMachineIds: number[];
  onSelectMachine: (machineId: number) => void;
  onDeselectMachine: (machineId: number) => void;
}

export default function RecommendedMachines({
  processType,
  jobRequirements,
  quantity,
  startDate,
  dueDate,
  facilityId,
  selectedMachineIds,
  onSelectMachine,
  onDeselectMachine,
}: RecommendedMachinesProps) {
  const [matches, setMatches] = useState<MachineMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAllMachines, setShowAllMachines] = useState(false);

  useEffect(() => {
    if (!processType || !startDate || !dueDate || quantity <= 0) {
      setMatches([]);
      return;
    }
    const typeMap = {
      "inserter": ["Insert", "Sort", "Data", "9-12 in+", "13+ in+"],
      "folders": ["Fold"],
      "hp_press": ["HP"],
      "inkjetters": ["Laser", "Ink jet"],
      "affixers": ["Label/Apply", "Affix with Glue", "Affix label+", "Labeling"]
    }
    const machineType = Object.keys(typeMap).find(key => 
      typeMap[key as keyof typeof typeMap].includes(processType)
      || "test"
    )
    const loadMatches = async () => {
      setLoading(true);
      setError(null);

      try {

        // Fetch all machines - wrap in try-catch to handle API errors
        let allMachines: Machine[] = [];
        try {
          allMachines = await getMachines(undefined, undefined, machineType);

          // Filter out machines with invalid process_type_key
          allMachines = allMachines.filter(m => {
            if (!m.process_type_key || m.process_type_key.trim() === '') {
              console.warn(`[RecommendedMachines] Skipping machine ${m.id} (Line ${m.line}) - no process_type_key`);
              return false;
            }
            return true;
          });
          console.log(`[RecommendedMachines] ${allMachines.length} machines have valid process_type_key`);
        } catch (apiError) {
          console.error("[RecommendedMachines] Error fetching machines:", apiError);
          throw new Error("Unable to load machines. Please check your machine configuration.");
        }

        // Fetch existing jobs for availability calculation
        let existingJobs: any[] = [];
        try {
          existingJobs = await getJobs();
          console.log(`[RecommendedMachines] Loaded ${existingJobs.length} jobs`);
        } catch (jobError) {
          console.warn("[RecommendedMachines] Error fetching jobs, continuing without availability data:", jobError);
          // Continue without jobs - availability will be estimated
        }

        // Convert dates to timestamps
        const startTimestamp = new Date(startDate).getTime();
        const dueTimestamp = new Date(dueDate).getTime();

        // Find matching machines
        const matchResults = await findMatchingMachines(
          {
            processType,
            jobRequirements,
            quantity,
            startDate: startTimestamp,
            dueDate: dueTimestamp,
            facilityId: facilityId || undefined,
          },
          allMachines,
          existingJobs.map((job: any) => ({
            machines_id: Array.isArray(job.machines_id)
              ? job.machines_id
              : typeof job.machines_id === "string"
              ? JSON.parse(job.machines_id)
              : [],
            start_date: job.start_date,
            due_date: job.due_date,
            quantity: job.quantity,
          }))
        );

        setMatches(matchResults);
      } catch (err) {
        console.error("[RecommendedMachines] Error loading matches:", err);
        setError(err instanceof Error ? err.message : "Failed to load recommendations");
        setMatches([]);
      } finally {
        setLoading(false);
      }
    };

    loadMatches();
  }, [processType, jobRequirements, quantity, startDate, dueDate, facilityId]);

  // Show loading state
  if (loading) {
    return (
      <div className="mt-6 p-4 border border-[var(--border)] rounded-lg bg-gray-50">
        <h4 className="font-semibold text-[var(--text-dark)] mb-4">
          Recommended Machines
        </h4>
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-blue)]"></div>
          <p className="mt-2 text-sm text-[var(--text-light)]">
            Finding best machines for this job...
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="mt-6 p-4 border border-red-300 rounded-lg bg-red-50">
        <h4 className="font-semibold text-red-800 mb-2">
          Unable to Load Recommendations
        </h4>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  // Don't show anything if no requirements are filled
  if (!processType || Object.keys(jobRequirements).length === 0) {
    return null;
  }

  // Separate machines that can handle vs can't handle
  const canHandleMachines = matches.filter((m) => m.canHandle);
  const cannotHandleMachines = matches.filter((m) => !m.canHandle);

  // Limit display to top 5 by default
  const displayMatches = showAllMachines
    ? canHandleMachines
    : canHandleMachines.slice(0, 5);

  return (
    <div className="mt-6 p-4 border border-[var(--border)] rounded-lg bg-gradient-to-br from-blue-50 to-white">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-[var(--text-dark)] flex items-center gap-2">
            <svg
              className="w-5 h-5 text-[var(--primary-blue)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Recommended Machines
          </h4>
          <p className="text-xs text-[var(--text-light)] mt-1">
            Based on job requirements and current capacity
          </p>
        </div>
        {canHandleMachines.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllMachines(!showAllMachines)}
            className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
          >
            {showAllMachines
              ? "Show Top 5"
              : `Show All (${canHandleMachines.length})`}
          </button>
        )}
      </div>

      {canHandleMachines.length === 0 ? (
        <div className="text-center py-6 px-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <svg
            className="w-12 h-12 text-yellow-500 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="font-medium text-yellow-800 mb-1">
            No machines can handle this job
          </p>
          <p className="text-sm text-yellow-700">
            The requirements don't match any available machine capabilities.
            {cannotHandleMachines.length > 0 && (
              <span className="block mt-2">
                Check below to see why machines don't match.
              </span>
            )}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayMatches.map((match, index) => {
            const isSelected = selectedMachineIds.includes(match.machine.id);
            const isTopRecommendation = index === 0;

            return (
              <div
                key={match.machine.id}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  isSelected
                    ? "border-[var(--primary-blue)] bg-blue-50"
                    : "border-gray-200 bg-white hover:border-[var(--primary-blue)]/50"
                } ${isTopRecommendation ? "ring-2 ring-green-200" : ""}`}
              >
                {isTopRecommendation && (
                  <div className="absolute -top-2 left-4 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                    BEST MATCH
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="font-bold text-lg text-[var(--text-dark)]">
                        Line {match.machine.line}
                      </h5>
                      {match.machine.name && (
                        <span className="text-sm text-[var(--text-light)]">
                          {match.machine.name}
                        </span>
                      )}
                      <span className="px-2 py-1 bg-gray-100 text-xs font-semibold rounded">
                        {match.machine.type}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded ${
                          match.matchScore >= 80
                            ? "bg-green-100 text-green-800"
                            : match.matchScore >= 60
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {match.matchScore}% Match
                      </span>
                    </div>

                    {/* Match Reasons */}
                    <div className="text-sm space-y-1 mb-3">
                      {match.matchReasons.slice(0, 4).map((reason, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 ${
                            reason.startsWith("✅")
                              ? "text-green-700"
                              : reason.startsWith("📊")
                              ? "text-blue-700"
                              : "text-gray-700"
                          }`}
                        >
                          <span className="font-mono text-xs">{reason}</span>
                        </div>
                      ))}
                    </div>

                    {/* Capacity Bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-[var(--text-light)]">
                          Current Utilization
                        </span>
                        <span
                          className={`font-bold ${
                            match.currentUtilization >= 90
                              ? "text-red-600"
                              : match.currentUtilization >= 70
                              ? "text-yellow-600"
                              : "text-green-600"
                          }`}
                        >
                          {match.currentUtilization}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            match.currentUtilization >= 90
                              ? "bg-red-500"
                              : match.currentUtilization >= 70
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${match.currentUtilization}%` }}
                        />
                      </div>
                    </div>

                    {/* Facility */}
                    {match.machine.facilities_id && (
                      <div className="text-xs text-[var(--text-light)] mt-2">
                        📍{" "}
                        {match.machine.facilities_id === 1
                          ? "Bolingbrook"
                          : "Lemont"}
                      </div>
                    )}
                  </div>

                  {/* Select/Deselect Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onDeselectMachine(match.machine.id);
                      } else {
                        onSelectMachine(match.machine.id);
                      }
                    }}
                    className={`ml-4 px-4 py-2 rounded-lg font-semibold transition-colors ${
                      isSelected
                        ? "bg-[var(--primary-blue)] text-white hover:bg-[var(--primary-blue)]/90"
                        : "bg-gray-100 text-[var(--text-dark)] hover:bg-gray-200"
                    }`}
                  >
                    {isSelected ? "✓ Selected" : "Select"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show incompatible machines if there are any */}
      {cannotHandleMachines.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-[var(--text-light)] hover:text-[var(--text-dark)] font-medium">
            Why can't other machines handle this job? ({cannotHandleMachines.length}{" "}
            incompatible)
          </summary>
          <div className="mt-3 space-y-2">
            {cannotHandleMachines.slice(0, 3).map((match) => (
              <div
                key={match.machine.id}
                className="p-3 bg-gray-50 border border-gray-200 rounded text-xs"
              >
                <div className="font-semibold text-gray-800 mb-1">
                  Line {match.machine.line} - {match.machine.type}
                </div>
                {match.matchReasons
                  .filter((r) => r.startsWith("✗"))
                  .map((reason, idx) => (
                    <div key={idx} className="text-red-600">
                      {reason}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
