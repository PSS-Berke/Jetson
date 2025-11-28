"use client";

import { useState, FormEvent, useEffect } from "react";
import SmartClientSelect from "./SmartClientSelect";
import FacilityToggle from "./FacilityToggle";
import ScheduleToggle from "./ScheduleToggle";
import DynamicRequirementFields from "./DynamicRequirementFields";
import RecommendedMachines from "./RecommendedMachines";
import { getToken, getJobTemplates, createJobTemplate } from "@/lib/api";
import { getProcessTypeConfig } from "@/lib/processTypeConfig";
import Toast from "./Toast";

interface AddJobModalProps {
  isOpen: boolean;
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
  client_name: string;
  sub_clients_id: number | null;
  sub_client_name: string;
  job_name: string;
  description: string;
  quantity: string;
  csr: string;
  prgm: string;
  data_type: string;
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

type JobCreationMode = "new" | "template" | null;

interface JobTemplate {
  id: number;
  clients_id: number;
  template: Record<string, any>;
  created_at?: number;
  updated_at?: number;
  job_name?: string;
  job_number?: string;
}

export default function AddJobModal({
  isOpen,
  onClose,
  onSuccess,
}: AddJobModalProps) {
  const [creationMode, setCreationMode] = useState<JobCreationMode>(null);
  const [currentStep, setCurrentStep] = useState(0); // Start at step 0 for mode selection
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [createdJobNumber, setCreatedJobNumber] = useState<number | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false); // true = Schedule, false = Soft Schedule
  const [showBackwardRedistributeWarning, setShowBackwardRedistributeWarning] =
    useState(false);
  const [pendingRedistribution, setPendingRedistribution] = useState<{
    weekIndex: number;
    newValue: number;
  } | null>(null);
  const [tempWeekQuantity, setTempWeekQuantity] = useState<string>("");

  // Template selection state
  const [selectedTemplateClientId, setSelectedTemplateClientId] = useState<number | null>(null);
  const [selectedTemplateClientName, setSelectedTemplateClientName] = useState<string>("");
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [formData, setFormData] = useState<JobFormData>({
    job_number: "",
    clients_id: null,
    client_name: "",
    sub_clients_id: null,
    sub_client_name: "",
    job_name: "",
    description: "",
    quantity: "",
    csr: "",
    prgm: "",
    data_type: "",
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

        if (weeks > 0) {
          // Only recalculate from scratch if weekly_split is empty or length changed
          if (
            formData.weekly_split.length === 0 ||
            formData.weekly_split.length !== weeks
          ) {
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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    // Cleanup function to restore scroll on unmount
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCreationMode(null);
      setCurrentStep(0);
      setSelectedTemplateClientId(null);
      setSelectedTemplateClientName("");
      setTemplates([]);
      setSelectedTemplate(null);
      setIsCreatingTemplate(false);
      setFormData({
        job_number: "",
        clients_id: null,
        client_name: "",
        sub_clients_id: null,
        sub_client_name: "",
        job_name: "",
        description: "",
        quantity: "",
        csr: "",
        prgm: "",
        data_type: "",
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
    }
  }, [isOpen]);

  // Fetch templates when client is selected for template mode
  useEffect(() => {
    const fetchTemplates = async () => {
      if (creationMode === "template" && selectedTemplateClientId) {
        setLoadingTemplates(true);
        try {
          const fetchedTemplates = await getJobTemplates(selectedTemplateClientId);
          setTemplates(fetchedTemplates);
        } catch (error) {
          console.error("Error fetching templates:", error);
          setTemplates([]);
        } finally {
          setLoadingTemplates(false);
        }
      } else {
        setTemplates([]);
      }
    };

    fetchTemplates();
  }, [creationMode, selectedTemplateClientId]);

  // Load template data into form
  const loadTemplateIntoForm = (template: JobTemplate) => {
    const templateData = template.template;

    // Parse requirements if they're a string
    let requirements: Requirement[] = [
      {
        process_type: "",
        price_per_m: "",
      },
    ];

    if (templateData.requirements) {
      if (typeof templateData.requirements === "string") {
        try {
          requirements = JSON.parse(templateData.requirements);
        } catch (e) {
          console.error("Error parsing requirements:", e);
        }
      } else if (Array.isArray(templateData.requirements)) {
        requirements = templateData.requirements;
      }
    }

    // Convert dates from timestamps to date strings if needed
    const formatDate = (dateValue: any): string => {
      if (!dateValue) return "";
      if (typeof dateValue === "number") {
        return new Date(dateValue).toISOString().split("T")[0];
      }
      if (typeof dateValue === "string") {
        // Check if it's a timestamp string
        const timestamp = parseInt(dateValue);
        if (!isNaN(timestamp)) {
          return new Date(timestamp).toISOString().split("T")[0];
        }
        return dateValue;
      }
      return "";
    };

    setFormData({
      job_number: templateData.job_number?.toString() || "",
      clients_id: templateData.clients_id || selectedTemplateClientId || null,
      client_name: templateData.client_name || "",
      sub_clients_id: templateData.sub_clients_id || null,
      sub_client_name: templateData.sub_client_name || "",
      job_name: templateData.job_name || "",
      description: templateData.description || "",
      quantity: templateData.quantity?.toString() || "",
      csr: templateData.csr || "",
      prgm: templateData.prgm || "",
      data_type: templateData.data_type || "",
      facilities_id: templateData.facilities_id || null,
      start_date: formatDate(templateData.start_date),
      due_date: formatDate(templateData.due_date),
      service_type: templateData.service_type || "insert",
      pockets: templateData.pockets?.toString() || "2",
      machines_id: Array.isArray(templateData.machines_id)
        ? templateData.machines_id
        : templateData.machines_id
          ? [templateData.machines_id]
          : [],
      requirements: requirements.length > 0 ? requirements : [
        {
          process_type: "",
          price_per_m: "",
        },
      ],
      weekly_split: Array.isArray(templateData.weekly_split)
        ? templateData.weekly_split
        : [],
      locked_weeks: Array.isArray(templateData.locked_weeks)
        ? templateData.locked_weeks
        : [],
      price_per_m: templateData.price_per_m?.toString() || "",
      add_on_charges: templateData.add_on_charges?.toString() || "",
      ext_price: templateData.ext_price?.toString() || "",
      total_billing: templateData.total_billing?.toString() || "",
    });
  };

  if (!isOpen) return null;

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
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

  const handleModeSelection = (mode: "new" | "template") => {
    setCreationMode(mode);
    if (mode === "new") {
      // For new job, go to step 1 (Job Details)
      setCurrentStep(1);
    } else {
      // For template, go to step 1 (Client Selection for templates)
      setCurrentStep(1);
    }
  };

  const handleNext = () => {
    // Step 0: Mode selection (handled by handleModeSelection)

    // Step 1: For template mode, validate client selection (if not creating template)
    if (currentStep === 1 && creationMode === "template" && !isCreatingTemplate) {
      if (!selectedTemplateClientId) {
        alert("Please select a client");
        return;
      }
      // Move to template selection step
      setCurrentStep(2);
      return;
    }

    // Step 2: For template mode, validate template selection (only if not creating template)
    if (currentStep === 2 && creationMode === "template" && !isCreatingTemplate) {
      if (!selectedTemplate) {
        alert("Please select a template");
        return;
      }
      // Load template and go to review
      loadTemplateIntoForm(selectedTemplate);
      setCurrentStep(3);
      setIsConfirmed(false);
      return;
    }

    // Step 1 (for new job or template creation): Validate weekly split if present
    if (currentStep === 1 && (creationMode === "new" || (creationMode === "template" && isCreatingTemplate))) {
      // Validate weekly split if present
      if (
        formData.weekly_split.length > 0 &&
        getWeeklySplitDifference() !== 0
      ) {
        alert("Weekly split total must equal the total quantity");
        return;
      }
      setCurrentStep(2);
      return;
    }

    // Step 2 (for new job or template creation): Validate requirements
    if (currentStep === 2 && (creationMode === "new" || (creationMode === "template" && isCreatingTemplate))) {
      const allRequirementsValid = formData.requirements.every(
        (r, reqIndex) => {
          if (!r.process_type) {
            console.log(
              `[AddJobModal] Requirement ${reqIndex + 1}: Missing process_type`,
            );
            return false;
          }

          // For dynamic fields (fetched from API), we only validate that process_type is set
          // The actual field validation is handled by the dynamic form component
          // We check if there's at least one additional field filled besides process_type
          const fieldCount = Object.keys(r).filter(
            (key) =>
              key !== "process_type" &&
              r[key] !== undefined &&
              r[key] !== null &&
              r[key] !== "",
          ).length;

          if (fieldCount === 0) {
            console.log(
              `[AddJobModal] Requirement ${reqIndex + 1} (${r.process_type}): No fields filled`,
            );
            return false;
          }

          console.log(
            `[AddJobModal] Requirement ${reqIndex + 1} (${r.process_type}): Valid with ${fieldCount} fields filled`,
            r,
          );
          return true;
        },
      );

      console.log(
        `[AddJobModal] All requirements valid:`,
        allRequirementsValid,
      );
      console.log(`[AddJobModal] Requirements data:`, formData.requirements);

      if (!allRequirementsValid) {
        alert(
          "Please select a process type and fill in at least one field for each requirement",
        );
        return;
      }
      setCurrentStep(3);
      setIsConfirmed(false);
      return;
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      if (isCreatingTemplate) {
        if (currentStep === 1) {
          // Go back to template selection
          setIsCreatingTemplate(false);
          setCurrentStep(2);
        } else {
          setCurrentStep(currentStep - 1);
        }
        console.log("");
      } else if (currentStep === 1 && creationMode === "template") {
        // Go back to mode selection
        setCurrentStep(0);
        setCreationMode(null);
        setSelectedTemplateClientId(null);
        setTemplates([]);
        setSelectedTemplate(null);
      } else if (currentStep === 2 && creationMode === "template") {
        // Go back to client selection
        setCurrentStep(1);
        setSelectedTemplate(null);
      } else {
        setCurrentStep(currentStep - 1);
      }
    }
  };

  // Get the maximum step number based on mode
  const getMaxStep = (): number => {
    if (creationMode === "template") {
      if (isCreatingTemplate) {
        return 3; // Job Details -> Requirements -> Review
      }
      return 3; // Mode selection -> Client -> Template -> Review
    }
    return 3; // Mode selection -> Job Details -> Requirements -> Review
  };

  // Get step label
  const getStepLabel = (step: number): string => {
    if (step === 0) return "Select Method";
    if (creationMode === "template") {
      if (isCreatingTemplate) {
        if (step === 1) return "Job Details";
        if (step === 2) return "Services";
        if (step === 3) return "Review";
      } else {
        if (step === 1) return "Select Client";
        if (step === 2) return "Select Template";
        if (step === 3) return "Review";
      }
    } else {
      if (step === 1) return "Job Details";
      if (step === 2) return "Services";
      if (step === 3) return "Review";
    }
    return "";
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!selectedTemplateClientId) {
      alert("Please select a client first");
      return;
    }

    setSavingTemplate(true);
    try {
      // Prepare template data from form
      const templateData = {
        job_number: formData.job_number,
        clients_id: formData.clients_id || selectedTemplateClientId,
        client_name: formData.client_name,
        sub_clients_id: formData.sub_clients_id,
        sub_client_name: formData.sub_client_name,
        job_name: formData.job_name,
        description: formData.description,
        quantity: formData.quantity,
        csr: formData.csr,
        prgm: formData.prgm,
        facilities_id: formData.facilities_id,
        start_date: formData.start_date ? new Date(formData.start_date).getTime() : undefined,
        due_date: formData.due_date ? new Date(formData.due_date).getTime() : undefined,
        service_type: formData.service_type,
        pockets: formData.pockets,
        data_type: formData.data_type,
        machines_id: formData.machines_id,
        requirements: formData.requirements,
        weekly_split: formData.weekly_split,
        locked_weeks: formData.locked_weeks,
        price_per_m: formData.price_per_m,
        add_on_charges: formData.add_on_charges,
        ext_price: formData.ext_price,
        total_billing: formData.total_billing,
      };

      await createJobTemplate({
        clients_id: selectedTemplateClientId,
        template: templateData,
      });

      // Refresh templates
      const fetchedTemplates = await getJobTemplates(selectedTemplateClientId);
      setTemplates(fetchedTemplates);

      // Select the newly created template (it should be the last one)
      if (fetchedTemplates.length > 0) {
        const newTemplate = fetchedTemplates[fetchedTemplates.length - 1];
        setSelectedTemplate(newTemplate);
      }

      // Exit template creation mode and go back to template selection
      setIsCreatingTemplate(false);
      setCurrentStep(2);

      alert("Template saved successfully!");
    } catch (error: any) {
      console.error("Error saving template:", error);
      alert(`Failed to save template: ${error.message || "Please try again"}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  /**
   * Convert weekly split into daily breakdown for each week
   * Returns a 2D array where each inner array represents 7 days of a week [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
   *
   * Example:
   * If job starts on Wednesday and has weekly_split = [5000, 7000]
   * Week 1 (Wed-Sun): [0, 0, 1000, 1000, 1000, 1000, 1000] - 5000 split across 5 days
   * Week 2 (Mon-Sun): [1000, 1000, 1000, 1000, 1000, 1000, 1000] - 7000 split across 7 days
   *
   * Result: [[0, 0, 1000, 1000, 1000, 1000, 1000], [1000, 1000, 1000, 1000, 1000, 1000, 1000]]
   */
  const convertWeeklySplitToDailyBreakdown = (
    weeklySplit: number[],
    startDate: string,
    dueDate: string,
  ): number[][] => {
    if (!startDate || !dueDate || weeklySplit.length === 0) {
      return [];
    }

    const start = new Date(startDate);
    const due = new Date(dueDate);
    const dailyBreakdown: number[][] = [];

    // For each week in the split
    for (let weekIndex = 0; weekIndex < weeklySplit.length; weekIndex++) {
      const weekTotal = weeklySplit[weekIndex];
      const weekArray = [0, 0, 0, 0, 0, 0, 0]; // Mon, Tue, Wed, Thu, Fri, Sat, Sun

      // Calculate the start and end date for this week
      const weekStartDate = new Date(start);
      weekStartDate.setDate(start.getDate() + weekIndex * 7);

      const weekEndDate = new Date(weekStartDate);
      weekEndDate.setDate(weekStartDate.getDate() + 6);

      // Determine which days in this week are active
      const actualStartDate = weekIndex === 0 ? start : weekStartDate;
      const actualEndDate =
        weekIndex === weeklySplit.length - 1
          ? due < weekEndDate
            ? due
            : weekEndDate
          : weekEndDate;

      // Count active days in this week
      const activeDays: number[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDay = new Date(weekStartDate);
        currentDay.setDate(weekStartDate.getDate() + dayOffset);

        if (currentDay >= actualStartDate && currentDay <= actualEndDate) {
          activeDays.push(dayOffset);
        }
      }

      // Distribute the week's total evenly across active days
      if (activeDays.length > 0) {
        const amountPerDay = Math.floor(weekTotal / activeDays.length);
        const remainder = weekTotal % activeDays.length;

        activeDays.forEach((dayIndex, idx) => {
          // Distribute remainder across first few days
          weekArray[dayIndex] = amountPerDay + (idx < remainder ? 1 : 0);
        });
      }

      dailyBreakdown.push(weekArray);
    }

    return dailyBreakdown;
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
      const token = getToken();

      // Calculate total billing from requirements
      const quantity = parseInt(formData.quantity) || 0;
      const calculatedRevenue = formData.requirements.reduce((total, req) => {
        const pricePerM = parseFloat(String(req.price_per_m || "0")) || 0;
        return total + (quantity / 1000) * pricePerM;
      }, 0);

      const addOnCharges = parseFloat(String(formData.add_on_charges || "0")) || 0;
      const calculatedTotalBilling = calculatedRevenue + addOnCharges;

      // Convert date strings to timestamps
      const startDateTimestamp: number | undefined = formData.start_date
        ? new Date(formData.start_date).getTime()
        : undefined;
      const dueDateTimestamp: number | undefined = formData.due_date
        ? new Date(formData.due_date).getTime()
        : undefined;

      // Convert weekly split to daily breakdown
      const dailyBreakdown = convertWeeklySplitToDailyBreakdown(
        formData.weekly_split,
        formData.start_date,
        formData.due_date,
      );

      console.log(
        "[AddJobModal] Weekly split converted to daily breakdown:",
        dailyBreakdown,
      );
      console.log(
        "[AddJobModal] Daily breakdown format example:",
        JSON.stringify(dailyBreakdown, null, 2),
      );

      // Prepare the payload according to the API specification
      const payload: Record<string, unknown> = {
        description: formData.description,
        quantity: quantity,
        clients_id: formData.clients_id,
        sub_clients_id: formData.sub_clients_id,
        machines_id: formData.machines_id,
        job_number: formData.job_number,
        service_type: formData.service_type,
        pockets: parseInt(formData.pockets) || 0,
        job_name: formData.job_name,
        prgm: formData.prgm,
        csr: formData.csr,
        data_type: formData.data_type,
        price_per_m: (parseFloat(String(formData.price_per_m || "0")) || 0).toFixed(2),
        add_on_charges: addOnCharges.toFixed(2),
        ext_price: (parseFloat(String(formData.ext_price || "0")) || 0).toFixed(2),
        total_billing: calculatedTotalBilling.toFixed(2),
        requirements: JSON.stringify(formData.requirements),
        daily_split: dailyBreakdown,
        weekly_split: formData.weekly_split,
        locked_weeks: formData.locked_weeks,
        confirmed: isConfirmed,
      };

      // Only include dates if they are valid timestamps (not 0 or undefined)
      if (startDateTimestamp && startDateTimestamp > 0) {
        payload.start_date = startDateTimestamp;
      }
      if (dueDateTimestamp && dueDateTimestamp > 0) {
        payload.due_date = dueDateTimestamp;
      }

      // Only include facilities_id if it's not null
      if (formData.facilities_id !== null) {
        payload.facilities_id = formData.facilities_id;
      }

      console.log(
        "[AddJobModal] Requirements before stringify:",
        formData.requirements,
      );
      console.log(
        "[AddJobModal] Requirements after stringify:",
        JSON.stringify(formData.requirements),
      );
      console.log(
        "[AddJobModal] facilities_id in formData:",
        formData.facilities_id,
      );
      console.log(
        "[AddJobModal] facilities_id in payload:",
        payload.facilities_id,
      );
      console.log("[AddJobModal] Full payload being sent to Xano:", payload);
      console.log(
        "[AddJobModal] JSON stringified payload:",
        JSON.stringify(payload, null, 2),
      );

      const response = await fetch(
        "https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/jobs",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Xano API Error:", errorData);
        throw new Error(`Failed to create job: ${JSON.stringify(errorData)}`);
      }

      const responseData = await response.json();
      console.log("Xano API Response:", responseData);
      console.log(
        "[AddJobModal] facilities_id in API response:",
        responseData.facilities_id,
      );

      // Auto-sync job_cost_entry from requirements
      try {
        const { syncJobCostEntryFromRequirements } = await import("@/lib/api");
        await syncJobCostEntryFromRequirements(
          responseData.id,
          formData.requirements,
          formData.start_date,
          formData.facilities_id || undefined,
        );
        console.log("[AddJobModal] Job cost entry synced successfully");
      } catch (costError) {
        console.error(
          "[AddJobModal] Failed to sync job cost entry (non-blocking):",
          costError,
        );
        // Don't fail job creation if cost entry sync fails
      }

      const jobNum = parseInt(formData.job_number);
      setCreatedJobNumber(jobNum);
      setShowSuccessToast(true);

      // Reset form and close modal
      setFormData({
        job_number: "",
        clients_id: null,
        client_name: "",
        sub_clients_id: null,
        sub_client_name: "",
        job_name: "",
        description: "",
        quantity: "",
        csr: "",
        prgm: "",
        data_type: "",
        facilities_id: null,
        start_date: "",
        due_date: "",
        service_type: "insert",
        pockets: "2",
        machines_id: [],
        requirements: [
          {
            process_type: "",
            paper_size: "",
            pockets: 0,
            shifts_id: 0,
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
      setCurrentStep(1);

      // Delay closing to show toast
      setTimeout(() => {
        onClose();

        // Call success callback to refresh jobs list
        if (onSuccess) {
          onSuccess();
        }
      }, 500);
    } catch (error) {
      console.error("Error creating job:", error);
      alert("Failed to create job. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(0);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[var(--border)]">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
            Add New Job
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        {/* Step Indicator */}
        {creationMode && (
          <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-[var(--border)]">
            {(() => {
              const steps = creationMode === "template" && !isCreatingTemplate
                ? [0, 1, 2, 3] // Mode -> Client -> Template -> Review
                : creationMode === "template" && isCreatingTemplate
                  ? [1, 2, 3] // Job Details -> Requirements -> Review (no mode step shown)
                  : [0, 1, 2, 3]; // Mode -> Job Details -> Requirements -> Review

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
                        {getStepLabel(step)}
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
        )}

        {/* Form Content */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {/* Step 0: Mode Selection */}
          {currentStep === 0 && (
            <div className="space-y-6">
              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold text-[var(--dark-blue)] mb-2">
                  How would you like to create this job?
                </h3>
                <p className="text-sm text-[var(--text-light)]">
                  Choose to create a new job from scratch or use an existing template
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* New Job Option */}
                <button
                  type="button"
                  onClick={() => handleModeSelection("new")}
                  className="p-6 border-2 border-[var(--border)] rounded-lg hover:border-[var(--primary-blue)] hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mr-4 group-hover:bg-blue-200 transition-colors">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-[var(--text-dark)]">New Job</h4>
                  </div>
                  <p className="text-sm text-[var(--text-light)]">
                    Create a new job from scratch with all the details
                  </p>
                </button>

                {/* Template Option */}
                <button
                  type="button"
                  onClick={() => handleModeSelection("template")}
                  className="p-6 border-2 border-[var(--border)] rounded-lg hover:border-[var(--primary-blue)] hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="flex items-center mb-3">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mr-4 group-hover:bg-green-200 transition-colors">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-semibold text-[var(--text-dark)]">Use Template</h4>
                  </div>
                  <p className="text-sm text-[var(--text-light)]">
                    Select a past job template to quickly create a similar job
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Client Selection (Template Mode) */}
          {currentStep === 1 && creationMode === "template" && !isCreatingTemplate && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-2">
                  Select Client
                </h3>
                <p className="text-sm text-[var(--text-light)]">
                  Choose the client to view their job templates
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                  Client <span className="text-red-500">*</span>
                </label>
                <SmartClientSelect
                  value={selectedTemplateClientId}
                  onChange={(clientId, clientName) => {
                    setSelectedTemplateClientId(clientId);
                    setSelectedTemplateClientName(clientName);
                    setTemplates([]);
                    setSelectedTemplate(null);
                  }}
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Template Selection (Template Mode) */}
          {currentStep === 2 && creationMode === "template" && !isCreatingTemplate && (
            <div className="space-y-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-2">
                  Select Template
                </h3>
                <p className="text-sm text-[var(--text-light)]">
                  Choose a template to use as the base for your new job
                </p>
              </div>

              {loadingTemplates ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-blue)]"></div>
                  <p className="mt-2 text-sm text-[var(--text-light)]">Loading templates...</p>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-[var(--border)] rounded-lg">
                  <p className="text-[var(--text-light)] mb-4">No templates found for this client</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingTemplate(true);
                      // Pre-fill the client in the form
                      if (selectedTemplateClientId) {
                        setFormData((prev) => ({
                          ...prev,
                          clients_id: selectedTemplateClientId,
                          client_name: selectedTemplateClientName,
                        }));
                      }
                      setCurrentStep(1); // Go to job details step
                    }}
                    className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity"
                  >
                    Create Template
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedTemplate(template)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${selectedTemplate?.id === template.id
                        ? "border-[var(--primary-blue)] bg-blue-50"
                        : "border-[var(--border)] hover:border-blue-300 hover:bg-gray-50"
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold text-[var(--text-dark)]">
                            {template.template.job_name || `Template #${template.id}`}
                          </h4>
                          {template.template.job_number && (
                            <p className="text-sm text-[var(--text-light)] mt-1">
                              Job #: {template.template.job_number}
                            </p>
                          )}
                          {template.template.description && (
                            <p className="text-sm text-[var(--text-light)] mt-1 line-clamp-2">
                              {template.template.description}
                            </p>
                          )}
                        </div>
                        {selectedTemplate?.id === template.id && (
                          <div className="ml-4">
                            <svg className="w-6 h-6 text-[var(--primary-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 1: Job Details (New Job Mode or Template Creation Mode) */}
          {currentStep === 1 && (creationMode === "new" || (creationMode === "template" && isCreatingTemplate)) && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Client
                  </label>
                  <SmartClientSelect
                    value={formData.clients_id}
                    onChange={handleClientChange}
                    required={false}
                    initialClientName={formData.client_name || undefined}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Sub Client
                  </label>
                  <SmartClientSelect
                    value={formData.sub_clients_id}
                    onChange={handleSubClientChange}
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
                <div className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-[var(--text-dark)]">
                      Weekly Quantity Split ({formData.weekly_split.length}{" "}
                      weeks)
                    </h4>
                    <div
                      className={`text-sm font-semibold ${getWeeklySplitDifference() === 0
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
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] text-sm ${isLocked
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="Job description"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Services (New Job Mode or Template Creation Mode) */}
          {currentStep === 2 && (creationMode === "new" || (creationMode === "template" && isCreatingTemplate)) && (
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

                console.log('[AddJobModal] Rendering RecommendedMachines for requirement:', requirement);

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
              {isCreatingTemplate && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded mb-4">
                  <p className="text-sm text-yellow-800 font-medium">
                    Creating a template for {selectedTemplateClientId ? "this client" : "the selected client"}.
                    Fill out the form below and click &quot;Save Template&quot; when done.
                  </p>
                </div>
              )}
              <div className="bg-[var(--bg-alert-info)] border-l-4 border-[var(--primary-blue)] p-4 rounded">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-[var(--text-dark)]">
                    {isCreatingTemplate ? "Template Summary" : "Job Summary"}
                  </h3>
                  {!isCreatingTemplate && (
                    <button
                      type="button"
                      onClick={() => {
                        // Switch to new job mode to enable editing
                        if (creationMode === "template" && !isCreatingTemplate) {
                          setCreationMode("new");
                        }
                        setCurrentStep(1);
                      }}
                      className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
                    >
                      Edit Details
                    </button>
                  )}
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
                    Job Services & Pricing
                  </h3>
                  {!isCreatingTemplate && (
                    <button
                      type="button"
                      onClick={() => {
                        // Switch to new job mode to enable editing
                        if (creationMode === "template" && !isCreatingTemplate) {
                          setCreationMode("new");
                        }
                        setCurrentStep(2);
                      }}
                      className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
                    >
                      Edit Services
                    </button>
                  )}
                </div>
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
                            Service {index + 1}:{" "}
                          </span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            {processConfig?.label || req.process_type}
                          </span>
                        </div>

                        {/* Display all fields for this requirement */}
                        <div className="grid grid-cols-2 gap-2 mb-2 ml-4">
                          {processConfig?.fields.map((fieldConfig) => {
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

                {/* Total Price Calculation */}
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

              {/* Selected Machines Section */}
              <div className="bg-white border border-[var(--border)] rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-[var(--text-dark)]">
                    Assigned Machines
                  </h3>
                  {!isCreatingTemplate && (
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="text-sm text-[var(--primary-blue)] hover:underline font-medium"
                    >
                      Edit Machines
                    </button>
                  )}
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

              {!isCreatingTemplate && (
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
              )}
            </div>
          )}

          {/* Footer - Inside Form */}
          {currentStep > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-[var(--border)]">
              <div className="text-sm text-[var(--text-light)]">
                Step {currentStep} of {getMaxStep()}
              </div>
              <div className="flex gap-3">
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={handlePrevious}
                    className="px-6 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
                  >
                    Previous
                  </button>
                )}
                {currentStep < getMaxStep() ? (
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={
                      (currentStep === 2 && (creationMode === "new" || (creationMode === "template" && isCreatingTemplate)) &&
                        formData.requirements.some((r) => {
                          if (!r.process_type) return true;
                          // Check if at least one field besides process_type is filled
                          const fieldCount = Object.keys(r).filter(
                            (key) =>
                              key !== "process_type" &&
                              r[key] !== undefined &&
                              r[key] !== null &&
                              r[key] !== "",
                          ).length;
                          return fieldCount === 0;
                        })) ||
                      (currentStep === 1 && creationMode === "template" && !isCreatingTemplate && !selectedTemplateClientId) ||
                      (currentStep === 2 && creationMode === "template" && !isCreatingTemplate && !selectedTemplate)
                    }
                    className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                ) : (
                  <>
                    {isCreatingTemplate ? (
                      <button
                        type="button"
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate || !formData.job_name || !formData.job_number}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingTemplate ? "Saving Template..." : "Save Template"}
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
                        {submitting ? "Creating Job..." : "Submit Job"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

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

      {/* Success Toast */}
      {showSuccessToast && createdJobNumber && (
        <Toast
          message={`Job #${createdJobNumber} created successfully!`}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </div>
  );
}
