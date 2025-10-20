import { SemVer } from 'semver';
export type BumpType = 'major' | 'minor' | 'patch' | 'none';
/**
 * Parse a semantic version string into a SemVer object using node-semver
 */
export declare function parseSemVer(versionString: string): SemVer;
/**
 * Convert a SemVer object to a string
 * Uses the raw property to preserve build metadata
 */
export declare function formatSemVer(version: SemVer): string;
/**
 * Compare two semantic versions using node-semver
 * Returns -1 if a < b, 0 if a === b, 1 if a > b
 */
export declare function compareSemVer(a: SemVer, b: SemVer): number;
/**
 * Bump a semantic version based on the bump type using node-semver
 */
export declare function bumpSemVer(version: SemVer, bumpType: BumpType): SemVer;
/**
 * Determine the bump type between two versions using node-semver
 */
export declare function getBumpType(from: SemVer, to: SemVer): BumpType;
/**
 * Get the highest bump type from a list of bump types
 */
export declare function maxBumpType(bumpTypes: BumpType[]): BumpType;
/**
 * Check if a version string is valid using node-semver
 */
export declare function isValidVersionString(versionString: string): boolean;
/**
 * Create initial version (0.0.0) using node-semver
 */
export declare function createInitialVersion(): SemVer;
/**
 * Bump a version to a pre-release version
 */
export declare function bumpToPrerelease(version: SemVer, bumpType: BumpType, prereleaseId: string): SemVer;
/**
 * Add build metadata to a version
 * Leverages SemVer's native build metadata support
 */
export declare function addBuildMetadata(version: SemVer, buildMetadata: string): SemVer;
/**
 * Generate a timestamp-based prerelease identifier
 * Format: {baseId}.{YYYYMMDD}.{HHMM}
 */
export declare function generateTimestampPrereleaseId(baseId: string, timestamp?: Date): string;
//# sourceMappingURL=index.d.ts.map