/**
 * Step indicator component for the machine creation wizard
 * Shows progress through the 5 steps with visual indicators
 */

"use client";

import React from "react";

interface WizardStepIndicatorProps {
  currentStep: number;
  steps: {
    number: number;
    label: string;
    shortLabel?: string;
  }[];
}

export default function WizardStepIndicator({
  currentStep,
  steps,
}: WizardStepIndicatorProps) {
  return (
    <div className="w-full py-4">
      {/* Progress Bar */}
      <div className="relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 w-full h-0.5 bg-gray-200" />

        {/* Progress line */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-blue-500 transition-all duration-300"
          style={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const isCompleted = step.number < currentStep;
            const isCurrent = step.number === currentStep;
            const isUpcoming = step.number > currentStep;

            return (
              <div key={step.number} className="flex flex-col items-center">
                {/* Step circle */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all duration-300 ${
                    isCompleted
                      ? "bg-blue-500 text-white"
                      : isCurrent
                        ? "bg-blue-500 text-white ring-4 ring-blue-100"
                        : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="3"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>

                {/* Step label */}
                <div className="mt-2 text-center">
                  {/* Full label - hidden on mobile */}
                  <div
                    className={`hidden sm:block text-sm font-medium ${
                      isCurrent
                        ? "text-blue-600"
                        : isCompleted
                          ? "text-gray-700"
                          : "text-gray-400"
                    }`}
                  >
                    {step.label}
                  </div>

                  {/* Short label - visible on mobile */}
                  {step.shortLabel && (
                    <div
                      className={`sm:hidden text-xs font-medium ${
                        isCurrent
                          ? "text-blue-600"
                          : isCompleted
                            ? "text-gray-700"
                            : "text-gray-400"
                      }`}
                    >
                      {step.shortLabel}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current step indicator text */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500">
          Step {currentStep} of {steps.length}
        </p>
      </div>
    </div>
  );
}
