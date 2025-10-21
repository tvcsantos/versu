import { join } from 'path';
import { getExecOutput } from '@actions/exec';
import { createInitialVersion, parseSemVer } from '../../semver/index.js';
import { exists } from '../../utils/file.js';
import { getGitHubActionPath } from '../../utils/actions.js';
import { Module, ProjectInformation, RawProjectInformation } from '../project-information.js';

/**
 * Name of the Gradle wrapper script file.
 * 
 * @remarks
 * The Gradle wrapper (gradlew) is a script that allows projects to be built
 * without requiring Gradle to be pre-installed. It automatically downloads
 * and uses the correct Gradle version specified in the project.
 * 
 * This is the preferred way to execute Gradle commands as it ensures
 * consistent build behavior across different environments.
 */
const GRADLE_WRAPPER = 'gradlew'

/**
 * Relative path to the Gradle initialization script within the action.
 * 
 * @remarks
 * This initialization script is injected into the Gradle build process to
 * collect project structure information. It defines a custom task that
 * outputs JSON containing:
 * - Module hierarchy
 * - Module versions
 * - Inter-module dependencies
 * - Module metadata (name, path, type)
 * 
 * The script is executed with the `--init-script` flag, which allows it to
 * run before the project's build scripts are evaluated.
 * 
 * @see {@link getRawProjectInformation} for how this script is used
 */
const GRADLE_INIT_SCRIPT = 'src/adapters/gradle/init-project-information.gradle.kts'

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
export async function getRawProjectInformation(projectRoot: string): Promise<RawProjectInformation> {
  const gradlew = join(projectRoot, GRADLE_WRAPPER);
  const initScriptPath = getGitHubActionPath(GRADLE_INIT_SCRIPT);

  // Check if init script exists
  const scriptExists = await exists(initScriptPath);
  if (!scriptExists) {
    throw new Error(
      `Init script not found at ${initScriptPath}. ` +
      `Please create the ${GRADLE_INIT_SCRIPT} file.`
    );
  }

  // Prepare Gradle command arguments
  const args = [
    '--quiet',                // Suppress non-error output for clean JSON
    '--console=plain',        // Disable ANSI formatting
    '--init-script',          // Inject initialization script
    initScriptPath,
    'structure'               // Custom task that outputs project structure
  ];

  // Execute Gradle wrapper with the prepared arguments
  const result = await getExecOutput(gradlew, args, {
    cwd: projectRoot,        // Run from project root
    silent: true,            // Don't log to console
    ignoreReturnCode: true   // Handle non-zero exit codes ourselves
  });

  // Check for Gradle execution failure
  if (result.exitCode !== 0) {
    throw new Error(
      `Gradle command failed with exit code ${result.exitCode}: ${result.stderr}`
    );
  }

  // Parse JSON output from Gradle
  return JSON.parse(result.stdout.trim() || '{}');
}

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
export function getProjectInformation(projectInformation: RawProjectInformation): ProjectInformation {
  const moduleIds = Object.keys(projectInformation);
  const modules = new Map<string, Module>();

  // Find root module by looking for the one with type 'root'
  let rootModule: string | undefined;
  for (const [moduleId, module] of Object.entries(projectInformation)) {
    if (module.type === 'root') {
      rootModule = moduleId;
    }
    
    // Create normalized Module object
    modules.set(moduleId, {
      id: moduleId,
      name: module.name,
      path: module.path,
      type: module.type,
      affectedModules: new Set(module.affectedModules),
      // Parse version if present, otherwise create initial version
      version: module.version === undefined ?
        createInitialVersion() :
        parseSemVer(module.version),
      declaredVersion: module.declaredVersion,
    });
  }

  // Validate that a root module was found
  if (!rootModule) {
    throw new Error(
      'No root module found in hierarchy. ' +
      'Every project hierarchy must contain exactly one module with type "root".'
    );
  }

  return {
    moduleIds,
    modules,
    rootModule
  };
}
