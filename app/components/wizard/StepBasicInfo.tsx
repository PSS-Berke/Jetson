/**
 * Step 2: Basic Information
 * Collects line number, machine name, and facility
 */

'use client';

import React from 'react';
import FacilityToggle from '../FacilityToggle';

interface StepBasicInfoProps {
  line: string;
  machineName: string;
  facilities_id: number | null;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onBlur: (field: string) => void;
}

export default function StepBasicInfo({
  line,
  machineName,
  facilities_id,
  onChange,
  errors,
  touched,
  onBlur,
}: StepBasicInfoProps) {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Basic Information</h2>
      <p className="text-sm text-gray-600 mb-8">
        Enter the essential details for this machine
      </p>

      <div className="space-y-6">
        {/* Line Number */}
        <div>
          <label htmlFor="line" className="block text-sm font-medium text-gray-700 mb-2">
            Line Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="line"
            value={line}
            onChange={(e) => onChange('line', e.target.value)}
            onBlur={() => onBlur('line')}
            placeholder="e.g., 101"
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              touched.line && errors.line
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
          />
          {touched.line && errors.line && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.line}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            A unique identifier for this machine within the facility
          </p>
        </div>

        {/* Machine Name */}
        <div>
          <label htmlFor="machineName" className="block text-sm font-medium text-gray-700 mb-2">
            Machine Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="machineName"
            value={machineName}
            onChange={(e) => onChange('machineName', e.target.value)}
            onBlur={() => onBlur('machineName')}
            placeholder="e.g., Inserter A, Folder 5, HP Press Main"
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              touched.machineName && errors.machineName
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300'
            }`}
          />
          {touched.machineName && errors.machineName && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.machineName}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            A descriptive name to identify this machine
          </p>
        </div>

        {/* Facility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Facility <span className="text-red-500">*</span>
          </label>
          <FacilityToggle
            currentFacility={facilities_id}
            onFacilityChange={(facility) => onChange('facilities_id', facility)}
            showAll={false}
          />
          {touched.facilities_id && errors.facilities_id && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.facilities_id}
            </p>
          )}
          <p className="mt-2 text-xs text-gray-500">
            Select the facility where this machine is located
          </p>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
          <svg
            className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          <div className="text-sm text-blue-800">
            <strong>Note:</strong> The machine will be created with &quot;Available&quot; status by default.
            Speed and capacity will be determined by the performance rules you configure in Step 4.
          </div>
        </div>
      </div>
    </div>
  );
}
