"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  getJobsByHealthIssue,
  bulkUpdateJobsWithProgress,
  type Job,
  type DataHealthIssueType,
} from "@/lib/api";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Calendar,
  CalendarX,
  Loader2,
  DollarSign,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
  Save,
} from "lucide-react";
import DynamicRequirementFields from "./DynamicRequirementFields";
import { updateJob } from "@/lib/api";
import { format } from "date-fns";

interface DataHealthBulkFixModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  issueType: DataHealthIssueType;
  facilitiesId: number | null;
}

interface EditedJob {
  start_date?: number | null;
  due_date?: number | null;
  actual_cost_per_m?: number | null;
}

interface JobRequirement {
  process_type: string;
  price_per_m?: string;
  [key: string]: string | number | boolean | undefined;
}

const ISSUE_CONFIG: Record<
  DataHealthIssueType,
  {
    title: string;
    description: string;
    icon: typeof CalendarX;
    primaryField: "start_date" | "due_date" | "actual_cost_per_m";
  }
> = {
  missing_due_dates: {
    title: "Fix Missing Due Dates",
    description: "The following jobs are missing due dates. Add due dates to fix these issues.",
    icon: CalendarX,
    primaryField: "due_date",
  },
  missing_start_date: {
    title: "Fix Missing Start Dates",
    description: "The following jobs are missing start dates. Add start dates to fix these issues.",
    icon: Calendar,
    primaryField: "start_date",
  },
  start_is_after_due: {
    title: "Fix Start After Due Date",
    description: "The following jobs have start dates that are after their due dates. Adjust the dates to fix these issues.",
    icon: AlertCircle,
    primaryField: "start_date",
  },
  missing_cost_per_m: {
    title: "Fix Missing Cost Per Thousand",
    description: "The following jobs are missing cost entries. Add actual cost per thousand to fix these issues.",
    icon: DollarSign,
    primaryField: "actual_cost_per_m",
  },
};

export default function DataHealthBulkFixModal({
  isOpen,
  onClose,
  onSuccess,
  issueType,
  facilitiesId,
}: DataHealthBulkFixModalProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editedJobs, setEditedJobs] = useState<Map<number, EditedJob>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<{
    success: number;
    failures: { jobId: number; error: string }[];
  } | null>(null);
  const [bulkDate, setBulkDate] = useState<string>("");
  const [bulkCost, setBulkCost] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>("");
  const [expandedJobs, setExpandedJobs] = useState<Set<number>>(new Set());
  const [editedServices, setEditedServices] = useState<Map<number, Map<number, string>>>(new Map());
  const [editingJobIds, setEditingJobIds] = useState<Set<number>>(new Set());
  const [editingRequirements, setEditingRequirements] = useState<Map<number, JobRequirement[]>>(new Map());
  const [savingJobIds, setSavingJobIds] = useState<Set<number>>(new Set());
  const hasInitialFetch = useRef(false);

  const config = ISSUE_CONFIG[issueType];
  const isCostIssue = issueType === "missing_cost_per_m";
  const IconComponent = config.icon;

  // Debounce search query
  useEffect(() => {
    if (!isCostIssue) return;
    
    console.log("[DataHealthBulkFixModal] Search query changed:", searchQuery);
    
    const timer = setTimeout(() => {
      console.log("[DataHealthBulkFixModal] Debounced search query set to:", searchQuery);
      setDebouncedSearchQuery(searchQuery);
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery, isCostIssue]);

  // Fetch jobs when modal opens
  useEffect(() => {
    if (!isOpen) {
      hasInitialFetch.current = false;
      return;
    }

    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);
      setSaveResult(null);
      
      // Reset state when modal first opens
      setEditedJobs(new Map());
      setBulkDate("");
      setBulkCost("");
      setSearchQuery("");
      setDebouncedSearchQuery("");
      setExpandedJobs(new Set());
      setEditedServices(new Map());
      setEditingJobIds(new Set());
      setEditingRequirements(new Map());
      setSavingJobIds(new Set());

      try {
        const fetchedJobs = await getJobsByHealthIssue(
          issueType,
          facilitiesId,
          isCostIssue ? "" : null
        );
        setJobs(fetchedJobs);
        hasInitialFetch.current = true;
      } catch (err) {
        console.error("[DataHealthBulkFixModal] Error fetching jobs:", err);
        setError(err instanceof Error ? err.message : "Failed to load jobs");
        hasInitialFetch.current = true;
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [isOpen, issueType, facilitiesId, isCostIssue]);

  // Fetch jobs when search query changes (debounced)
  useEffect(() => {
    console.log("[DataHealthBulkFixModal] Search effect triggered:", {
      isOpen,
      isCostIssue,
      hasInitialFetch: hasInitialFetch.current,
      debouncedSearchQuery
    });
    
    if (!isOpen || !isCostIssue) {
      console.log("[DataHealthBulkFixModal] Search effect skipped: modal not open or not cost issue");
      return;
    }
    
    // If initial fetch hasn't completed, mark it as complete and proceed with search
    // This allows search to work even if user types before initial load finishes
    if (!hasInitialFetch.current) {
      hasInitialFetch.current = true;
    }
    
    const fetchJobs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const searchParam = debouncedSearchQuery && debouncedSearchQuery.trim() 
          ? debouncedSearchQuery.trim() 
          : null;
        
        console.log("[DataHealthBulkFixModal] Fetching jobs with search:", searchParam);
        
        const fetchedJobs = await getJobsByHealthIssue(
          issueType,
          facilitiesId,
          searchParam
        );
        console.log("[DataHealthBulkFixModal] Jobs fetched:", fetchedJobs.length);
        setJobs(fetchedJobs);
      } catch (err) {
        console.error("[DataHealthBulkFixModal] Error fetching jobs:", err);
        setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobs();
  }, [debouncedSearchQuery, isOpen, issueType, facilitiesId, isCostIssue]);

  // Auto-calculate cost when inline editing requirements change
  useEffect(() => {
    if (!isCostIssue) return;

    for (const [jobId, requirements] of editingRequirements.entries()) {
      // Calculate directly from requirements without sanitizing first
      // This ensures we include all requirements even if they're partially filled
      // We'll sanitize only for the final calculation
      let totalCost = 0;

      console.log(`[DataHealthBulkFixModal] Calculating cost for job ${jobId}, ${requirements.length} services:`);

      for (let i = 0; i < requirements.length; i++) {
        const req = requirements[i];
        // Log the full requirement object to debug
        console.log(`  Service ${i + 1} full requirement object:`, JSON.stringify(req, null, 2));
        
        // Extract price_per_m directly from the requirement (before sanitization)
        // Handle both string and number types, and also handle the string "undefined"
        // Use hasOwnProperty to check if the property exists, default to empty string if missing
        // Also support legacy/mistyped field `price_per_m`
        const pricePerMRaw = req.hasOwnProperty("price_per_m") ? req.price_per_m : "";
        const pricePerMFromLegacy = (req as any).price_pe_m;
        const pricePerM =
          pricePerMRaw !== undefined && pricePerMRaw !== null && pricePerMRaw !== ""
            ? pricePerMRaw
            : pricePerMFromLegacy !== undefined && pricePerMFromLegacy !== null
            ? pricePerMFromLegacy
            : "";
        console.log(
          `  Service ${i + 1} price_per_m raw value:`,
          pricePerM,
          `(type: ${typeof pricePerM}, has price_per_m: ${req.hasOwnProperty("price_per_m")}, has price_per_m: ${req.hasOwnProperty("price_per_m")})`
        );
        
        // Check if pricePerM is valid (not undefined, null, empty string, or the string "undefined")
        const isValidPrice = pricePerM !== undefined && 
                            pricePerM !== null && 
                            pricePerM !== "" && 
                            String(pricePerM) !== "undefined" &&
                            String(pricePerM).trim() !== "";
        const baseCost = isValidPrice
          ? parseFloat(String(pricePerM)) || 0
          : 0;
        let serviceTotalCost = baseCost;

        // Add all _cost fields
        for (const [key, value] of Object.entries(req)) {
          if (key.endsWith("_cost") && key !== "price_per_m") {
            const additionalCost = value !== undefined && value !== null && value !== ""
              ? parseFloat(String(value)) || 0
              : 0;
            serviceTotalCost += additionalCost;
            if (additionalCost > 0) {
              console.log(`  Service ${i + 1} (${req.process_type || "unnamed"}): ${key} = $${additionalCost}`);
            }
          }
        }

        console.log(`  Service ${i + 1} (${req.process_type || "unnamed"}): price_per_m="${pricePerM}" → baseCost=$${baseCost}, serviceTotalCost=$${serviceTotalCost}`);
        totalCost += serviceTotalCost;
      }

      console.log(`  TOTAL COST for job ${jobId}: $${totalCost}`);

      // Always update the Cost/M field with the calculated total when editing inline requirements
      // This ensures the input field displays the calculated value
      setEditedJobs((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(jobId) || {};
        // Update with calculated total (use 0 if totalCost is 0, but still update to show the calculation)
        const newValue = totalCost;
        console.log(`[DataHealthBulkFixModal] Updating editedJobs for job ${jobId}: actual_cost_per_m = ${newValue}`);
        newMap.set(jobId, { ...existing, actual_cost_per_m: newValue });
        return newMap;
      });
    }
  }, [editingRequirements, isCostIssue]);

  // Auto-populate Cost/M from saved job requirements when job is expanded
  useEffect(() => {
    if (!isCostIssue) return;

    // Helper to parse requirements inline
    const parseRequirements = (job: Job): JobRequirement[] => {
      if (!job.requirements) return [];
      try {
        const parsed = JSON.parse(job.requirements);
        const requirements = Array.isArray(parsed) ? parsed : [];
        return sanitizeRequirements(requirements);
      } catch {
        return [];
      }
    };

    // Helper to calculate total cost inline
    const calcTotal = (requirements: JobRequirement[]): number => {
      return calculateTotalCostFromRequirements(requirements);
    };

    for (const jobId of expandedJobs) {
      // Skip if currently being edited inline
      if (editingJobIds.has(jobId)) continue;

      const job = jobs.find((j) => j.id === jobId);
      if (!job) continue;

      const requirements = parseRequirements(job);
      const totalCost = calcTotal(requirements);

      if (totalCost > 0) {
        setEditedJobs((prev) => {
          // Only update if not already set to this value
          const existing = prev.get(jobId);
          if (existing?.actual_cost_per_m === totalCost) return prev;

          const newMap = new Map(prev);
          newMap.set(jobId, { ...existing, actual_cost_per_m: totalCost });
          return newMap;
        });
      }
    }
  }, [expandedJobs, jobs, isCostIssue, editingJobIds]);

  // Get the current value for a job field (edited or original)
  const getJobValue = (job: Job, field: "start_date" | "due_date"): number | null | undefined => {
    const edited = editedJobs.get(job.id);
    if (edited && field in edited) {
      return edited[field];
    }
    return job[field];
  };

  // Get the current cost value for a job (edited only, since jobs don't have cost directly)
  const getCostValue = (jobId: number): number | null | undefined => {
    const edited = editedJobs.get(jobId);
    return edited?.actual_cost_per_m;
  };

  // Format date for display in input
  const formatDateForInput = (timestamp: number | null | undefined): string => {
    if (!timestamp) return "";
    return format(new Date(timestamp), "yyyy-MM-dd");
  };

  // Parse date from input to timestamp
  const parseDateFromInput = (dateStr: string): number | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.getTime();
  };

  // Handle individual job date change
  const handleDateChange = (
    jobId: number,
    field: "start_date" | "due_date",
    value: string
  ) => {
    const timestamp = parseDateFromInput(value);
    setEditedJobs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(jobId) || {};
      newMap.set(jobId, { ...existing, [field]: timestamp });
      return newMap;
    });
  };

  // Handle individual job cost change
  const handleCostChange = (jobId: number, value: string) => {
    // Parse the cost value, allowing empty string
    const costValue = value === "" ? null : parseFloat(value);
    setEditedJobs((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(jobId) || {};
      newMap.set(jobId, { ...existing, actual_cost_per_m: costValue });
      return newMap;
    });
  };

  // Apply bulk date to all jobs
  const handleApplyBulkDate = () => {
    if (!bulkDate) return;
    const timestamp = parseDateFromInput(bulkDate);

    setEditedJobs((prev) => {
      const newMap = new Map(prev);
      jobs.forEach((job) => {
        const existing = newMap.get(job.id) || {};
        newMap.set(job.id, { ...existing, [config.primaryField]: timestamp });
      });
      return newMap;
    });
  };

  // Apply bulk cost to all jobs
  const handleApplyBulkCost = () => {
    if (!bulkCost) return;
    const costValue = parseFloat(bulkCost);
    if (isNaN(costValue) || costValue < 0) return;

    setEditedJobs((prev) => {
      const newMap = new Map(prev);
      jobs.forEach((job) => {
        const existing = newMap.get(job.id) || {};
        newMap.set(job.id, { ...existing, actual_cost_per_m: costValue });
      });
      return newMap;
    });
  };

  // Parse job requirements from JSON string
  const getJobRequirements = (job: Job): JobRequirement[] => {
    if (!job.requirements) return [];
    try {
      const parsed = typeof job.requirements === "string"
        ? JSON.parse(job.requirements)
        : job.requirements;
      const requirements = Array.isArray(parsed) ? parsed : [];
      // Ensure all requirements have price_per_m initialized (even if empty string)
      // Also normalize legacy/mistyped field `price_per_m` to `price_per_m`
      const normalizedRequirements = requirements.map((req) => {
        const hasPricePerM = req.price_per_m !== undefined && req.price_per_m !== null && req.price_per_m !== "";
        const fallbackPricePerM = (req as any).price_per_m;
        const price_per_m = hasPricePerM
          ? req.price_per_m
          : fallbackPricePerM !== undefined && fallbackPricePerM !== null
          ? fallbackPricePerM
          : "";
        return {
          ...req,
          price_per_m,
        };
      });
      return sanitizeRequirements(normalizedRequirements);
    } catch {
      return [];
    }
  };

  // Toggle job row expansion
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

  // Handle service price change
  const handleServicePriceChange = (jobId: number, serviceIndex: number, value: string) => {
    setEditedServices((prev) => {
      const newMap = new Map(prev);
      const jobServices = new Map(newMap.get(jobId) || new Map());
      jobServices.set(serviceIndex, value);
      newMap.set(jobId, jobServices);
      return newMap;
    });
  };

  // Get service price (edited or original)
  const getServicePrice = (jobId: number, serviceIndex: number, requirement: JobRequirement): string => {
    const editedPrice = editedServices.get(jobId)?.get(serviceIndex);
    if (editedPrice !== undefined) {
      return editedPrice;
    }
    return requirement.price_per_m || "";
  };

  // Determine if a requirement field has been deselected/cleared by the user
  const isUnselectedValue = (value: unknown): boolean => {
    if (value === undefined || value === null) return true;
    if (typeof value === "boolean") return value === false;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" || trimmed === "false";
    }
    return false;
  };

  // Strip unselected fields and orphaned _cost fields so we don't send them
  const sanitizeRequirements = (requirements: JobRequirement[]): JobRequirement[] => {
    return requirements.map((req) => {
      const cleaned: JobRequirement = { process_type: req.process_type };
      const retainedFields = new Set<string>();

      if (!isUnselectedValue(req.price_per_m)) {
        cleaned.price_per_m = req.price_per_m;
      }

      Object.entries(req).forEach(([key, value]) => {
        if (key === "process_type" || key === "price_per_m" || key.endsWith("_cost")) return;
        if (!isUnselectedValue(value)) {
          cleaned[key] = value;
          retainedFields.add(key);
        }
      });

      Object.entries(req).forEach(([key, value]) => {
        if (!key.endsWith("_cost")) return;
        const baseField = key.replace(/_cost$/, "");
        if (!retainedFields.has(baseField)) return;
        if (!isUnselectedValue(value)) {
          cleaned[key] = value;
        }
      });

      return cleaned;
    });
  };

  // Extract all costs from a requirement (price_per_m + all _cost fields)
  const getRequirementCosts = (requirement: JobRequirement): {
    baseCost: number;
    additionalCosts: Array<{ name: string; cost: number }>;
    total: number;
  } => {
    const [sanitizedRequirement] = sanitizeRequirements([requirement]);
    const req = sanitizedRequirement || { process_type: requirement.process_type };

    const baseCost = parseFloat(String(req.price_per_m || "0")) || 0;
    const additionalCosts: Array<{ name: string; cost: number }> = [];

    // Find all _cost fields
    for (const [key, value] of Object.entries(req)) {
      if (key.endsWith("_cost") && key !== "price_per_m") {
        const cost = parseFloat(String(value || "0")) || 0;
        if (cost > 0) {
          // Convert field name to readable label (e.g., "affix_cost" -> "Affix")
          const name = key.replace("_cost", "").replace(/_/g, " ");
          const label = name.charAt(0).toUpperCase() + name.slice(1);
          additionalCosts.push({ name: label, cost });
        }
      }
    }

    const additionalTotal = additionalCosts.reduce((sum, item) => sum + item.cost, 0);
    return { baseCost, additionalCosts, total: baseCost + additionalTotal };
  };

  // Calculate total cost from all requirements (for job-level Cost/M)
  // This is the SUM of all service costs (base price + additional costs for each service)
  const calculateTotalCostFromRequirements = (requirements: JobRequirement[]): number => {
    const sanitizedRequirements = sanitizeRequirements(requirements);
    if (!sanitizedRequirements || sanitizedRequirements.length === 0) return 0;

    // Sum all service totals (each service total = base price + its additional costs)
    return sanitizedRequirements.reduce((sum, req) => sum + getRequirementCosts(req).total, 0);
  };

  // Start editing services inline for a job
  const startEditingServices = (job: Job) => {
    const requirements = getJobRequirements(job);
    setEditingJobIds((prev) => new Set(prev).add(job.id));
    setEditingRequirements((prev) => {
      const newMap = new Map(prev);
      newMap.set(job.id, requirements.length > 0 ? requirements : [{ process_type: "", price_per_m: "" }]);
      return newMap;
    });
  };

  // Cancel editing services for a job
  const cancelEditingServices = (jobId: number) => {
    setEditingJobIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(jobId);
      return newSet;
    });
    setEditingRequirements((prev) => {
      const newMap = new Map(prev);
      newMap.delete(jobId);
      return newMap;
    });
  };

  // Handle requirement field change for inline editing
  const handleInlineRequirementChange = (
    jobId: number,
    requirementIndex: number,
    field: string,
    value: string | number | boolean
  ) => {
    // Normalize the value - ensure undefined/null/string "undefined" becomes empty string for string fields
    // This prevents "undefined" from being stored as a string
    let normalizedValue: string | number | boolean = value;
    
    // Special handling for price_per_m - always ensure it's a string
    if (field === "price_per_m") {
      if (value === undefined || value === null || (typeof value === "string" && value === "undefined")) {
        normalizedValue = "";
      } else {
        // Convert to string to ensure consistency
        normalizedValue = String(value);
      }
    } else if (value === undefined || value === null || (typeof value === "string" && value === "undefined")) {
      // For other string fields, use empty string
      // For number fields, use 0
      // For boolean fields, use false
      if (typeof value === "string" && value === "undefined") {
        normalizedValue = "";
      } else if (typeof value === "number") {
        normalizedValue = 0;
      } else {
        normalizedValue = false;
      }
    }
    
    console.log(`[DataHealthBulkFixModal] handleInlineRequirementChange: job=${jobId}, serviceIndex=${requirementIndex}, field="${field}", value="${value}" (type: ${typeof value}) → normalized="${normalizedValue}" (type: ${typeof normalizedValue})`);
    setEditingRequirements((prev) => {
      const newMap = new Map(prev);
      const requirements = [...(newMap.get(jobId) || [])];
      if (requirements[requirementIndex]) {
        // Create updated requirement - ensure process_type and price_per_m are always strings
        const currentReq = requirements[requirementIndex];
        const updatedRequirement = { 
          ...currentReq,
          process_type: currentReq.process_type || "",
          // Always ensure price_per_m exists and is a string
          price_per_m: field === "price_per_m" 
            ? String(normalizedValue) 
            : (currentReq.price_per_m !== undefined ? String(currentReq.price_per_m) : ""),
          // Set the field that was changed
          [field]: normalizedValue 
        };
        requirements[requirementIndex] = updatedRequirement;
        console.log(`[DataHealthBulkFixModal] Updated requirement ${requirementIndex} for job ${jobId}:`, JSON.stringify(updatedRequirement, null, 2));
        console.log(`[DataHealthBulkFixModal] price_per_m in updated requirement:`, updatedRequirement.price_per_m, `(type: ${typeof updatedRequirement.price_per_m})`);
      }
      // Don't sanitize during editing - preserve all requirements and fields
      // Sanitization will happen when saving
      console.log(`[DataHealthBulkFixModal] All requirements for job ${jobId}:`, JSON.stringify(requirements, null, 2));
      newMap.set(jobId, requirements);
      return newMap;
    });
  };

  // Add a new requirement for inline editing
  const addInlineRequirement = (jobId: number) => {
    setEditingRequirements((prev) => {
      const newMap = new Map(prev);
      const requirements = [...(newMap.get(jobId) || [])];
      requirements.push({ process_type: "", price_per_m: "" });
      newMap.set(jobId, requirements);
      return newMap;
    });
  };

  // Remove a requirement for inline editing
  const removeInlineRequirement = (jobId: number, requirementIndex: number) => {
    setEditingRequirements((prev) => {
      const newMap = new Map(prev);
      const requirements = [...(newMap.get(jobId) || [])];
      if (requirements.length > 1) {
        requirements.splice(requirementIndex, 1);
        newMap.set(jobId, requirements);
      }
      return newMap;
    });
  };

  // Save inline edited services for a job
  const saveInlineServices = async (jobId: number) => {
    const requirements = editingRequirements.get(jobId);
    if (!requirements) return;

    setSavingJobIds((prev) => new Set(prev).add(jobId));

    try {
      // Calculate the total cost from the requirements
      const sanitizedRequirements = sanitizeRequirements(requirements);
      const totalCost = calculateTotalCostFromRequirements(sanitizedRequirements);

      // Get the job to access quantity and add_on_charges for total_billing calculation
      const job = jobs.find((j) => j.id === jobId);
      if (!job) return;

      // Update job with both requirements and actual_cost_per_m
      const updateData: Partial<Job> = {
        requirements: JSON.stringify(sanitizedRequirements),
      };
      
      // Include actual_cost_per_m if we have a valid cost
      if (totalCost > 0) {
        updateData.actual_cost_per_m = totalCost;
        
        // Calculate total_billing from quantity and actual_cost_per_m
        const quantity = job.quantity || 0;
        const addOnCharges = parseFloat(job.add_on_charges || "0") || 0;
        const calculatedTotalBilling = (quantity / 1000) * totalCost + addOnCharges;
        updateData.total_billing = calculatedTotalBilling.toFixed(2);
      }

      await updateJob(jobId, updateData);

      // Update the local jobs array with new requirements, actual_cost_per_m, and total_billing
      setJobs((prev) =>
        prev.map((job) => {
          if (job.id === jobId) {
            const updatedJob = { 
              ...job, 
              requirements: JSON.stringify(sanitizedRequirements),
              actual_cost_per_m: totalCost > 0 ? totalCost : job.actual_cost_per_m,
            };
            
            // Update total_billing if we have a valid cost
            if (totalCost > 0) {
              const quantity = job.quantity || 0;
              const addOnCharges = parseFloat(job.add_on_charges || "0") || 0;
              const calculatedTotalBilling = (quantity / 1000) * totalCost + addOnCharges;
              updatedJob.total_billing = calculatedTotalBilling.toFixed(2);
            }
            
            return updatedJob;
          }
          return job;
        })
      );

      // Update the Cost/M field in editedJobs with the calculated total
      if (totalCost > 0) {
        setEditedJobs((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(jobId) || {};
          newMap.set(jobId, { ...existing, actual_cost_per_m: totalCost });
          return newMap;
        });
      }

      // Clear editing state for this job
      setEditingJobIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
      setEditingRequirements((prev) => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });

      // Clear any edited service prices for this job
      setEditedServices((prev) => {
        const newMap = new Map(prev);
        newMap.delete(jobId);
        return newMap;
      });
    } catch (err) {
      console.error("[DataHealthBulkFixModal] Error saving services:", err);
      setError(err instanceof Error ? err.message : "Failed to save services");
    } finally {
      setSavingJobIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  // Check if a job row is valid (no date conflicts or missing cost)
  const isJobValid = (job: Job): boolean => {
    // For missing cost, check if a valid cost has been entered
    if (issueType === "missing_cost_per_m") {
      const cost = getCostValue(job.id);
      return cost !== null && cost !== undefined && !isNaN(cost) && cost >= 0;
    }

    const startDate = getJobValue(job, "start_date");
    const dueDate = getJobValue(job, "due_date");

    // For missing dates, check if they're now filled
    if (issueType === "missing_due_dates") {
      return dueDate !== null && dueDate !== undefined;
    }
    if (issueType === "missing_start_date") {
      return startDate !== null && startDate !== undefined;
    }
    // For start_is_after_due, check if start <= due
    if (issueType === "start_is_after_due") {
      if (!startDate || !dueDate) return false;
      return startDate <= dueDate;
    }
    return true;
  };

  // Count of jobs that have been edited and are now valid
  const validEditedCount = useMemo(() => {
    return jobs.filter((job) => editedJobs.has(job.id) && isJobValid(job)).length;
  }, [jobs, editedJobs, issueType]);

  // Count of jobs that are still invalid
  const invalidCount = useMemo(() => {
    return jobs.filter((job) => !isJobValid(job)).length;
  }, [jobs, editedJobs, issueType]);

  // Handle save
  const handleSave = async () => {
    // Get valid edits
    const validEdits = Array.from(editedJobs.entries()).filter(([jobId]) => {
      const job = jobs.find((j) => j.id === jobId);
      return job && isJobValid(job);
    });

    if (validEdits.length === 0) {
      setError("No valid changes to save");
      return;
    }

    setIsSaving(true);
    setSaveProgress({ current: 0, total: validEdits.length });
    setError(null);

    try {
      // Handle cost entries - update actual_cost_per_m field on jobs
      if (isCostIssue) {
        // Build a map of all job updates (combining requirements and actual_cost_per_m)
        const jobUpdatesMap = new Map<number, Partial<Job>>();

        // 1. Add requirement updates if service prices were edited
        for (const [jobId, serviceEdits] of editedServices.entries()) {
          if (serviceEdits.size > 0) {
            const job = jobs.find((j) => j.id === jobId);
            if (job) {
              const requirements = getJobRequirements(job);
              let hasChanges = false;

              for (const [idx, price] of serviceEdits.entries()) {
                if (requirements[idx]) {
                  requirements[idx].price_per_m = price;
                  hasChanges = true;
                }
              }

              if (hasChanges) {
                const sanitizedRequirements = sanitizeRequirements(requirements);
                jobUpdatesMap.set(jobId, {
                  requirements: JSON.stringify(sanitizedRequirements),
                });
              }
            }
          }
        }

        // 2. Add requirement updates when inline requirement fields were edited directly
        for (const [jobId, requirements] of editingRequirements.entries()) {
          if (!requirements || requirements.length === 0) continue;
          const sanitizedRequirements = sanitizeRequirements(requirements);
          const hasMeaningfulFields = sanitizedRequirements.some((req) => Object.keys(req).length > 1);
          if (!hasMeaningfulFields) continue;

          const existing = jobUpdatesMap.get(jobId) || {};
          jobUpdatesMap.set(jobId, {
            ...existing,
            requirements: JSON.stringify(sanitizedRequirements),
          });
        }

        // 3. Add actual_cost_per_m updates for jobs with valid cost values
        // Also calculate and include total_billing
        for (const [jobId, edits] of validEdits) {
          if (edits.actual_cost_per_m !== null && edits.actual_cost_per_m !== undefined) {
            const existing = jobUpdatesMap.get(jobId) || {};
            const job = jobs.find((j) => j.id === jobId);
            
            // Calculate total_billing from quantity and actual_cost_per_m
            let totalBilling: string | undefined;
            if (job) {
              const quantity = job.quantity || 0;
              const addOnCharges = parseFloat(job.add_on_charges || "0") || 0;
              const calculatedTotalBilling = (quantity / 1000) * edits.actual_cost_per_m + addOnCharges;
              totalBilling = calculatedTotalBilling.toFixed(2);
            }
            
            jobUpdatesMap.set(jobId, {
              ...existing,
              actual_cost_per_m: edits.actual_cost_per_m,
              ...(totalBilling !== undefined && { total_billing: totalBilling }),
            });
          }
        }

        // Convert map to array format for bulkUpdateJobsWithProgress
        const updates = Array.from(jobUpdatesMap.entries()).map(([id, data]) => ({
          id,
          data,
        }));

        if (updates.length === 0) {
          setError("No valid changes to save");
          setIsSaving(false);
          return;
        }

        // Update all jobs with both requirements and actual_cost_per_m
        const result = await bulkUpdateJobsWithProgress(updates, (current, total) => {
          setSaveProgress({ current, total });
        });

        setSaveResult({
          success: result.success.length,
          failures: result.failures,
        });

        if (result.failures.length === 0) {
          // All successful - refresh and close after a short delay
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        }
      } else {
        // Handle date updates - update job records
        const updates = validEdits.map(([jobId, edits]) => ({
          id: jobId,
          data: edits as Partial<Job>,
        }));

        const result = await bulkUpdateJobsWithProgress(updates, (current, total) => {
          setSaveProgress({ current, total });
        });

        setSaveResult({
          success: result.success.length,
          failures: result.failures,
        });

        if (result.failures.length === 0) {
          // All successful - refresh and close after a short delay
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
        }
      }
    } catch (err) {
      console.error("[DataHealthBulkFixModal] Error saving:", err);
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  // Get facility name
  const getFacilityName = (facilitiesId: number | undefined): string => {
    switch (facilitiesId) {
      case 1:
        return "Bolingbrook";
      case 2:
        return "Lemont";
      case 3:
        return "Shakopee";
      default:
        return "Unknown";
    }
  };

  if (!isOpen) return null;

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
            <div className="p-2 bg-orange-100 rounded-lg">
              <IconComponent className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {config.title}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {config.description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={isSaving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <span className="ml-3 text-gray-600">Loading jobs...</span>
            </div>
          ) : error && !saveResult ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              {error}
            </div>
          ) : saveResult ? (
            <div className="space-y-4">
              {saveResult.success > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-green-700">
                    Successfully updated {saveResult.success} job{saveResult.success !== 1 ? "s" : ""}
                  </span>
                </div>
              )}
              {saveResult.failures.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                    <AlertCircle className="w-5 h-5" />
                    Failed to update {saveResult.failures.length} job{saveResult.failures.length !== 1 ? "s" : ""}
                  </div>
                  <ul className="text-sm text-red-600 space-y-1 ml-7">
                    {saveResult.failures.map((f) => (
                      <li key={f.jobId}>
                        Job ID {f.jobId}: {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No jobs found with this issue.</p>
            </div>
          ) : (
            <>
              {/* Quick Actions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex flex-wrap items-center gap-3">
                  {isCostIssue ? (
                    <>
                      <span className="text-sm font-medium text-blue-800">
                        Quick Action: Set all costs to $
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={bulkCost}
                        onChange={(e) => setBulkCost(e.target.value)}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="px-3 py-1.5 border border-blue-300 rounded-lg text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleApplyBulkCost}
                        disabled={!bulkCost || parseFloat(bulkCost) < 0}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Apply to All
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-blue-800">
                        Quick Action: Set all {config.primaryField === "due_date" ? "due dates" : "start dates"} to
                      </span>
                      <input
                        type="date"
                        value={bulkDate}
                        onChange={(e) => setBulkDate(e.target.value)}
                        className="px-3 py-1.5 border border-blue-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={handleApplyBulkDate}
                        disabled={!bulkDate}
                        className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Apply to All
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Search - Only for missing_cost_per_m */}
              {isCostIssue && (
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search jobs by job number, client, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Jobs Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      {isCostIssue && (
                        <th className="px-2 py-3 w-8"></th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Job #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        Facility
                      </th>
                      {isCostIssue ? (
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                          Cost/M
                        </th>
                      ) : (
                        <>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Start Date
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            Due Date
                          </th>
                        </>
                      )}
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {jobs.map((job) => {
                      const isValid = isJobValid(job);
                      const isEdited = editedJobs.has(job.id);
                      const isExpanded = expandedJobs.has(job.id);
                      const requirements = isCostIssue ? getJobRequirements(job) : [];

                      return (
                        <React.Fragment key={job.id}>
                          <tr
                            onClick={() => isCostIssue && toggleJobExpanded(job.id)}
                            className={`${
                              isExpanded
                                ? "bg-blue-50"
                                : isEdited && isValid
                                ? "bg-green-50"
                                : !isValid
                                ? "bg-red-50"
                                : "bg-white"
                            } ${isCostIssue ? "cursor-pointer hover:bg-gray-50" : ""}`}
                          >
                            {isCostIssue && (
                              <td className="px-2 py-3 w-8">
                                <ChevronRight
                                  className={`w-4 h-4 text-gray-400 transition-transform ${
                                    isExpanded ? "rotate-90" : ""
                                  }`}
                                />
                              </td>
                            )}
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {job.job_number}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {job.client || job.sub_client || "—"}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {getFacilityName(job.facilities_id)}
                            </td>
                            {isCostIssue ? (
                              <td className="px-4 py-3">
                                <div className="flex items-center">
                                  <span className="text-gray-500 mr-1">$</span>
                                  <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="0.00"
                                    value={getCostValue(job.id) ?? ""}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                      handleCostChange(job.id, e.target.value)
                                    }
                                    onWheel={(e) => e.currentTarget.blur()}
                                    className={`px-2 py-1 border rounded text-sm w-24 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      !isValid
                                        ? "border-red-300 bg-red-50"
                                        : "border-gray-300"
                                    }`}
                                  />
                                </div>
                              </td>
                            ) : (
                              <>
                                <td className="px-4 py-3">
                                  <input
                                    type="date"
                                    value={formatDateForInput(getJobValue(job, "start_date"))}
                                    onChange={(e) =>
                                      handleDateChange(job.id, "start_date", e.target.value)
                                    }
                                    className={`px-2 py-1 border rounded text-sm w-full max-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      issueType === "missing_start_date" && !getJobValue(job, "start_date")
                                        ? "border-red-300 bg-red-50"
                                        : issueType === "start_is_after_due"
                                        ? "border-orange-300"
                                        : "border-gray-300"
                                    }`}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <input
                                    type="date"
                                    value={formatDateForInput(getJobValue(job, "due_date"))}
                                    onChange={(e) =>
                                      handleDateChange(job.id, "due_date", e.target.value)
                                    }
                                    className={`px-2 py-1 border rounded text-sm w-full max-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                      issueType === "missing_due_dates" && !getJobValue(job, "due_date")
                                        ? "border-red-300 bg-red-50"
                                        : issueType === "start_is_after_due"
                                        ? "border-orange-300"
                                        : "border-gray-300"
                                    }`}
                                  />
                                </td>
                              </>
                            )}
                            <td className="px-4 py-3 text-center">
                              {isValid ? (
                                <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" />
                              ) : (
                                <AlertCircle className="w-5 h-5 text-red-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                          {/* Expanded Services Row */}
                          {isCostIssue && isExpanded && (
                            <tr className="bg-gray-50">
                              <td colSpan={6} className="px-4 py-3">
                                <div className="ml-6 space-y-3">
                                  {/* Header with Edit/Save/Cancel Buttons */}
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-500 uppercase">
                                      Services
                                    </div>
                                    {editingJobIds.has(job.id) ? (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            cancelEditingServices(job.id);
                                          }}
                                          disabled={savingJobIds.has(job.id)}
                                          className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            saveInlineServices(job.id);
                                          }}
                                          disabled={savingJobIds.has(job.id)}
                                          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                          {savingJobIds.has(job.id) ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              Saving...
                                            </>
                                          ) : (
                                            <>
                                              <Save className="w-3.5 h-3.5" />
                                              Save Services
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          startEditingServices(job);
                                        }}
                                        className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                        Edit Services
                                      </button>
                                    )}
                                  </div>

                                  {/* Inline Editing Mode */}
                                  {editingJobIds.has(job.id) ? (
                                    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                                      {(editingRequirements.get(job.id) || []).map((requirement, reqIdx) => (
                                        <div
                                          key={reqIdx}
                                          className="border border-gray-200 rounded-lg p-4 bg-white space-y-4"
                                        >
                                          <div className="flex items-center justify-between">
                                            <h5 className="font-semibold text-gray-900 text-sm">
                                              Service {reqIdx + 1}
                                            </h5>
                                            {(editingRequirements.get(job.id) || []).length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => removeInlineRequirement(job.id, reqIdx)}
                                                className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Remove
                                              </button>
                                            )}
                                          </div>
                                          <DynamicRequirementFields
                                            requirement={requirement}
                                            onChange={(field, value) =>
                                              handleInlineRequirementChange(job.id, reqIdx, field, value)
                                            }
                                            disableRequired={true}
                                          />
                                        </div>
                                      ))}
                                      <button
                                        type="button"
                                        onClick={() => addInlineRequirement(job.id)}
                                        className="w-full px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-sm"
                                      >
                                        <Plus className="w-4 h-4" />
                                        Add Another Service
                                      </button>
                                    </div>
                                  ) : (
                                    /* Read-only Service List with Cost Breakdown */
                                    <>
                                      {requirements.length > 0 ? (
                                        <>
                                          {requirements.map((req, idx) => {
                                            const costs = getRequirementCosts(req);
                                            const hasNoCost = costs.total === 0;
                                            return (
                                              <div
                                                key={idx}
                                                className={`py-3 border-b border-gray-200 last:border-0 ${hasNoCost ? "bg-yellow-50 -mx-2 px-2 rounded" : ""}`}
                                              >
                                                <div className="flex items-center justify-between mb-2">
                                                  <span className="text-sm font-medium text-gray-700">
                                                    {req.process_type || "Unknown Service"}
                                                  </span>
                                                  {hasNoCost ? (
                                                    <span className="text-sm font-medium text-yellow-600 italic">
                                                      No price set
                                                    </span>
                                                  ) : (
                                                    <span className="text-sm font-semibold text-gray-900">
                                                      ${costs.total.toFixed(2)}/M
                                                    </span>
                                                  )}
                                                </div>

                                                {/* Cost Breakdown */}
                                                {!hasNoCost && (
                                                  <div className="ml-4 space-y-1 text-xs text-gray-500">
                                                    {costs.baseCost > 0 && (
                                                      <div className="flex justify-between">
                                                        <span>Base Price/M</span>
                                                        <span>${costs.baseCost.toFixed(2)}</span>
                                                      </div>
                                                    )}
                                                    {costs.additionalCosts.map((item, costIdx) => (
                                                      <div key={costIdx} className="flex justify-between text-blue-600">
                                                        <span>{item.name}</span>
                                                        <span>+${item.cost.toFixed(2)}</span>
                                                      </div>
                                                    ))}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}

                                          {/* Total Cost Summary */}
                                          {(() => {
                                            const totalCost = calculateTotalCostFromRequirements(requirements);
                                            const servicesWithPricing = requirements.filter(req => getRequirementCosts(req).total > 0).length;
                                            return (
                                              <div className="pt-3 mt-2 border-t border-gray-300">
                                                <div className="flex justify-between items-center">
                                                  <span className="text-sm font-semibold text-gray-700">
                                                    {servicesWithPricing > 0
                                                      ? `Total Cost/M (${servicesWithPricing} of ${requirements.length} service${requirements.length !== 1 ? "s" : ""} priced)`
                                                      : `${requirements.length} service${requirements.length !== 1 ? "s" : ""} - no pricing`
                                                    }
                                                  </span>
                                                  {totalCost > 0 ? (
                                                    <span className="text-sm font-bold text-blue-600">
                                                      ${totalCost.toFixed(2)}
                                                    </span>
                                                  ) : (
                                                    <span className="text-sm font-medium text-yellow-600">
                                                      Click Edit to add prices
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })()}
                                        </>
                                      ) : (
                                        <div className="text-sm text-gray-400 italic">
                                          No services defined for this job
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              <div className="mt-4 flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Total: <strong>{jobs.length}</strong> jobs
                </span>
                {validEditedCount > 0 && (
                  <span className="text-green-600">
                    <CheckCircle2 className="w-4 h-4 inline mr-1" />
                    <strong>{validEditedCount}</strong> ready to save
                  </span>
                )}
                {invalidCount > 0 && (
                  <span className="text-red-600">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    <strong>{invalidCount}</strong> still need fixing
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div>
            {isSaving && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving {saveProgress.current} of {saveProgress.total}...
              </div>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {saveResult ? "Close" : "Cancel"}
            </button>
            {!saveResult && jobs.length > 0 && (
              <button
                onClick={handleSave}
                disabled={isSaving || validEditedCount === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Save ${validEditedCount} Change${validEditedCount !== 1 ? "s" : ""}`
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
