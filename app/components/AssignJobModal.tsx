"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  getJobsV2,
  updateJob,
  updateMachine,
  type JobV2,
  type Job,
} from "@/lib/api";
import type { Machine } from "@/types";
import {
  X,
  Search,
  Loader2,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  Calendar,
  Briefcase,
  Users,
  MapPin,
  Clock,
  Package,
} from "lucide-react";
import { format } from "date-fns";
import ProcessTypeBadge from "./ProcessTypeBadge";
import { getFacilityName } from "@/lib/facilityUtils";

interface AssignJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
  onSuccess: () => void;
}

export default function AssignJobModal({
  isOpen,
  onClose,
  machine,
  onSuccess,
}: AssignJobModalProps) {
  const [jobs, setJobs] = useState<JobV2[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [assigningJobId, setAssigningJobId] = useState<number | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<number | null>(null);

  // Debounce search query (500ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch jobs when modal opens or search changes
  useEffect(() => {
    if (!isOpen || !machine) {
      return;
    }

    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await getJobsV2({
          facilities_id: machine.facilities_id || 0,
          per_page: 1000,
          search: debouncedSearchQuery || "",
        });

        // Filter jobs by matching service_type to machine's process_type_key
        const processTypeKey = machine.process_type_key?.toLowerCase() || "";
        const filteredJobs = response.items.filter((job) => {
          const jobServiceType = job.service_type?.toLowerCase() || "";
          // Match if service_type contains or equals the process_type_key
          return (
            jobServiceType.includes(processTypeKey) ||
            processTypeKey.includes(jobServiceType) ||
            normalizeProcessType(jobServiceType) === normalizeProcessType(processTypeKey)
          );
        });

        setJobs(filteredJobs);
      } catch (err) {
        console.error("[AssignJobModal] Error fetching jobs:", err);
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [isOpen, machine, debouncedSearchQuery]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setJobs([]);
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setExpandedJobs(new Set());
      setAssigningJobId(null);
      setAssignSuccess(null);
      setError(null);
    }
  }, [isOpen]);

  // Normalize process type for comparison
  const normalizeProcessType = (type: string): string => {
    const normalized = type.toLowerCase().trim();
    // Handle common variations
    if (normalized.includes("insert")) return "insert";
    if (normalized.includes("fold")) return "fold";
    if (normalized.includes("inkjet") || normalized.includes("ink jet")) return "inkjet";
    if (normalized.includes("affix") || normalized.includes("label")) return "affix";
    if (normalized.includes("hp") || normalized.includes("press")) return "hp";
    if (normalized.includes("laser")) return "laser";
    return normalized;
  };

  // Toggle job expansion
  const toggleJobExpanded = (jobId: number) => {
    setExpandedJobs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  // Check if machine is already assigned to job
  const isMachineAssigned = (job: JobV2): boolean => {
    if (!machine) return false;
    const machinesId = job.machines_id;
    if (Array.isArray(machinesId)) {
      return machinesId.includes(machine.id);
    }
    return false;
  };

  // Handle job assignment
  const handleAssignJob = async (job: JobV2) => {
    if (!machine || assigningJobId !== null) return;

    setAssigningJobId(job.id);
    setError(null);

    try {
      // Get current machines_id array
      const currentMachinesId = Array.isArray(job.machines_id) ? job.machines_id : [];

      // Add machine to the array if not already present
      if (!currentMachinesId.includes(machine.id)) {
        const updatedMachinesId = [...currentMachinesId, machine.id];

        // Update the job with new machines_id
        await updateJob(job.id, {
          machines_id: JSON.stringify(updatedMachinesId),
        } as Partial<Job>);

        // Check if job is active today - update machine status to "running"
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        const jobStartDate = job.start_date;
        const jobDueDate = job.due_date;

        if (jobStartDate && jobDueDate &&
            jobStartDate <= todayTimestamp &&
            todayTimestamp <= jobDueDate) {
          await updateMachine(machine.id, { status: "running" });
        }

        // Update local state
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, machines_id: updatedMachinesId }
              : j
          )
        );

        setAssignSuccess(job.id);

        // Clear success message and close after delay
        setTimeout(() => {
          setAssignSuccess(null);
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("[AssignJobModal] Error assigning job:", err);
      setError(err instanceof Error ? err.message : "Failed to assign job");
    } finally {
      setAssigningJobId(null);
    }
  };

  // Format date for display
  const formatDate = (timestamp: number | undefined | null): string => {
    if (!timestamp) return "N/A";
    try {
      return format(new Date(timestamp), "MM/dd/yyyy");
    } catch {
      return "N/A";
    }
  };

  // Format quantity for display
  const formatQuantity = (quantity: number | undefined): string => {
    if (!quantity) return "0";
    if (quantity >= 1000000) {
      return `${(quantity / 1000000).toFixed(1)}M`;
    }
    if (quantity >= 1000) {
      return `${(quantity / 1000).toFixed(0)}K`;
    }
    return quantity.toLocaleString();
  };

  // Parse job requirements
  const getJobRequirements = (job: JobV2): Array<{ process_type: string; [key: string]: any }> => {
    try {
      if (typeof job.requirements === "string") {
        return JSON.parse(job.requirements);
      }
      if (Array.isArray(job.requirements)) {
        return job.requirements;
      }
      return [];
    } catch {
      return [];
    }
  };

  // Get assigned machine lines
  const getAssignedMachineLines = (job: JobV2): string => {
    const machinesId = job.machines_id;
    if (!Array.isArray(machinesId) || machinesId.length === 0) {
      return "None";
    }
    return machinesId.map((id) => `#${id}`).join(", ");
  };

  if (!isOpen || !machine) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Briefcase className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Assign Job to: {machine.name || `Line ${machine.line}`}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <ProcessTypeBadge processType={machine.process_type_key || machine.type || "unknown"} />
                <span className="text-sm text-gray-500">|</span>
                <span className="text-sm text-gray-500">
                  {getFacilityName(machine.facilities_id)}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs by number, name, or client..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
            />
          </div>
          <div className="flex justify-end mt-2">
            <span className="text-sm text-gray-500">
              {jobs.length} compatible job{jobs.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mx-4 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Success Message */}
        {assignSuccess && (
          <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Job successfully assigned!
          </div>
        )}

        {/* Job List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
              <span className="ml-3 text-gray-500">Loading jobs...</span>
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No compatible jobs found</p>
              <p className="text-sm mt-1">
                {debouncedSearchQuery
                  ? "Try a different search term"
                  : `No jobs matching process type "${machine.process_type_key || machine.type}"`}
              </p>
            </div>
          ) : (
            jobs.map((job) => {
              const isExpanded = expandedJobs.has(job.id);
              const isAssigned = isMachineAssigned(job);
              const isAssigning = assigningJobId === job.id;
              const justAssigned = assignSuccess === job.id;

              return (
                <div
                  key={job.id}
                  className={`border rounded-lg transition-all duration-200 ${
                    isExpanded
                      ? "bg-blue-50 border-blue-200"
                      : isAssigned || justAssigned
                      ? "bg-green-50 border-green-200"
                      : "bg-white border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Collapsed Row */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer"
                    onClick={() => toggleJobExpanded(job.id)}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Expand Toggle */}
                      <button className="flex-shrink-0">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                      </button>

                      {/* Job Info */}
                      <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
                        <div className="truncate">
                          <span className="font-semibold text-gray-900">
                            {job.job_number || `#${job.id}`}
                          </span>
                        </div>
                        <div className="truncate text-gray-600">
                          {job.client || "No client"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {formatDate(job.start_date)} - {formatDate(job.due_date)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatQuantity(job.quantity)} pcs
                        </div>
                      </div>
                    </div>

                    {/* Assign Button */}
                    <div className="flex-shrink-0 ml-4">
                      {isAssigned || justAssigned ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                          <CheckCircle2 className="w-4 h-4" />
                          Assigned
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAssignJob(job);
                          }}
                          disabled={isAssigning}
                          className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isAssigning ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Assigning...
                            </>
                          ) : (
                            "Assign"
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-gray-200 mt-0">
                      <div className="bg-white rounded-lg p-4 mt-4 space-y-4">
                        {/* Job Information Grid */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                            Job Information
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Job #</div>
                              <div className="text-sm font-medium text-gray-900">
                                {job.job_number || `#${job.id}`}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Client</div>
                              <div className="text-sm font-medium text-gray-900 truncate">
                                {job.client || "N/A"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Facility</div>
                              <div className="text-sm font-medium text-gray-900">
                                {job.facility || getFacilityName(job.facilities_id)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-gray-500 mb-1">CSR</div>
                              <div className="text-sm font-medium text-gray-900">
                                {job.csr || "N/A"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Job Description */}
                        {job.description && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
                              Description
                            </h4>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                              {job.description}
                            </p>
                          </div>
                        )}

                        {/* Timeline */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Timeline
                          </h4>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Start:</span>
                              <span className="font-medium">{formatDate(job.start_date)}</span>
                            </div>
                            <span className="text-gray-300">→</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Due:</span>
                              <span className="font-medium">{formatDate(job.due_date)}</span>
                            </div>
                            <span className="text-gray-300">|</span>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-500">Quantity:</span>
                              <span className="font-medium">{job.quantity?.toLocaleString() || 0} pcs</span>
                            </div>
                          </div>
                        </div>

                        {/* Services */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Services
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {getJobRequirements(job).length > 0 ? (
                              getJobRequirements(job).map((req, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-sm"
                                >
                                  {req.process_type || "Unknown"}
                                  {req.paper_size && ` (${req.paper_size})`}
                                  {req.pockets && `, ${req.pockets} pockets`}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-gray-400 italic">
                                No services defined
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Assigned Machines */}
                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Assigned Machines
                          </h4>
                          <div className="text-sm text-gray-600">
                            {getAssignedMachineLines(job)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
