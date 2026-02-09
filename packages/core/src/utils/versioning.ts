/** Suffix appended to version strings to denote a snapshot (development) version ('-SNAPSHOT'). */
const SNAPSHOT_SUFFIX = "-SNAPSHOT";

/**
 * Applies the '-SNAPSHOT' suffix to a version string.
 * Idempotent - returns unchanged if already ends with '-SNAPSHOT'.
 * @param version - Version string to convert to a snapshot version
 * @returns Version string with '-SNAPSHOT' suffix
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

export function isSnapshotVersion(version: string): boolean {
  return version.endsWith(SNAPSHOT_SUFFIX);
}
