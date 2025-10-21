import * as semver from 'semver';
import { SemVer } from 'semver';

/**
 * Semantic version bump types.
 * 
 * @remarks
 * These types represent the different ways a semantic version can be incremented
 * following the Semantic Versioning 2.0.0 specification:
 * 
 * - **major**: Increment major version (breaking changes) - `1.2.3` → `2.0.0`
 * - **minor**: Increment minor version (new features) - `1.2.3` → `1.3.0`
 * - **patch**: Increment patch version (bug fixes) - `1.2.3` → `1.2.4`
 * - **none**: No version change - `1.2.3` → `1.2.3`
 * 
 * @see {@link https://semver.org} for Semantic Versioning specification
 */
export type BumpType = 'major' | 'minor' | 'patch' | 'none';

/**
 * Parses a semantic version string into a SemVer object.
 * 
 * @param versionString - The version string to parse (e.g., '1.2.3', '2.0.0-beta.1')
 * 
 * @returns A parsed {@link SemVer} object with structured version components
 * 
 * @throws {Error} If the version string is invalid or cannot be parsed
 * 
 * @remarks
 * Uses the node-semver library to parse version strings according to the
 * Semantic Versioning 2.0.0 specification. The parsed object provides
 * structured access to version components:
 * - major, minor, patch numbers
 * - prerelease identifiers
 * - build metadata
 * 
 * **Supported Formats:**
 * - Release versions: `1.0.0`, `2.5.3`
 * - Prerelease versions: `1.0.0-alpha`, `2.0.0-beta.1`, `3.0.0-rc.2`
 * - Build metadata: `1.0.0+20130313144700`, `1.0.0-beta+exp.sha.5114f85`
 * - Snapshots: `1.0.0-SNAPSHOT` (Gradle/Maven convention)
 * 
 * @example
 * ```typescript
 * const version = parseSemVer('1.2.3');
 * console.log(version.major); // 1
 * console.log(version.minor); // 2
 * console.log(version.patch); // 3
 * 
 * const prerelease = parseSemVer('2.0.0-beta.1');
 * console.log(prerelease.prerelease); // ['beta', 1]
 * 
 * // Invalid version throws error
 * try {
 *   parseSemVer('invalid');
 * } catch (error) {
 *   console.error(error.message); // "Invalid semantic version: invalid"
 * }
 * ```
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
 * 
 * @param version - The SemVer object to format
 * 
 * @returns The version as a string, preserving all components including build metadata
 * 
 * @remarks
 * Uses the `raw` property to preserve the exact original format including
 * build metadata, which is important for version traceability. The `raw`
 * property maintains the version exactly as it was parsed, including any
 * build metadata that might be stripped by other formatting methods.
 * 
 * @example
 * ```typescript
 * const version = parseSemVer('1.2.3+build.123');
 * const str = formatSemVer(version);
 * console.log(str); // "1.2.3+build.123"
 * 
 * const prerelease = parseSemVer('2.0.0-beta.1');
 * console.log(formatSemVer(prerelease)); // "2.0.0-beta.1"
 * ```
 */
export function formatSemVer(version: SemVer): string {
  return version.raw;
}

/**
 * Compares two semantic versions.
 * 
 * @param a - The first version to compare
 * @param b - The second version to compare
 * 
 * @returns `-1` if a < b, `0` if a === b, `1` if a > b
 * 
 * @remarks
 * Uses node-semver's comparison logic which follows Semantic Versioning 2.0.0
 * precedence rules:
 * 
 * 1. Compare major, minor, patch in order
 * 2. Prerelease versions have lower precedence than normal versions
 * 3. Prerelease identifiers are compared lexically
 * 4. Build metadata is ignored in comparisons
 * 
 * @example
 * ```typescript
 * const v1 = parseSemVer('1.0.0');
 * const v2 = parseSemVer('2.0.0');
 * const v3 = parseSemVer('1.0.0');
 * 
 * console.log(compareSemVer(v1, v2)); // -1 (1.0.0 < 2.0.0)
 * console.log(compareSemVer(v2, v1)); // 1  (2.0.0 > 1.0.0)
 * console.log(compareSemVer(v1, v3)); // 0  (1.0.0 === 1.0.0)
 * 
 * // Prerelease has lower precedence
 * const release = parseSemVer('1.0.0');
 * const prerelease = parseSemVer('1.0.0-beta');
 * console.log(compareSemVer(prerelease, release)); // -1
 * ```
 */
export function compareSemVer(a: SemVer, b: SemVer): number {
  return semver.compare(a, b);
}

/**
 * Increments a semantic version based on the specified bump type.
 * 
 * @param version - The version to bump
 * @param bumpType - The type of version increment to apply
 * 
 * @returns A new SemVer object with the incremented version
 * 
 * @throws {Error} If the version cannot be bumped with the specified type
 * 
 * @remarks
 * Uses node-semver's `inc` function to increment versions according to
 * Semantic Versioning rules:
 * 
 * - **major**: Resets minor and patch to 0, removes prerelease
 * - **minor**: Increments minor, resets patch to 0, removes prerelease
 * - **patch**: Increments patch, removes prerelease
 * - **none**: Returns the version unchanged
 * 
 * **Prerelease Handling:**
 * When bumping a prerelease version (e.g., `1.0.0-beta`), the prerelease
 * identifier is removed, resulting in a release version (e.g., `1.0.0`).
 * 
 * @example
 * ```typescript
 * const version = parseSemVer('1.2.3');
 * 
 * console.log(formatSemVer(bumpSemVer(version, 'major'))); // "2.0.0"
 * console.log(formatSemVer(bumpSemVer(version, 'minor'))); // "1.3.0"
 * console.log(formatSemVer(bumpSemVer(version, 'patch'))); // "1.2.4"
 * console.log(formatSemVer(bumpSemVer(version, 'none')));  // "1.2.3"
 * 
 * // Prerelease versions are promoted to release
 * const prerelease = parseSemVer('2.0.0-beta.1');
 * console.log(formatSemVer(bumpSemVer(prerelease, 'patch'))); // "2.0.0"
 * ```
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
 * Determines the bump type between two versions.
 * 
 * @param from - The starting version
 * @param to - The ending version
 * 
 * @returns The bump type that would transform `from` into `to`
 * 
 * @remarks
 * Analyzes the difference between two versions and returns the appropriate
 * bump type. This is useful for:
 * - Understanding what changed between versions
 * - Validating version increments
 * - Determining required dependency updates
 * 
 * **Detection Logic:**
 * 1. Check if major version increased → return 'major'
 * 2. Check if minor version increased → return 'minor'
 * 3. Check if patch version increased → return 'patch'
 * 4. No change → return 'none'
 * 
 * **Note:** This function only considers the numeric version components
 * (major.minor.patch) and does not account for prerelease or build metadata.
 * 
 * @example
 * ```typescript
 * console.log(getBumpType(
 *   parseSemVer('1.0.0'),
 *   parseSemVer('2.0.0')
 * )); // "major"
 * 
 * console.log(getBumpType(
 *   parseSemVer('1.0.0'),
 *   parseSemVer('1.1.0')
 * )); // "minor"
 * 
 * console.log(getBumpType(
 *   parseSemVer('1.0.0'),
 *   parseSemVer('1.0.1')
 * )); // "patch"
 * 
 * console.log(getBumpType(
 *   parseSemVer('1.0.0'),
 *   parseSemVer('1.0.0')
 * )); // "none"
 * ```
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
 * Determines the highest priority bump type from an array of bump types.
 * 
 * @param bumpTypes - Array of bump types to evaluate
 * 
 * @returns The bump type with the highest priority
 * 
 * @remarks
 * Uses a priority ranking to determine the most significant bump type:
 * - **major**: Priority 3 (highest - breaking changes)
 * - **minor**: Priority 2 (new features)
 * - **patch**: Priority 1 (bug fixes)
 * - **none**: Priority 0 (lowest - no changes)
 * 
 * This function is essential for aggregating multiple version changes in
 * multi-module projects, where the overall project should be bumped by
 * the most significant change across all modules.
 * 
 * **Use Cases:**
 * - Determining project-wide version bump from multiple module changes
 * - Aggregating dependency update impacts
 * - Computing transitive version requirements
 * 
 * @example
 * ```typescript
 * // Single major change takes precedence
 * console.log(maxBumpType(['patch', 'minor', 'major'])); // "major"
 * 
 * // Minor is highest when no major
 * console.log(maxBumpType(['patch', 'minor', 'none'])); // "minor"
 * 
 * // Only patches
 * console.log(maxBumpType(['patch', 'patch', 'none'])); // "patch"
 * 
 * // No changes
 * console.log(maxBumpType(['none', 'none'])); // "none"
 * 
 * // Empty array defaults to none
 * console.log(maxBumpType([])); // "none"
 * ```
 */
export function maxBumpType(bumpTypes: BumpType[]): BumpType {
  const priority = { none: 0, patch: 1, minor: 2, major: 3 };
  
  return bumpTypes.reduce((max, current) => {
    return priority[current] > priority[max] ? current : max;
  }, 'none' as BumpType);
}

/**
 * Validates whether a string is a valid semantic version.
 * 
 * @param versionString - The version string to validate
 * 
 * @returns `true` if the string is a valid semantic version, `false` otherwise
 * 
 * @remarks
 * Uses node-semver's validation to check if a string conforms to the
 * Semantic Versioning 2.0.0 specification. This is useful for:
 * - Pre-validation before parsing
 * - User input validation
 * - Configuration validation
 * 
 * Unlike {@link parseSemVer}, this function does not throw errors for
 * invalid versions, making it suitable for conditional checks.
 * 
 * @example
 * ```typescript
 * console.log(isValidVersionString('1.2.3')); // true
 * console.log(isValidVersionString('2.0.0-beta.1')); // true
 * console.log(isValidVersionString('1.0.0+build.123')); // true
 * console.log(isValidVersionString('invalid')); // false
 * console.log(isValidVersionString('1.2')); // false
 * 
 * // Use for conditional parsing
 * const input = '1.2.3';
 * if (isValidVersionString(input)) {
 *   const version = parseSemVer(input);
 *   // Safe to use version
 * }
 * ```
 */
export function isValidVersionString(versionString: string): boolean {
  return semver.valid(versionString) !== null;
}

/**
 * Creates an initial semantic version (0.0.0).
 * 
 * @returns A SemVer object representing version 0.0.0
 * 
 * @remarks
 * Provides a standard initial version for new modules or projects that
 * don't have an explicit version set. Using 0.0.0 indicates:
 * - Initial development phase
 * - No stable API yet
 * - Version management is starting from scratch
 * 
 * According to Semantic Versioning, version 0.x.y is for initial development
 * where anything may change at any time.
 * 
 * @example
 * ```typescript
 * const initialVersion = createInitialVersion();
 * console.log(formatSemVer(initialVersion)); // "0.0.0"
 * 
 * // Use for modules without declared versions
 * const moduleVersion = module.version === undefined
 *   ? createInitialVersion()
 *   : parseSemVer(module.version);
 * ```
 */
export function createInitialVersion(): SemVer {
  return new SemVer('0.0.0');
}

/**
 * Bumps a version to a prerelease version.
 * 
 * @param version - The version to bump to prerelease
 * @param bumpType - The type of version bump to apply before adding prerelease identifier
 * @param prereleaseId - The prerelease identifier (e.g., 'alpha', 'beta', 'rc')
 * 
 * @returns A new SemVer object with the prerelease version
 * 
 * @throws {Error} If the bump operation fails
 * @throws {Error} If an invalid bump type is provided (though this shouldn't happen with TypeScript)
 * 
 * @remarks
 * Creates prerelease versions following Semantic Versioning conventions.
 * The behavior varies based on the current version state and bump type:
 * 
 * **When bumpType is 'none':**
 * - If already a prerelease: Increments the prerelease number (e.g., `1.0.0-alpha.1` → `1.0.0-alpha.2`)
 * - If not a prerelease: Bumps patch and adds prerelease (e.g., `1.0.0` → `1.0.1-alpha.0`)
 * 
 * **When bumpType is 'patch', 'minor', or 'major':**
 * - Uses prepatch, preminor, or premajor respectively
 * - Example: `1.0.0` with 'minor' → `1.1.0-alpha.0`
 * - Example: `1.0.0` with 'major' → `2.0.0-alpha.0`
 * 
 * **Prerelease Identifier:**
 * Common identifiers include:
 * - `alpha`: Alpha release (early testing)
 * - `beta`: Beta release (feature complete)
 * - `rc`: Release candidate (almost ready)
 * - Custom identifiers are also supported
 * 
 * @example
 * ```typescript
 * const version = parseSemVer('1.0.0');
 * 
 * // Bump to prerelease minor
 * console.log(formatSemVer(
 *   bumpToPrerelease(version, 'minor', 'beta')
 * )); // "1.1.0-beta.0"
 * 
 * // Bump to prerelease major
 * console.log(formatSemVer(
 *   bumpToPrerelease(version, 'major', 'alpha')
 * )); // "2.0.0-alpha.0"
 * 
 * // Increment existing prerelease
 * const prerelease = parseSemVer('2.0.0-beta.0');
 * console.log(formatSemVer(
 *   bumpToPrerelease(prerelease, 'none', 'beta')
 * )); // "2.0.0-beta.1"
 * 
 * // Convert to prerelease without bump
 * console.log(formatSemVer(
 *   bumpToPrerelease(version, 'none', 'alpha')
 * )); // "1.0.1-alpha.0"
 * ```
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
 * Adds build metadata to a semantic version.
 * 
 * @param version - The version to add metadata to
 * @param buildMetadata - The build metadata string to append
 * 
 * @returns A new SemVer object with the build metadata appended
 * 
 * @remarks
 * Build metadata provides additional information about the build without
 * affecting version precedence. According to Semantic Versioning 2.0.0:
 * - Build metadata is appended with a `+` sign
 * - It does not affect version precedence (comparison ignores it)
 * - It's for informational purposes only
 * 
 * **Common Use Cases:**
 * - Commit SHA: `1.0.0+sha.5114f85`
 * - Build timestamp: `1.0.0+20130313144700`
 * - Build number: `1.0.0+build.123`
 * - Combined: `1.0.0-beta+exp.sha.5114f85`
 * 
 * **Build Metadata Format:**
 * - Can contain alphanumeric characters and hyphens
 * - Dot-separated identifiers are conventional but not required
 * - Should be ASCII characters
 * 
 * @example
 * ```typescript
 * const version = parseSemVer('1.0.0');
 * 
 * // Add commit SHA
 * const withSha = addBuildMetadata(version, 'sha.5114f85');
 * console.log(formatSemVer(withSha)); // "1.0.0+sha.5114f85"
 * 
 * // Add build timestamp
 * const withTimestamp = addBuildMetadata(version, '20130313144700');
 * console.log(formatSemVer(withTimestamp)); // "1.0.0+20130313144700"
 * 
 * // Works with prerelease versions too
 * const prerelease = parseSemVer('2.0.0-beta.1');
 * const withMetadata = addBuildMetadata(prerelease, 'build.123');
 * console.log(formatSemVer(withMetadata)); // "2.0.0-beta.1+build.123"
 * ```
 */
export function addBuildMetadata(version: SemVer, buildMetadata: string): SemVer {
  // Use the existing version string and append build metadata
  const baseVersionString = version.format(); // Gets version without build metadata
  const newVersionString = `${baseVersionString}+${buildMetadata}`;
  
  return parseSemVer(newVersionString);
}

/**
 * Generates a timestamp-based prerelease identifier.
 * 
 * @param baseId - The base identifier for the prerelease (e.g., 'alpha', 'beta', 'rc')
 * @param timestamp - Optional timestamp to use; defaults to current date/time
 * 
 * @returns A prerelease identifier string in the format `{baseId}.{YYYYMMDD}.{HHMM}`
 * 
 * @remarks
 * Creates a unique, sortable prerelease identifier by appending timestamp
 * components to a base identifier. The format ensures:
 * - **Uniqueness**: Each minute gets a unique identifier
 * - **Sortability**: Lexical sorting matches chronological order
 * - **Consistency**: Uses UTC to avoid timezone issues
 * - **Readability**: Human-readable date and time components
 * 
 * **Format Components:**
 * - `baseId`: The prerelease stage (e.g., 'alpha', 'beta', 'rc')
 * - `YYYYMMDD`: Date in ISO 8601 format (UTC)
 * - `HHMM`: Time in 24-hour format (UTC)
 * 
 * **Use Cases:**
 * - CI/CD builds: Generate unique prerelease versions
 * - Nightly builds: Track which night a build was created
 * - Continuous deployment: Sortable prerelease versions
 * - Development versions: Timestamp-based versioning
 * 
 * **Example Output:**
 * - `alpha.20230515.1430` - Alpha build from May 15, 2023 at 14:30 UTC
 * - `beta.20230601.0900` - Beta build from June 1, 2023 at 09:00 UTC
 * - `rc.20230620.1615` - Release candidate from June 20, 2023 at 16:15 UTC
 * 
 * @example
 * ```typescript
 * // Current timestamp
 * const id = generateTimestampPrereleaseId('alpha');
 * console.log(id); // e.g., "alpha.20230515.1430"
 * 
 * // Specific timestamp
 * const date = new Date('2023-05-15T14:30:00Z');
 * const id2 = generateTimestampPrereleaseId('beta', date);
 * console.log(id2); // "beta.20230515.1430"
 * 
 * // Use with bumpToPrerelease
 * const version = parseSemVer('1.0.0');
 * const prereleaseId = generateTimestampPrereleaseId('alpha');
 * const prerelease = bumpToPrerelease(version, 'minor', prereleaseId);
 * // Result: "1.1.0-alpha.20230515.1430.0"
 * ```
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
