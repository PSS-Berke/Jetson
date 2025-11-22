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
  getMachines,
  api,
} from "@/lib/api";
import { formatConditions } from "@/lib/rulesEngine";
import DynamicMachineCapabilityFields from "../../components/DynamicMachineCapabilityFields";
import { FaPen, FaTrash } from "react-icons/fa6";
import { FaTimes, FaSave } from "react-icons/fa";
import MachinesTabView from "../../components/machines/MachinesTabView";
import ProcessesTabView from "../../components/machines/ProcessesTabView";
import GroupsTabView from "../../components/machines/GroupsTabView";
import DeleteMachineModal from "../../components/DeleteMachineModal";
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
    filterFn: (machine) => machine.type?.toLowerCase()?.includes("insert") ?? false,
  },
  folders: {
    label: "Folder Machines",
    filterFn: (machine) =>
      machine.type?.toLowerCase()?.includes("folder") ||
      machine.type?.toLowerCase()?.includes("fold") ||
      false,
  },
  "hp-press": {
    label: "HP Press Machines",
    filterFn: (machine) =>
      machine.type?.toLowerCase()?.includes("hp") ||
      machine.type?.toLowerCase()?.includes("press") ||
      false,
  },
  inkjetters: {
    label: "Inkjet Machines",
    filterFn: (machine) => machine.type?.toLowerCase()?.includes("inkjet") ?? false,
  },
  affixers: {
    label: "Affixer Machines",
    filterFn: (machine) =>
      machine.type?.toLowerCase()?.includes("affixer") ||
      machine.type?.toLowerCase()?.includes("affix") ||
      false,
  },
};

export default function MachineTypePage() {
  const params = useParams();
  const machineType = params.type as string;

  const [viewMode, setViewMode] = useState<"machines" | "processes" | "groups">("machines");
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState<Machine | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [machineToDelete, setMachineToDelete] = useState<{id: number; line: number | string; name?: string; type?: string} | null>(null);
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
  } = useMachines(filterStatus, filterFacility || undefined, machineType);
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
      // Use getMachines instead of api.get to ensure capabilities are properly parsed
      const rawData = await getMachines(filterStatus, filterFacility || undefined, machineType);
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
    refetch(filterStatus, filterFacility || undefined, machineType);
    await fetchRawMachinesResponse();
  };

  const handleAddMachineSuccess = () => {
    setIsAddMachineModalOpen(false);
    refetch(filterStatus, filterFacility || undefined, machineType);
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
      refetch(filterStatus, filterFacility || undefined, machineType);
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
      refetch(filterStatus, filterFacility || undefined, machineType);
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

  const handleDeleteClick = (machine: Machine) => {
    setMachineToDelete({
      id: machine.id,
      line: machine.line,
      name: machine.name,
      type: machine.type,
    });
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!machineToDelete) return;

    try {
      await deleteMachine(machineToDelete.id);
      refetch(filterStatus, filterFacility || undefined, machineType);
      await fetchRawMachinesResponse();
      setEditingMachineId(null);
      setEditedMachineFormData(null);
      setErrors({});
      setIsDeleteModalOpen(false);
      setMachineToDelete(null);
    } catch (error) {
      console.error("Error deleting machine:", error);
      setErrors((prev) => ({
        ...prev,
        general: "Failed to delete machine. Please try again.",
      }));
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setMachineToDelete(null);
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

      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
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

        {/* View Mode Tabs */}
        <div className="flex border-b border-[var(--border)] mb-6">
          <button
            onClick={() => setViewMode("machines")}
            className={`px-6 py-3 font-medium transition-colors ${
              viewMode === "machines"
                ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
            }`}
          >
            Machines
          </button>
          <button
            onClick={() => setViewMode("processes")}
            className={`px-6 py-3 font-medium transition-colors ${
              viewMode === "processes"
                ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
            }`}
          >
            Processes & Capabilities
          </button>
          <button
            onClick={() => setViewMode("groups")}
            className={`px-6 py-3 font-medium transition-colors ${
              viewMode === "groups"
                ? "text-[var(--dark-blue)] border-b-2 border-[var(--dark-blue)]"
                : "text-[var(--text-light)] hover:text-[var(--dark-blue)]"
            }`}
          >
            Groups & Rules
          </button>
        </div>

        {/* Status Filters - Only shown on Machines tab */}
        {viewMode === "machines" && (
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
        )}

        {/* Tab Content */}
        {viewMode === "machines" && (
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
            <MachinesTabView
              machines={filteredRawMachinesResponse || []}
              loading={rawResponseLoading}
              onEditClick={(machine) => setSelectedMachine(machine)}
              onDeleteClick={handleDeleteClick}
            />
          </div>
        )}

        {viewMode === "processes" && (
          <ProcessesTabView machineType={machineType} />
        )}

        {viewMode === "groups" && (
          <GroupsTabView machineType={machineType} />
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

      {/* Delete Machine Modal */}
      <DeleteMachineModal
        isOpen={isDeleteModalOpen}
        machineLine={machineToDelete?.line || ""}
        machineName={machineToDelete?.name}
        machineType={machineToDelete?.type}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
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
