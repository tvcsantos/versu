import * as semver from 'semver';
import { SemVer } from 'semver';

export type BumpType = 'major' | 'minor' | 'patch' | 'none';

/**
 * Parse a semantic version string into a SemVer object using node-semver
 */
export function parseSemVer(versionString: string): SemVer {
  const parsed = semver.parse(versionString);
  
  if (!parsed) {
    throw new Error(`Invalid semantic version: ${versionString}`);
  }

  return parsed;
}

/**
 * Convert a SemVer object to a string
 * Uses the raw property to preserve build metadata
 */
export function formatSemVer(version: SemVer): string {
  return version.raw;
}

/**
 * Compare two semantic versions using node-semver
 * Returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  return semver.compare(a, b);
}

/**
 * Bump a semantic version based on the bump type using node-semver
 */
export function bumpSemVer(version: SemVer, bumpType: BumpType): SemVer {
  if (bumpType === 'none') {
    return version;
  }

  const bumpedVersionString = semver.inc(version, bumpType);
  if (!bumpedVersionString) {
    throw new Error(`Failed to bump version ${version.version} with type ${bumpType}`);
  }
  
  return parseSemVer(bumpedVersionString);
}

/**
 * Determine the bump type between two versions using node-semver
 */
export function getBumpType(from: SemVer, to: SemVer): BumpType {
  if (to.major > from.major) {
    return 'major';
  }
  
  if (to.minor > from.minor) {
    return 'minor';
  }
  
  if (to.patch > from.patch) {
    return 'patch';
  }
  
  return 'none';
}

/**
 * Get the highest bump type from a list of bump types
 */
export function maxBumpType(bumpTypes: BumpType[]): BumpType {
  const priority = { none: 0, patch: 1, minor: 2, major: 3 };
  
  return bumpTypes.reduce((max, current) => {
    return priority[current] > priority[max] ? current : max;
  }, 'none' as BumpType);
}

/**
 * Check if a version string is valid using node-semver
 */
export function isValidVersionString(versionString: string): boolean {
  return semver.valid(versionString) !== null;
}

/**
 * Create initial version (0.0.0) using node-semver
 */
export function createInitialVersion(): SemVer {
  return new SemVer('0.0.0');
}

/**
 * Bump a version to a pre-release version
 */
export function bumpToPrerelease(version: SemVer, bumpType: BumpType, prereleaseId: string): SemVer {
  if (bumpType === 'none') {
    // If no changes, convert current version to prerelease
    if (version.prerelease.length > 0) {
      // Already a prerelease, increment the prerelease version
      const bumpedVersionString = semver.inc(version, 'prerelease', prereleaseId);
      if (!bumpedVersionString) {
        throw new Error(`Failed to bump prerelease version ${version.version}`);
      }
      return parseSemVer(bumpedVersionString);
    } else {
      // Convert to prerelease by bumping patch and adding prerelease identifier
      const bumpedVersionString = semver.inc(version, 'prepatch', prereleaseId);
      if (!bumpedVersionString) {
        throw new Error(`Failed to create prerelease version from ${version.version}`);
      }
      return parseSemVer(bumpedVersionString);
    }
  }

  // Bump to prerelease version based on bump type
  let prereleaseType: semver.ReleaseType;
  switch (bumpType) {
    case 'patch':
      prereleaseType = 'prepatch';
      break;
    case 'minor':
      prereleaseType = 'preminor';
      break;
    case 'major':
      prereleaseType = 'premajor';
      break;
    default:
      throw new Error(`Invalid bump type for prerelease: ${bumpType}`);
  }

  const bumpedVersionString = semver.inc(version, prereleaseType, prereleaseId);
  if (!bumpedVersionString) {
    throw new Error(`Failed to bump version ${version.version} to prerelease with type ${prereleaseType}`);
  }
  
  return parseSemVer(bumpedVersionString);
}

/**
 * Add build metadata to a version
 * Leverages SemVer's native build metadata support
 */
export function addBuildMetadata(version: SemVer, buildMetadata: string): SemVer {
  // Use the existing version string and append build metadata
  const baseVersionString = version.format(); // Gets version without build metadata
  const newVersionString = `${baseVersionString}+${buildMetadata}`;
  
  return parseSemVer(newVersionString);
}

/**
 * Generate a timestamp-based prerelease identifier
 * Format: {baseId}.{YYYYMMDD}.{HHMM}
 */
export function generateTimestampPrereleaseId(baseId: string, timestamp?: Date): string {
  const date = timestamp || new Date();
  
  // Format: YYYYMMDD (using UTC to ensure consistency across timezones)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const dateString = `${year}${month}${day}`;
  
  // Format: HHMM (using UTC to ensure consistency across timezones)
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const timeString = `${hours}${minutes}`;
  
  return `${baseId}.${dateString}.${timeString}`;
}
