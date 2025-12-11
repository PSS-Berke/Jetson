"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import SmartClientSelect from "./SmartClientSelect";
import FacilityToggle from "./FacilityToggle";
import DynamicRequirementFields from "./DynamicRequirementFields";
import RecommendedMachines from "./RecommendedMachines";
import { updateJob, deleteJob, getToken } from "@/lib/api";
import { type ParsedJob } from "@/hooks/useJobs";
import { getProcessTypeConfig } from "@/lib/processTypeConfig";
import Toast from "./Toast";

interface EditJobModalProps {
  isOpen: boolean;
  job: ParsedJob | null;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Requirement {
  process_type: string;
  price_per_m?: string;
  // Dynamic fields based on process type
  [key: string]: string | number | boolean | undefined;
}

interface JobFormData {
  job_number: string;
  clients_id: number | null;
  sub_clients_id: number | null;
  client_name: string;
  sub_client_name: string;
  job_name: string;
  description: string;
  quantity: string;
  csr: string;
  prgm: string;
  facilities_id: number | null;
  start_date: string;
  due_date: string;
  service_type: string;
  pockets: string;
  machines_id: number[];
  requirements: Requirement[];
  weekly_split: number[];
  locked_weeks: boolean[];
  price_per_m: string;
  add_on_charges: string;
  ext_price: string;
  total_billing: string;
}

export default function EditJobModal({
  isOpen,
  job,
  onClose,
  onSuccess,
}: EditJobModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [scheduleType, setScheduleType] = useState<string>("soft schedule"); // "Hard Schedule", "soft schedule", "Cancelled", "projected", "completed"
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showBackwardRedistributeWarning, setShowBackwardRedistributeWarning] =
    useState(false);
  const [pendingRedistribution, setPendingRedistribution] = useState<{
    weekIndex: number;
    newValue: number;
  } | null>(null);
  const [tempWeekQuantity, setTempWeekQuantity] = useState<string>("");
  const [runSaturdays, setRunSaturdays] = useState<boolean>(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [formData, setFormData] = useState<JobFormData>({
    job_number: "",
    clients_id: null,
    sub_clients_id: null,
    client_name: "",
    sub_client_name: "",
    job_name: "",
    description: "",
    quantity: "",
    csr: "",
    prgm: "",
    facilities_id: null,
    start_date: "",
    due_date: "",
    service_type: "insert",
    pockets: "2",
    machines_id: [],
    requirements: [
      {
        process_type: "",
        price_per_m: "",
      },
    ],
    weekly_split: [],
    locked_weeks: [],
    price_per_m: "",
    add_on_charges: "",
    ext_price: "",
    total_billing: "",
  });

  // Initialize form with job data when modal opens
  useEffect(() => {
    if (isOpen && job) {


      let parsedRequirements: Requirement[];
      try {
        if (typeof job.requirements === "string") {
          parsedRequirements = JSON.parse(job.requirements);
        } else if (Array.isArray(job.requirements)) {
          // Map ParsedRequirement[] to Requirement[] - copy all fields dynamically
          parsedRequirements = job.requirements.map((req) => {
            // Create a copy with all fields, removing legacy shifts_id
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
            const { shifts_id, ...rest } = req as any;
            const requirement = {
              process_type: req.process_type || "",
              ...rest,
            };
            return requirement;
          });
        } else {
          parsedRequirements = [{ process_type: "", price_per_m: "" }];
        }

        // Ensure requirements is an array with at least one item
        if (!parsedRequirements || parsedRequirements.length === 0) {
          parsedRequirements = [{ process_type: "", price_per_m: "" }];
        }
        
        // Clean requirements to remove unselected/invalid fields (false, empty, null, undefined)
        // This ensures that fields with false values are removed immediately when the modal opens
        parsedRequirements = parsedRequirements.map((req) => {
          const cleaned: Requirement = {
            process_type: req.process_type,
          };
          
          // Always include price_per_m if it exists
          if (req.price_per_m !== undefined && req.price_per_m !== null && req.price_per_m !== "") {
            cleaned.price_per_m = req.price_per_m;
          }
          
          // Always include id if it exists
          if (req.id !== undefined && req.id !== null) {
            cleaned.id = req.id;
          }
          
          // Process all other fields - only include valid/selected ones
          Object.keys(req).forEach((key) => {
            // Skip fields we've already handled
            if (key === "process_type" || key === "price_per_m" || key === "id") {
              return;
            }
            
            // Skip cost fields - we'll handle them separately
            if (key.endsWith('_cost')) {
              return;
            }
            
            const value = req[key];
            
            // Helper to check if value is valid - be very strict, same as isFieldValueValid
            const isValid = (val: any): boolean => {
              if (val === undefined || val === null) return false;
              if (val === false || val === "false" || val === "False" || val === 0 || val === "0") return false;
              if (typeof val === "string") {
                const trimmed = val.trim();
                if (trimmed === "" || trimmed.toLowerCase() === "false") return false;
                return true;
              }
              if (typeof val === "number") {
                return val !== 0;
              }
              return true;
            };
            
            // Only include the field if it's valid/selected
            if (isValid(value)) {
              cleaned[key] = value;
              
              // If this field has a corresponding _cost field, include it only if the base field is valid
              const costKey = `${key}_cost`;
              if (req[costKey] !== undefined && req[costKey] !== null) {
                const costValue = req[costKey];
                // Include cost field if it has a valid value
                if (costValue !== "" && costValue !== null && costValue !== undefined) {
                  cleaned[costKey] = costValue;
                }
              }
            }
            // If field is not valid, don't include it AND don't include its _cost field
          });
          
          return cleaned;
        });
        
      } catch (error) {
        console.error("Failed to parse requirements:", error);
        parsedRequirements = [{ process_type: "", price_per_m: "" }];
      }

      // Convert timestamps to YYYY-MM-DD format for date inputs
      const formatDate = (timestamp: number | null | undefined) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toISOString().split("T")[0];
      };

      // Helper to safely convert to string, handling both string and number types
      const toStringValue = (value: unknown) => {
        if (value === null || value === undefined) return "";
        return String(value);
      };

      const clientId = job.client?.id || null;
      const clientName = job.client?.name || "";
      const subClientId = null; // sub_client is now just a string, not an object with an id
      const subClientName = job.sub_client || "";

      console.log("EditJobModal - Setting formData with:", {
        clientId,
        clientName,
        subClientId,
        subClientName,
      });

      // Parse weekly_split if it exists
      let weeklySplit: number[] = [];
      let lockedWeeks: boolean[] = [];
      const jobWithSplit = job as typeof job & {
        weekly_split?: number[] | string;
        locked_weeks?: boolean[];
      };
      if (jobWithSplit.weekly_split) {
        if (Array.isArray(jobWithSplit.weekly_split)) {
          weeklySplit = jobWithSplit.weekly_split;
        }
      }
      if (
        jobWithSplit.locked_weeks &&
        Array.isArray(jobWithSplit.locked_weeks)
      ) {
        lockedWeeks = jobWithSplit.locked_weeks;
      } else {
        // Initialize locked_weeks as all false if not present
        lockedWeeks = Array(weeklySplit.length).fill(false);
      }

      const jobWithFields = job as typeof job & {
        price_per_m?: string | number;
        add_on_charges?: string | number;
        ext_price?: string | number;
        total_billing?: string | number;
      };

      // Ensure facilities_id is a proper number or null
      let facilitiesId: number | null = null;
      if (job.facilities_id !== undefined && job.facilities_id !== null) {
        // Convert to number if it's a string
        facilitiesId =
          typeof job.facilities_id === "string"
            ? parseInt(job.facilities_id, 10)
            : job.facilities_id;
      }

      console.log(
        "EditJobModal - facilities_id from job:",
        job.facilities_id,
        "parsed to:",
        facilitiesId,
      );

      // Normalize machine ids so we never try to render raw machine objects
      const normalizeMachineIds = (
        machinesList: unknown,
        machinesIdField: unknown,
      ): number[] => {
        const machineIds = new Set<number>();

        const processEntries = (input: unknown) => {
          if (Array.isArray(input)) {
            input.forEach((item) => {
              if (typeof item === "number") {
                machineIds.add(item);
                return;
              }

              if (
                item &&
                typeof item === "object" &&
                "id" in item &&
                typeof (item as { id?: unknown }).id === "number"
              ) {
                machineIds.add((item as { id: number }).id);
              }
            });
          }
        };

        processEntries(machinesList);

        if (typeof machinesIdField === "string") {
          try {
            const parsed = JSON.parse(machinesIdField);
            processEntries(parsed);
          } catch (error) {
            console.warn(
              "EditJobModal - unable to parse machines_id string",
              error,
            );
          }
        } else {
          processEntries(machinesIdField);
        }

        return Array.from(machineIds);
      };

      const normalizedMachineIds = normalizeMachineIds(
        job.machines,
        (job as typeof job & { machines_id?: unknown }).machines_id,
      );

      setFormData({
        job_number: toStringValue(job.job_number),
        clients_id: clientId,
        sub_clients_id: subClientId,
        client_name: clientName,
        sub_client_name: subClientName,
        job_name: toStringValue(job.job_name),
        description: toStringValue(job.description),
        quantity: toStringValue(job.quantity),
        csr: toStringValue(job.csr),
        prgm: toStringValue(job.prgm),
        facilities_id: facilitiesId,
        start_date: formatDate(job.start_date),
        due_date: formatDate(job.due_date),
        service_type: job.service_type || "insert",
        pockets: "2", // Default value - pockets are defined in requirements
        machines_id: normalizedMachineIds,
        requirements: parsedRequirements,
        weekly_split: weeklySplit,
        locked_weeks: lockedWeeks,
        price_per_m: toStringValue(jobWithFields.price_per_m || ""),
        add_on_charges: toStringValue(jobWithFields.add_on_charges || ""),
        ext_price: toStringValue(jobWithFields.ext_price || ""),
        total_billing: toStringValue(jobWithFields.total_billing || ""),
      });

      // Initialize schedule type from job
      const jobWithSchedule = job as typeof job & {
        schedule_type?: string;
      };
      setScheduleType(jobWithSchedule.schedule_type || "soft schedule");
    }
  }, [isOpen, job]);

  // Calculate weeks and split quantity when dates or quantity changes
  useEffect(() => {
    if (formData.start_date && formData.due_date && formData.quantity) {
      const startDate = new Date(formData.start_date);
      const dueDate = new Date(formData.due_date);
      const quantity = parseInt(formData.quantity);

      if (!isNaN(quantity) && quantity > 0 && dueDate >= startDate) {
        // Calculate number of weeks (ceiling to capture partial weeks)
        const daysDiff =
          Math.ceil(
            (dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1;
        const weeks = Math.ceil(daysDiff / 7);

        if (weeks > 0 && formData.weekly_split.length === 0) {
          // Only auto-calculate if weekly_split is empty (not pre-populated from existing job)
          // Split quantity evenly across weeks
          const baseAmount = Math.floor(quantity / weeks);
          const remainder = quantity % weeks;

          // Create array with base amounts
          const newSplit = Array(weeks).fill(baseAmount);

          // Distribute remainder across first weeks
          for (let i = 0; i < remainder; i++) {
            newSplit[i]++;
          }

          // Initialize locked_weeks as all false
          const newLockedWeeks = Array(weeks).fill(false);

          setFormData((prev) => ({
            ...prev,
            weekly_split: newSplit,
            locked_weeks: newLockedWeeks,
          }));
        }
      }
    }
  }, [
    formData.start_date,
    formData.due_date,
    formData.quantity,
    formData.weekly_split.length,
  ]);

  // Handle quantity changes when weekly_split already exists - respect locked weeks
  useEffect(() => {
    if (formData.weekly_split.length > 0 && formData.quantity) {
      const totalQuantity = parseInt(formData.quantity) || 0;
      const currentTotal = formData.weekly_split.reduce(
        (sum, val) => sum + val,
        0,
      );
      const difference = totalQuantity - currentTotal;

      // Only redistribute if there's a difference and we have unlocked weeks
      if (difference !== 0) {
        setFormData((prev) => {
          const newSplit = [...prev.weekly_split];
          const lockedWeeks = prev.locked_weeks;

          // Get indices of all unlocked weeks
          const unlockedIndices = newSplit
            .map((_, idx) => idx)
            .filter((idx) => !lockedWeeks[idx]);

          if (unlockedIndices.length > 0) {
            // Calculate base adjustment per unlocked week
            const baseAdjustment = Math.floor(
              difference / unlockedIndices.length,
            );
            const remainder = difference % unlockedIndices.length;

            // Apply adjustments to unlocked weeks
            unlockedIndices.forEach((idx, position) => {
              let adjustment = baseAdjustment;

              // Distribute remainder across first few weeks
              if (position < Math.abs(remainder)) {
                adjustment += remainder > 0 ? 1 : -1;
              }

              // Apply adjustment, ensuring non-negative values
              newSplit[idx] = Math.max(0, newSplit[idx] + adjustment);
            });

            return { ...prev, weekly_split: newSplit };
          }

          return prev;
        });
      }
    }
  }, [formData.quantity]);

  const adjustTextareaHeight = (textarea: HTMLTextAreaElement) => {
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    // Calculate the height needed (minimum 3 rows)
    // Get computed line height or use a reasonable default
    const lineHeight = parseInt(window.getComputedStyle(textarea).lineHeight) || 24;
    const padding = parseInt(window.getComputedStyle(textarea).paddingTop) + 
                    parseInt(window.getComputedStyle(textarea).paddingBottom) || 16;
    const minHeight = (3 * lineHeight) + padding;
    const newHeight = Math.max(minHeight, textarea.scrollHeight);
    textarea.style.height = `${newHeight}px`;
  };

  // Helper function to format currency values
  const formatCurrency = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === "") return "N/A";
    const numValue = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(numValue)) return String(value);
    return `$${numValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Helper function to check if a field is a cost field
  const isCostField = (fieldName: string): boolean => {
    return (
      fieldName === "price_per_m" ||
      fieldName.endsWith("_cost") ||
      fieldName.toLowerCase().includes("price") ||
      fieldName.toLowerCase().includes("cost")
    );
  };

  // Adjust description textarea height on mount and when description changes
  useEffect(() => {
    if (descriptionTextareaRef.current) {
      adjustTextareaHeight(descriptionTextareaRef.current);
    }
  }, [formData.description, isOpen]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    
    // Auto-resize description textarea
    if (e.target.name === "description" && e.target instanceof HTMLTextAreaElement) {
      adjustTextareaHeight(e.target);
    }
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Remove commas from the input value before storing
    const cleanedValue = e.target.value.replace(/,/g, "");
    setFormData({
      ...formData,
      quantity: cleanedValue,
    });
  };

  const handleClientChange = (clientId: number, clientName: string) => {
    setFormData({
      ...formData,
      clients_id: clientId,
      client_name: clientName,
    });
  };

  const handleSubClientChange = (clientId: number, clientName: string) => {
    setFormData({
      ...formData,
      sub_clients_id: clientId,
      sub_client_name: clientName,
    });
  };

  const handleRequirementChange = (
    requirementIndex: number,
    field: keyof Requirement,
    value: string | number | boolean,
  ) => {
    console.log('[EditJobModal] handleRequirementChange called:', { requirementIndex, field, value, valueType: typeof value });
    
    setFormData((prev) => {
      const updated = {
        ...prev,
        requirements: prev.requirements.map((req, idx) => {
          if (idx !== requirementIndex) return req;
          
          // Check if the value is invalid/unselected - be very strict
          const isInvalid = 
            value === undefined || 
            value === null || 
            value === false || 
            value === "false" || 
            value === "False" ||
            value === 0 || 
            value === "0" ||
            (typeof value === "string" && (value.trim() === "" || value.trim().toLowerCase() === "false"));
          
          console.log('[EditJobModal] Field value check:', { field, value, isInvalid });
          
          // If the value is invalid, remove the field entirely (and set its cost field to 0)
          if (isInvalid) {
            // Create a new object without the field
            const rest: Partial<Requirement> = {};
            Object.keys(req).forEach((key) => {
              if (key !== String(field)) {
                rest[key as keyof Requirement] = req[key as keyof Requirement];
              }
            });

            // Always set the associated cost field to 0 when unchecking a boolean/field
            // This ensures when user re-checks the field, the cost starts at 0
            const costFieldName = `${String(field)}_cost`;
            rest[costFieldName as keyof Requirement] = "0" as any;  // Use string "0" to match input format
            console.log('[EditJobModal] Removed field and set cost to "0":', {
              field,
              costFieldName,
              oldCostValue: req[costFieldName as keyof Requirement],
              newCostValue: "0",
              remainingKeys: Object.keys(rest)
            });

            return rest as Requirement;
          }
          
          // Otherwise, update the field with the new value
          return { ...req, [field]: value };
        }),
      };
      
      console.log('[EditJobModal] Updated requirements:', updated.requirements);
      return updated;
    });
  };

  const addRequirement = () => {
    setFormData((prev) => ({
      ...prev,
      requirements: [
        ...prev.requirements,
        {
          process_type: "",
          price_per_m: "",
        },
      ],
    }));
  };

  const removeRequirement = (requirementIndex: number) => {
    if (formData.requirements.length > 1) {
      setFormData((prev) => ({
        ...prev,
        requirements: prev.requirements.filter(
          (_, idx) => idx !== requirementIndex,
        ),
      }));
    }
  };

  // Machine selection handlers
  const handleSelectMachine = (machineId: number) => {
    setFormData((prev) => ({
      ...prev,
      machines_id: [...prev.machines_id, machineId],
    }));
  };

  const handleDeselectMachine = (machineId: number) => {
    setFormData((prev) => ({
      ...prev,
      machines_id: prev.machines_id.filter((id) => id !== machineId),
    }));
  };

  const handleWeeklySplitChange = (weekIndex: number, value: string) => {
    // Remove commas from the input value before parsing
    const cleanedValue = value.replace(/,/g, "");
    const newValue = parseInt(cleanedValue) || 0;

    performRedistribution(weekIndex, newValue, false);
  };

  const performRedistribution = (
    weekIndex: number,
    newValue: number,
    allowBackward: boolean,
  ) => {
    setFormData((prev) => {
      const totalQuantity = parseInt(prev.quantity) || 0;
      const newSplit = [...prev.weekly_split];
      const newLockedWeeks = [...prev.locked_weeks];

      // Update the changed week and lock it
      newSplit[weekIndex] = newValue;
      newLockedWeeks[weekIndex] = true;

      // Calculate how much quantity is left to distribute
      const currentTotal = newSplit.reduce((sum, val) => sum + val, 0);
      const difference = totalQuantity - currentTotal;

      // If there's a difference, redistribute it
      if (difference !== 0) {
        // Get indices of unlocked weeks AFTER the changed week
        const unlockedWeeksAfter = newSplit
          .map((_, idx) => idx)
          .filter((idx) => idx > weekIndex && !newLockedWeeks[idx]);

        // If no unlocked weeks after, check if we should redistribute backward
        if (unlockedWeeksAfter.length === 0 && !allowBackward) {
          // Show warning and store pending redistribution
          setPendingRedistribution({ weekIndex, newValue });
          setTempWeekQuantity(newValue.toString());
          setShowBackwardRedistributeWarning(true);
          return prev; // Don't update yet
        }

        // Determine which weeks to redistribute to
        let targetWeekIndices = unlockedWeeksAfter;
        if (unlockedWeeksAfter.length === 0 && allowBackward) {
          // Get all unlocked weeks (forward and backward)
          targetWeekIndices = newSplit
            .map((_, idx) => idx)
            .filter((idx) => idx !== weekIndex && !newLockedWeeks[idx]);
        }

        if (targetWeekIndices.length > 0) {
          // Calculate base adjustment per week
          const baseAdjustment = Math.floor(
            difference / targetWeekIndices.length,
          );
          const remainder = difference % targetWeekIndices.length;

          // Apply adjustments to target weeks
          targetWeekIndices.forEach((idx, position) => {
            // Add base adjustment
            let adjustment = baseAdjustment;

            // Distribute remainder across first few weeks
            if (position < Math.abs(remainder)) {
              adjustment += remainder > 0 ? 1 : -1;
            }

            // Apply adjustment, ensuring non-negative values
            newSplit[idx] = Math.max(0, newSplit[idx] + adjustment);
          });
        }
      }

      return { ...prev, weekly_split: newSplit, locked_weeks: newLockedWeeks };
    });
  };

  const handleBackwardRedistributeConfirm = () => {
    if (pendingRedistribution) {
      const cleanedValue = tempWeekQuantity.replace(/,/g, "");
      const finalValue = parseInt(cleanedValue) || 0;
      performRedistribution(pendingRedistribution.weekIndex, finalValue, true);
      setPendingRedistribution(null);
      setTempWeekQuantity("");
    }
    setShowBackwardRedistributeWarning(false);
  };

  const handleBackwardRedistributeCancel = () => {
    setPendingRedistribution(null);
    setTempWeekQuantity("");
    setShowBackwardRedistributeWarning(false);
  };

  const handleUnlockWeek = (weekIndex: number) => {
    setFormData((prev) => {
      const newLockedWeeks = [...prev.locked_weeks];
      newLockedWeeks[weekIndex] = false;
      return { ...prev, locked_weeks: newLockedWeeks };
    });
  };

  const handleUnlockWeekInDialog = (weekIndex: number) => {
    // Unlock week in the actual form data so it's available for redistribution
    handleUnlockWeek(weekIndex);
  };

  const handleTempQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = e.target.value.replace(/,/g, "");
    setTempWeekQuantity(cleanedValue);
  };

  // Calculate redistribution preview for dialog
  const calculateRedistributionPreview = () => {
    if (!pendingRedistribution) return null;

    const cleanedValue = tempWeekQuantity.replace(/,/g, "");
    const proposedValue = parseInt(cleanedValue) || 0;
    const totalQuantity = parseInt(formData.quantity) || 0;
    const weekIndex = pendingRedistribution.weekIndex;

    // Calculate what the split would look like
    const tempSplit = [...formData.weekly_split];
    tempSplit[weekIndex] = proposedValue;

    const currentTotal = tempSplit.reduce((sum, val) => sum + val, 0);
    const difference = totalQuantity - currentTotal;

    // Get unlocked weeks before the adjusted week
    const unlockedBefore = formData.weekly_split
      .map((_, idx) => idx)
      .filter((idx) => idx < weekIndex && !formData.locked_weeks[idx]);

    const lockedBefore = formData.weekly_split
      .map((val, idx) => ({ idx, val }))
      .filter(({ idx }) => idx < weekIndex && formData.locked_weeks[idx]);

    const canRedistribute = unlockedBefore.length > 0;

    // Calculate preview of changes
    const preview: { weekIndex: number; oldValue: number; newValue: number }[] =
      [];

    if (canRedistribute) {
      const baseAdjustment = Math.floor(difference / unlockedBefore.length);
      const remainder = difference % unlockedBefore.length;

      unlockedBefore.forEach((idx, position) => {
        let adjustment = baseAdjustment;
        if (position < Math.abs(remainder)) {
          adjustment += remainder > 0 ? 1 : -1;
        }
        const newValue = Math.max(0, tempSplit[idx] + adjustment);
        preview.push({ weekIndex: idx, oldValue: tempSplit[idx], newValue });
      });
    }

    return {
      difference,
      unlockedBefore,
      lockedBefore,
      canRedistribute,
      preview,
      hasNegativeValues: preview.some((p) => p.newValue < 0),
    };
  };

  const getWeeklySplitSum = () => {
    return formData.weekly_split.reduce((sum, val) => sum + val, 0);
  };

  const getWeeklySplitDifference = () => {
    const quantity = parseInt(formData.quantity) || 0;
    return getWeeklySplitSum() - quantity;
  };

  // Helper function to check if a field value is valid/selected
  // Returns true if the field should be considered "selected" and its cost should be included
  // Returns false for ANY false value - be very strict
  const isFieldValueValid = (value: any): boolean => {
    if (value === undefined || value === null) return false;
    
    // Handle boolean values - only true is valid, everything else is false
    if (value === false || value === "false" || value === "False" || value === 0 || value === "0") return false;
    if (value === true || value === "true" || value === "True" || value === 1 || value === "1") return true;
    
    // Handle strings - must be non-empty and not "false"
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" || trimmed.toLowerCase() === "false") return false;
      return true;
    }
    
    // Handle numbers - must be non-zero
    if (typeof value === "number") {
      return value !== 0;
    }
    
    return true;
  };

  // Helper function to calculate additional costs, only including costs for fields that are actually selected
  // A cost field (e.g., "some_field_cost") should only be included if its base field (e.g., "some_field") is valid/selected
  const calculateAdditionalCosts = (req: Requirement, quantity: number): number => {
    return Object.keys(req)
      .filter(key => key.endsWith('_cost'))
      .reduce((costTotal, costKey) => {
        // Get the base field name (remove _cost suffix)
        const baseFieldName = costKey.replace('_cost', '');
        const baseFieldValue = req[baseFieldName];
        
        // Only include cost if the base field is valid/selected
        if (!isFieldValueValid(baseFieldValue)) {
          return costTotal;
        }
        
        const rawValue = req[costKey as keyof typeof req];
        let costValue = 0;
        if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
          const parsed = parseFloat(String(rawValue));
          costValue = isNaN(parsed) ? 0 : parsed;
        }
        // Additional costs are per 1000, so multiply by quantity/1000
        return costTotal + (quantity / 1000) * costValue;
      }, 0);
  };

  // Helper function to clean a requirement by removing unselected/invalid fields
  // This ensures that unselected fields (false, empty, null, undefined) are completely omitted from the payload
  const cleanRequirement = (req: Requirement): Requirement => {
    // process_type is required and should always be present (we only clean validated requirements)
    const cleaned: Requirement = {
      process_type: req.process_type,
    };
    
    // Always include price_per_m if it exists (even if 0, as it might be intentional)
    if (req.price_per_m !== undefined && req.price_per_m !== null && req.price_per_m !== "") {
      cleaned.price_per_m = req.price_per_m;
    }
    
    // Always include id if it exists
    if (req.id !== undefined && req.id !== null) {
      cleaned.id = req.id;
    }
    
    // Process all other fields
    Object.keys(req).forEach((key) => {
      // Skip fields we've already handled
      if (key === "process_type" || key === "price_per_m" || key === "id") {
        return;
      }
      
      // Skip cost fields - we'll handle them separately
      if (key.endsWith('_cost')) {
        return;
      }
      
      const value = req[key];
      
      // Only include the field if it's valid/selected
      if (isFieldValueValid(value)) {
        cleaned[key] = value;
        
        // If this field has a corresponding _cost field, include it only if the base field is valid
        const costKey = `${key}_cost`;
        if (req[costKey] !== undefined && req[costKey] !== null) {
          const costValue = req[costKey];
          // Include cost field if it has a valid value (even 0 might be intentional, but empty string/null should be excluded)
          if (costValue !== "" && costValue !== null && costValue !== undefined) {
            cleaned[costKey] = costValue;
          }
        }
      }
      // If field is not valid, don't include it AND don't include its _cost field
    });
    
    return cleaned;
  };

  // Helper function to filter out unselected/invalid requirements
  // A requirement is valid if it has a process_type and at least one other field filled
  const getValidRequirements = (requirements: Requirement[]): Requirement[] => {
    return requirements.filter((req) => {
      // Must have a process_type
      if (!req.process_type || req.process_type === "") {
        return false;
      }

      // Must have at least one other field filled (besides process_type, price_per_m, id, and cost fields)
      const fieldCount = Object.keys(req).filter(
        (key) =>
          key !== "process_type" &&
          key !== "price_per_m" &&
          key !== "id" &&
          !key.endsWith('_cost') && // Exclude cost fields from the count
          req[key] !== undefined &&
          req[key] !== null &&
          req[key] !== "" &&
          isFieldValueValid(req[key]),
      ).length;

      return fieldCount > 0;
    });
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      // Reset schedule type to soft schedule when entering review step
      if (currentStep === 2) {
        setScheduleType("soft schedule");
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Only allow submission on step 3 (review step) and if explicitly allowed
    if (currentStep !== 3 || !canSubmit) {
      return;
    }

    setCanSubmit(false); // Reset the flag
    setSubmitting(true);

    try {
      // Convert date strings to timestamps
      const startDateTimestamp: number | undefined = formData.start_date
        ? new Date(formData.start_date).getTime()
        : undefined;
      const dueDateTimestamp: number | undefined = formData.due_date
        ? new Date(formData.due_date).getTime()
        : undefined;


      // Filter to only valid requirements (those with process_type and at least one field)
      const validRequirements = getValidRequirements(formData.requirements);
      
      // Clean each requirement to remove unselected fields (false, empty, null, undefined)
      // This ensures unselected fields are completely omitted from the POST request
      const cleanedRequirements = validRequirements.map(req => cleanRequirement(req));

      // Calculate total billing from valid requirements only
      const quantity = parseInt(formData.quantity) || 0;
      const calculatedRevenue = cleanedRequirements.reduce((total, req) => {
        const pricePerM = parseFloat(String(req.price_per_m || "0")) || 0;

        // Calculate additional field costs (only for selected fields)
        const additionalCosts = calculateAdditionalCosts(req, quantity);

        return total + (quantity / 1000) * pricePerM + additionalCosts;
      }, 0);

      const addOnCharges = parseFloat(String(formData.add_on_charges || "0")) || 0;
      const calculatedTotalBilling = calculatedRevenue + addOnCharges;
      const actualPricePerM =
        quantity > 0 ? calculatedTotalBilling / (quantity / 1000) : null;

      const payload: Partial<{
        jobs_id: number;
        job_number: string;
        service_type: string;
        quantity: number;
        description: string;
        start_date: number;
        due_date: number;
        time_estimate: number | null;
        clients_id: number;
        sub_clients_id: number;
        machines_id: string;
        requirements: string;
        job_name: string;
        prgm: string;
        csr: string;
        facilities_id: number;
        price_per_m: string;
        add_on_charges: string;
        ext_price: string;
        total_billing: string;
        schedule_type: string;
        actual_cost_per_m: number | null;
      }> = {
        jobs_id: job.id,
        job_number: formData.job_number,
        service_type: formData.service_type,
        quantity: quantity,
        description: formData.description,
        time_estimate: null,
        clients_id: formData.clients_id || 0,
        machines_id: JSON.stringify(formData.machines_id),
        requirements: JSON.stringify(cleanedRequirements),
        job_name: formData.job_name,
        prgm: formData.prgm,
        csr: formData.csr,
        price_per_m: formData.price_per_m || "0",
        add_on_charges: addOnCharges.toString(),
        ext_price: formData.ext_price || "0",
        total_billing: calculatedTotalBilling.toString(),
        schedule_type: scheduleType || "soft schedule",
        actual_cost_per_m:
          actualPricePerM !== null && !Number.isNaN(actualPricePerM)
            ? actualPricePerM
            : null,
        // Include start_date - convert to timestamp or use existing
        start_date: startDateTimestamp && startDateTimestamp > 0 ? startDateTimestamp : job.start_date,
        // Include due_date - convert to timestamp or use existing
        due_date: dueDateTimestamp && dueDateTimestamp > 0 ? dueDateTimestamp : job.due_date,
        // Include facilities_id whether it was edited or not
        facilities_id: formData.facilities_id !== null ? formData.facilities_id : job.facilities_id,
      };

      // Include sub_clients_id if available (either from form or if it exists in job)
      if (formData.sub_clients_id !== null) {
        payload.sub_clients_id = formData.sub_clients_id;
      }

      await updateJob(job.id, payload);

      // Auto-sync job_cost_entry from valid requirements only
      try {
        const { syncJobCostEntryFromRequirements } = await import("@/lib/api");
        // Use start_date from payload (timestamp) or fall back to existing job start_date
        const startDateForSync =
          payload.start_date || new Date(job.start_date).getTime();
        await syncJobCostEntryFromRequirements(
          job.id,
          JSON.stringify(cleanedRequirements),
          startDateForSync,
          payload.facilities_id,
        );
        console.log("[EditJobModal] Job cost entry synced successfully");
      } catch (costError) {
        console.error(
          "[EditJobModal] Failed to sync job cost entry (non-blocking):",
          costError,
        );
        // Don't fail job update if cost entry sync fails
      }

      setCurrentStep(1);
      setShowSuccessToast(true);

      // Delay closing to show toast
      setTimeout(() => {
        onClose();

        // Call success callback to refresh jobs list
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (error) {
      console.error("Error updating job:", error);
      alert("Failed to update job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  const handleDelete = async () => {
    if (!job) return;

    setDeleting(true);
    try {
      await deleteJob(job.id);

      setShowDeleteConfirm(false);
      setShowSuccessToast(true);

      // Delay closing to show toast
      setTimeout(() => {
        onClose();

        // Call success callback to refresh jobs list
        if (onSuccess) {
          onSuccess();
        }
      }, 500);
    } catch (error) {
      console.error("Error deleting job:", error);
      alert("Failed to delete job. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-bold text-[var(--dark-blue)]">
            Edit Job #{job.job_number}
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Delete
            </button>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-[var(--border)]">
          {(() => {
            const steps = [1, 2, 3]; // Job Details -> Services -> Review

            return steps.map((step, index) => (
              <div
                key={step}
                className="flex items-center"
                style={{ flex: index === steps.length - 1 ? "0 1 auto" : "1 1 0%" }}
              >
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${step === currentStep
                      ? "bg-[#EF3340] text-white"
                      : step < currentStep
                        ? "bg-[#2E3192] text-white"
                        : "bg-gray-200 text-gray-500"
                      }`}
                  >
                    {step < currentStep ? "✓" : step === 0 ? "•" : step}
                  </div>
                  <div className="ml-3">
                    <div
                      className={`text-xs font-medium whitespace-nowrap ${step === currentStep
                        ? "text-[#EF3340]"
                        : step < currentStep
                          ? "text-[#2E3192]"
                          : "text-gray-500"
                        }`}
                    >
                      {step === 1 && "Job Details"}
                      {step === 2 && "Services"}
                      {step === 3 && "Review"}
                    </div>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 ${step < currentStep ? "bg-[#2E3192]" : "bg-gray-200"
                      }`}
                  />
                )}
              </div>
            ));
          })()}
        </div>

        {/* Form Content */}
        <form
          onSubmit={handleSubmit}
          onKeyDown={(e) => {
            // Prevent Enter key from submitting form on steps 1 and 2
            if (
              e.key === "Enter" &&
              currentStep !== 3 &&
              e.target instanceof HTMLInputElement
            ) {
              e.preventDefault();
            }
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {/* Step 1: Job Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Client
                  </label>
                  <SmartClientSelect
                    value={formData.clients_id}
                    onChange={handleClientChange}
                    initialClientName={formData.client_name}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Sub Client
                  </label>
                  <SmartClientSelect
                    value={formData.sub_clients_id}
                    onChange={handleSubClientChange}
                    initialClientName={formData.sub_client_name}
                    required={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Job Name
                  </label>
                  <input
                    type="text"
                    name="job_name"
                    value={formData.job_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="Job name"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Job #
                  </label>
                  <input
                    type="text"
                    name="job_number"
                    value={formData.job_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="e.g., 43"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Facility
                  </label>
                  <FacilityToggle
                    key={`facility-${job.id}-${formData.facilities_id}`}
                    currentFacility={formData.facilities_id}
                    onFacilityChange={(facility) =>
                      setFormData({ ...formData, facilities_id: facility })
                    }
                    showAll={false}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    CSR
                  </label>
                  <input
                    type="text"
                    name="csr"
                    value={formData.csr}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="CSR name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Program Cadence
                  </label>
                  <select
                    name="prgm"
                    value={formData.prgm}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                  >
                    <option value="">Select cadence...</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Monthly">Monthly</option>
                    <option value="One Time">One Time</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    value={formData.start_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Due Date
                  </label>
                  <input
                    type="date"
                    name="due_date"
                    value={formData.due_date}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Quantity
                  </label>
                  <div className="flex gap-4 items-center justify-between">
                    <div className="flex gap-4 items-center flex-1">
                      <input
                        type="text"
                        name="quantity"
                        value={
                          formData.quantity
                            ? parseInt(formData.quantity).toLocaleString()
                            : ""
                        }
                        onChange={handleQuantityChange}
                        className="flex-1 px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        placeholder="e.g., 73"
                      />
                      <div className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          id="runSaturdays"
                          checked={runSaturdays}
                          onChange={(e) => setRunSaturdays(e.target.checked)}
                          className="w-4 h-4 text-[var(--primary-blue)] border-[var(--border)] rounded focus:ring-[var(--primary-blue)]"
                        />
                        <label htmlFor="runSaturdays" className="text-sm text-[var(--text-dark)] whitespace-nowrap">
                          Run Saturdays
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Split Section */}
              {formData.weekly_split.length > 0 && (
                <div className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-[var(--text-dark)]">
                      Weekly Quantity Split ({formData.weekly_split.length}{" "}
                      weeks)
                    </h4>
                    <div
                      className={`text-sm font-semibold ${
                        getWeeklySplitDifference() === 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      Total: {getWeeklySplitSum().toLocaleString()} /{" "}
                      {parseInt(formData.quantity || "0").toLocaleString()}
                      {getWeeklySplitDifference() !== 0 && (
                        <span className="ml-1">
                          ({getWeeklySplitDifference() > 0 ? "+" : ""}
                          {getWeeklySplitDifference()})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {formData.weekly_split.map((amount, index) => {
                      const isLocked = formData.locked_weeks[index];
                      return (
                        <div key={index} className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-medium text-[var(--text-light)]">
                              Week {index + 1}
                            </label>
                            {isLocked && (
                              <button
                                type="button"
                                onClick={() => handleUnlockWeek(index)}
                                className="text-xs hover:opacity-70 transition-opacity flex items-center gap-1"
                                title="Unlock this week to allow auto-redistribution"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#2563eb"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect
                                    x="3"
                                    y="11"
                                    width="18"
                                    height="11"
                                    rx="2"
                                    ry="2"
                                  />
                                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <input
                              type="text"
                              value={amount.toLocaleString()}
                              onChange={(e) =>
                                handleWeeklySplitChange(index, e.target.value)
                              }
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] text-sm ${
                                isLocked
                                  ? "bg-blue-50 border-blue-300 font-semibold pr-8"
                                  : "border-[var(--border)]"
                              }`}
                              title={
                                isLocked
                                  ? "This week is locked and won't be auto-adjusted"
                                  : "Edit to lock this week"
                              }
                            />
                            {isLocked && (
                              <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg
                                  width="16"
                                  height="16"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#2563eb"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect
                                    x="3"
                                    y="11"
                                    width="18"
                                    height="11"
                                    rx="2"
                                    ry="2"
                                  />
                                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {getWeeklySplitDifference() !== 0 && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      ⚠️ Weekly split total must equal the total quantity
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                  Description
                </label>
                <textarea
                  ref={descriptionTextareaRef}
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] resize-none overflow-hidden"
                  placeholder="Job description"
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Step 2: Services */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-6">
                Job Services
              </h3>

              {formData.requirements.map((requirement, index) => (
                <div
                  key={index}
                  className="border border-[var(--border)] rounded-lg p-6 space-y-4"
                >
                  {/* Service Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-[var(--text-dark)]">
                      Service {index + 1}
                    </h4>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeRequirement(index)}
                        className="text-red-500 hover:text-red-700 font-semibold text-sm"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Dynamic Service Fields */}
                  <DynamicRequirementFields
                    requirement={requirement}
                    onChange={(field, value) =>
                      handleRequirementChange(index, field, value)
                    }
                    disableRequired={true}
                  />
                </div>
              ))}

              {/* Add Service Button */}
              <button
                type="button"
                onClick={addRequirement}
                className="w-full px-6 py-3 border-2 border-dashed border-[var(--border)] rounded-lg font-semibold text-[var(--primary-blue)] hover:bg-blue-50 transition-colors"
              >
                + Add Another Service
              </button>

              {/* Recommended Machines - Show for each requirement that has a process type */}
              {formData.requirements.map((requirement, index) => {
                // Only show recommendations if we have:
                // 1. A process type selected
                // 2. Quantity entered
                // 3. Start and due dates set
                if (!requirement.process_type || !formData.quantity || !formData.start_date || !formData.due_date) {
                  return null;
                }

                // Check if there are any filled capability fields (excluding metadata)
                const filledCapabilityFields = Object.keys(requirement).filter(
                  k => k !== 'process_type' && k !== 'price_per_m' && k !== 'id' &&
                       requirement[k] !== undefined && requirement[k] !== null && requirement[k] !== ''
                ).length;

                // Show recommendations if we have at least one capability field filled
                if (filledCapabilityFields === 0) {
                  return null;
                }

                console.log('[EditJobModal] Rendering RecommendedMachines for requirement:', requirement);

                return (
                  <RecommendedMachines
                    key={`recommended-${index}`}
                    processType={requirement.process_type}
                    jobRequirements={requirement}
                    quantity={parseInt(formData.quantity) || 0}
                    startDate={formData.start_date}
                    dueDate={formData.due_date}
                    facilityId={formData.facilities_id}
                    selectedMachineIds={formData.machines_id}
                    onSelectMachine={handleSelectMachine}
                    onDeselectMachine={handleDeselectMachine}
                  />
                );
              })}
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="bg-[var(--bg-alert-info)] border-l-4 border-[var(--primary-blue)] p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[var(--text-dark)]">
                    Job Summary
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(1);
                    }}
                    className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
                  >
                    Edit Details
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-light)]">Job #:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.job_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Facility:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.facilities_id === 1
                        ? "Bolingbrook"
                        : formData.facilities_id === 2
                          ? "Lemont"
                          : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Client:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.client_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Job Name:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.job_name || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">
                      Service Type:
                    </span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.service_type}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">CSR:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.csr || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Quantity:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {parseInt(formData.quantity || "0").toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">
                      Start Date:
                    </span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.start_date || "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Due Date:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.due_date || "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[var(--border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[var(--text-dark)]">
                    Job Services & Pricing1111
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentStep(2);
                    }}
                    className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
                  >
                    Edit Services
                  </button>
                </div>
                {(() => {
                  console.log('[EditJobModal Review Step] formData.requirements:', formData.requirements);
                  console.log('[EditJobModal Review Step] Quantity:', formData.quantity);
                  return null;
                })()}
                {getValidRequirements(formData.requirements).map((req, index) => {
                  const quantity = parseInt(formData.quantity || "0");
                  const pricePerMStr = req.price_per_m;
                  const isValidPrice =
                    pricePerMStr &&
                    pricePerMStr !== "undefined" &&
                    pricePerMStr !== "null";
                  const pricePerM = isValidPrice ? parseFloat(String(pricePerMStr)) : 0;

                  // Debug: Log requirement object
                  console.log('[EditJobModal Review] Full requirement object:', req);
                  console.log('[EditJobModal Review] All keys:', Object.keys(req));
                  const costKeys = Object.keys(req).filter(key => key.endsWith('_cost'));
                  console.log('[EditJobModal Review] Cost keys:', costKeys);

                  // Calculate additional field costs (only for selected fields)
                  const additionalCosts = calculateAdditionalCosts(req, quantity);

                  const baseRevenue = (quantity / 1000) * pricePerM;
                  const requirementTotal = baseRevenue + additionalCosts;

                  console.log('[EditJobModal Review] Price per M:', pricePerM);
                  console.log('[EditJobModal Review] Base revenue:', baseRevenue);
                  console.log('[EditJobModal Review] Total additional costs:', additionalCosts);
                  console.log('[EditJobModal Review] Final total:', requirementTotal);
                  const processConfig = getProcessTypeConfig(req.process_type);

                  return (
                    <div
                      key={index}
                      className="mb-4 pb-4 border-b border-[var(--border)] last:border-b-0"
                    >
                      <div className="text-sm">
                        <div className="mb-2">
                          <span className="text-[var(--text-light)]">
                            Service {index + 1}:{" "}
                          </span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            {processConfig?.label || req.process_type}
                          </span>
                        </div>

                        {/* Display all fields for this requirement */}
                        <div className="grid grid-cols-2 gap-2 mb-2 ml-4">
                          {/* Display basic fields from processConfig */}
                          {processConfig?.fields.map((fieldConfig) => {
                            const fieldValue =
                              req[fieldConfig.name as keyof typeof req];

                            // Skip if field has no value or is invalid (e.g., boolean false)
                            // Be extra strict - if value is false, "false", undefined, null, 0, or empty, don't display
                            if (
                              fieldValue === undefined ||
                              fieldValue === null ||
                              fieldValue === false ||
                              fieldValue === "false" ||
                              fieldValue === "False" ||
                              fieldValue === 0 ||
                              fieldValue === "0" ||
                              (typeof fieldValue === "string" && (fieldValue.trim() === "" || fieldValue.trim().toLowerCase() === "false")) ||
                              !isFieldValueValid(fieldValue)
                            ) {
                              return null;
                            }

                            // Format the value based on field type
                            let displayValue: string;
                            if (fieldConfig.type === "currency") {
                              displayValue = formatCurrency(fieldValue);
                            } else {
                              displayValue = String(fieldValue);
                            }

                            return (
                              <div key={fieldConfig.name} className="text-xs">
                                <span className="text-[var(--text-light)]">
                                  {fieldConfig.label}:{" "}
                                </span>
                                <span className="text-[var(--text-dark)] font-medium">
                                  {displayValue}
                                </span>
                              </div>
                            );
                          })}

                          {/* Display additional fields with costs */}
                          {Object.keys(req)
                            .filter(key => key.endsWith('_cost'))
                            .map(costKey => {
                              const rawValue = req[costKey as keyof typeof req];
                              let costValue = 0;
                              if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
                                const parsed = parseFloat(String(rawValue));
                                costValue = isNaN(parsed) ? 0 : parsed;
                              }
                              if (costValue === 0) return null;

                              // Get the base field name (remove _cost suffix)
                              const baseFieldName = costKey.replace('_cost', '');
                              const baseFieldValue = req[baseFieldName];
                              
                              // Only show cost if the base field is valid/selected
                              if (!isFieldValueValid(baseFieldValue)) {
                                return null;
                              }
                              
                              // Calculate the actual cost for this quantity
                              const calculatedCost = (quantity / 1000) * costValue;

                              // Format the field name for display
                              const displayLabel = baseFieldName
                                .split('_')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');

                              // Double-check: never display if base field is false/invalid
                              if (!isFieldValueValid(baseFieldValue)) {
                                return null;
                              }

                              return (
                                <div key={costKey} className="text-xs col-span-2 bg-blue-50 p-2 rounded">
                                  <div className="mb-1">
                                    <span className="text-[var(--text-light)]">
                                      {displayLabel}:{" "}
                                    </span>
                                    <span className="text-[var(--text-dark)] font-medium">
                                      {String(baseFieldValue)}
                                    </span>
                                  </div>
                                  <div className="ml-4 space-y-1">
                                    <div>
                                      <span className="text-[var(--text-light)]">
                                        Cost (per 1000):{" "}
                                      </span>
                                      <span className="text-[var(--text-dark)] font-medium">
                                        ${costValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[var(--text-light)]">
                                        Calculated Cost:{" "}
                                      </span>
                                      <span className="text-[var(--text-dark)] font-semibold">
                                        ${calculatedCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                          {/* Display dynamic fields not in processConfig (e.g., boolean fields from machine variables) */}
                          {Object.keys(req)
                            .filter(key => {
                              // Exclude fields already shown in processConfig
                              const isInProcessConfig = processConfig?.fields.some(f => f.name === key);
                              // Exclude system fields (but allow price_per_m and _cost fields to be shown if not in processConfig)
                              const isSystemField = key === "process_type" || key === "id";
                              // Only show if field has a valid value
                              return !isInProcessConfig && !isSystemField && isFieldValueValid(req[key]);
                            })
                            .map(fieldKey => {
                              const fieldValue = req[fieldKey];
                              
                              // Format the field name for display
                              const displayLabel = fieldKey
                                .split('_')
                                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                                .join(' ');

                              // Double-check: never display false values
                              if (!isFieldValueValid(fieldValue)) {
                                return null;
                              }

                              // Format the value
                              let displayValue: string;
                              if (typeof fieldValue === "boolean") {
                                displayValue = fieldValue ? "Yes" : "No";
                              } else if (isCostField(fieldKey)) {
                                // Format cost fields as currency
                                displayValue = formatCurrency(fieldValue);
                              } else {
                                displayValue = String(fieldValue);
                              }

                              return (
                                <div key={fieldKey} className="text-xs">
                                  <span className="text-[var(--text-light)]">
                                    {displayLabel}:{" "}
                                  </span>
                                  <span className="text-[var(--text-dark)] font-medium">
                                    {displayValue}
                                  </span>
                                </div>
                              );
                            })}
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                          <span className="text-[var(--text-light)]">
                            Subtotal for this service:
                          </span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            $
                            {requirementTotal.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Total Price Calculation */}
                <div className="mt-4 pt-4 border-t-2 border-[var(--primary-blue)]">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--text-dark)] text-lg">
                      Total Job Price:
                    </span>
                    <span className="font-bold text-[var(--primary-blue)] text-xl">
                      $
                      {getValidRequirements(formData.requirements)
                        .reduce((total, req) => {
                          const quantity = parseInt(formData.quantity || "0");
                          const pricePerMStr = req.price_per_m;
                          const isValidPrice =
                            pricePerMStr &&
                            pricePerMStr !== "undefined" &&
                            pricePerMStr !== "null";
                          const pricePerM = isValidPrice ? parseFloat(String(pricePerMStr)) : 0;
                          const baseRevenue = (quantity / 1000) * pricePerM;

                          // Calculate additional field costs (only for selected fields)
                          const additionalCosts = calculateAdditionalCosts(req, quantity);

                          return total + baseRevenue + additionalCosts;
                        }, 0)
                        .toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                    </span>
                  </div>
                </div>

                {/* Pricing Breakdown Section */}
                <div className="mt-6 pt-6 border-t border-[var(--border)]">
                  <h4 className="text-base font-semibold text-[var(--dark-blue)] mb-4">
                    Pricing Breakdown
                  </h4>
                  <div className="space-y-3">
                    {/* Revenue per Process */}
                    {getValidRequirements(formData.requirements).map((req, index) => {
                      const quantity = parseInt(formData.quantity || "0");
                      const pricePerMStr = req.price_per_m;
                      const isValidPrice =
                        pricePerMStr &&
                        pricePerMStr !== "undefined" &&
                        pricePerMStr !== "null";
                      const pricePerM = isValidPrice ? parseFloat(String(pricePerMStr)) : 0;
                      const baseRevenue = (quantity / 1000) * pricePerM;
                      
                      // Calculate additional field costs (only for selected fields)
                      const additionalCosts = calculateAdditionalCosts(req, quantity);
                      
                      const processRevenue = baseRevenue + additionalCosts;

                      return (
                        <div
                          key={index}
                          className="flex justify-between items-center py-2"
                        >
                          <span className="text-sm text-[var(--text-dark)]">
                            Revenue from {req.process_type}:
                          </span>
                          <span className="text-base font-semibold text-[var(--text-dark)]">
                            $
                            {processRevenue.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      );
                    })}

                    {/* Add-On Charges */}
                    {formData.add_on_charges && parseFloat(formData.add_on_charges) > 0 && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-[var(--text-dark)]">
                          Add-on Charges:
                        </span>
                        <span className="text-base font-semibold text-[var(--text-dark)]">
                          $
                          {parseFloat(formData.add_on_charges).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>
                    )}

                    {/* Total Revenue */}
                    {(() => {
                      // Calculate total revenue from requirements (including additional costs)
                      // Only use valid requirements (those with process_type and at least one field)
                      const calculatedTotalRevenue = getValidRequirements(formData.requirements).reduce((total, req) => {
                        const quantity = parseInt(formData.quantity || "0");
                        const pricePerMStr = req.price_per_m;
                        const isValidPrice =
                          pricePerMStr &&
                          pricePerMStr !== "undefined" &&
                          pricePerMStr !== "null";
                        const pricePerM = isValidPrice ? parseFloat(String(pricePerMStr)) : 0;
                        const baseRevenue = (quantity / 1000) * pricePerM;
                        
                        // Calculate additional field costs (only for selected fields)
                        const additionalCosts = calculateAdditionalCosts(req, quantity);
                        
                        return total + baseRevenue + additionalCosts;
                      }, 0) + parseFloat(formData.add_on_charges || "0");

                      return (
                        <div className="flex justify-between items-center py-3 border-t-2 border-[var(--primary-blue)] mt-3">
                          <span className="text-base font-bold text-[var(--text-dark)]">
                            Total Revenue:
                          </span>
                          <span className="text-xl font-bold text-[var(--primary-blue)]">
                            $
                            {calculatedTotalRevenue.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>
                      );
                    })()}

                    {/* Revenue per Unit */}
                    <div className="flex justify-between items-center py-2 bg-gray-50 rounded-lg px-4">
                      <span className="text-sm text-[var(--text-dark)]">
                        Revenue per Unit:
                      </span>
                      <span className="text-base font-semibold text-[var(--text-dark)]">
                        $
                        {(() => {
                          const quantity = parseInt(formData.quantity || "0");
                          if (quantity > 0) {
                            // Only use valid requirements (those with process_type and at least one field)
                            const totalRevenue = getValidRequirements(formData.requirements).reduce((total, req) => {
                              const pricePerMStr = req.price_per_m;
                              const isValidPrice =
                                pricePerMStr &&
                                pricePerMStr !== "undefined" &&
                                pricePerMStr !== "null";
                              const pricePerM = isValidPrice ? parseFloat(String(pricePerMStr)) : 0;
                              const baseRevenue = (quantity / 1000) * pricePerM;
                              
                              // Calculate additional field costs (only for selected fields)
                              const additionalCosts = calculateAdditionalCosts(req, quantity);
                              
                              return total + baseRevenue + additionalCosts;
                            }, 0) + parseFloat(formData.add_on_charges || "0");
                            
                            return (totalRevenue / quantity).toLocaleString("en-US", {
                              minimumFractionDigits: 4,
                              maximumFractionDigits: 4,
                            });
                          }
                          return "0.0000";
                        })()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Selected Machines Section */}
              <div className="bg-white border border-[var(--border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[var(--text-dark)]">
                    Assigned Machines
                  </h3>
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
                  >
                    Edit Machines
                  </button>
                </div>
                {formData.machines_id.length === 0 ? (
                  <div className="text-center py-6 px-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <svg
                      className="w-10 h-10 text-yellow-500 mx-auto mb-2"
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
                    <p className="text-sm font-medium text-yellow-800">
                      No machines selected
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Go back to Services step to select machines from recommendations
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formData.machines_id.map((machineId) => (
                      <div
                        key={machineId}
                        className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className="w-5 h-5 text-blue-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                            />
                          </svg>
                          <div>
                            <p className="font-semibold text-blue-900">
                              Machine ID: {machineId}
                            </p>
                            <p className="text-xs text-blue-700">
                              Assigned to this job
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeselectMachine(machineId)}
                          className="text-red-500 hover:text-red-700 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Schedule Type Section */}
              <div className="border-2 border-[var(--border)] rounded-lg p-4 bg-gray-50 mt-6">
                <h4 className="font-semibold text-[var(--text-dark)] mb-3">
                  Schedule Type
                </h4>
                <select
                  value={scheduleType}
                  onChange={(e) => setScheduleType(e.target.value)}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] bg-white"
                >
                  <option value="soft schedule">Soft Schedule</option>
                  <option value="Hard Schedule">Hard Schedule</option>
                  <option value="projected">Projected</option>
                  <option value="completed">Completed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
                <p className="text-sm text-[var(--text-light)] mt-3">
                  {scheduleType === "Hard Schedule"
                    ? "✓ This job will be confirmed and scheduled immediately."
                    : scheduleType === "soft schedule"
                      ? "ℹ This job will be added as a soft schedule and can be confirmed later."
                      : scheduleType === "projected"
                        ? "📊 This job is projected for future planning."
                        : scheduleType === "completed"
                          ? "✅ This job has been completed."
                          : scheduleType === "Cancelled"
                            ? "❌ This job has been cancelled."
                            : ""}
                </p>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--border)]">
            <div className="text-sm text-[var(--text-light)]">
              Step {currentStep} of 3
            </div>
            <div className="flex gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={handlePrevious}
                  className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
                >
                  Previous
                </button>
              )}
              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setCanSubmit(true);
                    // Use setTimeout to allow state to update before form submission
                    setTimeout(() => {
                      const form = document.querySelector("form");
                      if (form) {
                        form.requestSubmit();
                      }
                    }, 0);
                  }}
                  disabled={submitting}
                  className="px-6 py-2 bg-[#EF3340] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? "Updating Job..." : "Update Job"}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message={`Job #${job.job_number} updated successfully!`}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}

      {/* Backward Redistribution Warning Modal */}
      {showBackwardRedistributeWarning &&
        pendingRedistribution &&
        (() => {
          const preview = calculateRedistributionPreview();
          if (!preview) return null;

          return (
            <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={handleBackwardRedistributeCancel}
              />
              <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full relative z-10 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 border-b border-[var(--border)]">
                  <h3 className="text-xl font-bold text-[var(--dark-blue)]">
                    Adjust Week {pendingRedistribution.weekIndex + 1} Quantity
                  </h3>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  {/* Quantity Input */}
                  <div>
                    <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Week {pendingRedistribution.weekIndex + 1} Quantity
                    </label>
                    <input
                      type="text"
                      value={
                        tempWeekQuantity
                          ? parseInt(tempWeekQuantity).toLocaleString()
                          : ""
                      }
                      onChange={handleTempQuantityChange}
                      className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                      placeholder="Enter quantity"
                      autoFocus
                    />
                  </div>

                  {/* Redistribution Info */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="text-sm">
                      <div className="flex justify-between mb-2">
                        <span className="text-[var(--text-light)]">
                          Total Job Quantity:
                        </span>
                        <span className="font-semibold">
                          {parseInt(formData.quantity || "0").toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-light)]">
                          Amount to redistribute:
                        </span>
                        <span
                          className={`font-semibold ${preview.difference < 0 ? "text-red-600" : "text-green-600"}`}
                        >
                          {preview.difference > 0 ? "+" : ""}
                          {preview.difference.toLocaleString()} pieces
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Preview or Error Message */}
                  {preview.canRedistribute ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-[var(--text-dark)]">
                        This will redistribute{" "}
                        {Math.abs(preview.difference).toLocaleString()} pieces
                        from:
                      </p>
                      <div className="space-y-2">
                        {preview.preview.map(
                          ({ weekIndex, oldValue, newValue }) => (
                            <div
                              key={weekIndex}
                              className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2"
                            >
                              <span className="text-[var(--text-dark)]">
                                Week {weekIndex + 1}:
                              </span>
                              <span className="font-semibold">
                                {oldValue.toLocaleString()} →{" "}
                                {newValue.toLocaleString()}
                                <span
                                  className={`ml-2 ${newValue - oldValue < 0 ? "text-red-600" : "text-green-600"}`}
                                >
                                  ({newValue - oldValue > 0 ? "+" : ""}
                                  {(newValue - oldValue).toLocaleString()})
                                </span>
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                      {preview.lockedBefore.length > 0 && (
                        <p className="text-xs text-[var(--text-light)] italic">
                          {preview.lockedBefore.length} week(s) before Week{" "}
                          {pendingRedistribution.weekIndex + 1} remain locked
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <p className="text-sm text-red-800 font-semibold mb-2">
                          ⚠️ Cannot redistribute - all previous weeks are locked
                        </p>
                        <p className="text-xs text-red-700">
                          Unlock one or more weeks below to proceed with this
                          adjustment.
                        </p>
                      </div>

                      {preview.lockedBefore.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-[var(--text-dark)]">
                            Locked weeks:
                          </p>
                          {preview.lockedBefore.map(({ idx, val }) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded px-3 py-2"
                            >
                              <span className="text-sm text-[var(--text-dark)]">
                                Week {idx + 1}: {val.toLocaleString()} pieces
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUnlockWeekInDialog(idx)}
                                className="text-xs text-[var(--primary-blue)] hover:opacity-70 transition-opacity flex items-center gap-1 font-semibold"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="#2563eb"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <rect
                                    x="3"
                                    y="11"
                                    width="18"
                                    height="11"
                                    rx="2"
                                    ry="2"
                                  />
                                  <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                                </svg>
                                Unlock
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)] bg-gray-50">
                  <button
                    onClick={handleBackwardRedistributeCancel}
                    className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBackwardRedistributeConfirm}
                    disabled={!preview.canRedistribute}
                    className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full relative z-10">
            {/* Header */}
            <div className="p-6 border-b border-[var(--border)]">
              <h3 className="text-xl font-bold text-[var(--dark-blue)]">
                Confirm Deletion
              </h3>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-[var(--text-dark)] mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold">Job #{job.job_number}</span>?
              </p>
              <p className="text-[var(--text-light)] text-sm">
                This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--border)] bg-gray-50">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
