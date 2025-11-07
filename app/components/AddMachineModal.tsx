'use client';

import { useState, FormEvent, useEffect } from 'react';
import DynamicMachineCapabilityFields from './DynamicMachineCapabilityFields';
import FacilityToggle from './FacilityToggle';
import { MachineCapabilityValue, MachineStatus } from '@/types';
import { createMachine } from '@/lib/api';
import Toast from './Toast';

interface AddMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
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

export default function AddMachineModal({ isOpen, onClose, onSuccess }: AddMachineModalProps) {
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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 overflow-y-auto"
        onClick={handleClose}
      >
        {/* Modal Container */}
        <div className="min-h-screen px-4 flex items-center justify-center py-8">
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-[var(--text-dark)]">Add New Machine</h2>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-[var(--text-dark)]">Basic Information</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Line Number */}
                  <div>
                    <label htmlFor="line" className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Line Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="line"
                      name="line"
                      value={formData.line}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.line
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., 101"
                      required
                    />
                    {errors.line && <p className="mt-1 text-sm text-red-600">{errors.line}</p>}
                  </div>

                  {/* Machine Type Name */}
                  <div>
                    <label htmlFor="type" className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Machine Type Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="type"
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.type
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., Inserter, Folder, Laser"
                      required
                    />
                    {errors.type && <p className="mt-1 text-sm text-red-600">{errors.type}</p>}
                  </div>
                </div>

                {/* Facility */}
                <div>
                  <label className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                    Facility <span className="text-red-500">*</span>
                  </label>
                  <FacilityToggle
                    currentFacility={formData.facilities_id}
                    onFacilityChange={(facilityId) => setFormData({ ...formData, facilities_id: facilityId })}
                    showAll={false}
                  />
                  {errors.facilities_id && <p className="mt-1 text-sm text-red-600">{errors.facilities_id}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Status */}
                  <div>
                    <label htmlFor="status" className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]"
                      required
                    >
                      <option value="available">Available</option>
                      <option value="running">Running</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>

                  {/* Speed per Hour */}
                  <div>
                    <label htmlFor="speed_hr" className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Speed/hr <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="speed_hr"
                      name="speed_hr"
                      value={formData.speed_hr}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.speed_hr
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., 5000"
                      min="0"
                      step="1"
                      required
                    />
                    {errors.speed_hr && <p className="mt-1 text-sm text-red-600">{errors.speed_hr}</p>}
                  </div>

                  {/* Shift Capacity */}
                  <div>
                    <label htmlFor="shiftCapacity" className="block text-sm font-semibold text-[var(--text-dark)] mb-2">
                      Shift Capacity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      id="shiftCapacity"
                      name="shiftCapacity"
                      value={formData.shiftCapacity}
                      onChange={handleInputChange}
                      className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        errors.shiftCapacity
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-[var(--border)] focus:ring-[var(--primary-blue)] focus:border-[var(--primary-blue)]'
                      }`}
                      placeholder="e.g., 40000"
                      min="0"
                      step="1"
                      required
                    />
                    {errors.shiftCapacity && <p className="mt-1 text-sm text-red-600">{errors.shiftCapacity}</p>}
                  </div>
                </div>
              </div>

              {/* Machine Capabilities */}
              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-semibold text-[var(--text-dark)]">Machine Capabilities</h3>
                <DynamicMachineCapabilityFields
                  processTypeKey={formData.process_type_key}
                  capabilities={formData.capabilities}
                  onChange={handleCapabilityChange}
                  onProcessTypeChange={handleProcessTypeChange}
                  errors={errors}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-6 border-t">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={submitting}
                >
                  {submitting ? 'Creating...' : 'Create Machine'}
                </button>
              </div>
            </form>
          </div>
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
