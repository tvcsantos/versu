import * as semver from "semver";
import { SemVer } from "semver";

/**
 * Semantic version bump types: major, minor, patch, or none.
 * Represents different ways a version can be incremented per Semantic Versioning 2.0.0.
 */
export type BumpType = "major" | "minor" | "patch" | "none";

/**
 * Parses a semantic version string into a SemVer object.
 * @param versionString - The version string to parse (e.g., '1.2.3', '2.0.0-beta.1')
 * @returns A parsed SemVer object with structured version components
 * @throws {Error} If the version string is invalid or cannot be parsed
 */
export function parseSemVer(versionString: string): SemVer {
  const parsed = semver.parse(versionString);

  if (!parsed) {
    throw new Error(`Invalid semantic version: ${versionString}`);
  }

  return parsed;
}

/**
 * Converts a SemVer object to its string representation.
 * @param version - The SemVer object to format
 * @returns The version as a string, preserving all components including build metadata
 */
export function formatSemVer(version: SemVer): string {
  return version.raw;
}

/**
 * Compares two semantic versions following SemVer precedence rules.
 * @param a - The first version to compare
 * @param b - The second version to compare
 * @returns `-1` if a < b, `0` if a === b, `1` if a > b
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  return semver.compare(a, b);
}

/**
 * Increments a semantic version based on the specified bump type.
 * @param version - The version to bump
 * @param bumpType - The type of version increment to apply
 * @returns A new SemVer object with the incremented version
 * @throws {Error} If the version cannot be bumped with the specified type
 */
export function bumpSemVer(version: SemVer, bumpType: BumpType): SemVer {
  if (bumpType === "none") {
    return version;
  }

  const bumpedVersionString = semver.inc(version, bumpType);
  if (!bumpedVersionString) {
    throw new Error(
      `Failed to bump version ${version.version} with type ${bumpType}`,
    );
  }

  return parseSemVer(bumpedVersionString);
}

/**
 * Determines the bump type between two versions.
 * @param from - The starting version
 * @param to - The ending version
 * @returns The bump type that would transform 'from' into 'to'
 */
export function getBumpType(from: SemVer, to: SemVer): BumpType {
  if (to.major > from.major) {
    return "major";
  }

  if (to.minor > from.minor) {
    return "minor";
  }

  if (to.patch > from.patch) {
    return "patch";
  }

  return "none";
}

/**
 * Determines the highest priority bump type from an array.
 * Priority: major > minor > patch > none.
 * @param bumpTypes - Array of bump types to evaluate
 * @returns The bump type with highest priority
 */
export function maxBumpType(bumpTypes: BumpType[]): BumpType {
  const priority = { none: 0, patch: 1, minor: 2, major: 3 };

  return bumpTypes.reduce((max, current) => {
    return priority[current] > priority[max] ? current : max;
  }, "none" as BumpType);
}

/**
 * Validates whether a string is a valid semantic version.
 * @param versionString - The version string to validate
 * @returns True if valid semantic version, false otherwise
 */
export function isValidVersionString(versionString: string): boolean {
  return semver.valid(versionString) !== null;
}

/**
 * Creates an initial semantic version (0.0.0) for new modules or projects.
 * @returns A SemVer object representing version 0.0.0
 */
export function createInitialVersion(): SemVer {
  return new SemVer("0.0.0");
}

/**
 * Bumps a version to a prerelease version.
 * @param version - The version to bump to prerelease
 * @param bumpType - The type of version bump to apply before adding prerelease identifier
 * @param prereleaseId - The prerelease identifier (e.g., 'alpha', 'beta', 'rc')
 * @returns A new SemVer object with the prerelease version
 * @throws {Error} If the bump operation fails
 */
export function bumpToPrerelease(
  version: SemVer,
  bumpType: BumpType,
  prereleaseId: string,
): SemVer {
  if (bumpType === "none") {
    // If no changes, convert current version to prerelease
    if (version.prerelease.length > 0) {
      // Already a prerelease, increment the prerelease version
      const bumpedVersionString = semver.inc(
        version,
        "prerelease",
        prereleaseId,
      );
      if (!bumpedVersionString) {
        throw new Error(`Failed to bump prerelease version ${version.version}`);
      }
      return parseSemVer(bumpedVersionString);
    } else {
      // Convert to prerelease by bumping patch and adding prerelease identifier
      const bumpedVersionString = semver.inc(version, "prepatch", prereleaseId);
      if (!bumpedVersionString) {
        throw new Error(
          `Failed to create prerelease version from ${version.version}`,
        );
      }
      return parseSemVer(bumpedVersionString);
    }
  }

  // Bump to prerelease version based on bump type
  let prereleaseType: semver.ReleaseType;
  switch (bumpType) {
    case "patch":
      prereleaseType = "prepatch";
      break;
    case "minor":
      prereleaseType = "preminor";
      break;
    case "major":
      prereleaseType = "premajor";
      break;
    default:
      throw new Error(`Invalid bump type for prerelease: ${bumpType}`);
  }

  const bumpedVersionString = semver.inc(version, prereleaseType, prereleaseId);
  if (!bumpedVersionString) {
    throw new Error(
      `Failed to bump version ${version.version} to prerelease with type ${prereleaseType}`,
    );
  }

  return parseSemVer(bumpedVersionString);
}

/**
 * Adds build metadata to a semantic version.
 * Build metadata is appended with a '+' sign and doesn't affect version precedence.
 * @param version - The version to add metadata to
 * @param buildMetadata - The build metadata string to append
 * @returns A new SemVer object with the build metadata appended
 */
export function addBuildMetadata(
  version: SemVer,
  buildMetadata: string,
): SemVer {
  // Use the existing version string and append build metadata
  const baseVersionString = version.format(); // Gets version without build metadata
  const newVersionString = `${baseVersionString}+${buildMetadata}`;

  return parseSemVer(newVersionString);
}

/**
 * Generates a timestamp-based prerelease identifier in format `{baseId}.{YYYYMMDD}.{HHMM}`.
 * Creates unique, sortable prerelease identifiers using UTC timestamps.
 * @param baseId - The base identifier for the prerelease (e.g., 'alpha', 'beta', 'rc')
 * @param timestamp - Optional timestamp to use; defaults to current date/time
 * @returns A prerelease identifier string (e.g., 'alpha.20230515.1430')
 */
export function generateTimestampPrereleaseId(
  baseId: string,
  timestamp?: Date,
): string {
  const date = timestamp || new Date();

  // Format: YYYYMMDD (using UTC to ensure consistency across timezones)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const dateString = `${year}${month}${day}`;

  // Format: HHMM (using UTC to ensure consistency across timezones)
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const timeString = `${hours}${minutes}`;

  return `${baseId}.${dateString}.${timeString}`;
}

export function isReleaseVersion(version: SemVer | string): boolean {
  if (typeof version === "string") {
    const parsed = semver.parse(version);
    if (!parsed) return false;
    version = parsed;
  }

  // A release version has no prerelease identifiers
  return version.prerelease.length === 0;
}
