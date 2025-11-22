"use client";

interface ProcessViewToggleProps {
  showExpanded: boolean;
  onToggle: (show: boolean) => void;
}

export default function ProcessViewToggle({
  showExpanded,
  onToggle,
}: ProcessViewToggleProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => onToggle(false)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
          !showExpanded
            ? "bg-white text-green-600 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Jobs
      </button>
      <button
        onClick={() => onToggle(true)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
          showExpanded
            ? "bg-white text-purple-600 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Processes
      </button>
    </div>
  );
}
