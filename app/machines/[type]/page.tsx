"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import { useMachines } from "@/hooks/useMachines";
import FacilityToggle from "../../components/FacilityToggle";
import PageHeader from "../../components/PageHeader";
import Link from "next/link";
import { useParams } from "next/navigation";
import type {
  Machine,
  MachineCapabilityValue,
  MachineStatus,
  MachineRule,
} from "@/types";
import { getProcessTypeConfig } from "@/lib/processTypeConfig";
import {
  createMachine,
  updateMachine,
  deleteMachine,
  getMachineRules,
  api,
} from "@/lib/api";
import { formatConditions } from "@/lib/rulesEngine";
import DynamicMachineCapabilityFields from "../../components/DynamicMachineCapabilityFields";
import { FaPen, FaTrash } from "react-icons/fa6";
import { FaTimes, FaSave } from "react-icons/fa";
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
const AddJobModal = dynamic(() => import("../../components/AddJobModal"), {
  ssr: false,
});

const AddMachineModal = dynamic(
  () => import("../../components/AddMachineModal"),
  {
    ssr: false,
  },
);

const EditMachineModal = dynamic(
  () => import("../../components/EditMachineModal"),
  {
    ssr: false,
  },
);

const DynamicFormBuilderModal = dynamic(
  () => import("../../components/DynamicFormBuilderModal"),
  {
    ssr: false,
  },
);

// Machine type configurations
const machineTypeConfig: Record<
  string,
  {
    label: string;
    filterFn: (machine: Machine) => boolean;
  }
> = {
  inserters: {
    label: "Inserter Machines",
    filterFn: (machine) => machine.type.toLowerCase().includes("insert"),
  },
  folders: {
    label: "Folder Machines",
    filterFn: (machine) =>
      machine.type.toLowerCase().includes("folder") ||
      machine.type.toLowerCase().includes("fold"),
  },
  "hp-press": {
    label: "HP Press Machines",
    filterFn: (machine) =>
      machine.type.toLowerCase().includes("hp") ||
      machine.type.toLowerCase().includes("press"),
  },
  inkjetters: {
    label: "Inkjet Machines",
    filterFn: (machine) => machine.type.toLowerCase().includes("inkjet"),
  },
  affixers: {
    label: "Affixer Machines",
    filterFn: (machine) =>
      machine.type.toLowerCase().includes("affixer") ||
      machine.type.toLowerCase().includes("affix"),
  },
};

export default function MachineTypePage() {
  const params = useParams();
  const machineType = params.type as string;

  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [filterFacility, setFilterFacility] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [showNewMachineRow, setShowNewMachineRow] = useState(false);
  const [newMachineFormData, setNewMachineFormData] =
    useState<Partial<Machine> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingMachineId, setEditingMachineId] = useState<number | null>(null);
  const [editedMachineFormData, setEditedMachineFormData] =
    useState<Partial<Machine> | null>(null);
  const [activeRules, setActiveRules] = useState<MachineRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [rawMachinesResponse, setRawMachinesResponse] = useState<any[] | null>(null);
  const [rawResponseLoading, setRawResponseLoading] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const {
    machines,
    isLoading: machinesLoading,
    error: machinesError,
    refetch,
  } = useMachines(filterStatus, filterFacility || undefined);
  const { logout } = useAuth();

  // Get configuration for this machine type
  const config = machineTypeConfig[machineType];

  // Filter machines by type - must be before useEffect that uses it
  const filteredMachines = config ? machines.filter(config.filterFn) : [];
  
  // Filter raw machines response by type
  const filteredRawMachinesResponse = rawMachinesResponse && config
    ? rawMachinesResponse.filter((machine: any) => config.filterFn(machine as Machine))
    : rawMachinesResponse;


  // Function to fetch raw machines response
  const fetchRawMachinesResponse = async () => {
    setRawResponseLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== "") {
        params.append("status", filterStatus);
      }
      if (filterFacility && filterFacility > 0) {
        params.append("facilities_id", filterFacility.toString());
      }
      const queryString = params.toString();
      const endpoint = queryString ? `/machines?${queryString}` : "/machines";
      const rawData = await api.get<any[]>(endpoint);
      setRawMachinesResponse(rawData);
    } catch (error) {
      console.error("[MachineTypePage] Error fetching raw machines:", error);
      setRawMachinesResponse(null);
    } finally {
      setRawResponseLoading(false);
    }
  };

  // Fetch raw machines response
  useEffect(() => {
    fetchRawMachinesResponse();
  }, [filterStatus, filterFacility]);

  const getNewMachineInitialState = (): Partial<Machine> => ({
    line: undefined,
    type: "",
    process_type_key: "",
    facilities_id: undefined,
    status: "available",
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
    console.log("Selected machine:", machine);
    setSelectedMachine(machine);
  };

  const handleMachineModalClose = async () => {
    setSelectedMachine(null);
    refetch(filterStatus, filterFacility || undefined);
    await fetchRawMachinesResponse();
  };

  const handleAddMachineSuccess = () => {
    setIsAddMachineModalOpen(false);
    refetch(filterStatus, filterFacility || undefined);
  };

  // Helper to render capability values
  const renderCapabilityValue = (
    machine: Machine,
    capabilityKey: string,
  ): string => {
    if (!machine.capabilities || !machine.capabilities[capabilityKey]) {
      return "N/A";
    }

    const value = machine.capabilities[capabilityKey];

    if (Array.isArray(value)) {
      return value.length > 0 ? value.join(", ") : "N/A";
    }

    return String(value);
  };

  // Get relevant capability columns for a machine
  const getCapabilityColumns = (machine: Machine): string[] => {
    const processConfig = machine.process_type_key
      ? getProcessTypeConfig(machine.process_type_key)
      : null;
    if (!processConfig) return [];

    // Get the first 2-3 most important fields (skip price_per_m)
    return processConfig.fields
      .filter((field) => field.name !== "price_per_m")
      .slice(0, 2)
      .map((field) => field.name);
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Invalid machine type</div>
      </div>
    );
  }

  const statusColors = {
    running: "bg-blue-100 text-blue-800 border-blue-200",
    available: "bg-green-100 text-green-800 border-green-200",
    avalible: "bg-green-100 text-green-800 border-green-200",
    maintenance: "bg-yellow-100 text-yellow-800 border-yellow-200",
  };

  const statusLabels = {
    running: "Running",
    available: "Available",
    avalible: "Available",
    maintenance: "Maintenance",
  };

  const handleNewMachineInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    let processedValue: string | number | null | undefined = value;

    // Handle numeric inputs
    if (name === "line" || name === "speed_hr" || name === "shiftCapacity") {
      processedValue = value === "" ? undefined : parseFloat(value);
      if (isNaN(processedValue as number)) {
        // If parseFloat results in NaN, set to undefined
        processedValue = undefined;
      }
    } else if (name === "facilities_id") {
      processedValue = value === "" ? undefined : parseInt(value);
    }

    setNewMachineFormData((prev) => ({ ...prev, [name]: processedValue }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleNewMachineCapabilityChange = (
    field: string,
    value: MachineCapabilityValue,
  ) => {
    setNewMachineFormData((prev) => ({
      ...prev,
      capabilities: {
        ...prev?.capabilities,
        [field]: value,
      },
    }));
  };

  const handleNewMachineProcessTypeChange = (processTypeKey: string) => {
    setNewMachineFormData((prev) => ({
      ...prev,
      process_type_key: processTypeKey,
    }));
  };

  const handleSaveNewMachine = async () => {
    const newMachine = newMachineFormData;
    if (!newMachine) return;

    const processConfig = newMachine.process_type_key
      ? getProcessTypeConfig(newMachine.process_type_key)
      : null;
    if (!processConfig) {
      setErrors((prev) => ({
        ...prev,
        process_type_key: "Invalid process type",
      }));
      return;
    }

    // Validate required fields
    if (!newMachine.facilities_id) {
      setErrors((prev) => ({ ...prev, facilities_id: "Facility is required" }));
      return;
    }
    if (!newMachine.line) {
      setErrors((prev) => ({ ...prev, line: "Line is required" }));
      return;
    }
    if (!newMachine.type) {
      setErrors((prev) => ({ ...prev, type: "Type is required" }));
      return;
    }
    if (!newMachine.process_type_key) {
      setErrors((prev) => ({
        ...prev,
        process_type_key: "Process type is required",
      }));
      return;
    }
    if (!newMachine.status) {
      setErrors((prev) => ({ ...prev, status: "Status is required" }));
      return;
    }
    if (newMachine.speed_hr === undefined) {
      setErrors((prev) => ({ ...prev, speed_hr: "Speed/hr is required" }));
      return;
    }
    if (newMachine.shiftCapacity === undefined) {
      setErrors((prev) => ({
        ...prev,
        shiftCapacity: "Shift capacity is required",
      }));
      return;
    }

    try {
      await createMachine(newMachine);
      setShowNewMachineRow(false);
      setNewMachineFormData(null);
      setErrors({});
      refetch(filterStatus, filterFacility || undefined);
    } catch (error) {
      console.error("Error creating machine:", error);
      setErrors((prev) => ({
        ...prev,
        process_type_key: "Failed to create machine",
      }));
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
      shiftCapacity:
        machine.shiftCapacity === undefined || machine.shiftCapacity === null
          ? undefined
          : machine.shiftCapacity,
    });
    setErrors({}); // Clear errors when starting edit
  };

  const handleEditedMachineInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    id: number,
  ) => {
    const { name, value } = e.target;

    let processedValue: string | number | null | undefined = value;

    if (name === "line" || name === "speed_hr" || name === "shiftCapacity") {
      processedValue = value === "" ? undefined : parseFloat(value);
      if (isNaN(processedValue as number)) {
        processedValue = undefined;
      }
    } else if (name === "facilities_id") {
      processedValue = value === "" ? undefined : parseInt(value);
    }

    setEditedMachineFormData((prev) => ({
      ...prev,
      [name]: processedValue,
    }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const handleEditedMachineCapabilityChange = (
    field: string,
    value: MachineCapabilityValue,
    id: number,
  ) => {
    setEditedMachineFormData((prev) => ({
      ...prev,
      capabilities: {
        ...prev?.capabilities,
        [field]: value,
      },
    }));
  };

  const handleEditedMachineProcessTypeChange = (
    processTypeKey: string,
    id: number,
  ) => {
    setEditedMachineFormData((prev) => ({
      ...prev,
      process_type_key: processTypeKey,
    }));
    setErrors((prev) => ({ ...prev, process_type_key: "" }));
  };

  const handleSaveEditedMachine = async () => {
    const editedMachine = editedMachineFormData;
    if (!editingMachineId || !editedMachine) return;

    // Basic validation (can be expanded)
    const newErrors: Record<string, string> = {};
    if (
      editedMachine.facilities_id === undefined ||
      editedMachine.facilities_id === null
    ) {
      newErrors.facilities_id = "Facility is required";
    }
    if (editedMachine.line === undefined || editedMachine.line === null) {
      newErrors.line = "Line is required";
    }
    if (
      editedMachine.type === undefined ||
      editedMachine.type === null ||
      editedMachine.type.trim() === ""
    ) {
      newErrors.type = "Type is required";
    }
    if (
      editedMachine.process_type_key === undefined ||
      editedMachine.process_type_key.trim() === ""
    ) {
      newErrors.process_type_key = "Process type is required";
    }
    if (
      editedMachine.speed_hr === undefined ||
      editedMachine.speed_hr === null
    ) {
      newErrors.speed_hr = "Speed/hr is required";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      await updateMachine(editingMachineId, editedMachine as Machine);
      refetch(filterStatus, filterFacility || undefined);
      await fetchRawMachinesResponse();
      setEditingMachineId(null);
      setEditedMachineFormData(null);
      setErrors({});
    } catch (error) {
      console.error("Error updating machine:", error);
      setErrors((prev) => ({
        ...prev,
        general: "Failed to update machine. Please try again.",
      }));
    }
  };

  const handleCancelEdit = () => {
    setEditingMachineId(null);
    setEditedMachineFormData(null);
    setErrors({});
  };

  const handleDeleteClick = async (machineId: number) => {
    if (!confirm("Are you sure you want to delete this machine?")) {
      return;
    }

    try {
      await deleteMachine(machineId);
      refetch(filterStatus, filterFacility || undefined);
      await fetchRawMachinesResponse();
      setEditingMachineId(null);
      setEditedMachineFormData(null);
      setErrors({});
    } catch (error) {
      console.error("Error deleting machine:", error);
      setErrors((prev) => ({
        ...prev,
        general: "Failed to delete machine. Please try again.",
      }));
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
              <Link
                href="/machines"
                className="text-[var(--primary-blue)] hover:underline"
              >
                Machines
              </Link>
            </li>
            <li className="text-[var(--text-light)]">/</li>
            <li className="text-[var(--text-dark)] font-medium capitalize">
              {machineType.replace("-", " ")}
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-6 border-b border-[var(--border)] gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
              {config.label}
            </h2>
            <FacilityToggle
              currentFacility={filterFacility}
              onFacilityChange={handleFacilityChange}
              showAll={true}
            />
          </div>
        </div>

        {/* Status Filters */}
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => handleFilterChange("")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === ""
                ? "bg-[var(--primary-blue)] text-white"
                : "bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50"
            }`}
          >
            All
          </button>
          <button
            onClick={() => handleFilterChange("running")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "running"
                ? "bg-[var(--primary-blue)] text-white"
                : "bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50"
            }`}
          >
            Running
          </button>
          <button
            onClick={() => handleFilterChange("avalible")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "avalible"
                ? "bg-[var(--primary-blue)] text-white"
                : "bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50"
            }`}
          >
            Available
          </button>
          <button
            onClick={() => handleFilterChange("maintenance")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filterStatus === "maintenance"
                ? "bg-[var(--primary-blue)] text-white"
                : "bg-white text-[var(--text-dark)] border border-[var(--border)] hover:bg-gray-50"
            }`}
          >
            Maintenance
          </button>
        </div>

        {/* Raw Response Display */}
        <div className="mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Machines
            </h3>
            {filteredRawMachinesResponse && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                {filteredRawMachinesResponse.length} machine{filteredRawMachinesResponse.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {rawResponseLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading response...</span>
            </div>
          ) : filteredRawMachinesResponse && filteredRawMachinesResponse.length > 0 ? (
            <div className="space-y-4">
              {filteredRawMachinesResponse.map((machine: any, index: number) => {
                // Convert raw machine to Machine type for handlers
                const machineForHandlers: Machine = {
                  id: machine.id,
                  created_at: machine.created_at,
                  line: typeof machine.line === 'string' ? parseInt(machine.line) : machine.line,
                  type: machine.type || '',
                  status: (machine.status || 'available') as MachineStatus,
                  facilities_id: machine.facilities_id,
                  jobs_id: machine.jobs_id,
                  name: machine.name || '',
                  capabilities: machine.capabilities || {},
                  process_type_key: machine.process_type_key || '',
                  designation: machine.designation || '',
                  speed_hr: machine.speed_hr ?? 0,
                };

                return (
                  <div
                    key={index}
                    className="bg-white rounded-lg border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow relative"
                  >
                    {/* Edit and Delete Buttons */}
                    <div className="absolute top-4 right-4 flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMachine(machineForHandlers);
                        }}
                        className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                        title="Edit"
                      >
                        <FaPen size="0.875em" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(machine.id);
                        }}
                        className="p-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors shadow-sm"
                        title="Delete"
                      >
                        <FaTrash size="0.875em" />
                      </button>
                    </div>

                    {(machine.name || machine.designation) && (
                      <div className="mb-4 pb-4 border-b border-gray-200 pr-20">
                        {machine.name && (
                          <div className="text-2xl font-bold text-gray-900">
                            {machine.name}
                          </div>
                        )}
                        {machine.designation && (
                          <div className="text-sm text-gray-600 mt-1">
                            {machine.designation}
                          </div>
                        )}
                      </div>
                    )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Created At
                        </div>
                        <div className="text-sm text-gray-900">
                          {machine.created_at
                            ? new Date(machine.created_at).toLocaleString()
                            : 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Line
                        </div>
                        <div className="text-sm font-medium text-gray-900">
                          {machine.line ?? 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Type
                        </div>
                        <div className="text-sm font-medium text-blue-700">
                          {machine.type ?? 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Status
                        </div>
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
                            machine.status === 'running'
                              ? 'bg-blue-100 text-blue-800'
                              : machine.status === 'available' || machine.status === 'avalible'
                                ? 'bg-green-100 text-green-800'
                                : machine.status === 'maintenance'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {machine.status ?? 'N/A'}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Facility ID
                        </div>
                        <div className="text-sm text-gray-900">
                          {machine.facilities_id ?? 'N/A'}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Job ID
                        </div>
                        <div className="text-sm text-gray-900">
                          {machine.jobs_id ?? 'N/A'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                          Process Type Key
                        </div>
                        <div className="text-sm font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded">
                          {machine.process_type_key || <span className="text-gray-400 italic">Empty</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                  {machine.capabilities && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Capabilities
                        </div>
                        <div className="bg-gray-50 p-3 rounded border border-gray-200">
                          {machine.capabilities && typeof machine.capabilities === 'object' && Object.keys(machine.capabilities).length > 0 ? (
                            <div className="space-y-2">
                              {Object.entries(machine.capabilities).map(([key, value]) => (
                                <div key={key} className="flex items-start gap-2">
                                  <div className="text-xs font-semibold text-gray-600 min-w-[120px] capitalize">
                                    {key.replace(/_/g, ' ')}:
                                  </div>
                                  <div className="text-sm text-gray-900 flex-1">
                                    {Array.isArray(value) ? (
                                      <div className="flex flex-wrap gap-1">
                                        {value.map((item: any, idx: number) => (
                                          <span
                                            key={idx}
                                            className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                                          >
                                            {String(item)}
                                          </span>
                                        ))}
                                      </div>
                                    ) : value === null || value === undefined ? (
                                      <span className="text-gray-400 italic">null</span>
                                    ) : typeof value === 'object' ? (
                                      <span className="text-gray-600">{JSON.stringify(value)}</span>
                                    ) : (
                                      <span className="font-medium">{String(value)}</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : machine.capabilities === null ? (
                            <span className="text-sm text-gray-400 italic">null</span>
                          ) : (
                            <span className="text-sm text-gray-900">{String(machine.capabilities)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
              <p>No data available</p>
            </div>
          )}
        </div>

        {/* Active Rules Section */}
        {activeRules.length > 0 && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                ></path>
              </svg>
              Active Rules for {config.label} ({activeRules.length})
            </h3>
            <div className="space-y-2">
              {activeRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-white border border-green-200 rounded p-3"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-medium text-gray-900">
                      {rule.name}
                    </span>
                    <div className="flex items-center gap-3 text-sm text-gray-600">
                      <span>Speed: {rule.outputs.speed_modifier}%</span>
                      <span>People: {rule.outputs.people_required}</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Conditions:</span>{" "}
                    {formatConditions(rule.conditions)}
                  </div>
                  {rule.outputs.notes && (
                    <div className="text-xs text-gray-500 mt-1">
                      {rule.outputs.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <AddJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
      />

      {/* Add Machine Modal */}
      <AddMachineModal
        isOpen={isAddMachineModalOpen}
        onClose={() => setIsAddMachineModalOpen(false)}
        onSuccess={handleAddMachineSuccess}
        user={user}
      />

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
