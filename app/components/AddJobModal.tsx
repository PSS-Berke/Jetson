'use client';

import { useState, FormEvent, useEffect } from 'react';
import SmartClientSelect from './SmartClientSelect';
import FacilityToggle from './FacilityToggle';
import { getToken } from '@/lib/api';
import Toast from './Toast';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Requirement {
  process_type: string;
  paper_size: string;
  pockets: number;
  shifts_id: number;
  price_per_m: string;
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

export default function AddJobModal({ isOpen, onClose, onSuccess }: AddJobModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [createdJobNumber, setCreatedJobNumber] = useState<number | null>(null);
  const [confirmReview, setConfirmReview] = useState(false);
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
        paper_size: '',
        pockets: 0,
        shifts_id: 0,
        price_per_m: ''
      }
    ],
    weekly_split: [],
    price_per_m: '',
    add_on_charges: '',
    ext_price: '',
    total_billing: ''
  });

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
        
        if (weeks > 0) {
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
  }, [formData.start_date, formData.due_date, formData.quantity]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    // Cleanup function to restore scroll on unmount
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
        paper_size: '',
        pockets: 0,
        shifts_id: 0,
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
      const oldValue = prev.weekly_split[weekIndex];
      const difference = newValue - oldValue;

      // If only one week, just set it to the value
      if (prev.weekly_split.length === 1) {
        return { ...prev, weekly_split: [newValue] };
      }

      // Create new split array with the changed value
      const newSplit = [...prev.weekly_split];
      newSplit[weekIndex] = newValue;

      // Calculate how much we need to distribute to other weeks
      const amountToDistribute = -difference;

      // If no distribution needed (difference is 0), return as is
      if (amountToDistribute === 0) {
        return { ...prev, weekly_split: newSplit };
      }

      // Get indices of other weeks (excluding the one being edited)
      const otherIndices = newSplit
        .map((_, idx) => idx)
        .filter(idx => idx !== weekIndex);

      // Calculate total of other weeks for proportional distribution
      const otherWeeksTotal = otherIndices.reduce((sum, idx) => sum + prev.weekly_split[idx], 0);

      // If all other weeks are 0, distribute evenly
      if (otherWeeksTotal === 0) {
        const baseAmount = Math.floor(amountToDistribute / otherIndices.length);
        const remainder = amountToDistribute - (baseAmount * otherIndices.length);

        otherIndices.forEach((idx, i) => {
          newSplit[idx] = Math.max(0, baseAmount + (i < remainder ? 1 : 0));
        });
      } else {
        // Distribute proportionally based on current values
        let remainingToDistribute = amountToDistribute;
        const adjustments: number[] = [];

        // Calculate proportional adjustments
        otherIndices.forEach(idx => {
          const proportion = prev.weekly_split[idx] / otherWeeksTotal;
          const adjustment = Math.round(amountToDistribute * proportion);
          adjustments.push(adjustment);
        });

        // Apply adjustments and handle negatives
        otherIndices.forEach((idx, i) => {
          const newAmount = prev.weekly_split[idx] + adjustments[i];
          if (newAmount < 0) {
            // If would go negative, set to 0 and track remaining
            remainingToDistribute -= prev.weekly_split[idx];
            newSplit[idx] = 0;
          } else {
            newSplit[idx] = newAmount;
            remainingToDistribute -= adjustments[i];
          }
        });

        // If there's remaining amount due to rounding or negatives, distribute to non-zero weeks
        if (remainingToDistribute !== 0) {
          const nonZeroIndices = otherIndices.filter(idx => newSplit[idx] > 0);
          if (nonZeroIndices.length > 0) {
            // Add remainder to the first non-zero week
            newSplit[nonZeroIndices[0]] += remainingToDistribute;
            // Ensure it doesn't go negative
            if (newSplit[nonZeroIndices[0]] < 0) {
              newSplit[nonZeroIndices[0]] = 0;
            }
          }
        }
      }

      // Final safety check: ensure no negatives
      for (let i = 0; i < newSplit.length; i++) {
        if (newSplit[i] < 0) {
          newSplit[i] = 0;
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
    // Validate step 1 - job number, client ID, and facility are required
    if (currentStep === 1) {
      if (!formData.job_number || !formData.clients_id || !formData.facilities_id) {
        alert('Please fill in job number, client name, and facility');
        return;
      }
      // Validate weekly split if present
      if (formData.weekly_split.length > 0 && getWeeklySplitDifference() !== 0) {
        alert('Weekly split total must equal the total quantity');
        return;
      }
    }

    // Validate step 2 - all requirements must have required fields
    if (currentStep === 2) {
      const allRequirementsValid = formData.requirements.every(r =>
        r.process_type && r.paper_size && r.shifts_id > 0 && r.price_per_m
      );
      if (!allRequirementsValid) {
        alert('Please fill in all required requirement fields including price');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      // Reset confirmation checkbox when entering review step
      if (currentStep === 2) {
        setConfirmReview(false);
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
    setSubmitting(true);

    try {
      const token = getToken();

      // Prepare the payload according to the API specification
      const payload = {
        start_date: formData.start_date || null,
        due_date: formData.due_date || null,
        description: formData.description,
        quantity: parseInt(formData.quantity),
        clients_id: formData.clients_id,
        machines_id: formData.machines_id,
        job_number: parseInt(formData.job_number),
        service_type: formData.service_type,
        pockets: parseInt(formData.pockets),
        job_name: formData.job_name,
        prgm: formData.prgm,
        csr: formData.csr,
        facilities_id: formData.facilities_id,
        price_per_m: parseFloat(formData.price_per_m) || 0,
        add_on_charges: parseFloat(formData.add_on_charges) || 0,
        ext_price: parseFloat(formData.ext_price) || 0,
        total_billing: parseFloat(formData.total_billing) || 0,
        requirements: formData.requirements,
        weekly_split: formData.weekly_split
      };

      const response = await fetch('https://xnpm-iauo-ef2d.n7e.xano.io/api:1RpGaTf6/jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to create job');
      }

      await response.json();

      const jobNum = parseInt(formData.job_number);
      setCreatedJobNumber(jobNum);
      setShowSuccessToast(true);

      // Reset form and close modal
      setFormData({
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
            paper_size: '',
            pockets: 0,
            shifts_id: 0,
            price_per_m: ''
          }
        ],
        weekly_split: [],
        price_per_m: '',
        add_on_charges: '',
        ext_price: '',
        total_billing: ''
      });
      setCurrentStep(1);

      // Delay closing to show toast
      setTimeout(() => {
        onClose();

        // Call success callback to refresh jobs list
        if (onSuccess) {
          onSuccess();
        }
      }, 2000);
    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
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
          <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Add New Job</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-3xl leading-none font-light"
          >
            &times;
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center px-6 py-4 bg-gray-50 border-b border-[var(--border)]">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center" style={{ flex: step === 3 ? '0 1 auto' : '1 1 0%' }}>
              <div className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full font-semibold ${
                  step === currentStep
                    ? 'bg-[var(--primary-blue)] text-white'
                    : step < currentStep
                    ? 'bg-[var(--success)] text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step < currentStep ? '✓' : step}
                </div>
                <div className="ml-3">
                  <div className={`text-xs font-medium whitespace-nowrap ${
                    step === currentStep ? 'text-[var(--primary-blue)]' : 'text-gray-500'
                  }`}>
                    {step === 1 && 'Job Details'}
                    {step === 2 && 'Requirements'}
                    {step === 3 && 'Review'}
                  </div>
                </div>
              </div>
              {step < 3 && (
                <div className={`h-0.5 flex-1 mx-4 ${
                  step < currentStep ? 'bg-[var(--success)]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Job Details */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Client <span className="text-red-500">*</span>
                  </label>
                  <SmartClientSelect
                    value={formData.clients_id}
                    onChange={handleClientChange}
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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
                  <div className="grid grid-cols-4 gap-3">
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

              <div className="grid grid-cols-2 gap-4">
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
                  {/* Requirement Header */}
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

                  {/* Process Type & Paper Size */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Process Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={requirement.process_type}
                        onChange={(e) => handleRequirementChange(index, 'process_type', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        required
                      >
                        <option value="">Select process...</option>
                        <option value="Insert">Insert</option>
                        <option value="Sort">Sort</option>
                        <option value="IJ">IJ</option>
                        <option value="L/A">L/A</option>
                        <option value="Fold">Fold</option>
                        <option value="Laser">Laser</option>
                        <option value="HP Press">HP Press</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Paper Size <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={requirement.paper_size}
                        onChange={(e) => handleRequirementChange(index, 'paper_size', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        required
                      >
                        <option value="">Select size...</option>
                        <option value="6x9">6x9</option>
                        <option value="6x12">6x12</option>
                        <option value="9x12">9x12</option>
                        <option value="10x13">10x13</option>
                        <option value="12x15">12x15</option>
                        <option value="#10">10 Regular</option>
                        <option value="11x17">11x17</option>
                      </select>
                    </div>
                  </div>

                  {/* Pockets & Shift */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Number of Pockets/Inserts
                      </label>
                      <input
                        type="number"
                        value={requirement.pockets}
                        onChange={(e) => handleRequirementChange(index, 'pockets', parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        placeholder="e.g., 2"
                        min="0"
                        max="12"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Shift <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={requirement.shifts_id}
                        onChange={(e) => handleRequirementChange(index, 'shifts_id', parseInt(e.target.value))}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        required
                      >
                        <option value={0}>Select shift...</option>
                        <option value={1}>Shift One</option>
                        <option value={2}>Shift Two</option>
                      </select>
                    </div>
                  </div>

                  {/* Price per M */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Price (per/m) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={requirement.price_per_m}
                        onChange={(e) => handleRequirementChange(index, 'price_per_m', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Requirement Button */}
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

                  return (
                    <div key={index} className="mb-3 pb-3 border-b border-[var(--border)] last:border-b-0">
                      <div className="text-sm">
                        <div className="mb-1">
                          <span className="text-[var(--text-light)]">Requirement {index + 1}: </span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            {req.process_type} | {req.paper_size} | Pockets: {req.pockets} | Shift: {req.shifts_id}
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[var(--text-light)]">Price: ${pricePerM.toFixed(2)}/m</span>
                          <span className="font-semibold text-[var(--text-dark)]">
                            Subtotal: ${requirementTotal.toFixed(2)}
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
                      }, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border-2 border-[var(--primary-blue)] rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmReview}
                    onChange={(e) => setConfirmReview(e.target.checked)}
                    className="mt-1 w-5 h-5 text-[var(--primary-blue)] border-gray-300 rounded focus:ring-2 focus:ring-[var(--primary-blue)]"
                  />
                  <div>
                    <p className="font-semibold text-[var(--dark-blue)] mb-1">
                      Confirm Job Details
                    </p>
                    <p className="text-sm text-[var(--text-dark)]">
                      I have reviewed all job details above and confirm they are correct. I am ready to submit this job.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Footer - Inside Form */}
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
                    (currentStep === 2 && formData.requirements.some(r => !r.process_type || !r.paper_size || !r.shifts_id))
                  }
                  className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || !confirmReview}
                  className="px-6 py-2 bg-[var(--success)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Creating Job...' : 'Submit Job'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

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
