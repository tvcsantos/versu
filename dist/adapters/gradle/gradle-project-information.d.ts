import { ProjectInformation, RawProjectInformation } from '../project-information.js';
/**
 * Executes Gradle to collect raw project structure information.
 *
 * @param projectRoot - The absolute path to the Gradle project root directory
 *
 * @returns A promise that resolves to the raw project information as JSON
 *
 * @throws {Error} If the initialization script cannot be found
 * @throws {Error} If Gradle execution fails or returns a non-zero exit code
 *
 * @remarks
 * This function orchestrates the Gradle execution process to extract project
 * structure information. It works by:
 *
 * **Execution Process:**
 *
 * 1. **Locate Gradle Wrapper:**
 *    - Constructs path to gradlew script in the project root
 *    - Uses wrapper to ensure correct Gradle version
 *
 * 2. **Validate Init Script:**
 *    - Resolves the absolute path to the initialization script
 *    - Verifies the script file exists before execution
 *    - Throws descriptive error if script is missing
 *
 * 3. **Execute Gradle Command:**
 *    - Runs: `./gradlew --quiet --console=plain --init-script <script> structure`
 *    - `--quiet`: Suppresses unnecessary output for clean JSON parsing
 *    - `--console=plain`: Disables ANSI formatting for reliable output
 *    - `--init-script`: Injects custom script into build process
 *    - `structure`: Custom task defined in init script that outputs JSON
 *
 * 4. **Process Output:**
 *    - Captures stdout containing JSON project structure
 *    - Parses JSON into structured data
 *    - Returns empty object if output is empty
 *
 * **Output Structure:**
 * The returned object maps module IDs to module information:
 * ```json
 * {
 *   ":": { "name": "root", "type": "root", "version": "1.0.0", ... },
 *   ":app": { "name": "app", "type": "module", "version": "1.0.0", ... },
 *   ":lib:core": { "name": "core", "type": "module", ... }
 * }
 * ```
 *
 * **Error Handling:**
 * - Script not found: Provides guidance to create the required file
 * - Gradle failure: Includes exit code and stderr for debugging
 * - JSON parsing: Errors propagate if output is malformed
 *
 * @example
 * ```typescript
 * try {
 *   const rawInfo = await getRawProjectInformation('/path/to/gradle/project');
 *   console.log('Module count:', Object.keys(rawInfo).length);
 *
 *   // Access specific module
 *   const rootModule = rawInfo[':'];
 *   console.log('Root version:', rootModule.version);
 * } catch (error) {
 *   console.error('Failed to get project info:', error.message);
 * }
 * ```
 */
export declare function getRawProjectInformation(projectRoot: string): Promise<RawProjectInformation>;
/**
 * Transforms raw project information into structured, queryable format.
 *
 * @param projectInformation - The raw project information from Gradle execution
 *
 * @returns A structured {@link ProjectInformation} object with normalized data
 *
 * @throws {Error} If no root module is found in the project hierarchy
 *
 * @remarks
 * This function processes the raw JSON output from Gradle and transforms it
 * into a normalized structure suitable for version management operations. It
 * performs several important transformations:
 *
 * **Transformation Process:**
 *
 * 1. **Module Extraction:**
 *    - Iterates through all modules in the raw information
 *    - Creates normalized {@link Module} objects for each
 *    - Preserves module metadata (id, name, path, type)
 *
 * 2. **Root Module Identification:**
 *    - Searches for the module with `type === 'root'`
 *    - Validates that exactly one root module exists
 *    - Throws error if no root module is found
 *
 * 3. **Version Processing:**
 *    - Parses version strings into semantic version objects
 *    - Creates initial version (0.0.0) if no version is specified
 *    - Preserves declared version for reference
 *
 * 4. **Dependency Mapping:**
 *    - Converts `affectedModules` arrays into Sets for efficient lookup
 *    - Maintains bidirectional dependency relationships
 *    - Enables quick dependency graph traversal
 *
 * 5. **Data Indexing:**
 *    - Creates a Map of module IDs to Module objects for O(1) lookup
 *    - Maintains a separate array of all module IDs
 *    - Provides efficient access patterns for various operations
 *
 * **Data Structure:**
 * The returned object contains:
 * - `moduleIds`: Array of all module identifiers
 * - `modules`: Map of module ID to Module object
 * - `rootModule`: Identifier of the root module
 *
 * **Root Module Requirement:**
 * Every Gradle project must have exactly one root module (identified by
 * `type === 'root'`). This represents the top-level project and serves as
 * the entry point for the module hierarchy. The function validates this
 * invariant and fails fast if it's violated.
 *
 * **Version Handling:**
 * - If a module has a version: Parses it into SemVer object
 * - If no version: Creates initial version (0.0.0)
 * - Preserves `declaredVersion` for tracking original values
 *
 * @example
 * ```typescript
 * const rawInfo = await getRawProjectInformation('/path/to/project');
 * const projectInfo = getProjectInformation(rawInfo);
 *
 * // Access module information
 * console.log('All modules:', projectInfo.moduleIds);
 * console.log('Root module:', projectInfo.rootModule);
 *
 * // Get specific module
 * const appModule = projectInfo.modules.get(':app');
 * if (appModule) {
 *   console.log(`Module: ${appModule.name}`);
 *   console.log(`Version: ${appModule.version.major}.${appModule.version.minor}.${appModule.version.patch}`);
 *   console.log(`Affected modules: ${Array.from(appModule.affectedModules).join(', ')}`);
 * }
 * ```
 */
export declare function getProjectInformation(projectInformation: RawProjectInformation): ProjectInformation;
//# sourceMappingURL=gradle-project-information.d.ts.map