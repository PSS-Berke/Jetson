/**
 * Step 2: Basic Information
 * Collects line number, machine name, and facility
 */

"use client";

import React from "react";
import FacilityToggle from "../FacilityToggle";
import { generateLineList } from "@/hooks/useWizardState";

interface StepBasicInfoProps {
  quantity: number;
  line: string;
  lineStart: string;
  lineEnd: string;
  machineName: string;
  machineDesignation: string;
  facilities_id: number | null;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onBlur: (field: string) => void;
}

export default function StepBasicInfo({
  quantity,
  line,
  lineStart,
  lineEnd,
  machineName,
  machineDesignation,
  facilities_id,
  onChange,
  errors,
  touched,
  onBlur,
}: StepBasicInfoProps) {
  // Auto-calculate line range when quantity changes
  const handleQuantityChange = (value: string) => {
    const qty = parseInt(value) || 1;
    onChange("quantity", qty);

    // Auto-update line range if lineStart is set
    if (qty > 1 && lineStart.trim()) {
      const lineList = generateLineList(lineStart.trim(), qty);
      if (lineList.length > 0) {
        onChange("lineEnd", lineList[lineList.length - 1]);
      }
    }
  };

  // Auto-calculate lineEnd when lineStart changes
  const handleLineStartChange = (value: string) => {
    onChange("lineStart", value);

    if (quantity > 1 && value.trim()) {
      const lineList = generateLineList(value.trim(), quantity);
      if (lineList.length > 0) {
        onChange("lineEnd", lineList[lineList.length - 1]);
      }
    }
  };

  // Generate machine designations preview
  const generateDesignations = (): string[] => {
    if (!machineDesignation || quantity === 1) return [];

    return Array.from(
      { length: quantity },
      (_, i) => `${machineDesignation}${i + 1}`,
    );
  };

  const designations = generateDesignations();

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">
        Basic Information
      </h2>
      <p className="text-sm text-gray-600 mb-8">
        Enter the essential details for this machine
      </p>

      <div className="space-y-6">
        {/* Quantity */}
        <div>
          <label
            htmlFor="quantity"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Quantity <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            id="quantity"
            min="1"
            max="100"
            value={quantity}
            onChange={(e) => handleQuantityChange(e.target.value)}
            onBlur={() => onBlur("quantity")}
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              touched.quantity && errors.quantity
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300"
            }`}
          />
          {touched.quantity && errors.quantity && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.quantity}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Number of machines to create (1-100)
          </p>
        </div>

        {/* Line Number or Line Range */}
        {quantity === 1 ? (
          <div>
            <label
              htmlFor="line"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Line Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="line"
              value={line}
              onChange={(e) => onChange("line", e.target.value)}
              onBlur={() => onBlur("line")}
              placeholder="e.g., 101 or a1"
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                touched.line && errors.line
                  ? "border-red-500 focus:ring-red-500"
                  : "border-gray-300"
              }`}
            />
            {touched.line && errors.line && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
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
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="lineStart"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Starting Line Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lineStart"
                value={lineStart}
                onChange={(e) => handleLineStartChange(e.target.value)}
                onBlur={() => onBlur("lineStart")}
                placeholder="e.g., 1 or a1"
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  touched.lineStart && errors.lineStart
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300"
                }`}
              />
              {touched.lineStart && errors.lineStart && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.lineStart}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="lineEnd"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Ending Line Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lineEnd"
                value={lineEnd}
                onChange={(e) => onChange("lineEnd", e.target.value)}
                onBlur={() => onBlur("lineEnd")}
                placeholder="e.g., 3 or a3"
                className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  touched.lineEnd && errors.lineEnd
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-300"
                }`}
              />
              {touched.lineEnd && errors.lineEnd && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errors.lineEnd}
                </p>
              )}
            </div>
            <p className="col-span-2 text-xs text-gray-500">
              Line range for {quantity} machines (auto-calculated from starting
              line)
            </p>
            
            {/* Preview of line_list array */}
            {quantity > 1 && lineStart && lineStart.trim() && (
              <div className="col-span-2 mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  Generated Line Numbers:
                </p>
                <div className="flex flex-wrap gap-2">
                  {generateLineList(lineStart.trim(), quantity).map((lineNum, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      {lineNum}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Machine Name */}
        <div>
          <label
            htmlFor="machineName"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Machine Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="machineName"
            value={machineName}
            onChange={(e) => onChange("machineName", e.target.value)}
            onBlur={() => onBlur("machineName")}
            placeholder="e.g., Flow Master, Inserter, HP Press"
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              touched.machineName && errors.machineName
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300"
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
            A descriptive name to identify{" "}
            {quantity === 1 ? "this machine" : "these machines"}
          </p>
        </div>

        {/* Machine Designation */}
        <div>
          <label
            htmlFor="machineDesignation"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Machine Designation <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="machineDesignation"
            value={machineDesignation}
            onChange={(e) =>
              onChange("machineDesignation", e.target.value.toLowerCase())
            }
            onBlur={() => onBlur("machineDesignation")}
            placeholder="e.g., fm, ins, hp"
            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              touched.machineDesignation && errors.machineDesignation
                ? "border-red-500 focus:ring-red-500"
                : "border-gray-300"
            }`}
          />
          {touched.machineDesignation && errors.machineDesignation && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              {errors.machineDesignation}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Short code for machine identification (letters and numbers only)
          </p>

          {/* Preview of designations */}
          {quantity > 1 && machineDesignation && designations.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Generated Machine Designations:
              </p>
              <div className="flex flex-wrap gap-2">
                {designations.map((designation, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {designation}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Facility */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Facility <span className="text-red-500">*</span>
          </label>
          <FacilityToggle
            currentFacility={facilities_id}
            onFacilityChange={(facility) => onChange("facilities_id", facility)}
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
            <strong>Note:</strong>{" "}
            {quantity === 1 ? "The machine" : `All ${quantity} machines`} will
            be created with &quot;Offline&quot; status by default. Speed and
            capacity will be determined by the performance rules you configure
            in Step 4.
            {quantity > 1 && (
              <>
                <br />
                <br />
                Each machine will be assigned a unique line number and
                designation based on the range and designation prefix you
                provide.
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
