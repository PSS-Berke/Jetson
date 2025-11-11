'use client';

import { useState, FormEvent, useEffect } from 'react';
import DynamicMachineCapabilityFields from './DynamicMachineCapabilityFields';
import FacilityToggle from './FacilityToggle';
import { Machine, MachineCapabilityValue, MachineStatus, User } from '@/types';
import { updateMachine, deleteMachine } from '@/lib/api';
import Toast from './Toast';

interface EditMachineModalProps {
  isOpen: boolean;
  machine: Machine | null;
  onClose: () => void;
  onSuccess?: () => void;
  user?: User | null;
}

interface MachineFormData {
  line: string;
  type: string;
  process_type_key: string;
  facilities_id: number | null;
  status: MachineStatus;
  speed_hr: string;
  shiftCapacity: string;
  capabilities: {
    [key: string]: MachineCapabilityValue;
  };
}

export default function EditMachineModal({ isOpen, machine, onClose, onSuccess, user }: EditMachineModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  // Initialize form with machine data when modal opens
  useEffect(() => {
    if (isOpen && machine) {
      console.log('[EditMachineModal] Initializing with machine:', machine);

      setFormData({
        line: machine.line.toString(),
        type: machine.type,
        process_type_key: machine.process_type_key || '',
        facilities_id: machine.facilities_id || null,
        status: machine.status,
        speed_hr: machine.speed_hr.toString(),
        shiftCapacity: machine.shiftCapacity?.toString() || '',
        capabilities: machine.capabilities || {},
      });
    }
  }, [isOpen, machine]);

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

  if (!isOpen || !machine) return null;

  // Check if user is admin - show read-only view for non-admins
  if (!user?.admin) {
    return (
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
            <h2 className="text-2xl font-bold text-[var(--dark-blue)]">Machine Details</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Read-only Content */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Line Number</p>
                <p className="font-medium text-gray-900">Line {machine.line}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Type</p>
                <p className="font-medium text-gray-900">{machine.type}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Facility</p>
                <p className="font-medium text-gray-900">
                  {machine.facilities_id === 1 ? 'Bolingbrook' : machine.facilities_id === 2 ? 'Lemont' : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium text-gray-900 capitalize">{machine.status}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Speed/Hour</p>
                <p className="font-medium text-gray-900">{machine.speed_hr || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Shift Capacity</p>
                <p className="font-medium text-gray-900">{machine.shiftCapacity || 'N/A'}</p>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-500 italic">
                Only administrators can edit machine details.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        facilities_id: formData.facilities_id || undefined,
        status: formData.status,
        speed_hr: parseFloat(formData.speed_hr),
        shiftCapacity: parseFloat(formData.shiftCapacity),
        capabilities: formData.capabilities,
      };

      console.log('[EditMachineModal] Updating machine:', machine.id, 'with data:', machineData);
      console.log('[EditMachineModal] Capabilities:', JSON.stringify(formData.capabilities, null, 2));

      const updatedMachine = await updateMachine(machine.id, machineData);
      console.log('[EditMachineModal] Machine updated successfully:', updatedMachine);

      setShowSuccessToast(true);

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
      console.error('[EditMachineModal] Error updating machine:', error);
      alert(error instanceof Error ? error.message : 'Failed to update machine. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!machine) return;

    setDeleting(true);

    try {
      console.log('[EditMachineModal] Deleting machine:', machine.id);

      await deleteMachine(machine.id);
      console.log('[EditMachineModal] Machine deleted successfully');

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (error) {
      console.error('[EditMachineModal] Error deleting machine:', error);
      alert(error instanceof Error ? error.message : 'Failed to delete machine. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
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
    setShowDeleteConfirm(false);
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
              <h2 className="text-2xl font-bold text-[var(--text-dark)]">
                Edit Machine - Line {machine.line}
              </h2>
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
              <div className="flex justify-between pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  disabled={submitting || deleting}
                >
                  Delete Machine
                </button>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    disabled={submitting || deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={submitting || deleting}
                  >
                    {submitting ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-900 mb-4">Confirm Deletion</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete Machine Line {machine.line}? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <Toast
          message={`Machine Line ${machine.line} updated successfully!`}
          type="success"
          onClose={() => setShowSuccessToast(false)}
        />
      )}
    </>
  );
}
