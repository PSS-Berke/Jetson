"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerProps {
  /** Current date range to display */
  dateRange: DateRange;
  /** Callback when user confirms a new date range */
  onDateRangeChange: (range: DateRange) => void;
  /** Optional className for styling */
  className?: string;
  /** Display format for the date range text */
  displayFormat?: string;
}

/**
 * DateRangePicker - A clickable date range display that opens a range picker modal
 *
 * Allows users to select custom start and end dates instead of just using arrow navigation
 */
export default function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className = "",
  displayFormat = "M/d/yyyy",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [mounted, setMounted] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle client-side mounting for portal
  useEffect(() => {
    setMounted(true);
  }, []);

  // Format dates for display
  const displayText = `${format(dateRange.start, displayFormat)} - ${format(dateRange.end, displayFormat)}`;

  // Initialize temp values when picker opens
  useEffect(() => {
    if (isOpen) {
      setTempStartDate(format(dateRange.start, "yyyy-MM-dd"));
      setTempEndDate(format(dateRange.end, "yyyy-MM-dd"));
    }
  }, [isOpen, dateRange]);

  // Close picker when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;

      // Don't close if clicking on the button or inside the modal
      if (
        (pickerRef.current && pickerRef.current.contains(target)) ||
        (modalRef.current && modalRef.current.contains(target))
      ) {
        return;
      }

      setIsOpen(false);
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleApply = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const start = new Date(tempStartDate);
    const end = new Date(tempEndDate);

    // Validate dates
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      alert("Please enter valid dates");
      return;
    }

    if (start > end) {
      alert("Start date must be before end date");
      return;
    }

    console.log("Applying date range:", { start, end });
    onDateRangeChange({ start, end });
    setIsOpen(false);
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
  };

  // Render modal content
  const modalContent =
    isOpen && mounted && pickerRef.current ? (
      <div
        className="fixed inset-0 z-[9998]"
        style={{
          background: "transparent",
          pointerEvents: "none",
        }}
      >
        <div
          ref={modalRef}
          className="absolute bg-white border border-gray-300 rounded-lg shadow-xl p-4 min-w-[300px]"
          style={{
            top: `${pickerRef.current.getBoundingClientRect().bottom + window.scrollY + 8}px`,
            left: `${pickerRef.current.getBoundingClientRect().left + window.scrollX + pickerRef.current.offsetWidth / 2 - 150}px`,
            pointerEvents: "auto",
            zIndex: 9999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Select Date Range
            </h3>

            {/* Start Date */}
            <div className="mb-3">
              <label
                htmlFor="start-date"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Start Date
              </label>
              <input
                id="start-date"
                type="date"
                value={tempStartDate}
                onChange={(e) => setTempStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* End Date */}
            <div className="mb-3">
              <label
                htmlFor="end-date"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                End Date
              </label>
              <input
                id="end-date"
                type="date"
                value={tempEndDate}
                onChange={(e) => setTempEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="flex-1 px-3 py-2 text-sm font-medium text-white bg-[var(--primary-blue)] hover:bg-blue-600 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className={`relative ${className}`} ref={pickerRef}>
        {/* Clickable Date Range Display */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log("DateRangePicker clicked, isOpen:", isOpen);
            setIsOpen(!isOpen);
          }}
          type="button"
          className="text-base sm:text-lg font-semibold text-[var(--dark-blue)] hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors cursor-pointer"
          title="Click to select custom date range"
        >
          {displayText}
        </button>
      </div>

      {/* Render modal via portal to avoid overflow issues */}
      {mounted && modalContent && createPortal(modalContent, document.body)}
    </>
  );
}
