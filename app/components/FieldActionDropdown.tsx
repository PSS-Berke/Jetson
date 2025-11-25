"use client";

import React, { useState, useRef, useEffect } from "react";
import { Copy, ChevronDown } from "lucide-react";
import { PROCESS_TYPE_CONFIGS } from "@/lib/processTypeConfig";

interface FieldActionDropdownProps {
  currentProcessType: string;
  onDuplicateOnThisProcess: () => void;
  onSendToAnotherProcess: (targetProcessType: string) => void;
}

export default function FieldActionDropdown({
  currentProcessType,
  onDuplicateOnThisProcess,
  onSendToAnotherProcess,
}: FieldActionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showProcessList, setShowProcessList] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setShowProcessList(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Get all process types except the current one
  const otherProcessTypes = PROCESS_TYPE_CONFIGS.filter(
    (config) => config.key !== currentProcessType
  );

  const handleDuplicateClick = () => {
    onDuplicateOnThisProcess();
    setIsOpen(false);
    setShowProcessList(false);
  };

  const handleSendToClick = () => {
    setShowProcessList(true);
  };

  const handleProcessTypeSelect = (processTypeKey: string) => {
    onSendToAnotherProcess(processTypeKey);
    setIsOpen(false);
    setShowProcessList(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-blue-500 hover:text-blue-700 flex items-center gap-1"
        title="Duplicate options"
      >
        <Copy className="w-4 h-4" />
        <ChevronDown className="w-3 h-3" />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !showProcessList && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-1">
          <button
            type="button"
            onClick={handleDuplicateClick}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            <span>Duplicate on this process</span>
          </button>
          <button
            type="button"
            onClick={handleSendToClick}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01"
              />
            </svg>
            <span>Send to another process</span>
          </button>
        </div>
      )}

      {/* Process Type List */}
      {isOpen && showProcessList && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 z-50 py-2 max-h-96 overflow-y-auto">
          <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
            Select Process Type
          </div>
          <div className="py-1">
            {otherProcessTypes.map((processType) => (
              <button
                key={processType.key}
                type="button"
                onClick={() => handleProcessTypeSelect(processType.key)}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: processType.color }}
                />
                <span className="font-medium">{processType.label}</span>
              </button>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-gray-200">
            <button
              type="button"
              onClick={() => setShowProcessList(false)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              ← Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
