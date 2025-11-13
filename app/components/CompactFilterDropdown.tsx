"use client";

import { useState, useRef, useEffect } from "react";

interface CompactFilterDropdownProps {
  label: string;
  options: Array<{ id: number | string; name: string }>;
  selected: (number | string)[];
  onChange: (selected: (number | string)[]) => void;
  icon?: React.ReactNode;
}

export default function CompactFilterDropdown({
  label,
  options,
  selected,
  onChange,
  icon,
}: CompactFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = (id: number | string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--border)] rounded-lg text-sm font-medium text-[var(--text-dark)] hover:bg-gray-50 transition-colors"
      >
        {icon}
        <span>{label}</span>
        {selected.length > 0 && (
          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
            {selected.length}
          </span>
        )}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-[var(--border)] py-2 z-50 max-h-64 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-4 py-2 text-sm text-[var(--text-light)]">
              No options available
            </div>
          ) : (
            <>
              <button
                onClick={handleClearAll}
                className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Clear All
              </button>
              <div className="border-t border-[var(--border)] my-1"></div>
              {options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center px-4 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option.id)}
                    onChange={() => handleToggle(option.id)}
                    className="mr-2"
                  />
                  <span className="text-sm text-[var(--text-dark)]">
                    {option.name}
                  </span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
