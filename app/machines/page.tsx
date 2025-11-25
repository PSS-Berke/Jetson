"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { useAuth } from "@/hooks/useAuth";
import PageHeader from "../components/PageHeader";
import Link from "next/link";
import ProcessesTabView from "../components/machines/ProcessesTabView";
import GroupsTabView from "../components/machines/GroupsTabView";

// Dynamically import modals - only loaded when opened
const AddJobModal = dynamic(() => import("../components/AddJobModal"), {
  ssr: false,
});

const CreateMachineWizard = dynamic(
  () => import("../components/CreateMachineWizard"),
  {
    ssr: false,
  },
);

const machineTypes = [
  {
    name: "Inserters",
    description: "High-speed insertion machines",
    path: "/machines/inserters",
  },
  {
    name: "Folders",
    description: "Document folding equipment",
    path: "/machines/folders",
  },
  {
    name: "HP Press",
    description: "High-performance printing press",
    path: "/machines/hp-press",
  },
  {
    name: "Inkjetters",
    description: "Inkjet printing systems",
    path: "/machines/inkjetters",
  },
  {
    name: "Affixers",
    description: "Label and stamp affixing machines",
    path: "/machines/affixers",
  },
];

export default function Machines() {
  const [viewMode, setViewMode] = useState<"machines" | "processes" | "groups">("machines");
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();
  const router = useRouter();

  // Map process type keys to their routes
  const processTypeToRoute: Record<string, string> = {
    "insert": "/machines/inserters",
    "fold": "/machines/folders",
    "hpPress": "/machines/hp-press",
    "inkjet": "/machines/inkjetters",
    "inkjetPlus": "/machines/inkjetters",
    "affixGlue": "/machines/affixers",
    "affixLabel": "/machines/affixers",
    "labelApply": "/machines/affixers",
  };

  const handleWizardSuccess = (processTypeKey: string) => {
    setIsWizardOpen(false);
    // Navigate to the appropriate machine type page
    const route = processTypeToRoute[processTypeKey];
    if (route) {
      router.push(route);
    } else {
      // If no specific route mapping exists, try to infer from the process type name
      // For custom process types, we might not have a direct mapping
      console.warn(`No route mapping found for process type: ${processTypeKey}`);
      // Optionally: You could navigate to a generic machines list page or stay on current page
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        currentPage="machines"
        user={user}
        onAddJobClick={() => setIsJobModalOpen(true)}
        showAddJobButton={true}
        onLogout={logout}
      />

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
            Machine Management
          </h2>
          {viewMode === "machines" && (
            <button
              onClick={() => setIsWizardOpen(true)}
              className="px-4 lg:px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md flex items-center gap-2 cursor-pointer relative z-10"
            >
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
                  d="M12 4v16m8-8H4"
                ></path>
              </svg>
              <span>Machine</span>
            </button>
          )}
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

        {/* Machines Tab - Machine Type Tiles */}
        {viewMode === "machines" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {machineTypes.map((machine) => (
              <Link key={machine.name} href={machine.path} className="group">
                <div className="bg-white rounded-lg shadow-sm border border-[var(--border)] p-6 hover:shadow-md hover:border-[var(--primary-blue)] transition-all duration-200 cursor-pointer h-full">
                  <div className="flex flex-col items-center text-center">
                    <h3 className="text-xl font-semibold text-[var(--dark-blue)] mb-2">
                      {machine.name}
                    </h3>
                    <p className="text-[var(--text-light)] text-sm">
                      {machine.description}
                    </p>
                    <div className="mt-4 text-[var(--primary-blue)] font-medium group-hover:translate-x-1 transition-transform duration-200">
                      View Machines →
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Processes & Capabilities Tab */}
        {viewMode === "processes" && <ProcessesTabView />}

        {/* Groups & Rules Tab */}
        {viewMode === "groups" && <GroupsTabView />}
      </main>

      {/* Add Job Modal */}
      <AddJobModal
        isOpen={isJobModalOpen}
        onClose={() => setIsJobModalOpen(false)}
      />

      {/* Create Machine Wizard */}
      <CreateMachineWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleWizardSuccess}
      />
    </>
  );
}
