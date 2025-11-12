/**
 * Step 1: Category Selection
 * Small 200x400px modal for selecting Conveyance or Ancillary
 */

'use client';

import React from 'react';
import type { MachineCategory } from '@/types';

interface StepCategorySelectionProps {
  selected: MachineCategory | null;
  onSelect: (category: MachineCategory) => void;
  error?: string;
}

export default function StepCategorySelection({
  selected,
  onSelect,
  error,
}: StepCategorySelectionProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Machine Category</h2>
      <p className="text-sm text-gray-600 mb-8 text-center max-w-md">
        Choose the type of machine you want to create
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm">
        {/* Conveyance Option */}
        <button
          type="button"
          onClick={() => onSelect('conveyance')}
          className={`p-6 rounded-lg border-2 transition-all duration-200 text-left ${
            selected === 'conveyance'
              ? 'border-blue-500 bg-blue-50 shadow-lg'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                selected === 'conveyance' ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              🏭
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Conveyance</h3>
              <p className="text-sm text-gray-600">
                Primary machines that process materials through various operations
              </p>
              <div className="mt-2 text-xs text-gray-500">
                Examples: Inserters, Folders, Printers, Sorters
              </div>
            </div>
            {selected === 'conveyance' && (
              <div className="text-blue-500">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
        </button>

        {/* Ancillary Option */}
        <button
          type="button"
          onClick={() => onSelect('ancillary')}
          className={`p-6 rounded-lg border-2 transition-all duration-200 text-left ${
            selected === 'ancillary'
              ? 'border-blue-500 bg-blue-50 shadow-lg'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
          }`}
        >
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${
                selected === 'ancillary' ? 'bg-blue-100' : 'bg-gray-100'
              }`}
            >
              🔧
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Ancillary</h3>
              <p className="text-sm text-gray-600">
                Attachable systems that connect to conveyances to enhance functionality
              </p>
              <div className="mt-2 text-xs text-gray-500">
                Examples: Card Affixers, Inkjetters, Camera Systems
              </div>
            </div>
            {selected === 'ancillary' && (
              <div className="text-blue-500">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>
        </button>
      </div>

      {error && (
        <div className="mt-4 text-sm text-red-600 flex items-center gap-2">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
