'use client';

import { useState, FormEvent, useEffect } from 'react';
import SmartClientSelect from './SmartClientSelect';
import { getToken } from '@/lib/api';

interface AddJobModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Machine {
  id: number;
  created_at: number;
  line: number;
  type: string;
  max_size: string;
  speed_hr: string;
  status: string;
}

interface Process {
  id: number;
  processType: string;
  machineType: string;
  paperSize: string;
  pockets: string;
  shift: string;
  materialStatus: string;
  materialArrival: string;
  materialVendor: string;
  materialDesc: string;
  processNotes: string;
}

interface JobFormData {
  jobNumber: string;
  clientId: number | null;
  clientName: string;
  description: string;
  quantity: string;
  startDate: string;
  dueDate: string;
  specialNotes: string;
  processType: string;
  machineType: string;
  envelopeSize: string;
  pockets: string;
  shifts: string;
  materialStatus: string;
  processes: Process[];
}

export default function AddJobModal({ isOpen, onClose }: AddJobModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<JobFormData>({
    jobNumber: '',
    clientId: null,
    clientName: '',
    description: '',
    quantity: '',
    startDate: '',
    dueDate: '',
    specialNotes: '',
    processType: 'inserting',
    machineType: 'FM Standard - Letter',
    envelopeSize: '9x12',
    pockets: '6',
    shifts: '1',
    materialStatus: 'ready',
    processes: [
      {
        id: 1,
        processType: '',
        machineType: '',
        paperSize: '',
        pockets: '',
        shift: '1',
        materialStatus: 'available',
        materialArrival: '',
        materialVendor: '',
        materialDesc: '',
        processNotes: ''
      }
    ]
  });

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
      clientId,
      clientName
    });
  };

  const handleProcessChange = (processId: number, field: keyof Process, value: string) => {
    setFormData(prev => ({
      ...prev,
      processes: prev.processes.map(p =>
        p.id === processId ? { ...p, [field]: value } : p
      )
    }));
  };

  const addProcess = () => {
    const newProcessId = Math.max(...formData.processes.map(p => p.id), 0) + 1;
    setFormData(prev => ({
      ...prev,
      processes: [...prev.processes, {
        id: newProcessId,
        processType: '',
        machineType: '',
        paperSize: '',
        pockets: '',
        shift: '1',
        materialStatus: 'available',
        materialArrival: '',
        materialVendor: '',
        materialDesc: '',
        processNotes: ''
      }]
    }));
  };

  const removeProcess = (processId: number) => {
    if (formData.processes.length > 1) {
      setFormData(prev => ({
        ...prev,
        processes: prev.processes.filter(p => p.id !== processId)
      }));
    }
  };

  const handleNext = () => {
    // Validate step 1 - only job number and client ID are required
    if (currentStep === 1) {
      if (!formData.jobNumber || !formData.clientId) {
        alert('Please fill in job number and client name');
        return;
      }
    }

    // Validate step 2 - all processes must have required fields
    if (currentStep === 2) {
      const allProcessesValid = formData.processes.every(p =>
        p.processType && p.machineType && p.paperSize
      );
      if (!allProcessesValid) {
        alert('Please fill in all required process fields');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
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
        start_date: formData.startDate || null,
        due_date: formData.dueDate || null,
        description: formData.description,
        quantity: parseInt(formData.quantity),
        clients_id: formData.clientId,
        job_number: parseInt(formData.jobNumber)
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

      const result = await response.json();
      console.log('Job created successfully:', result);

      // Reset form and close modal
      setFormData({
        jobNumber: '',
        clientId: null,
        clientName: '',
        description: '',
        quantity: '',
        startDate: '',
        dueDate: '',
        specialNotes: '',
        processType: 'inserting',
        machineType: 'FM Standard - Letter',
        envelopeSize: '9x12',
        pockets: '6',
        shifts: '1',
        materialStatus: 'ready',
        processes: [
          {
            id: 1,
            processType: '',
            machineType: '',
            paperSize: '',
            pockets: '',
            shift: '1',
            materialStatus: 'available',
            materialArrival: '',
            materialVendor: '',
            materialDesc: '',
            processNotes: ''
          }
        ]
      });
      setCurrentStep(1);
      onClose();
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
          {[1, 2, 3].map((step, index) => (
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
                    {step === 2 && 'Step Requirements'}
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
                    Job Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="jobNumber"
                    value={formData.jobNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    placeholder="e.g., 7018"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Client Name <span className="text-red-500">*</span>
                  </label>
                  <SmartClientSelect
                    value={formData.clientId}
                    onChange={handleClientChange}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                  Job Description <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                  placeholder="e.g., INS 2 IN 9X12 INLINE OME"
                  required
                />
              </div>

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
                  placeholder="e.g., 372000"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="dueDate"
                    value={formData.dueDate}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Step Requirements */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-[var(--dark-blue)] mb-6">Step Requirements</h3>

              {formData.processes.map((process, index) => (
                <div key={process.id} className="border border-[var(--border)] rounded-lg p-6 space-y-4">
                  {/* Process Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-[var(--text-dark)]">Process {index + 1}</h4>
                    {index > 0 && (
                      <button
                        type="button"
                        onClick={() => removeProcess(process.id)}
                        className="text-red-500 hover:text-red-700 font-semibold text-sm"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>

                  {/* Process Type & Machine Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Process Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={process.processType}
                        onChange={(e) => handleProcessChange(process.id, 'processType', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        required
                      >
                        <option value="">Select process...</option>
                        <option value="insert">Insert</option>
                        <option value="fold">Fold</option>
                        <option value="affix">Affix Label</option>
                        <option value="print">Variable Print</option>
                        <option value="polybag">Poly Bag</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Machine Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={process.machineType}
                        onChange={(e) => handleProcessChange(process.id, 'machineType', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        required
                      >
                        <option value="">Select machine type...</option>
                        <option value="fm-standard">FM Standard</option>
                        <option value="ome">OME</option>
                        <option value="large-format">Large Format</option>
                        <option value="folder">Folder</option>
                        <option value="printer">Printer</option>
                      </select>
                    </div>
                  </div>

                  {/* Paper Size & Pockets */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Envelope/Paper Size <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={process.paperSize}
                        onChange={(e) => handleProcessChange(process.id, 'paperSize', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        required
                      >
                        <option value="">Select size...</option>
                        <option value="6x9">6x9</option>
                        <option value="6x12">6x12</option>
                        <option value="9x12">9x12</option>
                        <option value="10x13">10x13</option>
                        <option value="12x15">12x15</option>
                        <option value="10-regular">#10 Regular</option>
                        <option value="11x17">11x17</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Number of Pockets/Inserts
                      </label>
                      <input
                        type="number"
                        value={process.pockets}
                        onChange={(e) => handleProcessChange(process.id, 'pockets', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                        placeholder="e.g., 6"
                        min="1"
                        max="12"
                      />
                    </div>
                  </div>

                  {/* Shift & Estimated Time */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Shift Preference
                      </label>
                      <select
                        value={process.shift}
                        onChange={(e) => handleProcessChange(process.id, 'shift', e.target.value)}
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
                      >
                        <option value="1">1 Shift (7.5 hrs)</option>
                        <option value="2">2 Shifts (15 hrs)</option>
                        <option value="3">3 Shifts (24 hrs)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                        Estimated Time
                      </label>
                      <input
                        type="text"
                        className="w-full px-4 py-2 border border-[var(--border)] rounded-lg bg-gray-100"
                        placeholder="Auto-calculated"
                        readOnly
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Process Button */}
              <button
                type="button"
                onClick={addProcess}
                className="w-full px-6 py-3 border-2 border-dashed border-[var(--border)] rounded-lg font-semibold text-[var(--primary-blue)] hover:bg-blue-50 transition-colors"
              >
                + Add Another Process
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
                    <span className="text-[var(--text-light)]">Job Number:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.jobNumber}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Client:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.clientName}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Quantity:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{parseInt(formData.quantity).toLocaleString()} pieces</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Start Date:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.startDate}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Due Date:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.dueDate}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[var(--border)] rounded-lg p-4">
                <h3 className="font-semibold text-[var(--text-dark)] mb-3">Production Requirements</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-light)]">Machine Type:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.machineType}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Size:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.envelopeSize}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Pockets:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.pockets}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-light)]">Shifts:</span>
                    <span className="ml-2 font-semibold text-[var(--text-dark)]">{formData.shifts}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Ready to Submit</h3>
                <p className="text-sm text-green-800">
                  All required fields are filled. Click Submit to create this job.
                </p>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-[var(--border)] bg-gray-50">
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
                  (currentStep === 1 && (!formData.jobNumber || !formData.clientId)) ||
                  (currentStep === 2 && formData.processes.some(p => !p.processType || !p.machineType || !p.paperSize))
                }
                className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2 bg-[var(--success)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating Job...' : 'Submit Job'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
