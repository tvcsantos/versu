/**
 * The suffix appended to version strings to denote a snapshot (development) version.
 * 
 * This constant follows the Maven/Gradle convention where `-SNAPSHOT` is used to indicate
 * a version that is still under development and may change. Snapshot versions are typically
 * used for:
 * - Development branches that are actively being worked on
 * - Pre-release versions that haven't been finalized
 * - Nightly builds or continuous integration builds
 * 
 * @remarks
 * The `-SNAPSHOT` suffix is automatically stripped when creating release versions.
 * This convention is widely used in Java/Gradle ecosystems to distinguish between
 * stable releases and work-in-progress versions.
 * 
 * @example
 * ```typescript
 * // Snapshot version examples
 * const devVersion = '1.0.0-SNAPSHOT';
 * const preReleaseVersion = '2.1.0-SNAPSHOT';
 * 
 * // When released, the -SNAPSHOT suffix is removed
 * const releaseVersion = '1.0.0'; // was 1.0.0-SNAPSHOT
 * ```
 * 
 * @see {@link applySnapshotSuffix} - Function to apply this suffix to version strings
 */
const SNAPSHOT_SUFFIX = '-SNAPSHOT';

/**
 * Applies the `-SNAPSHOT` suffix to a version string to denote a development version.
 * 
 * This utility function ensures that a version string is properly marked as a snapshot
 * version by appending the `-SNAPSHOT` suffix. It follows Maven/Gradle conventions where
 * snapshot versions indicate work-in-progress or development versions that may change.
 * 
 * The function is idempotent - if the version already ends with `-SNAPSHOT`, it returns
 * the original string unchanged to prevent duplicate suffixes like `1.0.0-SNAPSHOT-SNAPSHOT`.
 * 
 * @param version - The version string to convert to a snapshot version.
 *                  Can be in any format (e.g., `1.0.0`, `2.1.0-beta`, `3.0.0-SNAPSHOT`).
 * 
 * @returns The version string with `-SNAPSHOT` suffix appended.
 *          If the input already ends with `-SNAPSHOT`, returns the input unchanged.
 * 
 * @remarks
 * **Idempotency**:
 * - Calling this function multiple times with the same input produces the same result
 * - Safe to call even when uncertain if the version is already a snapshot
 * - No validation is performed on the version string format
 * 
 * **Use Cases**:
 * - Converting release versions to development versions
 * - Ensuring all development builds have the snapshot suffix
 * - Preparing versions for continuous integration environments
 * - Marking versions as unstable or subject to change
 * 
 * **Version Format**:
 * - Works with semantic versions: `1.0.0` → `1.0.0-SNAPSHOT`
 * - Works with pre-release versions: `1.0.0-beta` → `1.0.0-beta-SNAPSHOT`
 * - Works with build metadata: `1.0.0+build123` → `1.0.0+build123-SNAPSHOT`
 * - No format validation is performed - any string is accepted
 * 
 * **Performance**:
 * - O(n) time complexity where n is the length of the version string
 * - Single string concatenation when suffix needs to be added
 * - No allocations when version already has the suffix
 * - Suitable for high-frequency operations
 * 
 * @example
 * **Basic Usage**:
 * ```typescript
 * // Convert release version to snapshot
 * const snapshot = applySnapshotSuffix('1.0.0');
 * console.log(snapshot); // '1.0.0-SNAPSHOT'
 * 
 * // Idempotent - already has suffix
 * const alreadySnapshot = applySnapshotSuffix('1.0.0-SNAPSHOT');
 * console.log(alreadySnapshot); // '1.0.0-SNAPSHOT' (unchanged)
 * ```
 * 
 * @example
 * **With Pre-release Versions**:
 * ```typescript
 * // Apply to alpha/beta/rc versions
 * const alphaSnapshot = applySnapshotSuffix('2.0.0-alpha.1');
 * console.log(alphaSnapshot); // '2.0.0-alpha.1-SNAPSHOT'
 * 
 * const betaSnapshot = applySnapshotSuffix('2.0.0-beta');
 * console.log(betaSnapshot); // '2.0.0-beta-SNAPSHOT'
 * 
 * const rcSnapshot = applySnapshotSuffix('2.0.0-rc.1');
 * console.log(rcSnapshot); // '2.0.0-rc.1-SNAPSHOT'
 * ```
 * 
 * @example
 * **In Version Management Flow**:
 * ```typescript
 * // Development workflow
 * let currentVersion = '1.0.0';
 * 
 * // Mark as development version
 * currentVersion = applySnapshotSuffix(currentVersion);
 * console.log(currentVersion); // '1.0.0-SNAPSHOT'
 * 
 * // Continue development...
 * currentVersion = applySnapshotSuffix(currentVersion); // Still '1.0.0-SNAPSHOT'
 * 
 * // When ready to release, remove suffix
 * const releaseVersion = currentVersion.replace('-SNAPSHOT', '');
 * console.log(releaseVersion); // '1.0.0'
 * ```
 * 
 * @example
 * **Integration with VERSE Workflow**:
 * ```typescript
 * import { applySnapshotSuffix } from './versioning.js';
 * import { bumpVersion } from '../semver/index.js';
 * 
 * // After bumping version, apply snapshot suffix for development
 * const currentVersion = '1.0.0';
 * const bumpedVersion = bumpVersion(currentVersion, 'minor'); // '1.1.0'
 * const devVersion = applySnapshotSuffix(bumpedVersion); // '1.1.0-SNAPSHOT'
 * 
 * // Update project files with snapshot version
 * await updateProjectVersion(devVersion);
 * ```
 * 
 * @example
 * **Multiple Calls (Idempotency)**:
 * ```typescript
 * let version = '3.2.1';
 * 
 * // First call adds suffix
 * version = applySnapshotSuffix(version); // '3.2.1-SNAPSHOT'
 * 
 * // Subsequent calls don't duplicate suffix
 * version = applySnapshotSuffix(version); // '3.2.1-SNAPSHOT'
 * version = applySnapshotSuffix(version); // '3.2.1-SNAPSHOT'
 * 
 * // Always safe to call
 * version = applySnapshotSuffix(version); // '3.2.1-SNAPSHOT'
 * ```
 * 
 * @example
 * **Edge Cases**:
 * ```typescript
 * // Empty string
 * applySnapshotSuffix(''); // '-SNAPSHOT'
 * 
 * // Already ends with suffix
 * applySnapshotSuffix('1.0.0-SNAPSHOT'); // '1.0.0-SNAPSHOT'
 * 
 * // Non-standard version formats
 * applySnapshotSuffix('v1.0.0'); // 'v1.0.0-SNAPSHOT'
 * applySnapshotSuffix('1.0'); // '1.0-SNAPSHOT'
 * applySnapshotSuffix('latest'); // 'latest-SNAPSHOT'
 * ```
 * 
 * @see {@link SNAPSHOT_SUFFIX} - The constant defining the snapshot suffix value
 */
export function applySnapshotSuffix(version: string): string {
  // Don't add -SNAPSHOT if it's already there
  // This makes the function idempotent and prevents duplicates like '1.0.0-SNAPSHOT-SNAPSHOT'
  if (version.endsWith(SNAPSHOT_SUFFIX)) {
    return version;
  }

  // Append the snapshot suffix to mark this as a development version
  return `${version}${SNAPSHOT_SUFFIX}`;
}
