/**
 * Centralized theme configuration for the Jetson Capacity Planner
 * This file serves as the single source of truth for all colors and theme values
 */

export const colors = {
  // Brand Colors
  primary: '#2563eb',        // Primary blue
  primaryDark: '#1e40af',    // Dark blue

  // Text Colors
  textDark: '#1e293b',
  textLight: '#64748b',

  // Status Colors
  success: '#10b981',        // Green
  warning: '#f59e0b',        // Yellow/Orange
  error: '#ef4444',          // Red

  // Neutral Colors
  border: '#e2e8f0',
  background: '#f8fafc',
  foreground: '#1e293b',

  // Background Variants
  card: '#ffffff',
  alertCritical: '#fff5f5',
  alertWarning: '#fffaf0',
  alertInfo: '#e6f2ff',

  // Gray Scale (for tables and UI elements)
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray700: '#374151',
  gray800: '#1f2937',
} as const;

/**
 * Capacity utilization thresholds and their corresponding colors
 */
export const capacityThresholds = {
  low: {
    max: 0.5,
    color: colors.success,
    colorWithAlpha: 'rgba(16, 185, 129, 0.1)',
    label: 'Low',
  },
  moderate: {
    min: 0.5,
    max: 0.8,
    color: colors.warning,
    colorWithAlpha: 'rgba(245, 158, 11, 0.1)',
    label: 'Moderate',
  },
  high: {
    min: 0.8,
    color: colors.error,
    colorWithAlpha: 'rgba(239, 68, 68, 0.1)',
    label: 'High',
  },
} as const;

/**
 * Get capacity color based on utilization percentage
 * @param utilization - Utilization value between 0 and 1 (or higher for over-capacity)
 * @returns Color string from the theme
 */
export function getCapacityColor(utilization: number): string {
  if (utilization < capacityThresholds.low.max) {
    return capacityThresholds.low.color;
  } else if (utilization < capacityThresholds.moderate.max) {
    return capacityThresholds.moderate.color;
  } else {
    return capacityThresholds.high.color;
  }
}

/**
 * Get capacity background color with alpha for subtle highlighting
 * @param utilization - Utilization value between 0 and 1 (or higher for over-capacity)
 * @returns RGBA color string
 */
export function getCapacityBackgroundColor(utilization: number): string {
  if (utilization < capacityThresholds.low.max) {
    return capacityThresholds.low.colorWithAlpha;
  } else if (utilization < capacityThresholds.moderate.max) {
    return capacityThresholds.moderate.colorWithAlpha;
  } else {
    return capacityThresholds.high.colorWithAlpha;
  }
}

/**
 * Tailwind class mappings for capacity indicators
 * Use these for components that need Tailwind classes instead of inline styles
 */
export const capacityClasses = {
  low: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
  },
  moderate: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
  },
  high: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
  },
} as const;

/**
 * Get Tailwind classes for capacity indicators
 * @param utilization - Utilization value between 0 and 1 (or higher for over-capacity)
 * @returns Object with bg, text, and border classes
 */
export function getCapacityClasses(utilization: number) {
  if (utilization < capacityThresholds.low.max) {
    return capacityClasses.low;
  } else if (utilization < capacityThresholds.moderate.max) {
    return capacityClasses.moderate;
  } else {
    return capacityClasses.high;
  }
}
