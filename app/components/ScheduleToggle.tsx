"use client";

import { useRef, useLayoutEffect, useState, useMemo } from "react";

interface ScheduleToggleProps {
  isConfirmed: boolean;
  onScheduleChange: (isConfirmed: boolean) => void;
}

export default function ScheduleToggle({
  isConfirmed,
  onScheduleChange,
}: ScheduleToggleProps) {
  const scheduleOptions = useMemo(
    () => [
      { value: false, label: "Soft Schedule", color: "#2E3192" },
      { value: true, label: "Schedule", color: "#EF3340" },
    ],
    [],
  );

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState({ width: 0, left: 0 });

  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const selectedIndex = scheduleOptions.findIndex(
        (opt) => opt.value === isConfirmed,
      );

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
          left: buttonRect.left - containerRect.left - containerPadding,
        });
      }
    };

    // Use requestAnimationFrame to ensure DOM is fully rendered
    requestAnimationFrame(() => {
      updateBubblePosition();
    });

    // Update on window resize to handle responsive changes
    window.addEventListener("resize", updateBubblePosition);
    return () => window.removeEventListener("resize", updateBubblePosition);
  }, [isConfirmed, scheduleOptions]);

  // Determine the current color based on selection
  const currentColor =
    scheduleOptions.find((opt) => opt.value === isConfirmed)?.color ||
    "#2E3192";

  return (
    <div className="flex flex-col gap-2">
      <div
        ref={containerRef}
        className="relative inline-flex w-auto rounded-full border-2 bg-gray-50 p-1 transition-colors duration-300"
        style={{ borderColor: currentColor }}
      >
        {/* Sliding bubble indicator */}
        {bubbleStyle.width > 0 && (
          <div
            className="absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-in-out"
            style={{
              width: `${bubbleStyle.width}px`,
              transform: `translateX(${bubbleStyle.left}px)`,
              backgroundColor: currentColor,
            }}
          />
        )}

        {/* Buttons */}
        {scheduleOptions.map((option, index) => (
          <button
            key={option.label}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            onClick={() => onScheduleChange(option.value)}
            className={`relative z-10 px-4 sm:px-4 lg:px-6 py-2.5 sm:py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
              isConfirmed === option.value
                ? "text-white"
                : "text-[var(--text-dark)] hover:opacity-70"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
