'use client';

import { CalendarViewType } from '@/types/calendar';

interface ViewToggleProps {
  currentView: CalendarViewType;
  onViewChange: (view: CalendarViewType) => void;
}

export default function ViewToggle({ currentView, onViewChange }: ViewToggleProps) {
  const views: { value: CalendarViewType; label: string }[] = [
    { value: 'month', label: 'Month' },
    { value: 'week', label: 'Week' },
    { value: 'day', label: 'Day' }
  ];

  return (
    <div className="inline-flex rounded-lg border border-[var(--border)] bg-white p-1">
      {views.map(view => (
        <button
          key={view.value}
          onClick={() => onViewChange(view.value)}
          className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
            currentView === view.value
              ? 'bg-[var(--primary-blue)] text-white shadow-sm'
              : 'text-[var(--text-dark)] hover:bg-gray-100'
          }`}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
