"use client";

import { useState } from "react";
import type {
  Machine,
  MachineStatus,
} from "@/types";
import { FaPen, FaTrash } from "react-icons/fa6";
import { getFacilityName, getFacilityColors } from "@/lib/facilityUtils";
import ProcessTypeBadge from "@/app/components/ProcessTypeBadge";
import { isReservedFieldName } from "@/lib/capabilityValidation";

interface MachinesTabViewProps {
  machines: any[];
  loading: boolean;
  onEditClick: (machine: Machine) => void;
  onDeleteClick: (machine: Machine) => void;
}

export default function MachinesTabView({
  machines,
  loading,
  onEditClick,
  onDeleteClick,
}: MachinesTabViewProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading machines...</span>
      </div>
    );
  }

  if (!machines || machines.length === 0) {
    return (
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
        <p>No machines available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {machines.map((machine: any, index: number) => {
        // Convert raw machine to Machine type for handlers
        const machineForHandlers: Machine = {
          id: machine.id,
          created_at: machine.created_at,
          line: typeof machine.line === 'string' ? machine.line : String(machine.line),
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
                  onEditClick(machineForHandlers);
                }}
                className="p-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors shadow-sm"
                title="Edit"
              >
                <FaPen size="0.875em" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClick(machineForHandlers);
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
                  <ProcessTypeBadge processType={machine.process_type_key || machine.type || 'unknown'} />
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
                    Facility
                  </div>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-semibold border ${
                      getFacilityColors(machine.facilities_id).bg
                    } ${getFacilityColors(machine.facilities_id).text} ${
                      getFacilityColors(machine.facilities_id).border
                    }`}
                  >
                    {getFacilityName(machine.facilities_id)}
                  </span>
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
                    Process Type
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
                    {machine.capabilities && typeof machine.capabilities === 'object' && !Array.isArray(machine.capabilities) && Object.keys(machine.capabilities).length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(machine.capabilities).map(([key, value]) => {
                          const isStandardField = isReservedFieldName(key);
                          const isCustomField = key.startsWith('custom_') || key.startsWith('fb_');

                          // Format field label
                          const fieldLabel = key
                            .replace(/^(custom_|fb_)/, '') // Remove prefix for display
                            .replace(/_/g, ' ')
                            .replace(/\b\w/g, (char) => char.toUpperCase()); // Title case

                          return (
                            <div key={key} className="flex flex-col gap-1 group p-2 bg-white rounded border border-gray-200">
                              <div className="text-xs font-semibold text-gray-600 flex items-center gap-1 flex-wrap">
                                <span className="capitalize">{fieldLabel}:</span>
                                {isCustomField && (
                                  <span
                                    className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium"
                                    title="Custom field added via form builder"
                                  >
                                    Custom
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-900">
                                {Array.isArray(value) ? (
                                  <div className="flex flex-wrap gap-1">
                                    {value.map((item: any, idx: number) => (
                                      <span
                                        key={idx}
                                        className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200 transition-colors"
                                        title={`Value: ${String(item)}`}
                                      >
                                        {String(item)}
                                      </span>
                                    ))}
                                  </div>
                                ) : value === null || value === undefined || value === '' ? (
                                  <span className="text-gray-400 italic">Not set</span>
                                ) : typeof value === 'boolean' ? (
                                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${value ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'}`}>
                                    {value ? 'Yes' : 'No'}
                                  </span>
                                ) : typeof value === 'number' ? (
                                  <span className="font-medium">
                                    {key.includes('price') || key.includes('cost') ? `$${value.toFixed(2)}` : value}
                                  </span>
                                ) : typeof value === 'object' ? (
                                  <details className="text-xs">
                                    <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                                      View object
                                    </summary>
                                    <pre className="mt-1 p-2 bg-white rounded border border-gray-300 text-[11px] overflow-x-auto">
                                      {JSON.stringify(value, null, 2)}
                                    </pre>
                                  </details>
                                ) : (
                                  <span className="font-medium break-words">{String(value)}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No capabilities defined</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
