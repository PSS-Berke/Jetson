"use client";

interface ViewModeToggleProps {
  currentMode: "jobs" | "processes";
  onModeChange: (mode: "jobs" | "processes") => void;
}

export default function ViewModeToggle({
  currentMode,
  onModeChange,
}: ViewModeToggleProps) {
  const modes: { value: "jobs" | "processes"; label: string }[] = [
    { value: "jobs", label: "Jobs" },
    { value: "processes", label: "Processes" },
  ];

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {modes.map((mode) => (
        <button
          key={mode.value}
          onClick={() => onModeChange(mode.value)}
          className={`p-2 rounded-md text-sm font-semibold transition-all ${
            currentMode === mode.value
              ? "bg-white text-green-600 shadow-sm"
              : "text-[var(--text-light)] hover:text-[var(--text-dark)]"
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
