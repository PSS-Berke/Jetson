"use client";

import { useRef, useLayoutEffect, useState } from "react";

export type Granularity = "week" | "month" | "quarter";

interface GranularityToggleProps {
  currentGranularity: Granularity;
  onGranularityChange: (granularity: Granularity) => void;
}

const granularities: { value: Granularity; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "quarter", label: "Quarterly" },
];

export default function GranularityToggle({
  currentGranularity,
  onGranularityChange,
}: GranularityToggleProps) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState({ width: 0, left: 0 });

  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const selectedIndex = granularities.findIndex(
        (g) => g.value === currentGranularity,
      );
      const selectedButton = buttonRefs.current[selectedIndex];
      const container = containerRef.current;

      if (selectedButton && container) {
        const buttonRect = selectedButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Account for the container's padding (p-1 = 4px)
        const containerPadding = 4;

        setBubbleStyle({
          width: buttonRect.width,
          left: buttonRect.left - containerRect.left - containerPadding,
        });
      }
    };

    updateBubblePosition();

    // Update on window resize to handle responsive changes
    window.addEventListener("resize", updateBubblePosition);
    return () => window.removeEventListener("resize", updateBubblePosition);
  }, [currentGranularity]);

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative inline-flex w-auto rounded-full border-2 border-[var(--primary-blue)] bg-gray-50 p-1"
      >
        {/* Sliding bubble indicator */}
        <div
          className="absolute top-1 bottom-1 bg-[var(--primary-blue)] rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${bubbleStyle.width}px`,
            transform: `translateX(${bubbleStyle.left}px)`,
          }}
        />

        {/* Buttons */}
        {granularities.map((granularity, index) => (
          <button
            key={granularity.value}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            onClick={() => onGranularityChange(granularity.value)}
            className={`relative z-10 px-4 sm:px-4 lg:px-6 py-2.5 sm:py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              currentGranularity === granularity.value
                ? "text-white"
                : "text-[var(--text-dark)] hover:text-[var(--primary-blue)]"
            }`}
          >
            {granularity.label}
          </button>
        ))}
      </div>
    </div>
  );
}
