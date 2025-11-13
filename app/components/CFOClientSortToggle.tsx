"use client";

import { useRef, useLayoutEffect, useState } from "react";

export type ClientSortType = "revenue" | "volume" | "profit";

interface CFOClientSortToggleProps {
  currentSort: ClientSortType;
  onSortChange: (sort: ClientSortType) => void;
}

export default function CFOClientSortToggle({
  currentSort,
  onSortChange,
}: CFOClientSortToggleProps) {
  const sortOptions: { value: ClientSortType; label: string }[] = [
    { value: "revenue", label: "Revenue" },
    { value: "volume", label: "Volume" },
    { value: "profit", label: "Profit" },
  ];

  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState({ width: 0, left: 0 });

  useLayoutEffect(() => {
    const updateBubblePosition = () => {
      const selectedIndex = sortOptions.findIndex(
        (s) => s.value === currentSort,
      );

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
          left: buttonRect.left - containerRect.left - containerPadding,
        });
      }
    };

    updateBubblePosition();

    // Update on window resize to handle responsive changes
    window.addEventListener("resize", updateBubblePosition);
    return () => window.removeEventListener("resize", updateBubblePosition);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSort]);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex rounded-full border-2 border-[var(--primary-blue)] bg-gray-50 p-0.5 sm:p-1"
    >
      {/* Sliding bubble indicator */}
      {bubbleStyle.width > 0 && (
        <div
          className="absolute top-0.5 sm:top-1 bottom-0.5 sm:bottom-1 bg-[var(--primary-blue)] rounded-full transition-all duration-300 ease-in-out"
          style={{
            width: `${bubbleStyle.width}px`,
            transform: `translateX(${bubbleStyle.left}px)`,
          }}
        />
      )}

      {/* Buttons */}
      {sortOptions.map((option, index) => (
        <button
          key={option.value}
          ref={(el) => {
            buttonRefs.current[index] = el;
          }}
          onClick={() => onSortChange(option.value)}
          className={`relative z-10 px-3 sm:px-4 lg:px-6 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors ${
            currentSort === option.value
              ? "text-white"
              : "text-[var(--text-dark)] hover:text-[var(--primary-blue)]"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
