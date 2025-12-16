/**
 * Version Grouping Utilities
 *
 * This module provides utilities for grouping jobs by their version_group_uuid
 * to display multiple versions of the same job together in the ProjectionsTable.
 */

import type { JobProjection } from "./projectionUtils";
import type { ParsedJob } from "@/hooks/useJobs";

/**
 * Represents a group of job versions sharing the same version_group_uuid
 */
export interface VersionGroup {
  groupId: string;                           // version_group_uuid
  primaryJob: JobProjection;                 // First/original version (typically v1)
  allVersions: JobProjection[];              // All versions sorted by version_name
  aggregatedTotalQuantity: number;           // Sum of quantities across ALL versions
  aggregatedWeeklyTotals: Map<string, number>; // Sum of weekly totals across versions
}

/**
 * Type guard to check if an item is a VersionGroup
 */
export function isVersionGroup(item: JobProjection | VersionGroup): item is VersionGroup {
  return 'groupId' in item && 'allVersions' in item && 'primaryJob' in item;
}

/**
 * Get the version_group_uuid from a parsed job
 */
export function getVersionGroupUuid(job: ParsedJob): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (job as any).version_group_uuid;
}

/**
 * Get the version_name from a parsed job
 */
export function getVersionName(job: ParsedJob): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const versionName = (job as any).version_name;
  return versionName || "v1";
}

/**
 * Sort versions by version name (v1 first, then v2, v3, etc.)
 * Handles both numeric (v1, v2) and string (initial, revised) version names
 */
function sortVersionsByName(projections: JobProjection[]): JobProjection[] {
  return [...projections].sort((a, b) => {
    const versionA = getVersionName(a.job);
    const versionB = getVersionName(b.job);

    // Extract numeric part if version name starts with 'v' followed by number
    const numA = versionA.match(/^v(\d+)$/i)?.[1];
    const numB = versionB.match(/^v(\d+)$/i)?.[1];

    if (numA && numB) {
      return parseInt(numA) - parseInt(numB);
    }

    // Fallback to string comparison
    return versionA.localeCompare(versionB);
  });
}

/**
 * Group job projections by their version_group_uuid
 *
 * @param projections - Array of job projections to group
 * @param enabled - Whether version grouping is enabled
 * @returns Object containing groups, standalone jobs, and processed projections for rendering
 */
export function groupProjectionsByVersion(
  projections: JobProjection[],
  enabled: boolean
): {
  groups: Map<string, VersionGroup>;
  standalone: JobProjection[];
  processedProjections: Array<JobProjection | VersionGroup>;
} {
  // If grouping is disabled, return all projections as standalone
  if (!enabled) {
    return {
      groups: new Map(),
      standalone: projections,
      processedProjections: projections,
    };
  }

  // Group projections by version_group_uuid
  const groupMap = new Map<string, JobProjection[]>();
  const standalone: JobProjection[] = [];

  projections.forEach((projection) => {
    const groupUuid = getVersionGroupUuid(projection.job);

    if (groupUuid) {
      const existing = groupMap.get(groupUuid) || [];
      existing.push(projection);
      groupMap.set(groupUuid, existing);
    } else {
      // No version_group_uuid means standalone job
      standalone.push(projection);
    }
  });

  // Build VersionGroup objects for groups with multiple versions
  const groups = new Map<string, VersionGroup>();
  const singleVersionJobs: JobProjection[] = [];

  groupMap.forEach((groupProjections, groupUuid) => {
    if (groupProjections.length === 1) {
      // Single version - treat as standalone
      singleVersionJobs.push(groupProjections[0]);
    } else {
      // Multiple versions - create a VersionGroup
      const sortedVersions = sortVersionsByName(groupProjections);
      const primaryJob = sortedVersions[0]; // v1 or first version

      // Calculate aggregated totals
      let aggregatedTotalQuantity = 0;
      const aggregatedWeeklyTotals = new Map<string, number>();

      sortedVersions.forEach((projection) => {
        aggregatedTotalQuantity += projection.totalQuantity;

        projection.weeklyQuantities.forEach((qty, label) => {
          const existing = aggregatedWeeklyTotals.get(label) || 0;
          aggregatedWeeklyTotals.set(label, existing + qty);
        });
      });

      groups.set(groupUuid, {
        groupId: groupUuid,
        primaryJob,
        allVersions: sortedVersions,
        aggregatedTotalQuantity,
        aggregatedWeeklyTotals,
      });
    }
  });

  // Combine standalone jobs with single-version jobs
  const allStandalone = [...standalone, ...singleVersionJobs];

  // Build processedProjections maintaining original order
  // We need to replace grouped jobs with their VersionGroup while maintaining position
  const processedProjections: Array<JobProjection | VersionGroup> = [];
  const processedGroupIds = new Set<string>();

  projections.forEach((projection) => {
    const groupUuid = getVersionGroupUuid(projection.job);

    if (groupUuid && groups.has(groupUuid)) {
      // This projection belongs to a multi-version group
      if (!processedGroupIds.has(groupUuid)) {
        // First encounter of this group - add the VersionGroup
        processedProjections.push(groups.get(groupUuid)!);
        processedGroupIds.add(groupUuid);
      }
      // Skip subsequent projections from the same group (they're in allVersions)
    } else {
      // Standalone or single-version job
      processedProjections.push(projection);
    }
  });

  return {
    groups,
    standalone: allStandalone,
    processedProjections,
  };
}

/**
 * Check if a job has multiple versions (belongs to a version group with >1 jobs)
 * Note: This requires the full list of projections to determine
 */
export function hasMultipleVersions(
  job: ParsedJob,
  allProjections: JobProjection[]
): boolean {
  const groupUuid = getVersionGroupUuid(job);
  if (!groupUuid) return false;

  const sameGroupCount = allProjections.filter(
    (p) => getVersionGroupUuid(p.job) === groupUuid
  ).length;

  return sameGroupCount > 1;
}

/**
 * Get all versions of a job from projections
 */
export function getJobVersions(
  job: ParsedJob,
  allProjections: JobProjection[]
): JobProjection[] {
  const groupUuid = getVersionGroupUuid(job);
  if (!groupUuid) return [];

  const versions = allProjections.filter(
    (p) => getVersionGroupUuid(p.job) === groupUuid
  );

  return sortVersionsByName(versions);
}
