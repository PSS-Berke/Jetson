"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import SmartClientSelect from "./SmartClientSelect";
import FacilityToggle from "./FacilityToggle";
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
  const [scheduleType, setScheduleType] = useState<string>("soft schedule"); // "Hard Schedule", "soft schedule", "Cancelled", "projected", "completed"
  const [showBackwardRedistributeWarning, setShowBackwardRedistributeWarning] =
    useState(false);
  const [pendingRedistribution, setPendingRedistribution] = useState<{
    weekIndex: number;
    newValue: number;
  } | null>(null);
  const [tempWeekQuantity, setTempWeekQuantity] = useState<string>("");
  const [runSaturdays, setRunSaturdays] = useState<boolean>(false);
  const [splitResults, setSplitResults] = useState<Array<{
    Date: string;
    CalendarDayInWeek: number;
    CalendarWeek: number;
    Quantity: number;
  }>>([]);
  const [loadingSplit, setLoadingSplit] = useState<boolean>(false);

  // Template selection state
  const [selectedTemplateClientId, setSelectedTemplateClientId] = useState<number | null>(null);
  const [selectedTemplateClientName, setSelectedTemplateClientName] = useState<string>("");
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<JobTemplate | null>(null);
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
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

  // Automatically calculate split when quantity, start_date, or due_date changes (step 1 only)
  useEffect(() => {
    // Only run on step 1 for new job or template creation mode
    if (
      currentStep === 1 &&
      (creationMode === "new" || (creationMode === "template" && isCreatingTemplate)) &&
      formData.start_date &&
      formData.due_date &&
      formData.quantity
    ) {
      const calculateSplit = async () => {
        setLoadingSplit(true);
        try {
          const token = getToken();
          const quantity = parseInt(formData.quantity) || 0;
          
          // Use ISO date strings (YYYY-MM-DD format)
          const startDate = formData.start_date;
          const endDate = formData.due_date;

          const params = new URLSearchParams({
            start: startDate,
            end: endDate,
            quantity: quantity.toString(),
            saturday: runSaturdays.toString(),
          });

          const response = await fetch(
            `https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/quantity_split?${params.toString()}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to calculate split: ${JSON.stringify(errorData)}`);
          }

          const data = await response.json();
          setSplitResults(data);
        } catch (error) {
          console.error("Error calculating split:", error);
          // Don't show alert on automatic calls, just log the error
          setSplitResults([]);
        } finally {
          setLoadingSplit(false);
        }
      };

      calculateSplit();
    }
  }, [formData.quantity, formData.start_date, formData.due_date, runSaturdays, currentStep, creationMode, isCreatingTemplate]);

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
      setRunSaturdays(false);
      setSplitResults([]);
      setScheduleType("soft schedule");
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
    // Remove commas from the input value before storing
    const cleanedValue = e.target.value.replace(/,/g, "");
    setFormData({
      ...formData,
      quantity: cleanedValue,
    });
  };

  const handleCalculateSplit = async () => {
    if (!formData.start_date || !formData.due_date || !formData.quantity) {
      alert("Please fill in start date, due date, and quantity before calculating split");
      return;
    }

    setLoadingSplit(true);
    try {
      const token = getToken();
      const quantity = parseInt(formData.quantity) || 0;
      
      // Use ISO date strings (YYYY-MM-DD format)
      const startDate = formData.start_date;
      const endDate = formData.due_date;

      const params = new URLSearchParams({
        start: startDate,
        end: endDate,
        quantity: quantity.toString(),
        saturday: runSaturdays.toString(),
      });

      const response = await fetch(
        `https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/quantity_split?${params.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to calculate split: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json();
      setSplitResults(data);
    } catch (error) {
      console.error("Error calculating split:", error);
      alert("Failed to calculate split. Please try again.");
      setSplitResults([]);
    } finally {
      setLoadingSplit(false);
    }
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
      requirements: prev.requirements.map((req, idx) => {
        if (idx !== requirementIndex) return req;
        
        // Check if the value is invalid/unselected
        const isInvalid = 
          value === undefined || 
          value === null || 
          value === false || 
          value === "false" || 
          value === 0 || 
          (typeof value === "string" && value.trim() === "");
        
        // If the value is invalid, remove the field entirely (and its cost field if it exists)
        if (isInvalid) {
          const { [field]: removedField, ...rest } = req;
          // Also remove the associated cost field if it exists
          const costFieldName = `${String(field)}_cost` as keyof Requirement;
          if (costFieldName in rest) {
            const { [costFieldName]: removedCost, ...restWithoutCost } = rest;
            return restWithoutCost as Requirement;
          }
          return rest as Requirement;
        }
        
        // Otherwise, update the field with the new value
        return { ...req, [field]: value };
      }),
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
      setScheduleType("soft schedule");
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
      setScheduleType("soft schedule");
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
      // Filter to only valid requirements (those with process_type and at least one field)
      const validRequirements = getValidRequirements(formData.requirements);
      
      // Clean each requirement to remove unselected fields (false, empty, null, undefined)
      // This ensures unselected fields are completely omitted from the template
      const cleanedRequirements = validRequirements.map(req => cleanRequirement(req));

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
        requirements: cleanedRequirements,
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

  // Helper function to check if a field value is valid/selected
  // Returns true if the field should be considered "selected" and its cost should be included
  const isFieldValueValid = (value: any): boolean => {
    if (value === undefined || value === null) return false;
    
    // Handle boolean values - only true is valid
    if (value === true || value === "true" || value === 1) return true;
    if (value === false || value === "false" || value === 0) return false;
    
    // Handle strings - must be non-empty
    if (typeof value === "string") {
      return value.trim() !== "";
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
        
        const costValue = parseFloat(String(req[costKey] || "0")) || 0;
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

      // Convert date strings to timestamps
      const startDateTimestamp: number | undefined = formData.start_date
        ? new Date(formData.start_date).getTime()
        : undefined;
      const dueDateTimestamp: number | undefined = formData.due_date
        ? new Date(formData.due_date).getTime()
        : undefined;

      // Convert splitResults to daily_split format for new API
      // Format: [{ date: "01.01.2026", quantity: 1000 }]
      // Date format: DD.MM.YYYY
      const formatDateToDDMMYYYY = (dateString: string): string => {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
      };

      const dailySplit = splitResults.length > 0
        ? splitResults.map((item) => ({
            date: formatDateToDDMMYYYY(item.Date),
            quantity: item.Quantity,
          }))
        : [];

      // Use the selected schedule type directly

      // Prepare the payload according to the new v2 API specification
      // Only include valid requirements in the request body
      const payload: Record<string, unknown> = {
        job_number: formData.job_number || "",
        service_type: formData.service_type || "",
        quantity: quantity,
        description: formData.description || "",
        start_date: startDateTimestamp && startDateTimestamp > 0 ? startDateTimestamp : null,
        due_date: dueDateTimestamp && dueDateTimestamp > 0 ? dueDateTimestamp : null,
        time_estimate: null,
        clients_id: formData.clients_id || 0,
        machines_id: formData.machines_id || [],
        job_name: formData.job_name || "",
        prgm: formData.prgm || "",
        csr: formData.csr || "",
        requirements: cleanedRequirements || [],
        total_billing: calculatedTotalBilling > 0 ? calculatedTotalBilling : null,
        facilities_id: formData.facilities_id,
        daily_split: dailySplit,
        sub_client_id: formData.sub_clients_id || 0,
        schedule_type: scheduleType || "soft schedule",
      };

      console.log(
        "[AddJobModal] All requirements:",
        formData.requirements,
      );
      console.log(
        "[AddJobModal] Valid requirements (filtered):",
        validRequirements,
      );
      console.log(
        "[AddJobModal] Cleaned requirements (unselected fields removed):",
        cleanedRequirements,
      );
      console.log(
        "[AddJobModal] Requirements after stringify:",
        JSON.stringify(cleanedRequirements),
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
        "https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/jobs/v2",
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

      // Auto-sync job_cost_entry from valid requirements only
      try {
        const { syncJobCostEntryFromRequirements } = await import("@/lib/api");
        await syncJobCostEntryFromRequirements(
          responseData.id,
          cleanedRequirements,
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
      setScheduleType("soft schedule");
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
                    {loadingSplit && (
                      <div className="flex items-center gap-2 text-sm text-[var(--text-light)]">
                        <svg className="animate-spin h-4 w-4 text-[var(--primary-blue)]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Calculating split...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Split Results Display */}
              {splitResults.length > 0 && (
                <div className="border border-[var(--border)] rounded-lg p-4 bg-blue-50">
                  <h4 className="font-semibold text-[var(--text-dark)] mb-3">
                    Calculated Quantity Split
                  </h4>
                  <div className="space-y-3">
                    {(() => {
                      // Group results by CalendarWeek
                      const groupedByWeek = splitResults.reduce((acc, item) => {
                        if (!acc[item.CalendarWeek]) {
                          acc[item.CalendarWeek] = [];
                        }
                        acc[item.CalendarWeek].push(item);
                        return acc;
                      }, {} as Record<number, typeof splitResults>);

                      // Sort weeks and days within each week
                      const sortedWeeks = Object.keys(groupedByWeek)
                        .map(Number)
                        .sort((a, b) => a - b);

                      const dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

                      return sortedWeeks.map((week) => {
                        const weekData = groupedByWeek[week].sort(
                          (a, b) => a.CalendarDayInWeek - b.CalendarDayInWeek
                        );
                        const weekTotal = weekData.reduce((sum, item) => sum + item.Quantity, 0);
                        const startDate = weekData[0]?.Date || "";
                        const endDate = weekData[weekData.length - 1]?.Date || "";

                        return (
                          <div
                            key={week}
                            className="bg-white border border-[var(--border)] rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <span className="font-semibold text-[var(--text-dark)]">
                                  Week {week}
                                </span>
                                <span className="text-sm text-[var(--text-light)] ml-2">
                                  ({startDate} to {endDate})
                                </span>
                              </div>
                              <span className="font-semibold text-[var(--primary-blue)]">
                                Total: {weekTotal.toLocaleString()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              {weekData.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between bg-gray-50 px-2 py-1 rounded"
                                >
                                  <span className="text-[var(--text-light)]">
                                    {dayNames[item.CalendarDayInWeek]}:
                                  </span>
                                  <span className="font-medium text-[var(--text-dark)]">
                                    {item.Quantity.toLocaleString()}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

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
                {getValidRequirements(formData.requirements).map((req, index) => {
                  const quantity = parseInt(formData.quantity || "0");
                  const pricePerM = parseFloat(req.price_per_m || "0");

                  // Debug: Log requirement object
                  console.log('[AddJobModal Review] Full requirement object:', req);
                  console.log('[AddJobModal Review] All keys:', Object.keys(req));
                  console.log('[AddJobModal Review] Cost keys:', Object.keys(req).filter(key => key.endsWith('_cost')));

                  // Calculate additional field costs (only for selected fields)
                  const additionalCosts = calculateAdditionalCosts(req, quantity);

                  console.log('[AddJobModal Review] Total additional costs:', additionalCosts);
                  console.log('[AddJobModal Review] Price per M:', pricePerM);
                  console.log('[AddJobModal Review] Base calculation:', (quantity / 1000) * pricePerM);
                  console.log('[AddJobModal Review] Final total:', (quantity / 1000) * pricePerM + additionalCosts);

                  const requirementTotal = (quantity / 1000) * pricePerM + additionalCosts;
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
                            if (!isFieldValueValid(fieldValue)) {
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

                          {/* Display dynamic fields not in processConfig (e.g., boolean fields from machine variables) */}
                          {Object.keys(req)
                            .filter(key => {
                              // Exclude fields already shown in processConfig
                              const isInProcessConfig = processConfig?.fields.some(f => f.name === key);
                              // Exclude system fields
                              const isSystemField = key === "process_type" || key === "price_per_m" || key === "id" || key.endsWith('_cost');
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

                              // Format the value
                              let displayValue: string;
                              if (typeof fieldValue === "boolean") {
                                displayValue = fieldValue ? "Yes" : "No";
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

                          {/* Display additional fields with costs */}
                          {Object.keys(req)
                            .filter(key => key.endsWith('_cost'))
                            .map(costKey => {
                              const costValue = parseFloat(String(req[costKey] || "0")) || 0;
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
                      {getValidRequirements(formData.requirements)
                        .reduce((total, req) => {
                          const quantity = parseInt(formData.quantity || "0");
                          const pricePerM = parseFloat(req.price_per_m || "0");

                          // Calculate additional field costs (only for selected fields)
                          const additionalCosts = calculateAdditionalCosts(req, quantity);

                          return total + (quantity / 1000) * pricePerM + additionalCosts;
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