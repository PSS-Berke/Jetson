'use client';

import { useState, FormEvent, useEffect } from 'react';
import DynamicMachineCapabilityFields from './DynamicMachineCapabilityFields';
import FacilityToggle from './FacilityToggle';
import { MachineCapabilityValue, MachineStatus, User } from '@/types';
import { createMachine } from '@/lib/api';
import Toast from './Toast';

interface AddMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  user?: User | null;
}

interface MachineFormData {
  line: string;
  type: string; // Display name
  process_type_key: string;
  facilities_id: number | null;
  status: MachineStatus;
  speed_hr: string;
  shiftCapacity: string;
  capabilities: {
    [key: string]: MachineCapabilityValue;
  };
}

export default function AddMachineModal({ isOpen, onClose, onSuccess, user }: AddMachineModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [createdMachineLine, setCreatedMachineLine] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<MachineFormData>({
    line: '',
    type: '',
    process_type_key: '',
    facilities_id: null,
    status: 'available',
    speed_hr: '',
    shiftCapacity: '',
    capabilities: {},
  });

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

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleCapabilityChange = (field: string, value: MachineCapabilityValue) => {
    setFormData((prev) => ({
      ...prev,
      capabilities: {
        ...prev.capabilities,
        [field]: value,
      },
    }));
  };

  const handleProcessTypeChange = (processTypeKey: string) => {
    setFormData((prev) => ({
      ...prev,
      process_type_key: processTypeKey,
      // Reset capabilities when process type changes
      capabilities: {},
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.line) {
      newErrors.line = 'Line number is required';
    }
    if (!formData.type) {
      newErrors.type = 'Machine type name is required';
    }
    if (!formData.process_type_key) {
      newErrors.process_type_key = 'Process type is required';
    }
    if (!formData.facilities_id) {
      newErrors.facilities_id = 'Facility is required';
    }
    if (!formData.speed_hr || parseFloat(formData.speed_hr) <= 0) {
      newErrors.speed_hr = 'Speed per hour must be greater than 0';
    }
    if (!formData.shiftCapacity || parseFloat(formData.shiftCapacity) <= 0) {
      newErrors.shiftCapacity = 'Shift capacity must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Prepare the machine data
      const machineData = {
        line: parseInt(formData.line),
        type: formData.type,
        process_type_key: formData.process_type_key,
        facilities_id: formData.facilities_id,
        status: formData.status,
        speed_hr: parseFloat(formData.speed_hr),
        shiftCapacity: parseFloat(formData.shiftCapacity),
        capabilities: formData.capabilities,
      };

      console.log('[AddMachineModal] Creating machine with data:', machineData);
      console.log('[AddMachineModal] Capabilities:', JSON.stringify(formData.capabilities, null, 2));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const createdMachine = await createMachine(machineData as any);
      console.log('[AddMachineModal] Machine created successfully:', createdMachine);

      setCreatedMachineLine(createdMachine.line);
      setShowSuccessToast(true);

      // Reset form
      setFormData({
        line: '',
        type: '',
        process_type_key: '',
        facilities_id: null,
        status: 'available',
        speed_hr: '',
        shiftCapacity: '',
        capabilities: {},
      });

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after short delay
      setTimeout(() => {
        onClose();
        setShowSuccessToast(false);
      }, 2000);
    } catch (error) {
      console.error('[AddMachineModal] Error creating machine:', error);
      alert(error instanceof Error ? error.message : 'Failed to create machine. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      line: '',
      type: '',
      process_type_key: '',
      facilities_id: null,
      status: 'available',
      speed_hr: '',
      shiftCapacity: '',
      capabilities: {},
    });
    setErrors({});
    onClose();
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Modal Container - with max height and scrolling */}
        <div
          className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - Fixed at top */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-2xl font-bold text-[var(--text-dark)]">Add New Machine</h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 transition-colors text-3xl font-light w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100"
              type="button"
            >
              ×
            </button>
          </div>

          {/* Form - Scrollable content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="px-6 py-6 space-y-8">
              {/* Basic Information */}
              <div className="space-y-5">
                <h3 className="text-lg font-semibold text-[var(--text-dark)] pb-2">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Line Number */}
                  <div>
                    <label htmlFor="line" className="block text-sm font-medium text-gray-700 mb-2">
                      Line Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="line"
                      name="line"
                      value={formData.line}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.line
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-blue-200 focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., 101"
                      required
                    />
                    {errors.line && <p className="mt-1.5 text-sm text-red-600">{errors.line}</p>}
                  </div>

                  {/* Machine Type Name */}
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                      Machine Type Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.type
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-blue-200 focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., Inserter, Folder, Laser"
                      required
                    />
                    {errors.type && <p className="mt-1.5 text-sm text-red-600">{errors.type}</p>}
                  </div>
                </div>

                {/* Facility */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Facility <span className="text-red-500">*</span>
                  </label>
                  <FacilityToggle
                    currentFacility={formData.facilities_id}
                    onFacilityChange={(facilityId) => setFormData({ ...formData, facilities_id: facilityId })}
                    showAll={false}
                  />
                  {errors.facilities_id && <p className="mt-1.5 text-sm text-red-600">{errors.facilities_id}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Status */}
                  <div>
                    <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[var(--primary-blue)] bg-white"
                      required
                    >
                      <option value="available">Available</option>
                      <option value="running">Running</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  {/* Speed per Hour */}
                  <div>
                    <label htmlFor="speed_hr" className="block text-sm font-medium text-gray-700 mb-2">
                      Speed/hr <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="speed_hr"
                      name="speed_hr"
                      value={formData.speed_hr}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.speed_hr
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-blue-200 focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., 5000"
                      min="0"
                      step="1"
                      required
                    />
                    {errors.speed_hr && <p className="mt-1.5 text-sm text-red-600">{errors.speed_hr}</p>}
                  </div>

                  {/* Shift Capacity */}
                  <div>
                    <label htmlFor="shiftCapacity" className="block text-sm font-medium text-gray-700 mb-2">
                      Shift Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="shiftCapacity"
                      name="shiftCapacity"
                      value={formData.shiftCapacity}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.shiftCapacity
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                          : 'border-gray-300 focus:ring-blue-200 focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., 40000"
                      min="0"
                      step="1"
                      required
                    />
                    {errors.shiftCapacity && <p className="mt-1.5 text-sm text-red-600">{errors.shiftCapacity}</p>}
                  </div>
                </div>
              </div>

              {/* Machine Capabilities */}
              <div className="space-y-5 pt-6 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-[var(--text-dark)] pb-2">Machine Capabilities</h3>
                <DynamicMachineCapabilityFields
                  processTypeKey={formData.process_type_key}
                  capabilities={formData.capabilities}
                  onChange={handleCapabilityChange}
                  onProcessTypeChange={handleProcessTypeChange}
                  errors={errors}
                />
              </div>
            </div>

            {/* Action Buttons - Fixed at bottom */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-white transition-colors shadow-sm"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-[var(--primary-blue)] text-white rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create Machine'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message={`Machine Line ${createdMachineLine} created successfully!`}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </>
  );
}
