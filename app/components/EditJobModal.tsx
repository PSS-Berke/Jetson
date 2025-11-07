'use client';

import { useState, FormEvent, useEffect } from 'react';
import SmartClientSelect from './SmartClientSelect';
import FacilityToggle from './FacilityToggle';
import DynamicRequirementFields from './DynamicRequirementFields';
import { updateJob, deleteJob } from '@/lib/api';
import { type ParsedJob } from '@/hooks/useJobs';
import { getProcessTypeConfig } from '@/lib/processTypeConfig';
import Toast from './Toast';

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
  [key: string]: string | number | undefined;
}

interface JobFormData {
  job_number: string;
  clients_id: number | null;
  client_name: string;
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
  price_per_m: string;
  add_on_charges: string;
  ext_price: string;
  total_billing: string;
}

export default function EditJobModal({ isOpen, job, onClose, onSuccess }: EditJobModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [canSubmit, setCanSubmit] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false); // true = Schedule, false = Soft Schedule
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<JobFormData>({
    job_number: '',
    clients_id: null,
    client_name: '',
    job_name: '',
    description: '',
    quantity: '',
    csr: '',
    prgm: '',
    facilities_id: null,
    start_date: '',
    due_date: '',
    service_type: 'insert',
    pockets: '2',
    machines_id: [],
    requirements: [
      {
        process_type: '',
        price_per_m: ''
      }
    ],
    weekly_split: [],
    price_per_m: '',
    add_on_charges: '',
    ext_price: '',
    total_billing: ''
  });

  // Initialize form with job data when modal opens
  useEffect(() => {
    if (isOpen && job) {
      console.log('EditJobModal - Initializing with job:', job);
      console.log('EditJobModal - Client data:', job.client);
      
      // Parse requirements if it's a JSON string or already an array
      let parsedRequirements: Requirement[];
      try {
        if (typeof job.requirements === 'string') {
          parsedRequirements = JSON.parse(job.requirements);
        } else if (Array.isArray(job.requirements)) {
          // Map ParsedRequirement[] to Requirement[] - copy all fields dynamically
          parsedRequirements = job.requirements.map(req => {
            // Create a copy with all fields, removing legacy shifts_id
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
            const { shifts_id, ...rest } = req as any;
            return {
              process_type: req.process_type || '',
              ...rest
            };
          });
        } else {
          parsedRequirements = [{ process_type: '', price_per_m: '' }];
        }

        // Ensure requirements is an array with at least one item
        if (!parsedRequirements || parsedRequirements.length === 0) {
          parsedRequirements = [{ process_type: '', price_per_m: '' }];
        }
      } catch (error) {
        console.error('Failed to parse requirements:', error);
        parsedRequirements = [{ process_type: '', price_per_m: '' }];
      }

      // Convert timestamps to YYYY-MM-DD format for date inputs
      const formatDate = (timestamp: number | null | undefined) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toISOString().split('T')[0];
      };

      // Helper to safely convert to string, handling both string and number types
      const toStringValue = (value: unknown) => {
        if (value === null || value === undefined) return '';
        return String(value);
      };

      const clientId = job.client?.id || null;
      const clientName = job.client?.name || '';
      
      console.log('EditJobModal - Setting formData with:', { clientId, clientName });
      
      // Parse weekly_split if it exists
      let weeklySplit: number[] = [];
      const jobWithSplit = job as typeof job & { weekly_split?: number[] | string };
      if (jobWithSplit.weekly_split) {
        if (Array.isArray(jobWithSplit.weekly_split)) {
          weeklySplit = jobWithSplit.weekly_split;
        }
      }

      const jobWithFields = job as typeof job & {
        price_per_m?: string | number;
        add_on_charges?: string | number;
        ext_price?: string | number;
        total_billing?: string | number;
      };

      setFormData({
        job_number: toStringValue(job.job_number),
        clients_id: clientId,
        client_name: clientName,
        job_name: toStringValue(job.job_name),
        description: toStringValue(job.description),
        quantity: toStringValue(job.quantity),
        csr: toStringValue(job.csr),
        prgm: toStringValue(job.prgm),
        facilities_id: job.facilities_id || null,
        start_date: formatDate(job.start_date),
        due_date: formatDate(job.due_date),
        service_type: job.service_type || 'insert',
        pockets: '2', // Default value - pockets are defined in requirements
        machines_id: job.machines?.map(m => m.id) || [],
        requirements: parsedRequirements,
        weekly_split: weeklySplit,
        price_per_m: toStringValue(jobWithFields.price_per_m || ''),
        add_on_charges: toStringValue(jobWithFields.add_on_charges || ''),
        ext_price: toStringValue(jobWithFields.ext_price || ''),
        total_billing: toStringValue(jobWithFields.total_billing || '')
      });
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
        const daysDiff = Math.ceil((dueDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
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
          
          setFormData(prev => ({ ...prev, weekly_split: newSplit }));
        }
      }
    }
  }, [formData.start_date, formData.due_date, formData.quantity, formData.weekly_split.length]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleClientChange = (clientId: number, clientName: string) => {
    setFormData({
      ...formData,
      clients_id: clientId,
      client_name: clientName
    });
  };

  const handleRequirementChange = (requirementIndex: number, field: keyof Requirement, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      requirements: prev.requirements.map((req, idx) =>
        idx === requirementIndex ? { ...req, [field]: value } : req
      )
    }));
  };

  const addRequirement = () => {
    setFormData(prev => ({
      ...prev,
      requirements: [...prev.requirements, {
        process_type: '',
        price_per_m: ''
      }]
    }));
  };

  const removeRequirement = (requirementIndex: number) => {
    if (formData.requirements.length > 1) {
      setFormData(prev => ({
        ...prev,
        requirements: prev.requirements.filter((_, idx) => idx !== requirementIndex)
      }));
    }
  };

  const handleWeeklySplitChange = (weekIndex: number, value: string) => {
    // Remove commas from the input value before parsing
    const cleanedValue = value.replace(/,/g, '');
    const newValue = parseInt(cleanedValue) || 0;

    setFormData(prev => {
      const totalQuantity = parseInt(prev.quantity) || 0;
      const newSplit = [...prev.weekly_split];

      // Update the changed week
      newSplit[weekIndex] = newValue;

      // Calculate how much quantity is left to distribute
      const currentTotal = newSplit.reduce((sum, val) => sum + val, 0);
      const difference = totalQuantity - currentTotal;

      // If there's a difference, redistribute it across other weeks
      if (difference !== 0) {
        // Get indices of all other weeks (excluding the one being changed)
        const otherWeekIndices = newSplit
          .map((_, idx) => idx)
          .filter(idx => idx !== weekIndex);

        if (otherWeekIndices.length > 0) {
          // Calculate base adjustment per week
          const baseAdjustment = Math.floor(difference / otherWeekIndices.length);
          const remainder = difference % otherWeekIndices.length;

          // Apply adjustments to other weeks
          otherWeekIndices.forEach((idx, position) => {
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

      return { ...prev, weekly_split: newSplit };
    });
  };

  const getWeeklySplitSum = () => {
    return formData.weekly_split.reduce((sum, val) => sum + val, 0);
  };

  const getWeeklySplitDifference = () => {
    const quantity = parseInt(formData.quantity) || 0;
    return getWeeklySplitSum() - quantity;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (!formData.job_number || !formData.clients_id) {
        alert('Please fill in job number and client name');
        return;
      }
      // Validate weekly split if present
      if (formData.weekly_split.length > 0 && getWeeklySplitDifference() !== 0) {
        alert('Weekly split total must equal the total quantity');
        return;
      }
    }

    // Validate step 2 - all requirements must have required fields based on their process type
    if (currentStep === 2) {
      const allRequirementsValid = formData.requirements.every(r => {
        if (!r.process_type) return false;

        const config = getProcessTypeConfig(r.process_type);
        if (!config) return false;

        // Check all required fields for this process type
        return config.fields.every(field => {
          if (!field.required) return true;
          const value = r[field.name];
          return value !== undefined && value !== null && value !== '';
        });
      });

      if (!allRequirementsValid) {
        alert('Please fill in all required fields for each requirement');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      // Reset schedule type to soft schedule when entering review step
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

      // Validate that we have at least one machine selected
      if (!formData.machines_id || formData.machines_id.length === 0) {
        alert('Please select at least one machine');
        return;
      }

      // Validate that we have requirements
      if (!formData.requirements || formData.requirements.length === 0) {
        alert('Please add at least one requirement');
        return;
      }

      // Calculate total billing from requirements
      const quantity = parseInt(formData.quantity);
      const calculatedRevenue = formData.requirements.reduce((total, req) => {
        const pricePerM = parseFloat(req.price_per_m || '0');
        return total + ((quantity / 1000) * pricePerM);
      }, 0);

      const addOnCharges = parseFloat(formData.add_on_charges || '0');
      const calculatedTotalBilling = calculatedRevenue + addOnCharges;

      const payload: Partial<{
        jobs_id: number;
        job_number: number;
        service_type: string;
        quantity: number;
        description: string;
        start_date: number;
        due_date: number;
        time_estimate: number | null;
        clients_id: number;
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
        confirmed: boolean;
      }> = {
        jobs_id: job.id,
        job_number: parseInt(formData.job_number),
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
        price_per_m: formData.price_per_m || '0',
        add_on_charges: addOnCharges.toString(),
        ext_price: formData.ext_price || '0',
        total_billing: calculatedTotalBilling.toString(),
        weekly_split: formData.weekly_split,
        confirmed: isConfirmed
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

      console.log('Payload being sent to Xano (Edit):', payload);
      await updateJob(job.id, payload);
      console.log('Job updated successfully');

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
      console.error('Error updating job:', error);
      alert('Failed to update job. Please try again.');
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
      console.error('Error deleting job:', error);
      alert('Failed to delete job. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
      />
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Edit Job #{job.job_number}</h2>
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
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center" style={{ flex: step === 3 ? '0 1 auto' : '1 1 0%' }}>
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                  step === currentStep
                    ? 'bg-[#EF3340] text-white'
                    : step < currentStep
                    ? 'bg-[#EF3340] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step < currentStep ? '✓' : step}
                </div>
                <div className="ml-3">
                  <div className={`text-xs font-medium whitespace-nowrap ${
                    step === currentStep ? 'text-[#EF3340]' : 'text-gray-500'
                  }`}>
                    {step === 1 && 'Job Details'}
                    {step === 2 && 'Requirements'}
                    {step === 3 && 'Review'}
                  </div>
                </div>
              </div>
              {step < 3 && (
                <div className={`h-0.5 flex-1 mx-4 ${
                  step < currentStep ? 'bg-[#EF3340]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <form 
          onSubmit={handleSubmit} 
          onKeyDown={(e) => {
            // Prevent Enter key from submitting form on steps 1 and 2
            if (e.key === 'Enter' && currentStep !== 3 && e.target instanceof HTMLInputElement) {
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
                    Client <span className="text-red-500">*</span>
                  </label>
                  <SmartClientSelect
                    value={formData.clients_id}
                    onChange={handleClientChange}
                    initialClientName={formData.client_name}
                    required
                  />
                </div>
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
                    Job # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="job_number"
                    value={formData.job_number}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="e.g., 43"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Facility <span className="text-red-500">*</span>
                  </label>
                  <FacilityToggle
                    currentFacility={formData.facilities_id}
                    onFacilityChange={(facility) => setFormData({ ...formData, facilities_id: facility })}
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
                    Quantity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="e.g., 73"
                    required
                  />
                </div>
              </div>

              {/* Weekly Split Section */}
              {formData.weekly_split.length > 0 && (
                <div className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-[var(--text-dark)]">
                      Weekly Quantity Split ({formData.weekly_split.length} weeks)
                    </h4>
                    <div className={`text-sm font-semibold ${
                      getWeeklySplitDifference() === 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      Total: {getWeeklySplitSum().toLocaleString()} / {parseInt(formData.quantity || '0').toLocaleString()}
                      {getWeeklySplitDifference() !== 0 && (
                        <span className="ml-1">
                          ({getWeeklySplitDifference() > 0 ? '+' : ''}{getWeeklySplitDifference()})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {formData.weekly_split.map((amount, index) => (
                      <div key={index}>
                        <label className="block text-xs font-medium text-[var(--text-light)] mb-1">
                          Week {index + 1}
                        </label>
                        <input
                          type="text"
                          value={amount.toLocaleString()}
                          onChange={(e) => handleWeeklySplitChange(index, e.target.value)}
                          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] text-sm"
                        />
                      </div>
                    ))}
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

          {/* Step 2: Requirements */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-6">Job Requirements</h3>

              {formData.requirements.map((requirement, index) => (
                <div key={index} className="border border-[var(--border)] rounded-lg p-6 space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-[var(--text-dark)]">Requirement {index + 1}</h4>
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

                  {/* Dynamic Requirement Fields */}
                  <DynamicRequirementFields
                    requirement={requirement}
                    onChange={(field, value) => handleRequirementChange(index, field, value)}
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
                <h3 className="font-semibold text-[var(--text-dark)] mb-2">Job Summary</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-light)]">Job #:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.job_number}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Facility:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">
                      {formData.facilities_id === 1 ? 'Bolingbrook' : formData.facilities_id === 2 ? 'Lemont' : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Client:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.client_name}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Job Name:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.job_name || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Service Type:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.service_type}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">CSR:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.csr || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Quantity:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{parseInt(formData.quantity || '0').toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Start Date:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.start_date || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Due Date:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.due_date || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[var(--border)] rounded-lg p-4">
                <h3 className="font-semibold text-[var(--text-dark)] mb-3">Job Requirements & Pricing</h3>
                {formData.requirements.map((req, index) => {
                  const quantity = parseInt(formData.quantity || '0');
                  const pricePerM = parseFloat(req.price_per_m || '0');
                  const requirementTotal = (quantity / 1000) * pricePerM;
                  const processConfig = getProcessTypeConfig(req.process_type);

                  return (
                    <div key={index} className="mb-4 pb-4 border-b border-[var(--border)] last:border-b-0">
                      <div className="text-sm">
                        <div className="mb-2">
                          <span className="text-[var(--text-light)]">Requirement {index + 1}: </span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            {processConfig?.label || req.process_type}
                          </span>
                        </div>

                        {/* Display all fields for this requirement */}
                        <div className="grid grid-cols-2 gap-2 mb-2 ml-4">
                          {processConfig?.fields.map((fieldConfig) => {
                            const fieldValue = req[fieldConfig.name as keyof typeof req];

                            // Skip if field has no value
                            if (fieldValue === undefined || fieldValue === null || fieldValue === '') {
                              return null;
                            }

                            // Format the value based on field type
                            let displayValue: string;
                            if (fieldConfig.type === 'currency') {
                              displayValue = `$${parseFloat(String(fieldValue)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                            } else {
                              displayValue = String(fieldValue);
                            }

                            return (
                              <div key={fieldConfig.name} className="text-xs">
                                <span className="text-[var(--text-light)]">{fieldConfig.label}: </span>
                                <span className="text-[var(--text-dark)] font-medium">{displayValue}</span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                          <span className="text-[var(--text-light)]">Subtotal for this requirement:</span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            ${requirementTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Total Price Calculation */}
                <div className="mt-4 pt-4 border-t-2 border-[var(--primary-blue)]">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--text-dark)] text-lg">Total Job Price:</span>
                    <span className="font-bold text-[var(--primary-blue)] text-xl">
                      ${formData.requirements.reduce((total, req) => {
                        const quantity = parseInt(formData.quantity || '0');
                        const pricePerM = parseFloat(req.price_per_m || '0');
                        return total + ((quantity / 1000) * pricePerM);
                      }, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="border-2 border-[var(--border)] rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold text-[var(--text-dark)] mb-3">Schedule Type</h4>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsConfirmed(false)}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                      !isConfirmed
                        ? 'bg-[#2E3192] text-white shadow-md'
                        : 'bg-white text-[var(--text-dark)] border-2 border-gray-300 hover:border-[#2E3192]'
                    }`}
                  >
                    Soft Schedule
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmed(true)}
                    className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
                      isConfirmed
                        ? 'bg-[#EF3340] text-white shadow-md'
                        : 'bg-white text-[var(--text-dark)] border-2 border-gray-300 hover:border-[#EF3340]'
                    }`}
                  >
                    Schedule
                  </button>
                </div>
                <p className="text-sm text-[var(--text-light)] mt-3">
                  {isConfirmed 
                    ? '✓ This job will be confirmed and scheduled immediately.'
                    : 'ℹ This job will be added as a soft schedule and can be confirmed later.'}
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
                  disabled={
                    (currentStep === 1 && (!formData.job_number || !formData.clients_id || !formData.quantity)) ||
                    (currentStep === 2 && formData.requirements.some(r => {
                      if (!r.process_type) return true;
                      const config = getProcessTypeConfig(r.process_type);
                      if (!config) return true;
                      return config.fields.some(field => {
                        if (!field.required) return false;
                        const value = r[field.name];
                        return value === undefined || value === null || value === '';
                      });
                    }))
                  }
                  className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
                      const form = document.querySelector('form');
                      if (form) {
                        form.requestSubmit();
                      }
                    }, 0);
                  }}
                  disabled={submitting}
                  className="px-6 py-2 bg-[#EF3340] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Updating Job...' : 'Update Job'}
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
              <h3 className="text-xl font-bold text-[var(--dark-blue)]">Confirm Deletion</h3>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-[var(--text-dark)] mb-4">
                Are you sure you want to delete <span className="font-bold">Job #{job.job_number}</span>?
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
                {deleting ? 'Deleting...' : 'Delete Job'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
