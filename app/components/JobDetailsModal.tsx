"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { type ParsedJob } from "@/hooks/useJobs";
import { deleteJob, updateJob } from "@/lib/api";
import { getProcessTypeConfig } from "@/lib/processTypeConfig";
import Toast from "./Toast";
import JobRevisionHistoryModal from "./JobRevisionHistoryModal";
import SmartClientSelect from "./SmartClientSelect";
import FacilityToggle from "./FacilityToggle";
import ScheduleToggle from "./ScheduleToggle";
import DynamicRequirementFields from "./DynamicRequirementFields";

interface JobDetailsModalProps {
  isOpen: boolean;
  job: ParsedJob | null;
  onClose: () => void;
  onRefresh?: () => void;
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

export default function JobDetailsModal({
  isOpen,
  job,
  onClose,
  onRefresh,
}: JobDetailsModalProps) {
  // Mode management
  const [isEditMode, setIsEditMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // State for view mode
  const [isRevisionHistoryOpen, setIsRevisionHistoryOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [deletedJobNumber, setDeletedJobNumber] = useState<string | null>(null);

  // State for edit mode
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [showBackwardRedistributeWarning, setShowBackwardRedistributeWarning] =
    useState(false);
  const [pendingRedistribution, setPendingRedistribution] = useState<{
    weekIndex: number;
    newValue: number;
  } | null>(null);
  const [tempWeekQuantity, setTempWeekQuantity] = useState<string>("");
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

  // Initialize form with job data when entering edit mode
  useEffect(() => {
    if (isEditMode && job) {
      console.log("JobDetailsModal - Initializing edit mode with job:", job);

      // Parse requirements
      let parsedRequirements: Requirement[];
      try {
        if (typeof job.requirements === "string") {
          parsedRequirements = JSON.parse(job.requirements);
        } else if (Array.isArray(job.requirements)) {
          parsedRequirements = job.requirements.map((req) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
            const { shifts_id, ...rest } = req as any;
            return {
              process_type: req.process_type || "",
              ...rest,
            };
          });
        } else {
          parsedRequirements = [{ process_type: "", price_per_m: "" }];
        }

        if (!parsedRequirements || parsedRequirements.length === 0) {
          parsedRequirements = [{ process_type: "", price_per_m: "" }];
        }
      } catch (error) {
        console.error("Failed to parse requirements:", error);
        parsedRequirements = [{ process_type: "", price_per_m: "" }];
      }

      const formatDate = (timestamp: number | null | undefined) => {
        if (!timestamp) return "";
        const date = new Date(timestamp);
        return date.toISOString().split("T")[0];
      };

      const toStringValue = (value: unknown) => {
        if (value === null || value === undefined) return "";
        return String(value);
      };

      const clientId = job.client?.id || null;
      // Preserve client name even if it's "Unknown" - SmartClientSelect can now handle it
      const clientName = job.client?.name || "";
      const subClientId = null; // sub_client is now just a string, not an object with an id
      const subClientName = job.sub_client || "";

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
        lockedWeeks = Array(weeklySplit.length).fill(false);
      }

      const jobWithFields = job as typeof job & {
        price_per_m?: string | number;
        add_on_charges?: string | number;
        ext_price?: string | number;
        total_billing?: string | number;
      };

      let facilitiesId: number | null = null;
      if (job.facilities_id !== undefined && job.facilities_id !== null) {
        facilitiesId =
          typeof job.facilities_id === "string"
            ? parseInt(job.facilities_id, 10)
            : job.facilities_id;
      }

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
        pockets: "2",
        machines_id: job.machines?.map((m) => m.id) || [],
        requirements: parsedRequirements,
        weekly_split: weeklySplit,
        locked_weeks: lockedWeeks,
        price_per_m: toStringValue(jobWithFields.price_per_m || ""),
        add_on_charges: toStringValue(jobWithFields.add_on_charges || ""),
        ext_price: toStringValue(jobWithFields.ext_price || ""),
        total_billing: toStringValue(jobWithFields.total_billing || ""),
      });
    }
  }, [isEditMode, job]);

  // Calculate weeks and split quantity when dates or quantity changes
  useEffect(() => {
    if (
      isEditMode &&
      formData.start_date &&
      formData.due_date &&
      formData.quantity
    ) {
      const startDate = new Date(formData.start_date);
      const dueDate = new Date(formData.due_date);
      const quantity = parseInt(formData.quantity);

      if (!isNaN(quantity) && quantity > 0 && dueDate >= startDate) {
        const daysDiff =
          Math.ceil(
            (dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
          ) + 1;
        const weeks = Math.ceil(daysDiff / 7);

        if (weeks > 0 && formData.weekly_split.length === 0) {
          const baseAmount = Math.floor(quantity / weeks);
          const remainder = quantity % weeks;
          const newSplit = Array(weeks).fill(baseAmount);
          for (let i = 0; i < remainder; i++) {
            newSplit[i]++;
          }
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
    isEditMode,
    formData.start_date,
    formData.due_date,
    formData.quantity,
    formData.weekly_split.length,
  ]);

  // Handle quantity changes when weekly_split already exists
  useEffect(() => {
    if (
      isEditMode &&
      formData.weekly_split.length > 0 &&
      formData.quantity
    ) {
      const totalQuantity = parseInt(formData.quantity) || 0;
      const currentTotal = formData.weekly_split.reduce(
        (sum, val) => sum + val,
        0,
      );
      const difference = totalQuantity - currentTotal;

      if (difference !== 0) {
        setFormData((prev) => {
          const newSplit = [...prev.weekly_split];
          const lockedWeeks = prev.locked_weeks;
          const unlockedIndices = newSplit
            .map((_, idx) => idx)
            .filter((idx) => !lockedWeeks[idx]);

          if (unlockedIndices.length > 0) {
            const baseAdjustment = Math.floor(
              difference / unlockedIndices.length,
            );
            const remainder = difference % unlockedIndices.length;

            unlockedIndices.forEach((idx, position) => {
              let adjustment = baseAdjustment;
              if (position < Math.abs(remainder)) {
                adjustment += remainder > 0 ? 1 : -1;
              }
              newSplit[idx] = Math.max(0, newSplit[idx] + adjustment);
            });

            return { ...prev, weekly_split: newSplit };
          }

          return prev;
        });
      }
    }
  }, [isEditMode, formData.quantity]);

  // Adjust description textarea height on mount and when description changes
  useEffect(() => {
    if (descriptionTextareaRef.current && isEditMode) {
      adjustTextareaHeight(descriptionTextareaRef.current);
    }
  }, [formData.description, isEditMode, isOpen]);

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

  const handleEdit = () => {
    setIsEditMode(true);
    setCurrentStep(1);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setCurrentStep(1);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const jobNum = job.job_number;
      const jobIdValue = job.id;

      // Validation check
      if (!jobIdValue || jobIdValue === 0) {
        throw new Error(`Invalid job ID: ${jobIdValue}`);
      }

      await deleteJob(jobIdValue);

      setShowDeleteConfirm(false);
      setDeletedJobNumber(jobNum);
      setShowDeleteToast(true);
      onClose();

      // Delay refresh to show toast
      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }
      }, 500);
    } catch (error) {
      console.error("Error deleting job:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      alert(
        `Failed to delete job #${job.job_number}.\n\nError: ${errorMessage}\n\nPlease check the console for details or contact support.`,
      );

      // Keep the confirmation dialog open so user can try again or cancel
      // setShowDeleteConfirm(false); // Don't close on error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
  };

  // Form handlers for edit mode
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
    setFormData((prev) => ({
      ...prev,
      requirements: prev.requirements.map((req, idx) =>
        idx === requirementIndex ? { ...req, [field]: value } : req,
      ),
    }));
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

  const handleWeeklySplitChange = (weekIndex: number, value: string) => {
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

      newSplit[weekIndex] = newValue;
      newLockedWeeks[weekIndex] = true;

      const currentTotal = newSplit.reduce((sum, val) => sum + val, 0);
      const difference = totalQuantity - currentTotal;

      if (difference !== 0) {
        const unlockedWeeksAfter = newSplit
          .map((_, idx) => idx)
          .filter((idx) => idx > weekIndex && !newLockedWeeks[idx]);

        if (unlockedWeeksAfter.length === 0 && !allowBackward) {
          setPendingRedistribution({ weekIndex, newValue });
          setTempWeekQuantity(newValue.toString());
          setShowBackwardRedistributeWarning(true);
          return prev;
        }

        let targetWeekIndices = unlockedWeeksAfter;
        if (unlockedWeeksAfter.length === 0 && allowBackward) {
          targetWeekIndices = newSplit
            .map((_, idx) => idx)
            .filter((idx) => idx !== weekIndex && !newLockedWeeks[idx]);
        }

        if (targetWeekIndices.length > 0) {
          const baseAdjustment = Math.floor(
            difference / targetWeekIndices.length,
          );
          const remainder = difference % targetWeekIndices.length;

          targetWeekIndices.forEach((idx, position) => {
            let adjustment = baseAdjustment;
            if (position < Math.abs(remainder)) {
              adjustment += remainder > 0 ? 1 : -1;
            }
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
    handleUnlockWeek(weekIndex);
  };

  const handleTempQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const cleanedValue = e.target.value.replace(/,/g, "");
    setTempWeekQuantity(cleanedValue);
  };

  const calculateRedistributionPreview = () => {
    if (!pendingRedistribution) return null;

    const cleanedValue = tempWeekQuantity.replace(/,/g, "");
    const proposedValue = parseInt(cleanedValue) || 0;
    const totalQuantity = parseInt(formData.quantity) || 0;
    const weekIndex = pendingRedistribution.weekIndex;

    const tempSplit = [...formData.weekly_split];
    tempSplit[weekIndex] = proposedValue;

    const currentTotal = tempSplit.reduce((sum, val) => sum + val, 0);
    const difference = totalQuantity - currentTotal;

    const unlockedBefore = formData.weekly_split
      .map((_, idx) => idx)
      .filter((idx) => idx < weekIndex && !formData.locked_weeks[idx]);

    const lockedBefore = formData.weekly_split
      .map((val, idx) => ({ idx, val }))
      .filter(({ idx }) => idx < weekIndex && formData.locked_weeks[idx]);

    const canRedistribute = unlockedBefore.length > 0;

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

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      if (currentStep === 2) {
        setIsConfirmed(false);
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

    if (currentStep !== 3 || !canSubmit) {
      return;
    }

    setCanSubmit(false);
    setSubmitting(true);

    try {
      const startDateTimestamp: number | undefined = formData.start_date
        ? new Date(formData.start_date).getTime()
        : undefined;
      const dueDateTimestamp: number | undefined = formData.due_date
        ? new Date(formData.due_date).getTime()
        : undefined;

      const quantity = parseInt(formData.quantity);
      const calculatedRevenue = formData.requirements.reduce((total, req) => {
        const pricePerM = parseFloat(req.price_per_m || "0");
        return total + (quantity / 1000) * pricePerM;
      }, 0);

      const addOnCharges = parseFloat(formData.add_on_charges || "0");
      const calculatedTotalBilling = calculatedRevenue + addOnCharges;

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
        sub_client: string;
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
        weekly_split: number[];
        locked_weeks: boolean[];
        confirmed: boolean;
      }> = {
        jobs_id: job.id,
        job_number: formData.job_number,
        service_type: formData.service_type,
        quantity: quantity,
        description: formData.description,
        time_estimate: null,
        clients_id: formData.clients_id || 0,
        machines_id: JSON.stringify(formData.machines_id),
        requirements: JSON.stringify(formData.requirements),
        job_name: formData.job_name,
        prgm: formData.prgm,
        csr: formData.csr,
        price_per_m: formData.price_per_m || "0",
        add_on_charges: addOnCharges.toString(),
        ext_price: formData.ext_price || "0",
        total_billing: calculatedTotalBilling.toString(),
        weekly_split: formData.weekly_split,
        locked_weeks: formData.locked_weeks,
        confirmed: isConfirmed,
      };

      if (formData.sub_clients_id !== null) {
        payload.sub_clients_id = formData.sub_clients_id;
      }

      // Include sub_client name in the payload
      if (formData.sub_client_name) {
        payload.sub_client = formData.sub_client_name;
      }

      if (startDateTimestamp && startDateTimestamp > 0) {
        payload.start_date = startDateTimestamp;
      }
      if (dueDateTimestamp && dueDateTimestamp > 0) {
        payload.due_date = dueDateTimestamp;
      }

      if (formData.facilities_id !== null) {
        payload.facilities_id = formData.facilities_id;
      }

      console.log("Payload being sent to Xano (Edit):", payload);
      await updateJob(job.id, payload);
      console.log("Job updated successfully");

      try {
        const { syncJobCostEntryFromRequirements } = await import("@/lib/api");
        const startDateForSync =
          payload.start_date || new Date(job.start_date).getTime();
        await syncJobCostEntryFromRequirements(
          job.id,
          payload.requirements as string,
          startDateForSync,
          payload.facilities_id,
        );
        console.log("[JobDetailsModal] Job cost entry synced successfully");
      } catch (costError) {
        console.error(
          "[JobDetailsModal] Failed to sync job cost entry (non-blocking):",
          costError,
        );
      }

      setIsEditMode(false);
      setCurrentStep(1);
      setShowSuccessToast(true);

      setTimeout(() => {
        if (onRefresh) {
          onRefresh();
        }
      }, 500);
    } catch (error) {
      console.error("Error updating job:", error);
      alert("Failed to update job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={isEditMode ? handleCancelEdit : onClose} />
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border)]">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
            {isEditMode ? `Edit Job #${job.job_number}` : "Job Details"}
          </h2>
          <button
            onClick={isEditMode ? handleCancelEdit : onClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        {/* Step Indicator - Only show in edit mode */}
        {isEditMode && (
          <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-[var(--border)]">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className="flex items-center"
                style={{ flex: step === 3 ? "0 1 auto" : "1 1 0%" }}
              >
                <div className="flex items-center">
                  <div
                    className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                      step === currentStep
                        ? "bg-[#EF3340] text-white"
                        : step < currentStep
                          ? "bg-[#EF3340] text-white"
                          : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {step < currentStep ? "✓" : step}
                  </div>
                  <div className="ml-3">
                    <div
                      className={`text-xs font-medium whitespace-nowrap ${
                        step === currentStep ? "text-[#EF3340]" : "text-gray-500"
                      }`}
                    >
                      {step === 1 && "Job Details"}
                      {step === 2 && "Requirements"}
                      {step === 3 && "Review"}
                    </div>
                  </div>
                </div>
                {step < 3 && (
                  <div
                    className={`h-0.5 flex-1 mx-4 ${
                      step < currentStep ? "bg-[#EF3340]" : "bg-gray-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Content - Conditional rendering based on mode */}
        {!isEditMode ? (
          // View Mode
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Job Information Section */}
          <div>
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Job Information
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Job Number
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.job_number}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Facility
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.facilities_id === 1
                    ? "Bolingbrook"
                    : job.facilities_id === 2
                      ? "Lemont"
                      : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Job Name
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.job_name || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Client
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.client?.name || "Unknown"}
                </p>
              </div>
              {job.sub_client && (
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                    Sub Client
                  </label>
                  <p className="text-base text-[var(--text-dark)]">
                    {job.sub_client}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Service Type
                </label>
                <span className="inline-block px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {job.service_type}
                </span>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Description
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.description || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Quantity
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.quantity.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Dates Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Timeline
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Start Date
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.start_date
                    ? new Date(job.start_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Due Date
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.due_date
                    ? new Date(job.due_date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Time Estimate
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.time_estimate ? `${job.time_estimate} hours` : "N/A"}
                </p>
              </div>
            </div>

            {/* Weekly Quantity Distribution */}
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {(job as any).weekly_split &&
              (job as any).weekly_split.length > 0 && (
                <div className="mt-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-semibold text-[var(--dark-blue)]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Weekly Quantity Distribution (
                        {(job as any).weekly_split.length}{" "}
                        {(job as any).weekly_split.length === 1
                          ? "week"
                          : "weeks"}
                        )
                      </h4>
                      <div className="text-sm font-semibold text-[var(--text-dark)]">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        Total:{" "}
                        {(job as any).weekly_split
                          .reduce((sum: number, qty: number) => sum + qty, 0)
                          .toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {(job as any).weekly_split.map(
                        (qty: number, index: number) => (
                          <div
                            key={index}
                            className="bg-white rounded-md p-3 border border-gray-200"
                          >
                            <div className="text-xs font-medium text-[var(--text-light)] mb-1">
                              Week {index + 1}
                            </div>
                            <div className="text-base font-semibold text-[var(--text-dark)]">
                              {qty.toLocaleString()}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Staff Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Assignment
            </h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  CSR
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.csr || "N/A"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                  Program Cadence
                </label>
                <p className="text-base text-[var(--text-dark)]">
                  {job.prgm || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Pricing
            </h3>
            {job.requirements && job.requirements.length > 0 ? (
              <div className="space-y-3">
                {/* Revenue per Process */}
                {(() => {
                  // Debug logging
                  console.log("[JobDetailsModal] Job data:", {
                    jobNumber: job.job_number,
                    quantity: job.quantity,
                    total_billing: job.total_billing,
                    add_on_charges: job.add_on_charges,
                    requirements: job.requirements,
                  });

                  // Calculate total revenue from requirements
                  const requirementsTotal = job.requirements.reduce(
                    (total, req) => {
                      // Handle "undefined" string, null, undefined, and empty string
                      const pricePerMStr = req.price_per_m;
                      const isValidPrice =
                        pricePerMStr &&
                        pricePerMStr !== "undefined" &&
                        pricePerMStr !== "null";
                      const pricePerM = isValidPrice
                        ? parseFloat(pricePerMStr)
                        : 0;
                      console.log(
                        `[JobDetailsModal] Requirement ${req.process_type}: price_per_m="${req.price_per_m}", parsed=${pricePerM}`,
                      );
                      return total + (job.quantity / 1000) * pricePerM;
                    },
                    0,
                  );

                  // Get the actual total billing
                  const totalBilling = parseFloat(job.total_billing || "0");
                  const addOnCharges = parseFloat(job.add_on_charges || "0");
                  const revenueWithoutAddOns = totalBilling - addOnCharges;

                  console.log("[JobDetailsModal] Calculations:", {
                    requirementsTotal,
                    totalBilling,
                    addOnCharges,
                    revenueWithoutAddOns,
                  });

                  // If requirements don't have price_per_m but we have total_billing, distribute it
                  const shouldDistribute =
                    revenueWithoutAddOns > 0 && requirementsTotal === 0;

                  return job.requirements.map((req, index) => {
                    // Handle "undefined" string, null, undefined, and empty string
                    const pricePerMStr = req.price_per_m;
                    const isValidPrice =
                      pricePerMStr &&
                      pricePerMStr !== "undefined" &&
                      pricePerMStr !== "null";
                    const pricePerM = isValidPrice
                      ? parseFloat(pricePerMStr)
                      : 0;
                    let processRevenue = (job.quantity / 1000) * pricePerM;

                    // Distribute revenue if price_per_m is missing
                    if (shouldDistribute) {
                      // If only one requirement, give it all the revenue
                      if (job.requirements.length === 1) {
                        processRevenue = revenueWithoutAddOns;
                      } else {
                        // Distribute evenly across all requirements
                        processRevenue =
                          revenueWithoutAddOns / job.requirements.length;
                      }
                    }

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
                  });
                })()}

                {/* Add-On Charges */}
                {job.add_on_charges && parseFloat(job.add_on_charges) > 0 && (
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-[var(--text-dark)]">
                      Add-on Charges:
                    </span>
                    <span className="text-base font-semibold text-[var(--text-dark)]">
                      $
                      {parseFloat(job.add_on_charges).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}

                {/* Total Revenue */}
                <div className="flex justify-between items-center py-3 border-t-2 border-[var(--primary-blue)] mt-3">
                  <span className="text-base font-bold text-[var(--text-dark)]">
                    Total Revenue:
                  </span>
                  <span className="text-xl font-bold text-[var(--primary-blue)]">
                    $
                    {job.total_billing
                      ? parseFloat(job.total_billing).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      : (
                          job.requirements.reduce((total, req) => {
                            const pricePerM = parseFloat(
                              req.price_per_m || "0",
                            );
                            return total + (job.quantity / 1000) * pricePerM;
                          }, 0) + parseFloat(job.add_on_charges || "0")
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                  </span>
                </div>

                {/* Revenue per Unit */}
                <div className="flex justify-between items-center py-2 bg-gray-50 rounded-lg px-4">
                  <span className="text-sm text-[var(--text-dark)]">
                    Revenue per Unit:
                  </span>
                  <span className="text-base font-semibold text-[var(--text-dark)]">
                    $
                    {job.quantity > 0
                      ? (
                          (parseFloat(job.total_billing || "0") ||
                            job.requirements.reduce((total, req) => {
                              const pricePerM = parseFloat(
                                req.price_per_m || "0",
                              );
                              return total + (job.quantity / 1000) * pricePerM;
                            }, 0) + parseFloat(job.add_on_charges || "0")) /
                          job.quantity
                        ).toLocaleString("en-US", {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })
                      : "0.0000"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-base text-[var(--text-light)]">
                <p>No requirements found for this job.</p>
              </div>
            )}
          </div>

          {/* Requirements Section */}
          <div className="border-t border-[var(--border)] pt-6">
            <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-4">
              Requirements Details
            </h3>
            {(() => {
              // Defensive parsing: handle cases where requirements might still be a string
              let parsedRequirements: any[] = [];
              
              if (job.requirements) {
                if (Array.isArray(job.requirements)) {
                  parsedRequirements = job.requirements;
                } else {
                  // Type assertion needed because ParsedJob types requirements as array,
                  // but at runtime it might still be a string in some cases
                  const requirementsStr = job.requirements as unknown as string;
                  if (typeof requirementsStr === "string") {
                    try {
                      // Try parsing as JSON string
                      if (requirementsStr.trim().startsWith("[")) {
                        parsedRequirements = JSON.parse(requirementsStr);
                      } else if (requirementsStr.trim().startsWith("{")) {
                        // Handle single object wrapped in braces
                        parsedRequirements = [JSON.parse(requirementsStr)];
                      }
                    } catch (error) {
                      console.error("[JobDetailsModal] Failed to parse requirements:", error, requirementsStr);
                      parsedRequirements = [];
                    }
                  }
                }
              }

              console.log("[JobDetailsModal] Requirements debug:", {
                jobId: job.id,
                jobNumber: job.job_number,
                rawRequirements: job.requirements,
                parsedRequirements,
                isArray: Array.isArray(job.requirements),
                type: typeof job.requirements,
              });

              if (parsedRequirements && parsedRequirements.length > 0) {
                return (
                  <div className="space-y-4">
                    {parsedRequirements.map((req, index) => {
                      // Get the process type configuration
                      const processConfig = getProcessTypeConfig(req.process_type);

                      // Get all fields for this process type, excluding process_type (shown in header)
                      const fieldsToDisplay =
                        processConfig?.fields.filter(
                          (field) => field.name !== "process_type",
                        ) || [];

                      // Get all keys from the requirement object to show any fields not in config
                      const allReqKeys = Object.keys(req).filter(
                        (key) => key !== "process_type" && req[key] !== undefined && req[key] !== null && req[key] !== ""
                      );
                      const configFieldNames = new Set(fieldsToDisplay.map((f) => f.name));
                      const additionalFields = allReqKeys.filter((key) => !configFieldNames.has(key));

                      return (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-[var(--dark-blue)] mb-3">
                            Requirement {index + 1}:{" "}
                            {processConfig?.label || req.process_type || "Unknown"}
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            {fieldsToDisplay.map((fieldConfig) => {
                              const fieldValue =
                                req[fieldConfig.name as keyof typeof req];

                              // Skip if field has no value
                              if (
                                fieldValue === undefined ||
                                fieldValue === null ||
                                fieldValue === ""
                              ) {
                                return null;
                              }

                              // Format the value based on field type
                              let displayValue: string;
                              if (fieldConfig.type === "currency") {
                                displayValue = `$${parseFloat(String(fieldValue)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              } else {
                                displayValue = String(fieldValue);
                              }

                              return (
                                <div key={fieldConfig.name}>
                                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                                    {fieldConfig.label}
                                  </label>
                                  <p className="text-base text-[var(--text-dark)]">
                                    {displayValue}
                                  </p>
                                </div>
                              );
                            })}

                            {/* Show additional fields that aren't in the process type config */}
                            {additionalFields.map((fieldName) => {
                              const fieldValue = req[fieldName];
                              if (fieldValue === undefined || fieldValue === null || fieldValue === "") {
                                return null;
                              }

                              return (
                                <div key={fieldName}>
                                  <label className="block text-sm font-semibold text-[var(--text-light)] mb-1">
                                    {fieldName.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                                  </label>
                                  <p className="text-base text-[var(--text-dark)]">
                                    {String(fieldValue)}
                                  </p>
                                </div>
                              );
                            })}

                            {/* Show "No additional details" if no fields to display */}
                            {fieldsToDisplay.length === 0 && additionalFields.length === 0 && (
                              <div className="col-span-2 text-sm text-[var(--text-light)] italic">
                                No additional requirement details
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              } else {
                return (
                  <p className="text-base text-[var(--text-light)]">
                    No specific requirements
                  </p>
                );
              }
            })()}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--border)] pt-6 flex justify-between gap-3">
            <button
              onClick={handleDeleteClick}
              className="px-6 py-2 border-2 border-red-500 text-red-500 rounded-lg font-semibold hover:bg-red-50 transition-colors"
            >
              Delete Job
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => setIsRevisionHistoryOpen(true)}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
              >
                Revision History
              </button>
              <button
                onClick={handleEdit}
                className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                Edit Job
              </button>
              <button
                onClick={onClose}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
        ) : (
          // Edit Mode - 3-step wizard
          <form
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                currentStep !== 3 &&
                e.target instanceof HTMLInputElement
              ) {
                e.preventDefault();
              }
            }}
            className="flex-1 overflow-y-auto p-6"
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
                      Sub-Client
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
                    <input
                      type="text"
                      name="quantity"
                      value={
                        formData.quantity
                          ? parseInt(formData.quantity).toLocaleString()
                          : ""
                      }
                      onChange={handleQuantityChange}
                      className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                      placeholder="e.g., 73"
                    />
                  </div>
                </div>

                {/* Weekly Split Section */}
                {formData.weekly_split.length > 0 && (
                  <div className="bg-white border border-[var(--border)] rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-semibold text-[var(--dark-blue)]">
                        Weekly Quantity Split ({formData.weekly_split.length}{" "}
                        {formData.weekly_split.length === 1 ? "week" : "weeks"})
                      </h4>
                      <div
                        className={`text-base font-semibold ${
                          getWeeklySplitDifference() === 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        Total: {getWeeklySplitSum().toLocaleString()} /{" "}
                        {parseInt(formData.quantity || "0").toLocaleString()}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {formData.weekly_split.map((amount, index) => {
                        const isLocked = formData.locked_weeks[index];
                        return (
                          <div key={index} className="relative">
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-sm font-medium text-gray-600">
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
                                className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] text-base font-semibold ${
                                  isLocked
                                    ? "bg-blue-50 border-blue-300 pr-8"
                                    : "bg-white border-gray-200"
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
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
                        <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Weekly split total must equal the total quantity</span>
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

            {/* Step 2: Requirements */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-6">
                  Job Requirements
                </h3>

                {formData.requirements.map((requirement, index) => (
                  <div
                    key={index}
                    className="border border-[var(--border)] rounded-lg p-6 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-[var(--text-dark)]">
                        Requirement {index + 1}
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

                    <DynamicRequirementFields
                      requirement={requirement}
                      onChange={(field, value) =>
                        handleRequirementChange(index, field, value)
                      }
                      disableRequired={true}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addRequirement}
                  className="w-full px-6 py-3 border-2 border-dashed border-[var(--border)] rounded-lg font-semibold text-[var(--primary-blue)] hover:bg-blue-50 transition-colors"
                >
                  + Add Another Requirement
                </button>
              </div>
            )}

            {/* Step 3: Review */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="bg-[var(--bg-alert-info)] border-l-4 border-[var(--primary-blue)] p-4 rounded">
                  <h3 className="font-semibold text-[var(--text-dark)] mb-2">
                    Job Summary
                  </h3>
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
                      <span className="text-[var(--text-light)]">
                        Sub-Client:
                      </span>
                      <span className="ml-2 font-semibold text-[var(--text-dark)]">
                        {formData.sub_client_name || "N/A"}
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
                  <h3 className="font-semibold text-[var(--text-dark)] mb-3">
                    Job Requirements & Pricing
                  </h3>
                  {formData.requirements.map((req, index) => {
                    const quantity = parseInt(formData.quantity || "0");
                    const pricePerM = parseFloat(req.price_per_m || "0");
                    const requirementTotal = (quantity / 1000) * pricePerM;
                    const processConfig = getProcessTypeConfig(req.process_type);

                    return (
                      <div
                        key={index}
                        className="mb-4 pb-4 border-b border-[var(--border)] last:border-b-0"
                      >
                        <div className="text-sm">
                          <div className="mb-2">
                            <span className="text-[var(--text-light)]">
                              Requirement {index + 1}:{" "}
                            </span>
                            <span className="font-semibold text-[var(--text-dark)]">
                              {processConfig?.label || req.process_type}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 mb-2 ml-4">
                            {processConfig?.fields.map((fieldConfig) => {
                              const fieldValue =
                                req[fieldConfig.name as keyof typeof req];

                              if (
                                fieldValue === undefined ||
                                fieldValue === null ||
                                fieldValue === ""
                              ) {
                                return null;
                              }

                              let displayValue: string;
                              if (fieldConfig.type === "currency") {
                                displayValue = `$${parseFloat(String(fieldValue)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
                          </div>

                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                            <span className="text-[var(--text-light)]">
                              Subtotal for this requirement:
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

                  <div className="mt-4 pt-4 border-t-2 border-[var(--primary-blue)]">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-[var(--text-dark)] text-lg">
                        Total Job Price:
                      </span>
                      <span className="font-bold text-[var(--primary-blue)] text-xl">
                        $
                        {formData.requirements
                          .reduce((total, req) => {
                            const quantity = parseInt(formData.quantity || "0");
                            const pricePerM = parseFloat(req.price_per_m || "0");
                            return total + (quantity / 1000) * pricePerM;
                          }, 0)
                          .toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="border-2 border-[var(--border)] rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold text-[var(--text-dark)] mb-3">
                    Schedule Type
                  </h4>
                  <ScheduleToggle
                    isConfirmed={isConfirmed}
                    onScheduleChange={setIsConfirmed}
                  />
                  <p className="text-sm text-[var(--text-light)] mt-3">
                    {isConfirmed
                      ? "✓ This job will be confirmed and scheduled immediately."
                      : "ℹ This job will be added as a soft schedule and can be confirmed later."}
                  </p>
                </div>
              </div>
            )}

            {/* Footer with navigation */}
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
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 flex items-center justify-center z-[60] p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleDeleteCancel}
          />
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative z-10">
            <h3 className="text-xl font-bold text-[var(--dark-blue)] mb-4">
              Confirm Delete
            </h3>
            <p className="text-[var(--text-dark)] mb-6">
              Are you sure you want to delete{" "}
              <strong>Job #{job.job_number}</strong>? This action cannot be
              undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "Deleting..." : "Delete Job"}
              </button>
            </div>
          </div>
        </div>
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
                <div className="p-6 border-b border-[var(--border)]">
                  <h3 className="text-xl font-bold text-[var(--dark-blue)]">
                    Adjust Week {pendingRedistribution.weekIndex + 1} Quantity
                  </h3>
                </div>

                <div className="p-6 space-y-4">
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

      {/* Revision History Modal */}
      <JobRevisionHistoryModal
        isOpen={isRevisionHistoryOpen}
        onClose={() => setIsRevisionHistoryOpen(false)}
        jobId={job.id}
        jobNumber={job.job_number}
        jobName={job.job_name}
      />

      {/* Success Toasts */}
      {showDeleteToast && deletedJobNumber && (
        <Toast
          message={`Job #${deletedJobNumber} deleted successfully!`}
          type="success"
          onClose={() => setShowDeleteToast(false)}
        />
      )}

      {showSuccessToast && (
        <Toast
          message={`Job #${job.job_number} updated successfully!`}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}
