"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getJobsV2, updateJob, type JobV2 } from "@/lib/api";
import {
  FinancialIssueType,
  calculateFinancialHealthSummary,
  filterJobsByIssueType,
  analyzeJobsFinancialHealth,
  calculateJobMargin,
  getMarginStatusColor,
} from "@/lib/financialHealthUtils";
import { calculateBillingRatePerM, formatCurrency } from "@/lib/jobCostUtils";
import { getJobsInTimeRange } from "@/lib/productionUtils";
import Toast from "../Toast";
import Pagination from "../Pagination";
import type { ParsedJob } from "@/hooks/useJobs";
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Search,
  AlertTriangle,
  DollarSign,
  Clock,
  X,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type TabType = "all" | FinancialIssueType;

type SortField =
  | "job_number"
  | "client_name"
  | "quantity"
  | "billing"
  | "cost"
  | "margin"
  | "hours";

type SortDirection = "asc" | "desc";

interface FinancialDataManagerProps {
  jobs: ParsedJob[];
  startDate: number;
  endDate: number;
  facilitiesId?: number;
  onSuccess?: () => void;
}

interface JobFinancialData {
  job: ParsedJob;
  job_id: number;
  job_number: string;
  job_name: string;
  client_name: string;
  quantity: number;
  billing_rate_per_m: number;
  actual_cost_per_m: number;
  total_billing: number;
  add_on_charges: number;
  margin_percent: number;
  time_estimate: number | null;
  max_hours: number | null;
  // Editable values
  edited_price_per_m: string;
  edited_cost_per_m: string;
  edited_total_billing: string;
  edited_add_on_charges: string;
  edited_max_hours: string;
  // State
  isExpanded: boolean;
  isSelected: boolean;
  hasChanges: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FinancialDataManager({
  jobs,
  startDate,
  endDate,
  facilitiesId,
  onSuccess,
}: FinancialDataManagerProps) {
  // State
  const [jobData, setJobData] = useState<JobFinancialData[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>("job_number");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectAll, setSelectAll] = useState(false);

  // Bulk action state
  const [showBulkBilling, setShowBulkBilling] = useState(false);
  const [showBulkCost, setShowBulkCost] = useState(false);
  const [showBulkHours, setShowBulkHours] = useState(false);
  const [bulkBillingValue, setBulkBillingValue] = useState("");
  const [bulkCostValue, setBulkCostValue] = useState("");
  const [bulkHoursValue, setBulkHoursValue] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load job data
  useEffect(() => {
    if (jobs.length === 0) return;

    const loadJobData = async () => {
      const relevantJobs = getJobsInTimeRange(jobs, startDate, endDate);

      try {
        // Fetch all jobs to get actual_cost_per_m
        const allJobs: JobV2[] = [];
        let currentPageNum = 1;
        let hasMore = true;

        while (hasMore) {
          const response = await getJobsV2({
            facilities_id: facilitiesId || 0,
            page: currentPageNum,
            per_page: 1000,
          });
          allJobs.push(...response.items);
          hasMore = response.nextPage !== null;
          if (response.nextPage) currentPageNum = response.nextPage;
        }

        // Create cost map
        const costsMap = new Map<number, { cost: number; maxHours: number | null }>();
        allJobs.forEach((job) => {
          costsMap.set(job.id, {
            cost: job.actual_cost_per_m ?? 0,
            maxHours: job.max_hours ?? null,
          });
        });

        // Build job data
        const data: JobFinancialData[] = relevantJobs.map((job) => {
          const billingRate = calculateBillingRatePerM(job);
          const costData = costsMap.get(job.id);
          const currentCost = costData?.cost ?? job.actual_cost_per_m ?? 0;
          const maxHours = costData?.maxHours ?? job.max_hours ?? null;
          const clientName = job.client?.name || "Unknown";
          const fullClientName = job.sub_client
            ? `${clientName} / ${job.sub_client}`
            : clientName;

          const marginInfo = calculateJobMargin(job);
          const totalBilling = parseFloat(job.total_billing || "0") || 0;
          const addOnCharges = parseFloat(job.add_on_charges || "0") || 0;

          return {
            job,
            job_id: job.id,
            job_number: job.job_number,
            job_name: job.job_name,
            client_name: fullClientName,
            quantity: job.quantity,
            billing_rate_per_m: billingRate,
            actual_cost_per_m: currentCost,
            total_billing: totalBilling,
            add_on_charges: addOnCharges,
            margin_percent: marginInfo.marginPercent,
            time_estimate: job.time_estimate,
            max_hours: maxHours,
            // Editable values start empty
            edited_price_per_m: "",
            edited_cost_per_m: "",
            edited_total_billing: "",
            edited_add_on_charges: "",
            edited_max_hours: "",
            isExpanded: false,
            isSelected: false,
            hasChanges: false,
          };
        });

        setJobData(data);
        setCurrentPage(1);
      } catch (error) {
        console.error("[FinancialDataManager] Error loading data:", error);
        // Set basic data without API costs
        const data: JobFinancialData[] = relevantJobs.map((job) => {
          const billingRate = calculateBillingRatePerM(job);
          const clientName = job.client?.name || "Unknown";
          const fullClientName = job.sub_client
            ? `${clientName} / ${job.sub_client}`
            : clientName;
          const marginInfo = calculateJobMargin(job);

          return {
            job,
            job_id: job.id,
            job_number: job.job_number,
            job_name: job.job_name,
            client_name: fullClientName,
            quantity: job.quantity,
            billing_rate_per_m: billingRate,
            actual_cost_per_m: 0,
            total_billing: parseFloat(job.total_billing || "0") || 0,
            add_on_charges: parseFloat(job.add_on_charges || "0") || 0,
            margin_percent: marginInfo.marginPercent,
            time_estimate: job.time_estimate,
            max_hours: job.max_hours ?? null,
            edited_price_per_m: "",
            edited_cost_per_m: "",
            edited_total_billing: "",
            edited_add_on_charges: "",
            edited_max_hours: "",
            isExpanded: false,
            isSelected: false,
            hasChanges: false,
          };
        });
        setJobData(data);
        setCurrentPage(1);
      }
    };

    loadJobData();
  }, [jobs, startDate, endDate, facilitiesId, refreshTrigger]);

  // Calculate health summary
  const healthSummary = useMemo(() => {
    const jobList = jobData.map((d) => d.job);
    return calculateFinancialHealthSummary(jobList);
  }, [jobData]);

  // Filter jobs by tab and search
  const filteredJobData = useMemo(() => {
    let filtered = jobData;

    // Filter by tab
    if (activeTab !== "all") {
      const jobList = jobData.map((d) => d.job);
      const filteredJobs = filterJobsByIssueType(jobList, activeTab);
      const filteredIds = new Set(filteredJobs.map((j) => j.id));
      filtered = filtered.filter((d) => filteredIds.has(d.job_id));
    }

    // Filter by search
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.job_number.toLowerCase().includes(query) ||
          d.job_name.toLowerCase().includes(query) ||
          d.client_name.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [jobData, activeTab, debouncedSearch]);

  // Sort jobs
  const sortedJobData = useMemo(() => {
    return [...filteredJobData].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortField) {
        case "job_number":
          aValue = a.job_number;
          bValue = b.job_number;
          break;
        case "client_name":
          aValue = a.client_name.toLowerCase();
          bValue = b.client_name.toLowerCase();
          break;
        case "quantity":
          aValue = a.quantity;
          bValue = b.quantity;
          break;
        case "billing":
          aValue = a.total_billing || a.billing_rate_per_m;
          bValue = b.total_billing || b.billing_rate_per_m;
          break;
        case "cost":
          aValue = a.actual_cost_per_m;
          bValue = b.actual_cost_per_m;
          break;
        case "margin":
          aValue = a.margin_percent;
          bValue = b.margin_percent;
          break;
        case "hours":
          aValue = a.time_estimate ?? 0;
          bValue = b.time_estimate ?? 0;
          break;
        default:
          aValue = a.job_number;
          bValue = b.job_number;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredJobData, sortField, sortDirection]);

  // Paginate
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = sortedJobData.slice(startIndex, endIndex);

  // Selected jobs
  const selectedJobs = useMemo(
    () => jobData.filter((d) => d.isSelected),
    [jobData]
  );

  // Jobs with changes
  const jobsWithChanges = useMemo(
    () => jobData.filter((d) => d.hasChanges),
    [jobData]
  );

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setJobData((prev) =>
      prev.map((d) => {
        const isInFiltered = paginatedData.some((pd) => pd.job_id === d.job_id);
        return isInFiltered ? { ...d, isSelected: newSelectAll } : d;
      })
    );
  };

  const handleSelectJob = (jobId: number) => {
    setJobData((prev) =>
      prev.map((d) =>
        d.job_id === jobId ? { ...d, isSelected: !d.isSelected } : d
      )
    );
  };

  const handleExpandJob = (jobId: number) => {
    setJobData((prev) =>
      prev.map((d) =>
        d.job_id === jobId ? { ...d, isExpanded: !d.isExpanded } : d
      )
    );
  };

  const handleFieldChange = (
    jobId: number,
    field: keyof JobFinancialData,
    value: string
  ) => {
    // Validate numeric input
    const validChars = value.replace(/[^\d.]/g, "");
    const parts = validChars.split(".");
    if (parts.length > 2) return;

    setJobData((prev) =>
      prev.map((d) => {
        if (d.job_id !== jobId) return d;
        const updated = { ...d, [field]: validChars };
        // Check if there are changes
        updated.hasChanges =
          updated.edited_price_per_m !== "" ||
          updated.edited_cost_per_m !== "" ||
          updated.edited_total_billing !== "" ||
          updated.edited_add_on_charges !== "" ||
          updated.edited_max_hours !== "";
        return updated;
      })
    );
  };

  // Bulk actions
  const applyBulkBilling = () => {
    if (!bulkBillingValue) return;
    setJobData((prev) =>
      prev.map((d) => {
        if (!d.isSelected) return d;
        return {
          ...d,
          edited_price_per_m: bulkBillingValue,
          hasChanges: true,
        };
      })
    );
    setBulkBillingValue("");
    setShowBulkBilling(false);
  };

  const applyBulkCost = () => {
    if (!bulkCostValue) return;
    setJobData((prev) =>
      prev.map((d) => {
        if (!d.isSelected) return d;
        return {
          ...d,
          edited_cost_per_m: bulkCostValue,
          hasChanges: true,
        };
      })
    );
    setBulkCostValue("");
    setShowBulkCost(false);
  };

  const applyBulkHours = () => {
    if (!bulkHoursValue) return;
    setJobData((prev) =>
      prev.map((d) => {
        if (!d.isSelected) return d;
        return {
          ...d,
          edited_max_hours: bulkHoursValue,
          hasChanges: true,
        };
      })
    );
    setBulkHoursValue("");
    setShowBulkHours(false);
  };

  // Save changes
  const handleSave = async () => {
    const toSave = jobsWithChanges;
    if (toSave.length === 0) return;

    setSubmitting(true);
    setErrorMessage("");

    try {
      const updates = toSave.map(async (item) => {
        const updateData: Record<string, number | null | undefined> = {};

        if (item.edited_cost_per_m) {
          const cost = parseFloat(item.edited_cost_per_m);
          if (!isNaN(cost) && cost >= 0) {
            updateData.actual_cost_per_m = cost;
          }
        }

        if (item.edited_max_hours) {
          const hours = parseFloat(item.edited_max_hours);
          if (!isNaN(hours) && hours >= 0) {
            updateData.max_hours = hours;
          }
        }

        // Note: price_per_m and total_billing updates would need to be handled
        // through the requirements system for accurate updates

        if (Object.keys(updateData).length > 0) {
          return updateJob(item.job_id, updateData);
        }
        return null;
      });

      await Promise.all(updates);
      setRefreshTrigger((prev) => prev + 1);
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (error) {
      console.error("[FinancialDataManager] Save error:", error);
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to save changes"
      );
      setShowErrorToast(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Sort icon
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <span className="text-gray-400 ml-1">↕</span>;
    }
    return (
      <span className="text-blue-600 ml-1">
        {sortDirection === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // Get status indicator for a job
  const getStatusIndicator = (item: JobFinancialData) => {
    const issues: string[] = [];

    if (item.total_billing === 0 && item.billing_rate_per_m === 0) {
      issues.push("No billing");
    }
    if (item.margin_percent < 0) {
      issues.push("Negative margin");
    }
    if (item.max_hours && item.time_estimate && item.time_estimate > item.max_hours) {
      issues.push("Over hours");
    }

    if (issues.length === 0) return null;

    return (
      <div className="flex items-center gap-1">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span className="text-xs text-amber-600">{issues.join(", ")}</span>
      </div>
    );
  };

  // Empty state
  if (jobData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="text-center py-8 text-gray-500">
          <p className="mb-2">No jobs found in the selected time period.</p>
          <p className="text-sm">
            Adjust your date range to see jobs available for financial management.
          </p>
        </div>
      </div>
    );
  }

  const containerClass = isExpanded
    ? "fixed inset-0 z-50 bg-white overflow-auto"
    : "bg-white rounded-lg shadow border border-gray-200";

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Financial Data Manager
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Manage billing, costs, and pricing for jobs in this period
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Health Summary */}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`px-2 py-1 rounded ${
                healthSummary.healthPercentage >= 80
                  ? "bg-green-100 text-green-700"
                  : healthSummary.healthPercentage >= 60
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {healthSummary.healthPercentage.toFixed(0)}% Healthy
            </span>
          </div>
          {/* Expand/Collapse */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title={isExpanded ? "Exit fullscreen" : "Expand to fullscreen"}
          >
            {isExpanded ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-3 border-b border-gray-200 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => {
            setActiveTab("all");
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
            activeTab === "all"
              ? "bg-blue-100 text-blue-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          All Jobs ({jobData.length})
        </button>
        <button
          onClick={() => {
            setActiveTab("missing_billing");
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
            activeTab === "missing_billing"
              ? "bg-amber-100 text-amber-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Missing Billing ({healthSummary.missingBilling})
        </button>
        <button
          onClick={() => {
            setActiveTab("discrepancy");
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
            activeTab === "discrepancy"
              ? "bg-orange-100 text-orange-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Discrepancies ({healthSummary.discrepancies})
        </button>
        <button
          onClick={() => {
            setActiveTab("zero_pricing");
            setCurrentPage(1);
          }}
          className={`px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
            activeTab === "zero_pricing"
              ? "bg-red-100 text-red-700"
              : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          $0 Pricing ({healthSummary.zeroPricing})
        </button>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-gray-200 flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Bulk Actions */}
        <div className="flex items-center gap-2">
          {selectedJobs.length > 0 && (
            <span className="text-sm text-gray-600">
              {selectedJobs.length} selected
            </span>
          )}

          {/* Set Billing Rate */}
          <div className="relative">
            <button
              onClick={() => setShowBulkBilling(!showBulkBilling)}
              disabled={selectedJobs.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <DollarSign className="w-4 h-4" />
              Set Billing
            </button>
            {showBulkBilling && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 min-w-[200px]">
                <label className="block text-xs text-gray-600 mb-1">
                  Billing Rate (per/M)
                </label>
                <input
                  type="text"
                  value={bulkBillingValue}
                  onChange={(e) => setBulkBillingValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={applyBulkBilling}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowBulkBilling(false)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Set Cost */}
          <div className="relative">
            <button
              onClick={() => setShowBulkCost(!showBulkCost)}
              disabled={selectedJobs.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <DollarSign className="w-4 h-4" />
              Set Cost
            </button>
            {showBulkCost && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 min-w-[200px]">
                <label className="block text-xs text-gray-600 mb-1">
                  Cost (per/M)
                </label>
                <input
                  type="text"
                  value={bulkCostValue}
                  onChange={(e) => setBulkCostValue(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={applyBulkCost}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowBulkCost(false)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Set Hours Cap */}
          <div className="relative">
            <button
              onClick={() => setShowBulkHours(!showBulkHours)}
              disabled={selectedJobs.length === 0}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <Clock className="w-4 h-4" />
              Set Hours
            </button>
            {showBulkHours && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-20 min-w-[200px]">
                <label className="block text-xs text-gray-600 mb-1">
                  Max Hours (soft cap)
                </label>
                <input
                  type="text"
                  value={bulkHoursValue}
                  onChange={(e) => setBulkHoursValue(e.target.value)}
                  placeholder="0"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={applyBulkHours}
                    className="flex-1 px-2 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowBulkHours(false)}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Save Button */}
        {jobsWithChanges.length > 0 && (
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting
              ? "Saving..."
              : `Save ${jobsWithChanges.length} Change${
                  jobsWithChanges.length !== 1 ? "s" : ""
                }`}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-2 py-3 w-8"></th>
              <th
                onClick={() => handleSort("job_number")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Job #
                  <SortIcon field="job_number" />
                </div>
              </th>
              <th
                onClick={() => handleSort("client_name")}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center gap-1">
                  Client
                  <SortIcon field="client_name" />
                </div>
              </th>
              <th
                onClick={() => handleSort("quantity")}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Qty
                  <SortIcon field="quantity" />
                </div>
              </th>
              <th
                onClick={() => handleSort("billing")}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Billing
                  <SortIcon field="billing" />
                </div>
              </th>
              <th
                onClick={() => handleSort("cost")}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Cost
                  <SortIcon field="cost" />
                </div>
              </th>
              <th
                onClick={() => handleSort("margin")}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Margin
                  <SortIcon field="margin" />
                </div>
              </th>
              <th
                onClick={() => handleSort("hours")}
                className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
              >
                <div className="flex items-center justify-end gap-1">
                  Hours
                  <SortIcon field="hours" />
                </div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {paginatedData.map((item) => (
              <React.Fragment key={item.job_id}>
                {/* Main Row */}
                <tr
                  className={`hover:bg-gray-50 ${
                    item.hasChanges ? "bg-blue-50" : ""
                  }`}
                >
                  <td className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={item.isSelected}
                      onChange={() => handleSelectJob(item.job_id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-2 py-4">
                    <button
                      onClick={() => handleExpandJob(item.job_id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {item.isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">
                    {item.job_number}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600">
                    {item.client_name}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500 text-right">
                    {item.quantity.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-gray-900 text-right">
                    {item.total_billing > 0
                      ? formatCurrency(item.total_billing)
                      : item.billing_rate_per_m > 0
                      ? `${formatCurrency(item.billing_rate_per_m)}/M`
                      : "—"}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-700 text-right">
                    {item.actual_cost_per_m > 0
                      ? `${formatCurrency(item.actual_cost_per_m)}/M`
                      : "—"}
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold text-right">
                    <span className={getMarginStatusColor(item.margin_percent)}>
                      {item.margin_percent !== 0
                        ? `${item.margin_percent.toFixed(1)}%`
                        : "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-right">
                    {item.time_estimate != null ? (
                      <span
                        className={
                          item.max_hours &&
                          item.time_estimate > item.max_hours
                            ? "text-amber-600"
                            : "text-gray-600"
                        }
                      >
                        {item.time_estimate.toFixed(1)}
                        {item.max_hours && `/${item.max_hours}`}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-4">{getStatusIndicator(item)}</td>
                </tr>

                {/* Expanded Row */}
                {item.isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={10} className="px-6 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* Price per M */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Billing Rate (per/M)
                          </label>
                          <input
                            type="text"
                            value={item.edited_price_per_m}
                            onChange={(e) =>
                              handleFieldChange(
                                item.job_id,
                                "edited_price_per_m",
                                e.target.value
                              )
                            }
                            placeholder={
                              item.billing_rate_per_m > 0
                                ? formatCurrency(item.billing_rate_per_m)
                                : "0.00"
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        {/* Cost per M */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Actual Cost (per/M)
                          </label>
                          <input
                            type="text"
                            value={item.edited_cost_per_m}
                            onChange={(e) =>
                              handleFieldChange(
                                item.job_id,
                                "edited_cost_per_m",
                                e.target.value
                              )
                            }
                            placeholder={
                              item.actual_cost_per_m > 0
                                ? formatCurrency(item.actual_cost_per_m)
                                : "0.00"
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        {/* Add-on Charges */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Add-on Charges
                          </label>
                          <input
                            type="text"
                            value={item.edited_add_on_charges}
                            onChange={(e) =>
                              handleFieldChange(
                                item.job_id,
                                "edited_add_on_charges",
                                e.target.value
                              )
                            }
                            placeholder={
                              item.add_on_charges > 0
                                ? formatCurrency(item.add_on_charges)
                                : "0.00"
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>

                        {/* Max Hours */}
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">
                            Max Hours (soft cap)
                          </label>
                          <input
                            type="text"
                            value={item.edited_max_hours}
                            onChange={(e) =>
                              handleFieldChange(
                                item.job_id,
                                "edited_max_hours",
                                e.target.value
                              )
                            }
                            placeholder={
                              item.max_hours != null
                                ? item.max_hours.toString()
                                : "No limit"
                            }
                            className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>

                      {/* Job Details */}
                      <div className="mt-4 text-sm text-gray-600">
                        <span className="font-medium">{item.job_name}</span>
                        {item.time_estimate != null && (
                          <span className="ml-4">
                            Est. Hours: {item.time_estimate.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {sortedJobData.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Pagination
            currentPage={currentPage}
            totalItems={sortedJobData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => setCurrentPage(page)}
            onItemsPerPageChange={(items) => {
              setItemsPerPage(items);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* Footer Summary */}
      {selectedJobs.length > 0 && (
        <div className="px-6 py-3 border-t border-gray-200 bg-blue-50 flex items-center justify-between">
          <div className="text-sm text-blue-800">
            <span className="font-medium">{selectedJobs.length}</span> jobs
            selected
            <span className="mx-2">•</span>
            Total Billing:{" "}
            <span className="font-medium">
              {formatCurrency(
                selectedJobs.reduce((sum, j) => sum + j.total_billing, 0)
              )}
            </span>
          </div>
        </div>
      )}

      {/* Toasts */}
      {showSuccessToast && (
        <Toast
          message="Changes saved successfully!"
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
      {showErrorToast && (
        <Toast
          message={errorMessage || "Failed to save changes"}
          type="error"
          onClose={() => setShowErrorToast(false)}
        />
      )}
    </div>
  );
}
