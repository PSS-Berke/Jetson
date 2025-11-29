"use client";

import React from "react";

export default function ProjectionsLoading() {
  return (
    <div className="flex items-center justify-center min-h-[600px] py-24">
      <div className="flex flex-col items-center justify-center space-y-6">
        {/* Simple spinner */}
        <div className="relative w-12 h-12">
          <div 
            className="absolute inset-0 border-4 border-gray-200 border-t-[var(--primary-blue)] rounded-full animate-spin" 
          />
        </div>

        {/* Loading text */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-semibold text-[var(--text-dark)]">
            Loading Projections
          </h3>
          <p className="text-sm text-[var(--text-light)]">
            Please wait while we gather your data
          </p>
        </div>
      </div>
    </div>
  );
}

