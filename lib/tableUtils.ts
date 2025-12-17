// Shared table utility functions
// Centralized helpers used across projections, revenue, and other tables

/**
 * Convert hex color to rgba with specified opacity
 * Used for note backgrounds, row highlighting, etc.
 */
export const hexToRgba = (hex: string, opacity: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

/**
 * Format currency for display (USD)
 * Used in revenue tables for financial data
 */
export const formatRevenue = (amount: number): string => {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
};

/**
 * Format currency with decimal places
 */
export const formatRevenueWithDecimals = (amount: number, decimals: number = 2): string => {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
};

/**
 * Format job number for display (truncated if needed)
 */
export const formatJobNumber = (jobNumber: string, maxLength = 7): string => {
  if (jobNumber.length <= maxLength) return jobNumber;
  return `${jobNumber.slice(0, maxLength)}…`;
};

/**
 * Format date for table display
 */
export const formatTableDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
};

/**
 * Format quantity with locale-aware thousands separators
 */
export const formatQuantity = (quantity: number): string => {
  return quantity.toLocaleString();
};
