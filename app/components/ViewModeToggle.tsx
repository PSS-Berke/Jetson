'use client';

interface ViewModeToggleProps {
  currentMode: 'jobs' | 'processes';
  onModeChange: (mode: 'jobs' | 'processes') => void;
}

export default function ViewModeToggle({ currentMode, onModeChange }: ViewModeToggleProps) {
  const modes: { value: 'jobs' | 'processes'; label: string }[] = [
    { value: 'jobs', label: 'Jobs' },
    { value: 'processes', label: 'Processes' }
  ];

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-1">
      {modes.map(mode => (
        <button
          key={mode.value}
          onClick={() => onModeChange(mode.value)}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            currentMode === mode.value
              ? 'bg-[var(--primary-blue)] text-white shadow-sm'
              : 'text-[var(--text-dark)] hover:bg-gray-100'
          }`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
