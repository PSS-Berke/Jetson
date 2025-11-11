'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { useMachines } from '@/hooks/useMachines';
import FacilityToggle from '../../components/FacilityToggle';
import PageHeader from '../../components/PageHeader';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { Machine, MachineCapabilityValue, MachineStatus } from '@/types';
import { getProcessTypeConfig } from '@/lib/processTypeConfig';
import { createMachine, updateMachine, deleteMachine } from '@/lib/api';
import DynamicMachineCapabilityFields from '../../components/DynamicMachineCapabilityFields';
import { FaPen, FaTrash, FaCopy } from 'react-icons/fa6';
import { FaTimes, FaSave } from 'react-icons/fa';
/* import {
  ArrowPathIcon,
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  Cog6ToothIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  PlayIcon,
} from '@heroicons/react/24/outline';
import { formatInTimeZone } from 'date-fns-tz';
import AddJobModal from '@/app/components/AddJobModal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/app/components/DropdownMenu';
import { AddMachineModal } from '@/app/components/AddMachineModal';
import EditMachineModal from '@/app/components/EditMachineModal';
import DeleteMachineModal from '@/app/components/DeleteMachineModal';
import { toast } from 'react-toastify';
import { Tooltip } from 'react-tooltip';
import { LoadingSpinner } from '@/app/components/LoadingSpinner';
import {
  getBulkUpdateMachinePayload,
  handleUpdateMachine,
  MachineBulkUpdatePayload,
} from '@/lib/machineUtils';
import { ConfirmationModal } from '@/app/components/ConfirmationModal';
import { JobProductionEntry, ProcessType } from '@/types/production'; */

// Dynamically import modals - only loaded when opened
const AddJobModal = dynamic(() => import('../../components/AddJobModal'), {
  ssr: false,
});

const EditMachineModal = dynamic(() => import('../../components/EditMachineModal'), {
  ssr: false,
});

const DynamicFormBuilderModal = dynamic(() => import('../../components/DynamicFormBuilderModal'), {
  ssr: false,
});

// Machine type configurations
const machineTypeConfig: Record<string, {
  label: string;
  filterFn: (machine: Machine) => boolean;
}> = {
  'inserters': {
    label: 'Inserter Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('insert')
  },
  'folders': {
    label: 'Folder Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('folder') || machine.type.toLowerCase().includes('fold')
  },
  'hp-press': {
    label: 'HP Press Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('hp') || machine.type.toLowerCase().includes('press')
  },
  'inkjetters': {
    label: 'Inkjet Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('inkjet')
  },
  'affixers': {
    label: 'Affixer Machines',
    filterFn: (machine) => machine.type.toLowerCase().includes('affixer') || machine.type.toLowerCase().includes('affix')
  }
};

export default function MachineTypePage() {
  const params = useParams();
  const machineType = params.type as string;
  
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [filterFacility, setFilterFacility] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [showNewMachineRow, setShowNewMachineRow] = useState(false);
  const [newMachineFormData, setNewMachineFormData] = useState<Partial<Machine> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingMachineId, setEditingMachineId] = useState<number | null>(null);
  const [editedMachineFormData, setEditedMachineFormData] = useState<Partial<Machine> | null>(null);
  const { user, isLoading: userLoading } = useUser();
  const { machines, isLoading: machinesLoading, error: machinesError, refetch } = useMachines(filterStatus, filterFacility || undefined);
  const { logout } = useAuth();

  const getNewMachineInitialState = (): Partial<Machine> => ({
    line: undefined,
    type: '',
    process_type_key: '',
    facilities_id: undefined,
    status: 'available',
    speed_hr: undefined,
    shiftCapacity: undefined,
    capabilities: {},
  });

  const handleFacilityChange = (facility: number | null) => {
    setFilterFacility(facility);
  };

  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
  };

  const handleMachineClick = (machine: Machine) => {
    console.log('Selected machine:', machine);
    setSelectedMachine(machine);
  };

  const handleMachineModalClose = () => {
    setSelectedMachine(null);
    refetch(filterStatus, filterFacility || undefined);
  };

  // Helper to render capability values
  const renderCapabilityValue = (machine: Machine, capabilityKey: string): string => {
    if (!machine.capabilities || !machine.capabilities[capabilityKey]) {
      return 'N/A';
    }

    const value = machine.capabilities[capabilityKey];

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(', ') : 'N/A';
    }

    return String(value);
  };

  // Get relevant capability columns for a machine
  const getCapabilityColumns = (machine: Machine): string[] => {
    const processConfig = machine.process_type_key ? getProcessTypeConfig(machine.process_type_key) : null;
    if (!processConfig) return [];

    // Get the first 2-3 most important fields (skip price_per_m)
    return processConfig.fields
      .filter(field => field.name !== 'price_per_m')
      .slice(0, 2)
      .map(field => field.name);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Get configuration for this machine type
  const config = machineTypeConfig[machineType];
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Invalid machine type</div>
      </div>
    );
  }

  // Filter machines by type
  const filteredMachines = machines.filter(config.filterFn);

  const statusColors = {
    running: 'bg-blue-100 text-blue-800 border-blue-200',
    available: 'bg-green-100 text-green-800 border-green-200',
    avalible: 'bg-green-100 text-green-800 border-green-200',
    maintenance: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  };

  const statusLabels = {
    running: 'Running',
    available: 'Available',
    avalible: 'Available',
    maintenance: 'Maintenance'
  };

  const handleNewMachineInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    let processedValue: string | number | null | undefined = value;

    // Handle numeric inputs
    if (name === 'line' || name === 'speed_hr' || name === 'shiftCapacity') {
      processedValue = value === '' ? undefined : parseFloat(value);
      if (isNaN(processedValue as number)) { // If parseFloat results in NaN, set to undefined
        processedValue = undefined;
      }
    } else if (name === 'facilities_id') {
      processedValue = value === '' ? undefined : parseInt(value);
    }

    setNewMachineFormData(prev => ({ ...prev, [name]: processedValue }));
    setErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleNewMachineCapabilityChange = (field: string, value: MachineCapabilityValue) => {
    setNewMachineFormData(prev => ({
      ...prev,
      capabilities: {
        ...prev?.capabilities,
        [field]: value,
      },
    }));
  };

  const handleNewMachineProcessTypeChange = (processTypeKey: string) => {
    setNewMachineFormData(prev => ({ ...prev, process_type_key: processTypeKey }));
  };

  const handleSaveNewMachine = async () => {
    const newMachine = newMachineFormData;
    if (!newMachine) return;

    const processConfig = newMachine.process_type_key ? getProcessTypeConfig(newMachine.process_type_key) : null;
    if (!processConfig) {
      setErrors(prev => ({ ...prev, process_type_key: 'Invalid process type' }));
      return;
    }

    // Validate required fields
    if (!newMachine.facilities_id) {
      setErrors(prev => ({ ...prev, facilities_id: 'Facility is required' }));
      return;
    }
    if (!newMachine.line) {
      setErrors(prev => ({ ...prev, line: 'Line is required' }));
      return;
    }
    if (!newMachine.type) {
      setErrors(prev => ({ ...prev, type: 'Type is required' }));
      return;
    }
    if (!newMachine.process_type_key) {
      setErrors(prev => ({ ...prev, process_type_key: 'Process type is required' }));
      return;
    }
    if (!newMachine.status) {
      setErrors(prev => ({ ...prev, status: 'Status is required' }));
      return;
    }
    if (newMachine.speed_hr === undefined) {
      setErrors(prev => ({ ...prev, speed_hr: 'Speed/hr is required' }));
      return;
    }
    if (newMachine.shiftCapacity === undefined) {
      setErrors(prev => ({ ...prev, shiftCapacity: 'Shift capacity is required' }));
      return;
    }

    try {
      await createMachine(newMachine);
      setShowNewMachineRow(false);
      setNewMachineFormData(null);
      setErrors({});
      refetch(filterStatus, filterFacility || undefined);
    } catch (error) {
      console.error('Error creating machine:', error);
      setErrors(prev => ({ ...prev, process_type_key: 'Failed to create machine' }));
    }
  };

  const handleCancelNewMachine = () => {
    setShowNewMachineRow(false);
    setNewMachineFormData(null);
    setErrors({});
  };

  const handleEditClick = (machine: Machine) => {
    setEditingMachineId(machine.id);
    setEditedMachineFormData({
      ...machine,
      // Ensure capabilities are deep-copied to avoid direct modification of original machine object
      capabilities: machine.capabilities ? { ...machine.capabilities } : {},
      // Ensure shiftCapacity is a string for input value, or undefined
      shiftCapacity: machine.shiftCapacity === undefined || machine.shiftCapacity === null
        ? undefined
        : machine.shiftCapacity,
    });
    setErrors({}); // Clear errors when starting edit
  };

  const handleEditedMachineInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    id: number
  ) => {
    const { name, value } = e.target;

    let processedValue: string | number | null | undefined = value;

    if (name === 'line' || name === 'speed_hr' || name === 'shiftCapacity') {
      processedValue = value === '' ? undefined : parseFloat(value);
      if (isNaN(processedValue as number)) {
        processedValue = undefined;
      }
    } else if (name === 'facilities_id') {
      processedValue = value === '' ? undefined : parseInt(value);
    }

    setEditedMachineFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleEditedMachineCapabilityChange = (
    field: string,
    value: MachineCapabilityValue,
    id: number
  ) => {
    setEditedMachineFormData((prev) => ({
      ...prev,
      capabilities: {
        ...prev?.capabilities,
        [field]: value,
      },
    }));
  };

  const handleEditedMachineProcessTypeChange = (processTypeKey: string, id: number) => {
    setEditedMachineFormData((prev) => ({ ...prev, process_type_key: processTypeKey }));
    setErrors((prev) => ({ ...prev, process_type_key: '' }));
  };

  const handleSaveEditedMachine = async () => {
    const editedMachine = editedMachineFormData;
    if (!editingMachineId || !editedMachine) return;

    // Basic validation (can be expanded)
    const newErrors: Record<string, string> = {};
    if (editedMachine.facilities_id === undefined || editedMachine.facilities_id === null) {
      newErrors.facilities_id = 'Facility is required';
    }
    if (editedMachine.line === undefined || editedMachine.line === null) {
      newErrors.line = 'Line is required';
    }
    if (editedMachine.type === undefined || editedMachine.type === null || editedMachine.type.trim() === '') {
      newErrors.type = 'Type is required';
    }
    if (editedMachine.process_type_key === undefined || editedMachine.process_type_key.trim() === '') {
      newErrors.process_type_key = 'Process type is required';
    }
    if (editedMachine.speed_hr === undefined || editedMachine.speed_hr === null) {
      newErrors.speed_hr = 'Speed/hr is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await updateMachine(editingMachineId, editedMachine as Machine);
      refetch(filterStatus, filterFacility || undefined);
      setEditingMachineId(null);
      setEditedMachineFormData(null);
      setErrors({});
    } catch (error) {
      console.error('Error updating machine:', error);
      setErrors((prev) => ({ ...prev, general: 'Failed to update machine. Please try again.' }));
    }
  };

  const handleCancelEdit = () => {
    setEditingMachineId(null);
    setEditedMachineFormData(null);
    setErrors({});
  };

  const handleDeleteClick = async (machineId: number) => {
    if (!confirm('Are you sure you want to delete this machine?')) {
      return;
    }

    try {
      await deleteMachine(machineId);
      refetch(filterStatus, filterFacility || undefined);
      setEditingMachineId(null);
      setEditedMachineFormData(null);
      setErrors({});
    } catch (error) {
      console.error('Error deleting machine:', error);
      setErrors((prev) => ({ ...prev, general: 'Failed to delete machine. Please try again.' }));
    }
  };

  const handleCopyMachine = async (machine: Machine) => {
    try {
      const { id, created_at, currentJob, ...machineData } = machine;
      
      const copiedMachine: Partial<Machine> = {
        ...machineData,
        type: machine.type,
        line: machine.line,
        capabilities: machine.capabilities ? { ...machine.capabilities } : {},
      };

      await createMachine(copiedMachine);
      refetch(filterStatus, filterFacility || undefined);
    } catch (error) {
      console.error('Error copying machine:', error);
      setErrors((prev) => ({ ...prev, general: 'Failed to copy machine. Please try again.' }));
    }
  };

  return (
    <>
      <PageHeader
        currentPage="machines"
        user={user}
        onAddJobClick={() => setIsJobModalOpen(true)}
        showAddJobButton={true}
        onLogout={logout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/machines" className="text-[var(--primary-blue)] hover:underline">
                Machines
              </Link>
            </li>
            <li className="text-[var(--text-light)]">/</li>
            <li className="text-[var(--text-dark)] font-medium capitalize">{machineType.replace('-', ' ')}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-6 border-b border-[var(--border)] gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">{config.label}</h2>
            <FacilityToggle
              currentFacility={filterFacility}
              onFacilityChange={handleFacilityChange}
              showAll={true}
            />
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setIsFormBuilderOpen(true)}
              className="px-4 py-2 bg-[#E31E24] text-white rounded-lg hover:bg-[#C01A1F] transition-colors font-medium flex items-center gap-2 border-2 border-[#E31E24]"
            >
              <span className="text-lg">+</span>
              Form
            </button>
            
              <button
                onClick={() => {
                  setShowNewMachineRow(true);
                  setNewMachineFormData(getNewMachineInitialState());
                }}
                className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center gap-2 border-2 border-[var(--primary-blue)]"
              >
                <span className="text-lg">+</span>
                Add Machine
              </button>
            
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleFilterChange('')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === ''
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange('running')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'running'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            Running
          </button>
          <button
            onClick={() => handleFilterChange('avalible')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'avalible'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            Available
          </button>
          <button
            onClick={() => handleFilterChange('maintenance')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === 'maintenance'
                ? 'bg-[var(--primary-blue)] text-white'
                : 'bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50'
            }`}
          >
            Maintenance
          </button>
        </div>

        {/* Machines Table */}
        {machinesError ? (
          <div className="text-center py-12">
            <div className="text-red-600">Error loading machines: {machinesError}</div>
          </div>
        ) : machinesLoading ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)]">Loading machines...</div>
          </div>
        ) : filteredMachines.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-[var(--text-light)] text-lg">No machines found</div>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full bg-white rounded-lg shadow-sm border border-[var(--border)]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="pl-2 pr-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider min-w-[200px]">
                      <span className="pl-[100px]">Facility</span>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Line
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider w-[10%]">
                      Process
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Cap 1
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Cap 2
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Speed/hr
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Shift Capacity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-[var(--text-light)] uppercase tracking-wider">
                      Current Job
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {showNewMachineRow && newMachineFormData && (
                    <tr className="bg-blue-50/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                        {/* Facility Input */}
                        <select
                          name="facilities_id"
                          value={newMachineFormData.facilities_id ?? ''}
                          onChange={handleNewMachineInputChange}
                          className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.facilities_id ? 'border-red-400' : 'border-gray-300'}`}
                        >
                          <option value="">Select Facility</option>
                          <option value="1">Bolingbrook</option>
                          <option value="2">Lemont</option>
                        </select>
                        {errors.facilities_id && <p className="text-red-500 text-xs mt-1">{errors.facilities_id}</p>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                        {/* Line Input */}
                        <input
                          type="number"
                          name="line"
                          value={newMachineFormData.line ?? ''}
                          onChange={handleNewMachineInputChange}
                          className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.line ? 'border-red-400' : 'border-gray-300'}`}
                          placeholder="Line #"
                        />
                        {errors.line && <p className="text-red-500 text-xs mt-1">{errors.line}</p>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                        {/* Type Input */}
                        <input
                          type="text"
                          name="type"
                          value={newMachineFormData.type ?? ''}
                          onChange={handleNewMachineInputChange}
                          className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.type ? 'border-red-400' : 'border-gray-300'}`}
                          placeholder="Type"
                        />
                        {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-dark)] w-[10%]">
                        {/* Process Type - DynamicMachineCapabilityFields will handle this */}
                        <DynamicMachineCapabilityFields
                          processTypeKey={newMachineFormData.process_type_key ?? ''}
                          capabilities={newMachineFormData.capabilities ?? {}}
                          onChange={handleNewMachineCapabilityChange}
                          onProcessTypeChange={handleNewMachineProcessTypeChange}
                          errors={errors}
                          minimalMode={true} // Add a prop to render a more compact version if needed
                        />
                        {errors.process_type_key && <p className="text-red-500 text-xs mt-1">{errors.process_type_key}</p>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                        {/* Status Select */}
                        <select
                          name="status"
                          value={newMachineFormData.status ?? 'available'}
                          onChange={handleNewMachineInputChange}
                          className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                        >
                          <option value="available">Available</option>
                          <option value="running">Running</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                        {/* Capability 1 - Will be rendered by DynamicMachineCapabilityFields */}
                        N/A
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                        {/* Capability 2 - Will be rendered by DynamicMachineCapabilityFields */}
                        N/A
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                        {/* Speed/hr Input */}
                        <input
                          type="number"
                          name="speed_hr"
                          value={newMachineFormData.speed_hr ?? ''}
                          onChange={handleNewMachineInputChange}
                          className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.speed_hr ? 'border-red-400' : 'border-gray-300'}`}
                          placeholder="Speed/hr"
                          min="0"
                          step="1"
                        />
                        {errors.speed_hr && <p className="text-red-500 text-xs mt-1">{errors.speed_hr}</p>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                        {/* Shift Capacity Input */}
                        <input
                          type="number"
                          name="shiftCapacity"
                          value={newMachineFormData.shiftCapacity ?? ''}
                          onChange={handleNewMachineInputChange}
                          className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.shiftCapacity ? 'border-red-400' : 'border-gray-300'}`}
                          placeholder="Shift Capacity"
                          min="0"
                          step="1"
                        />
                        {errors.shiftCapacity && <p className="text-red-500 text-xs mt-1">{errors.shiftCapacity}</p>}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                        {/* Actions: Save/Cancel */}
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveNewMachine}
                            className="px-3 py-1 bg-blue-400 text-white rounded-md hover:bg-blue-500 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={handleCancelNewMachine}
                            className="px-3 py-1 bg-gray-400 text-gray-800 rounded-md hover:bg-gray-500 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredMachines.map(machine => {
                    const capabilityKeys = getCapabilityColumns(machine);
                    const processConfig = machine.process_type_key ? getProcessTypeConfig(machine.process_type_key) : null;

                    const isEditing = editingMachineId === machine.id;

                    return (
                      <tr key={machine.id} className="relative group">
                        {isEditing && editedMachineFormData ? (
                          <>
                            <td className="pl-2 pr-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSaveEditedMachine();
                                    }}
                                    className="p-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                                    title="Save"
                                  >
                                    <FaSave size="0.75em" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelEdit();
                                    }}
                                    className="p-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition-colors"
                                    title="Cancel Edit"
                                  >
                                    <FaTimes size="0.75em" />
                                  </button>
                                  {/* Facility Input */}
                                  <select
                                    name="facilities_id"
                                    value={editedMachineFormData.facilities_id ?? ''}
                                    onChange={(e) => handleEditedMachineInputChange(e, machine.id)}
                                    className={`flex-1 px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.facilities_id ? 'border-red-400' : 'border-gray-300'}`}
                                  >
                                    <option value="">Select Facility</option>
                                    <option value="1">Bolingbrook</option>
                                    <option value="2">Lemont</option>
                                  </select>
                                </div>
                                {errors.facilities_id && <p className="text-red-500 text-xs">{errors.facilities_id}</p>}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {/* Line Input */}
                              <input
                                type="number"
                                name="line"
                                value={editedMachineFormData.line ?? ''}
                                onChange={(e) => handleEditedMachineInputChange(e, machine.id)}
                                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.line ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="Line #"
                              />
                              {errors.line && <p className="text-red-500 text-xs mt-1">{errors.line}</p>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {/* Type Input */}
                              <input
                                type="text"
                                name="type"
                                value={editedMachineFormData.type ?? ''}
                                onChange={(e) => handleEditedMachineInputChange(e, machine.id)}
                                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.type ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="Type"
                              />
                              {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
                            </td>
                            <td className="px-6 py-4 text-sm text-[var(--text-dark)] w-[10%]">
                              {/* Process Type - DynamicMachineCapabilityFields will handle this */}
                              <DynamicMachineCapabilityFields
                                processTypeKey={editedMachineFormData.process_type_key ?? ''}
                                capabilities={editedMachineFormData.capabilities ?? {}}
                                onChange={(field, value) => handleEditedMachineCapabilityChange(field, value, machine.id)}
                                onProcessTypeChange={(processTypeKey) => handleEditedMachineProcessTypeChange(processTypeKey, machine.id)}
                                errors={errors}
                                minimalMode={true}
                              />
                              {errors.process_type_key && <p className="text-red-500 text-xs mt-1">{errors.process_type_key}</p>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {/* Status Select */}
                              <select
                                name="status"
                                value={editedMachineFormData.status ?? 'available'}
                                onChange={(e) => handleEditedMachineInputChange(e, machine.id)}
                                className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1"
                              >
                                <option value="available">Available</option>
                                <option value="running">Running</option>
                                <option value="maintenance">Maintenance</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                              N/A
                            </td>
                            <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                              N/A
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {/* Speed/hr Input */}
                              <input
                                type="number"
                                name="speed_hr"
                                value={editedMachineFormData.speed_hr ?? ''}
                                onChange={(e) => handleEditedMachineInputChange(e, machine.id)}
                                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.speed_hr ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="Speed/hr"
                                min="0"
                                step="1"
                              />
                              {errors.speed_hr && <p className="text-red-500 text-xs mt-1">{errors.speed_hr}</p>}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {/* Shift Capacity Input */}
                              <input
                                type="number"
                                name="shiftCapacity"
                                value={editedMachineFormData.shiftCapacity ?? ''}
                                onChange={(e) => handleEditedMachineInputChange(e, machine.id)}
                                className={`w-full px-2 py-1 border rounded-md focus:outline-none focus:ring-1 ${errors.shiftCapacity ? 'border-red-400' : 'border-gray-300'}`}
                                placeholder="Shift Capacity"
                                min="0"
                                step="1"
                              />
                              {errors.shiftCapacity && <p className="text-red-500 text-xs mt-1">{errors.shiftCapacity}</p>}
                            </td>
                            <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                              {/* Actions: Delete */}
                              <div className="flex gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick(machine.id);
                                  }}
                                  className="p-2 bg-red-500 text-white rounded-md hover:bg-red-500 transition-colors"
                                  title="Delete"
                                >
                                  <FaTrash size="0.75em" />
                                </button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="pl-2 pr-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyMachine(machine);
                                    }}
                                    className="p-2 bg-green-100 text-white rounded-md hover:bg-green-500 transition-colors"
                                    title="Copy"
                                  >
                                    <FaCopy size="0.75em" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(machine.id);
                                    }}
                                    className="p-2 bg-red-100 text-white rounded-md hover:bg-red-600 transition-colors"
                                    title="Delete"
                                  >
                                    <FaTrash size="0.75em" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation(); // Prevent row click from being triggered
                                      handleEditClick(machine);
                                    }}
                                    className="p-2 bg-orange-100 text-white rounded-md hover:bg-orange-500 transition-colors"
                                    title="Edit"
                                  >
                                    <FaPen size="0.75em" />
                                  </button>
                                  <span className="ml-2">
                                    {machine.facilities_id === 1 ? 'Bolingbrook' : machine.facilities_id === 2 ? 'Lemont' : 'N/A'}
                                  </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[var(--text-dark)]">
                              Line {machine.line}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {machine.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)] w-[10%]">
                              {processConfig ? processConfig.label : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[machine.status]}`}>
                                {statusLabels[machine.status]}
                              </span>
                            </td>
                            {capabilityKeys.map((key, idx) => {
                              const field = processConfig?.fields.find(f => f.name === key);
                              const capKey = field?.type === 'dropdown' ? `supported_${key}s` :
                                           field?.type === 'number' ? `max_${key}` : key;
                              return (
                                <td key={idx} className="px-6 py-4 text-sm text-[var(--text-dark)]">
                                  {renderCapabilityValue(machine, capKey)}
                                </td>
                              );
                            })}
                            {capabilityKeys.length < 2 && (
                              <td className="px-6 py-4 text-sm text-[var(--text-dark)]">N/A</td>
                            )}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {machine.speed_hr ? `${machine.speed_hr}/hr` : 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--text-dark)]">
                              {machine.shiftCapacity ? machine.shiftCapacity.toLocaleString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-[var(--text-dark)]">
                              {machine.currentJob ? (
                                <span>Job #{machine.currentJob.number} - {machine.currentJob.name}</span>
                              ) : (machine.status === 'available' || machine.status === 'avalible') ? (
                                <span className="text-[var(--success)]">Ready for next job</span>
                              ) : (
                                <span className="text-[var(--text-light)]">No active job</span>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {filteredMachines.map(machine => {
                const processConfig = machine.process_type_key ? getProcessTypeConfig(machine.process_type_key) : null;

                return (
                  <div
                    key={machine.id}
                    className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-4 cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleMachineClick(machine)}
                  >
                    {/* Machine Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-base font-semibold text-[var(--text-dark)]">
                          Line {machine.line}
                        </div>
                        <div className="text-sm text-[var(--text-light)] mt-1">
                          {machine.type} {processConfig ? `(${processConfig.label})` : ''}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${statusColors[machine.status]}`}>
                        {statusLabels[machine.status]}
                      </span>
                    </div>

                    {/* Machine Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <div className="text-xs text-[var(--text-light)]">Facility</div>
                        <div className="font-medium text-[var(--text-dark)]">
                          {machine.facilities_id === 1 ? 'Bolingbrook' : machine.facilities_id === 2 ? 'Lemont' : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-light)]">Speed/hr</div>
                        <div className="font-medium text-[var(--text-dark)]">
                          {machine.speed_hr ? `${machine.speed_hr}/hr` : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[var(--text-light)]">Shift Capacity</div>
                        <div className="font-medium text-[var(--text-dark)]">
                          {machine.shiftCapacity ? machine.shiftCapacity.toLocaleString() : 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Current Job */}
                    <div className="border-t border-[var(--border)] pt-3 mb-3">
                      <div className="text-xs text-[var(--text-light)] mb-1">Current Job</div>
                      <div className="text-sm text-[var(--text-dark)]">
                        {machine.currentJob ? (
                          <span>Job #{machine.currentJob.number} - {machine.currentJob.name}</span>
                        ) : (machine.status === 'available' || machine.status === 'avalible') ? (
                          <span className="text-[var(--success)]">Ready for next job</span>
                        ) : (
                          <span className="text-[var(--text-light)]">No active job</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 border-t border-[var(--border)] pt-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyMachine(machine);
                        }}
                        className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium flex items-center justify-center gap-2"
                        title="Copy"
                      >
                        <FaCopy size="0.875em" />
                        Copy
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(machine.id);
                        }}
                        className="flex-1 px-3 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors font-medium flex items-center justify-center gap-2"
                        title="Delete"
                      >
                        <FaTrash size="0.875em" />
                        Delete
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditClick(machine);
                        }}
                        className="flex-1 px-3 py-2 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors font-medium flex items-center justify-center gap-2"
                        title="Edit"
                      >
                        <FaPen size="0.875em" />
                        Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <AddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} />

      {/* Edit Machine Modal */}
      <EditMachineModal
        isOpen={selectedMachine !== null}
        machine={selectedMachine}
        onClose={handleMachineModalClose}
        onSuccess={handleMachineModalClose}
        user={user}
      />

      {/* Dynamic Form Builder Modal */}
      <DynamicFormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
        user={user}
      />
    </>
  );
}

