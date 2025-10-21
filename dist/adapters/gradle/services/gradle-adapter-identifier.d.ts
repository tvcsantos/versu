import { AdapterIdentifier } from '../../../services/adapter-identifier.js';
/**
 * Adapter identifier for Gradle-based projects.
 *
 * @remarks
 * This class implements the {@link AdapterIdentifier} interface to provide
 * auto-detection capabilities for Gradle projects. It identifies Gradle projects
 * by searching for characteristic Gradle files in the project root.
 *
 * **Detection Strategy:**
 * The identifier looks for any of the following files:
 * - `gradle.properties`
 * - `build.gradle` or `build.gradle.kts`
 * - `settings.gradle` or `settings.gradle.kts`
 *
 * The presence of any one of these files is sufficient to identify the project
 * as a Gradle project, as they are unique to Gradle's build system.
 *
 * **Capabilities:**
 * - **Snapshot Support**: Gradle fully supports snapshot versions (e.g., '1.0.0-SNAPSHOT')
 *   commonly used in development and CI/CD workflows
 *
 * @example
 * ```typescript
 * const identifier = new GradleAdapterIdentifier();
 *
 * // Check if project is a Gradle project
 * const isGradle = await identifier.accept('/path/to/project');
 *
 * // Access metadata
 * console.log(identifier.metadata.id);  // 'gradle'
 * console.log(identifier.metadata.capabilities.supportsSnapshots);  // true
 * ```
 */
export declare class GradleAdapterIdentifier implements AdapterIdentifier {
    /**
     * Metadata describing this Gradle adapter.
     *
     * @remarks
     * Provides static information about the adapter's identity and capabilities.
     * The metadata is immutable and available without requiring project analysis.
     *
     * **Properties:**
     * - **id**: 'gradle' - Unique identifier for the Gradle adapter
     * - **capabilities.supportsSnapshots**: true - Gradle supports snapshot versions
     */
    readonly metadata: {
        id: string;
        capabilities: {
            supportsSnapshots: boolean;
        };
    };
    /**
     * Determines whether the specified project is a Gradle project.
     *
     * @param projectRoot - The absolute path to the project root directory to analyze
     *
     * @returns A promise that resolves to `true` if the project is identified as a
     *          Gradle project, or `false` otherwise
     *
     * @remarks
     * This method performs file system analysis to detect Gradle project indicators.
     * The detection process is designed to be fast and reliable:
     *
     * **Detection Algorithm:**
     *
     * 1. **Validate Project Root:**
     *    - Check if the project root directory exists
     *    - Return `false` immediately if it doesn't exist (fail-fast)
     *    - Log debug message for troubleshooting
     *
     * 2. **Read Directory Contents:**
     *    - List all files in the project root directory
     *    - Only top-level files are checked (no recursive search)
     *
     * 3. **Check for Gradle Files:**
     *    - Compare directory contents against known Gradle file names
     *    - Return `true` if any Gradle-specific file is found
     *    - Return `false` if no Gradle files are present
     *
     * **Performance Characteristics:**
     * - Time Complexity: O(n) where n is the number of files in the project root
     * - Only reads the directory listing, doesn't open or parse files
     * - Fails fast if project root doesn't exist
     *
     * **Supported Project Types:**
     * - Single-module Gradle projects (with build.gradle/kts)
     * - Multi-module Gradle projects (with settings.gradle/kts)
     * - Both Groovy DSL and Kotlin DSL projects
     *
     * @example
     * ```typescript
     * const identifier = new GradleAdapterIdentifier();
     *
     * // Detect Gradle project with build.gradle
     * const isGradle1 = await identifier.accept('/path/to/groovy-project');
     * // Returns: true (if build.gradle exists)
     *
     * // Detect Gradle project with build.gradle.kts
     * const isGradle2 = await identifier.accept('/path/to/kotlin-project');
     * // Returns: true (if build.gradle.kts exists)
     *
     * // Non-Gradle project
     * const isGradle3 = await identifier.accept('/path/to/maven-project');
     * // Returns: false (no Gradle files found)
     * ```
     */
    accept(projectRoot: string): Promise<boolean>;
}
//# sourceMappingURL=gradle-adapter-identifier.d.ts.map