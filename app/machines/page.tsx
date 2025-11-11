'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import PageHeader from '../components/PageHeader';
import Link from 'next/link';

// Dynamically import modals - only loaded when opened
const AddJobModal = dynamic(() => import('../components/AddJobModal'), {
  ssr: false,
});

const AddMachineModal = dynamic(() => import('../components/AddMachineModal'), {
  ssr: false,
});

const DynamicFormBuilderModal = dynamic(() => import('../components/DynamicFormBuilderModal'), {
  ssr: false,
});

const machineTypes = [
  {
    name: 'Inserters',
    description: 'High-speed insertion machines',
    path: '/machines/inserters'
  },
  {
    name: 'Folders',
    description: 'Document folding equipment',
    path: '/machines/folders'
  },
  {
    name: 'HP Press',
    description: 'High-performance printing press',
    path: '/machines/hp-press'
  },
  {
    name: 'Inkjetters',
    description: 'Inkjet printing systems',
    path: '/machines/inkjetters'
  },
  {
    name: 'Affixers',
    description: 'Label and stamp affixing machines',
    path: '/machines/affixers'
  }
];

export default function Machines() {
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isAddMachineModalOpen, setIsAddMachineModalOpen] = useState(false);
  const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
  const { user, isLoading: userLoading } = useUser();
  const { logout } = useAuth();

  const handleAddMachineSuccess = () => {
    setIsAddMachineModalOpen(false);
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-6 border-b border-[var(--border)] gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-[var(--dark-blue)]">
            Machine Types
          </h2>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddMachineModalOpen(true)}
              className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
            >
              + Add Machine
            </button>
            <button
              onClick={() => setIsFormBuilderOpen(true)}
              className="px-4 py-2 bg-[#E31E24] text-white rounded-lg hover:bg-[#C01A1F] transition-colors font-medium flex items-center gap-2 border-2 border-[#E31E24]"
            >
              <span className="text-lg">+</span>
              Form
            </button>
          </div>
        </div>

        {/* Machine Type Tiles */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {machineTypes.map((machine) => (
            <Link
              key={machine.name}
              href={machine.path}
              className="group"
            >
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
      </main>

      {/* Add Job Modal */}
      <AddJobModal isOpen={isJobModalOpen} onClose={() => setIsJobModalOpen(false)} />

      {/* Add Machine Modal */}
      <AddMachineModal
        isOpen={isAddMachineModalOpen}
        onClose={() => setIsAddMachineModalOpen(false)}
        onSuccess={handleAddMachineSuccess}
      />

      {/* Dynamic Form Builder Modal */}
      <DynamicFormBuilderModal
        isOpen={isFormBuilderOpen}
        onClose={() => setIsFormBuilderOpen(false)}
      />
    </>
  );
}
