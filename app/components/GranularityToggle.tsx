'use client';

import { useRef, useLayoutEffect, useState } from 'react';

export type Granularity = 'weekly' | 'monthly' | 'quarterly';

interface GranularityToggleProps {
  currentGranularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
}

const granularities: { value: Granularity; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Month' },
  { value: 'quarterly', label: 'Quarterly' }
];

export default function GranularityToggle({ currentGranularity, onGranularityChange }: GranularityToggleProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState({ width: 0, left: 0 });

  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const selectedIndex = granularities.findIndex(g => g.value === currentGranularity);
      const selectedButton = buttonRefs.current[selectedIndex];
      const container = containerRef.current;

      if (selectedButton && container) {
        const buttonRect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Account for the container's padding (p-1 = 4px)
        const containerPadding = 4;

        setBubbleStyle({
          width: buttonRect.width,
          left: buttonRect.left - containerRect.left - containerPadding
        });
      }
    };

    updateBubblePosition();

    // Update on window resize to handle responsive changes
    window.addEventListener('resize', updateBubblePosition);
    return () => window.removeEventListener('resize', updateBubblePosition);
  }, [currentGranularity]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative inline-flex rounded-full border-2 border-[var(--primary-blue)] bg-gray-50 p-0.5 sm:p-1"
      >
        {/* Sliding bubble indicator */}
        <div
          className="absolute top-0.5 sm:top-1 bottom-0.5 sm:bottom-1 bg-[var(--primary-blue)] rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${bubbleStyle.width}px`,
            transform: `translateX(${bubbleStyle.left}px)`
          }}
        />

        {/* Buttons */}
        {granularities.map((granularity, index) => (
          <button
            key={granularity.value}
            ref={el => { buttonRefs.current[index] = el; }}
            onClick={() => onGranularityChange(granularity.value)}
            className={`relative z-10 px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
              currentGranularity === granularity.value
                ? 'text-white'
                : 'text-[var(--text-dark)] hover:text-[var(--primary-blue)]'
            }`}
          >
            {granularity.label}
          </button>
        ))}
      </div>
    </div>
  );
}
