"use client";

interface ProcessViewToggleProps {
  currentMode: "consolidated" | "expanded";
  onModeChange: (mode: "consolidated" | "expanded") => void;
}

export default function ProcessViewToggle({
  currentMode,
  onModeChange,
}: ProcessViewToggleProps) {
  const modes: { value: "consolidated" | "expanded"; label: string }[] = [
    { value: "consolidated", label: "Consolidated" },
    { value: "expanded", label: "Expanded" },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onModeChange(mode.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
            currentMode === mode.value
              ? "bg-white text-purple-600 shadow-sm"
              : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
