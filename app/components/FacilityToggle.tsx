'use client';

import { useRef, useLayoutEffect, useState, useMemo } from 'react';
import { getJobs } from '@/lib/api';
import type { Job } from '@/types';

interface FacilityToggleProps {
  currentFacility: number | null;
  onFacilityChange: (facility: number | null) => void;
  onJobsLoaded?: (jobs: Job[]) => void;
  showAll?: boolean;
}

export default function FacilityToggle({ currentFacility, onFacilityChange, onJobsLoaded, showAll = true }: FacilityToggleProps) {
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

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState({ width: 0, left: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const selectedIndex = facilities.findIndex(f => f.value === currentFacility);
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

    // Use requestAnimationFrame to ensure DOM has updated
    const frameId = requestAnimationFrame(updateBubblePosition);

    // Update on window resize to handle responsive changes
    window.addEventListener('resize', updateBubblePosition);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateBubblePosition);
    };
  }, [currentFacility, facilities, isLoading]);

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="text-red-600 text-sm bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      <div
        ref={containerRef}
        className="relative inline-flex rounded-full border-2 border-[var(--primary-blue)] bg-gray-50 p-1"
      >
        {/* Sliding bubble indicator */}
        <div
          className="absolute top-1 bottom-1 bg-[var(--primary-blue)] rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${bubbleStyle.width}px`,
            transform: `translateX(${bubbleStyle.left}px)`
          }}
        />

        {/* Buttons */}
        {facilities.map((facility, index) => (
          <button
            key={facility.value === null ? 'all' : facility.value}
            ref={el => { buttonRefs.current[index] = el; }}
            onClick={async () => {
              setIsLoading(true);
              setError(null);
              try {
                onFacilityChange(facility.value);
                const jobs = await getJobs(facility.value === null ? undefined : facility.value);
                onJobsLoaded?.(jobs);
              } catch (err) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to fetch jobs';
                setError(errorMessage);
                console.error('Error fetching jobs:', err);
              } finally {
                setIsLoading(false);
              }
            }}
            disabled={isLoading}
            className={`relative z-10 px-6 py-2 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 ${
              currentFacility === facility.value
                ? 'text-white'
                : 'text-[var(--text-dark)] hover:text-[var(--primary-blue)]'
            }`}
          >
            {isLoading ? 'Loading...' : facility.label}
          </button>
        ))}
      </div>
    </div>
  );
}
