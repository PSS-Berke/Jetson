"use client";

import React, { useState, useCallback, useMemo } from "react";

interface WeeklySplitEditorProps {
  weeklySplit: number[];
  lockedWeeks: boolean[];
  totalQuantity: number;
  onSplitChange: (newSplit: number[], newLockedWeeks: boolean[]) => void;
  readOnly?: boolean;
}

interface BackwardRedistributeWarningProps {
  isOpen: boolean;
  weekIndex: number;
  tempQuantity: string;
  onTempQuantityChange: (value: string) => void;
  preview: ReturnType<typeof calculateRedistributionPreviewFn> | null;
  weeklySplit: number[];
  lockedWeeks: boolean[];
  onUnlockWeek: (index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

// Helper function to calculate redistribution preview
function calculateRedistributionPreviewFn(
  weeklySplit: number[],
  lockedWeeks: boolean[],
  weekIndex: number,
  proposedValue: number,
  totalQuantity: number
) {
  const tempSplit = [...weeklySplit];
  tempSplit[weekIndex] = proposedValue;

  const currentTotal = tempSplit.reduce((sum, val) => sum + val, 0);
  const difference = totalQuantity - currentTotal;

  // Get unlocked weeks before the adjusted week
  const unlockedBefore = weeklySplit
    .map((_, idx) => idx)
    .filter((idx) => idx < weekIndex && !lockedWeeks[idx]);

  const lockedBefore = weeklySplit
    .map((val, idx) => ({ idx, val }))
    .filter(({ idx }) => idx < weekIndex && lockedWeeks[idx]);

  const canRedistribute = unlockedBefore.length > 0;

  // Calculate preview of changes
  const preview: { weekIndex: number; oldValue: number; newValue: number }[] = [];

  if (canRedistribute) {
    const baseAdjustment = Math.floor(difference / unlockedBefore.length);
    const remainder = difference % unlockedBefore.length;

    unlockedBefore.forEach((idx, position) => {
      let adjustment = baseAdjustment;
      if (position < Math.abs(remainder)) {
        adjustment += remainder > 0 ? 1 : -1;
      }
      const newValue = Math.max(0, tempSplit[idx] + adjustment);
      preview.push({ weekIndex: idx, oldValue: tempSplit[idx], newValue });
    });
  }

  return {
    difference,
    unlockedBefore,
    lockedBefore,
    canRedistribute,
    preview,
    hasNegativeValues: preview.some((p) => p.newValue < 0),
  };
}

function BackwardRedistributeWarning({
  isOpen,
  weekIndex,
  tempQuantity,
  onTempQuantityChange,
  preview,
  weeklySplit,
  lockedWeeks,
  onUnlockWeek,
  onConfirm,
  onCancel,
}: BackwardRedistributeWarningProps) {
  if (!isOpen || !preview) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[70] p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 relative z-10 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-[var(--dark-blue)] mb-3">
          Redistribute to Earlier Weeks?
        </h3>
        <p className="text-sm text-[var(--text-dark)] mb-4">
          Week {weekIndex + 1} is the last unlocked week. To change it, the
          difference must be redistributed to earlier weeks.
        </p>

        {/* Current value editor */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-[var(--text-dark)] mb-1">
            New value for Week {weekIndex + 1}:
          </label>
          <input
            type="text"
            value={parseInt(tempQuantity || "0").toLocaleString()}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/,/g, "");
              onTempQuantityChange(cleaned);
            }}
            className="w-full px-3 py-2 border border-[var(--border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)]"
          />
        </div>

        {/* Preview section */}
        {preview.canRedistribute ? (
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-[var(--text-dark)] mb-2">
              Redistribution Preview:
            </h4>
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              {preview.preview.map(({ weekIndex: idx, oldValue, newValue }) => (
                <div
                  key={idx}
                  className="flex justify-between text-sm items-center"
                >
                  <span>Week {idx + 1}</span>
                  <span>
                    <span className="text-[var(--text-light)]">
                      {oldValue.toLocaleString()}
                    </span>
                    <span className="mx-2">→</span>
                    <span
                      className={
                        newValue < oldValue
                          ? "text-red-600 font-semibold"
                          : "text-green-600 font-semibold"
                      }
                    >
                      {newValue.toLocaleString()}
                    </span>
                  </span>
                </div>
              ))}
              <div className="border-t border-[var(--border)] pt-2 mt-2 flex justify-between text-sm font-semibold">
                <span>Net Change</span>
                <span
                  className={
                    preview.difference > 0 ? "text-green-600" : "text-red-600"
                  }
                >
                  {preview.difference > 0 ? "+" : ""}
                  {preview.difference.toLocaleString()}
                </span>
              </div>
            </div>
            {preview.hasNegativeValues && (
              <p className="text-xs text-red-600 mt-2">
                ⚠️ Warning: Some weeks would become negative
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <strong>No unlocked weeks available</strong> for redistribution.
              Unlock at least one earlier week to redistribute.
            </p>
            <div className="mt-3 space-y-1">
              {preview.lockedBefore.map(({ idx, val }) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm"
                >
                  <span>
                    Week {idx + 1}: {val.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUnlockWeek(idx)}
                    className="text-xs text-[var(--primary-blue)] hover:underline"
                  >
                    Unlock
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-[var(--border)] rounded-lg font-semibold text-[var(--text-dark)] hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          {preview.canRedistribute && (
            <button
              type="button"
              onClick={onConfirm}
              disabled={preview.hasNegativeValues}
              className="px-4 py-2 bg-[var(--primary-blue)] text-white rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Redistribute
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WeeklySplitEditor({
  weeklySplit,
  lockedWeeks,
  totalQuantity,
  onSplitChange,
  readOnly = false,
}: WeeklySplitEditorProps) {
  // State for backward redistribution warning
  const [showBackwardWarning, setShowBackwardWarning] = useState(false);
  const [pendingRedistribution, setPendingRedistribution] = useState<{
    weekIndex: number;
    newValue: number;
  } | null>(null);
  const [tempWeekQuantity, setTempWeekQuantity] = useState<string>("");

  // Calculate totals
  const splitSum = useMemo(() => {
    return weeklySplit.reduce((sum, val) => sum + val, 0);
  }, [weeklySplit]);

  const splitDifference = useMemo(() => {
    return splitSum - totalQuantity;
  }, [splitSum, totalQuantity]);

  // Perform redistribution
  const performRedistribution = useCallback(
    (weekIndex: number, newValue: number, allowBackward: boolean) => {
      const newSplit = [...weeklySplit];
      const newLockedWeeks = [...lockedWeeks];

      // Update the changed week and lock it
      newSplit[weekIndex] = newValue;
      newLockedWeeks[weekIndex] = true;

      // Calculate how much quantity is left to distribute
      const currentTotal = newSplit.reduce((sum, val) => sum + val, 0);
      const difference = totalQuantity - currentTotal;

      // If there's a difference, redistribute it
      if (difference !== 0) {
        // Get indices of unlocked weeks AFTER the changed week
        const unlockedWeeksAfter = newSplit
          .map((_, idx) => idx)
          .filter((idx) => idx > weekIndex && !newLockedWeeks[idx]);

        // If no unlocked weeks after, check if we should redistribute backward
        if (unlockedWeeksAfter.length === 0 && !allowBackward) {
          // Show warning and store pending redistribution
          setPendingRedistribution({ weekIndex, newValue });
          setTempWeekQuantity(newValue.toString());
          setShowBackwardWarning(true);
          return; // Don't update yet
        }

        // Determine which weeks to redistribute to
        let targetWeekIndices = unlockedWeeksAfter;
        if (unlockedWeeksAfter.length === 0 && allowBackward) {
          // Get all unlocked weeks (forward and backward)
          targetWeekIndices = newSplit
            .map((_, idx) => idx)
            .filter((idx) => idx !== weekIndex && !newLockedWeeks[idx]);
        }

        if (targetWeekIndices.length > 0) {
          // Calculate base adjustment per week
          const baseAdjustment = Math.floor(difference / targetWeekIndices.length);
          const remainder = difference % targetWeekIndices.length;

          // Apply adjustments to target weeks
          targetWeekIndices.forEach((idx, position) => {
            let adjustment = baseAdjustment;
            if (position < Math.abs(remainder)) {
              adjustment += remainder > 0 ? 1 : -1;
            }
            newSplit[idx] = Math.max(0, newSplit[idx] + adjustment);
          });
        }
      }

      onSplitChange(newSplit, newLockedWeeks);
    },
    [weeklySplit, lockedWeeks, totalQuantity, onSplitChange]
  );

  // Handle week value change
  const handleWeekChange = useCallback(
    (weekIndex: number, value: string) => {
      if (readOnly) return;
      const cleanedValue = value.replace(/,/g, "");
      const newValue = parseInt(cleanedValue) || 0;
      performRedistribution(weekIndex, newValue, false);
    },
    [readOnly, performRedistribution]
  );

  // Handle unlock week
  const handleUnlockWeek = useCallback(
    (weekIndex: number) => {
      if (readOnly) return;
      const newLockedWeeks = [...lockedWeeks];
      newLockedWeeks[weekIndex] = false;
      onSplitChange(weeklySplit, newLockedWeeks);
    },
    [readOnly, weeklySplit, lockedWeeks, onSplitChange]
  );

  // Calculate redistribution preview
  const redistributionPreview = useMemo(() => {
    if (!pendingRedistribution) return null;
    const cleanedValue = tempWeekQuantity.replace(/,/g, "");
    const proposedValue = parseInt(cleanedValue) || 0;
    return calculateRedistributionPreviewFn(
      weeklySplit,
      lockedWeeks,
      pendingRedistribution.weekIndex,
      proposedValue,
      totalQuantity
    );
  }, [pendingRedistribution, tempWeekQuantity, weeklySplit, lockedWeeks, totalQuantity]);

  // Handle backward redistribution confirm
  const handleBackwardConfirm = useCallback(() => {
    if (pendingRedistribution) {
      const cleanedValue = tempWeekQuantity.replace(/,/g, "");
      const finalValue = parseInt(cleanedValue) || 0;
      performRedistribution(pendingRedistribution.weekIndex, finalValue, true);
      setPendingRedistribution(null);
      setTempWeekQuantity("");
    }
    setShowBackwardWarning(false);
  }, [pendingRedistribution, tempWeekQuantity, performRedistribution]);

  // Handle backward redistribution cancel
  const handleBackwardCancel = useCallback(() => {
    setPendingRedistribution(null);
    setTempWeekQuantity("");
    setShowBackwardWarning(false);
  }, []);

  if (weeklySplit.length === 0) return null;

  return (
    <div className="border border-[var(--border)] rounded-lg p-4 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-[var(--text-dark)]">
          Weekly Quantity Split ({weeklySplit.length} weeks)
        </h4>
        <div
          className={`text-sm font-semibold ${
            splitDifference === 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          Total: {splitSum.toLocaleString()} / {totalQuantity.toLocaleString()}
          {splitDifference !== 0 && (
            <span className="ml-1">
              ({splitDifference > 0 ? "+" : ""}
              {splitDifference.toLocaleString()})
            </span>
          )}
        </div>
      </div>

      {/* Week inputs grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {weeklySplit.map((amount, index) => {
          const isLocked = lockedWeeks[index];
          return (
            <div key={index} className="relative">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-[var(--text-light)]">
                  Week {index + 1}
                </label>
                {isLocked && !readOnly && (
                  <button
                    type="button"
                    onClick={() => handleUnlockWeek(index)}
                    className="text-xs hover:opacity-70 transition-opacity flex items-center gap-1"
                    title="Unlock this week to allow auto-redistribution"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                    </svg>
                  </button>
                )}
              </div>
              <div className="relative">
                {readOnly ? (
                  <div
                    className={`w-full px-3 py-2 border rounded-lg text-sm ${
                      isLocked
                        ? "bg-blue-50 border-blue-300 font-semibold"
                        : "border-[var(--border)] bg-white"
                    }`}
                  >
                    {amount.toLocaleString()}
                  </div>
                ) : (
                  <input
                    type="text"
                    value={amount.toLocaleString()}
                    onChange={(e) => handleWeekChange(index, e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary-blue)] text-sm ${
                      isLocked
                        ? "bg-blue-50 border-blue-300 font-semibold pr-8"
                        : "border-[var(--border)]"
                    }`}
                    title={
                      isLocked
                        ? "This week is locked and won't be auto-adjusted"
                        : "Edit to lock this week"
                    }
                  />
                )}
                {isLocked && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Warning if totals don't match */}
      {splitDifference !== 0 && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          Warning: Weekly split total must equal the total quantity
        </div>
      )}

      {/* Backward redistribution warning modal */}
      <BackwardRedistributeWarning
        isOpen={showBackwardWarning}
        weekIndex={pendingRedistribution?.weekIndex || 0}
        tempQuantity={tempWeekQuantity}
        onTempQuantityChange={setTempWeekQuantity}
        preview={redistributionPreview}
        weeklySplit={weeklySplit}
        lockedWeeks={lockedWeeks}
        onUnlockWeek={handleUnlockWeek}
        onConfirm={handleBackwardConfirm}
        onCancel={handleBackwardCancel}
      />
    </div>
  );
}
