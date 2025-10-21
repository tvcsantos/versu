/**
 * Metadata describing an adapter's identity and capabilities.
 *
 * @remarks
 * This type provides essential information about an adapter that can be used
 * for identification, registration, and feature detection purposes.
 */
export type AdapterMetadata = {
    /**
     * Unique identifier for the adapter.
     *
     * @remarks
     * This should be a stable, unique string that identifies the adapter type
     * (e.g., 'gradle', 'maven', 'npm'). Used for adapter lookup and registration.
     */
    readonly id: string;
    /**
     * The set of capabilities supported by this adapter.
     *
     * @remarks
     * Capabilities define what features and operations the adapter can perform,
     * allowing the system to adapt behavior based on adapter support.
     */
    readonly capabilities: AdapterCapabilities;
};
/**
 * Defines the feature capabilities of an adapter.
 *
 * @remarks
 * This type allows the system to query whether an adapter supports specific
 * features before attempting to use them, enabling graceful degradation.
 */
export type AdapterCapabilities = {
    /**
     * Indicates whether the adapter supports snapshot versions.
     *
     * @remarks
     * Snapshot versions are pre-release versions commonly used in development.
     * Not all build systems or versioning schemes support this concept.
     *
     * @example
     * - Maven: Supports snapshots (e.g., '1.0.0-SNAPSHOT')
     * - Gradle: Supports snapshots (e.g., '1.0.0-SNAPSHOT')
     * - npm: Does not typically use snapshot terminology
     */
    readonly supportsSnapshots: boolean;
};
/**
 * Interface for adapter identification and auto-discovery.
 *
 * @remarks
 * Each adapter implementation must implement this interface to participate
 * in the auto-discovery mechanism. The system uses this interface to:
 * - Identify which adapter can handle a given project
 * - Retrieve adapter metadata and capabilities
 * - Enable dynamic adapter registration and selection
 *
 * @example
 * ```typescript
 * class GradleAdapterIdentifier implements AdapterIdentifier {
 *   readonly metadata: AdapterMetadata = {
 *     id: 'gradle',
 *     capabilities: { supportsSnapshots: true }
 *   };
 *
 *   async accept(projectRoot: string): Promise<boolean> {
 *     const buildFile = path.join(projectRoot, 'build.gradle');
 *     return await fileExists(buildFile);
 *   }
 * }
 * ```
 */
export interface AdapterIdentifier {
    /**
     * The metadata describing this adapter's identity and capabilities.
     *
     * @remarks
     * This property provides static information about the adapter that doesn't
     * require project analysis. It should be immutable and available immediately.
     */
    readonly metadata: AdapterMetadata;
    /**
     * Determines whether this adapter can handle the specified project.
     *
     * @param projectRoot - The absolute path to the root directory of the project to analyze
     *
     * @returns A promise that resolves to `true` if this adapter can handle the project,
     *          or `false` if it cannot
     *
     * @remarks
     * This method performs project introspection to determine compatibility.
     * Implementations should check for adapter-specific indicators such as:
     * - Build files (e.g., build.gradle, pom.xml, package.json)
     * - Configuration files
     * - Directory structures
     * - Other project artifacts
     *
     * The method should be efficient as it may be called multiple times during
     * adapter discovery. Avoid expensive operations when possible.
     *
     * @example
     * ```typescript
     * // Check for Gradle project
     * async accept(projectRoot: string): Promise<boolean> {
     *   const buildGradle = path.join(projectRoot, 'build.gradle');
     *   const buildGradleKts = path.join(projectRoot, 'build.gradle.kts');
     *   return await fileExists(buildGradle) || await fileExists(buildGradleKts);
     * }
     * ```
     */
    accept(projectRoot: string): Promise<boolean>;
}
//# sourceMappingURL=adapter-identifier.d.ts.map