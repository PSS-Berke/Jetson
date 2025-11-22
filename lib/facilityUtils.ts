import type { FacilityId } from "@/types";

/**
 * Get the facility name from a facility ID
 * @param facilityId - The facility ID (1 or 2)
 * @returns The facility name
 */
export const getFacilityName = (facilityId: FacilityId | number | null | undefined): string => {
  if (facilityId === null || facilityId === undefined) return "All Facilities";
  if (facilityId === 1) return "Bolingbrook";
  if (facilityId === 2) return "Lemont";
  return "Unknown Facility";
};

/**
 * Get the facility color classes for styling
 * @param facilityId - The facility ID (1 or 2)
 * @returns Object with background and text color classes
 */
export const getFacilityColors = (facilityId: FacilityId | number | null | undefined): {
  bg: string;
  text: string;
  border: string;
} => {
  if (facilityId === 1) {
    // Bolingbrook - Jetson Red
    return {
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-200",
    };
  }
  if (facilityId === 2) {
    // Lemont - Jetson Blue
    return {
      bg: "bg-blue-50",
      text: "text-blue-700",
      border: "border-blue-200",
    };
  }
  // Default for All Facilities or Unknown
  return {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
  };
};

/**
 * Get all available facilities
 * @returns Array of facility objects with id and name
 */
export const getAllFacilities = () => [
  { id: 1 as FacilityId, name: "Bolingbrook" },
  { id: 2 as FacilityId, name: "Lemont" },
];
