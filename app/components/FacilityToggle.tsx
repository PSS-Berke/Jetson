'use client';

import { useRef, useLayoutEffect, useState, useMemo } from 'react';

interface FacilityToggleProps {
  currentFacility: number | null;
  onFacilityChange: (facility: number | null) => void;
  showAll?: boolean;
}

export default function FacilityToggle({ currentFacility, onFacilityChange, showAll = true }: FacilityToggleProps) {
  const facilities = useMemo(() => showAll
    ? [
        { value: null, label: 'All' },
        { value: 1, label: 'Bolingbrook' },
        { value: 2, label: 'Lemont' }
      ]
    : [
        { value: 1, label: 'Bolingbrook' },
        { value: 2, label: 'Lemont' }
      ], [showAll]);

  console.log('FacilityToggle - currentFacility:', currentFacility, 'type:', typeof currentFacility);

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState({ width: 0, left: 0 });

  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const selectedIndex = facilities.findIndex(f => f.value === currentFacility);

      // Reset bubble if no valid selection
      if (selectedIndex === -1) {
        setBubbleStyle({ width: 0, left: 0 });
        return;
      }

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

    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      updateBubblePosition();
    });

    // Update on window resize to handle responsive changes
    window.addEventListener('resize', updateBubblePosition);
    return () => window.removeEventListener('resize', updateBubblePosition);
  }, [currentFacility, facilities]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative inline-flex rounded-full border-2 border-[var(--primary-blue)] bg-gray-50 p-0.5 sm:p-1"
      >
        {/* Sliding bubble indicator - Show when facility is selected (including null for "All") */}
        {bubbleStyle.width > 0 && (
          <div
            className="absolute top-0.5 sm:top-1 bottom-0.5 sm:bottom-1 bg-[var(--primary-blue)] rounded-full transition-all duration-300 ease-in-out"
            style={{
              width: `${bubbleStyle.width}px`,
              transform: `translateX(${bubbleStyle.left}px)`
            }}
          />
        )}

        {/* Buttons */}
        {facilities.map((facility, index) => (
          <button
            key={facility.value === null ? 'all' : facility.value}
            ref={el => { buttonRefs.current[index] = el; }}
            onClick={() => onFacilityChange(facility.value)}
            className={`relative z-10 px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
              currentFacility === facility.value
                ? 'text-white'
                : 'text-[var(--text-dark)] hover:text-[var(--primary-blue)]'
            }`}
          >
            {facility.label}
          </button>
        ))}
      </div>
    </div>
  );
}
