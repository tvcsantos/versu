import { join } from 'path';
import { VersionUpdateStrategy } from "../../../services/version-update-strategy.js";
import { moduleIdToVersionPropertyName } from '../gradle-properties.js';
import { upsertProperties } from '../../../utils/properties.js';
import { GRADLE_PROPERTIES_FILE } from '../constants.js';

/**
 * Gradle-specific implementation for version update operations.
 * 
 * @remarks
 * This class implements the {@link VersionUpdateStrategy} interface to provide
 * version management capabilities for Gradle projects. It handles version updates
 * by modifying the gradle.properties file, which is the standard location for
 * Gradle project version configuration.
 * 
 * **Version Management Approach:**
 * 
 * Gradle projects typically store version information in gradle.properties using
 * property names that correspond to module identifiers:
 * - Root project: `version=1.0.0`
 * - Subproject `:app`: `app.version=1.0.0`
 * - Subproject `:lib:core`: `lib.core.version=1.0.0`
 * 
 * **Key Features:**
 * - **Batch Updates**: Supports updating multiple module versions in one operation
 * - **Atomic Operations**: All updates are applied atomically to prevent partial updates
 * - **Property Preservation**: Maintains existing properties, comments, and formatting
 * - **Module ID Mapping**: Automatically converts module IDs to property names
 * 
 * **File Format:**
 * The strategy works with standard Java properties file format:
 * ```properties
 * # Project version
 * version=1.0.0
 * 
 * # Module versions
 * app.version=2.0.0
 * lib.core.version=1.5.0
 * ```
 * 
 * @example
 * ```typescript
 * const strategy = new GradleVersionUpdateStrategy('/path/to/project');
 * 
 * // Update multiple module versions
 * const versions = new Map([
 *   [':', '2.0.0'],           // Root project
 *   [':app', '2.0.0'],        // App module
 *   [':lib:core', '1.5.0']    // Core library module
 * ]);
 * 
 * await strategy.writeVersionUpdates(versions);
 * ```
 */
export class GradleVersionUpdateStrategy implements VersionUpdateStrategy {
  /**
   * The absolute path to the gradle.properties file.
   * 
   * @remarks
   * This path points to the gradle.properties file in the repository root,
   * which is the standard location for Gradle project-wide configuration.
   * The file contains version properties for all modules in the project.
   * 
   * The path is computed during construction by joining the repository root
   * with the standard gradle.properties filename.
   */
  private readonly versionFilePath: string;

  /**
   * Creates a new Gradle version update strategy.
   * 
   * @param repoRoot - The absolute path to the repository root directory
   * 
   * @remarks
   * The constructor initializes the strategy by computing the path to the
   * gradle.properties file. This file will be the target for all version
   * update operations.
   * 
   * The repository root should point to the directory containing the root
   * build.gradle(.kts) file, where gradle.properties is typically located.
   * 
   * @example
   * ```typescript
   * const strategy = new GradleVersionUpdateStrategy('/path/to/gradle/project');
   * // Will operate on /path/to/gradle/project/gradle.properties
   * ```
   */
  constructor(repoRoot: string) {
    this.versionFilePath = join(repoRoot, GRADLE_PROPERTIES_FILE);
  }
  
  /**
   * Writes version updates for multiple modules to the gradle.properties file.
   * 
   * @param moduleVersions - A map of module IDs to their new version strings
   * 
   * @returns A promise that resolves when all version updates are written
   * 
   * @throws {Error} If the gradle.properties file cannot be read or written
   * @throws {Error} If property conversion or update operations fail
   * 
   * @remarks
   * This method performs batch version updates in an efficient, atomic manner.
   * It converts Gradle module IDs to property names and updates the
   * gradle.properties file with all new versions in a single operation.
   * 
   * **Update Process:**
   * 
   * 1. **Module ID Conversion:**
   *    - Converts each module ID to its corresponding property name
   *    - Example: `:` → `version`, `:app` → `app.version`, `:lib:core` → `lib.core.version`
   *    - Handles root project (`:`) and nested subprojects
   * 
   * 2. **Property Preparation:**
   *    - Builds a map of property names to version values
   *    - Maintains all mappings in memory before file update
   * 
   * 3. **Atomic File Update:**
   *    - Reads existing gradle.properties content
   *    - Updates or inserts version properties
   *    - Preserves existing properties, comments, and formatting
   *    - Writes all changes atomically to prevent partial updates
   * 
   * **Version Format:**
   * The version strings can be any valid semantic version, including:
   * - Release versions: `1.0.0`, `2.5.3`
   * - Snapshot versions: `1.0.0-SNAPSHOT`, `2.0.0-SNAPSHOT`
   * - Pre-release versions: `1.0.0-alpha`, `1.0.0-beta.1`
   * 
   * **File Safety:**
   * The underlying `upsertProperties` function ensures atomic updates with
   * proper error handling. If any error occurs during the update, the file
   * remains in its original state.
   * 
   * **Performance:**
   * - Single file I/O operation regardless of number of version updates
   * - Efficient for multi-module projects with many modules
   * - No temporary files or backup copies created
   * 
   * @example
   * ```typescript
   * const strategy = new GradleVersionUpdateStrategy('/path/to/project');
   * 
   * // Update root project and submodules
   * await strategy.writeVersionUpdates(new Map([
   *   [':', '2.0.0'],              // Root: version=2.0.0
   *   [':app', '2.0.0'],           // App: app.version=2.0.0
   *   [':lib:core', '1.5.0'],      // Core: lib.core.version=1.5.0
   *   [':lib:util', '1.5.0']       // Util: lib.util.version=1.5.0
   * ]));
   * 
   * // Update with snapshot versions
   * await strategy.writeVersionUpdates(new Map([
   *   [':', '2.1.0-SNAPSHOT']      // version=2.1.0-SNAPSHOT
   * ]));
   * ```
   */
  async writeVersionUpdates(moduleVersions: Map<string, string>): Promise<void> {
    // Convert module IDs to property names
    // Example: ':app' → 'app.version', ':' → 'version'
    const propertyUpdates = new Map<string, string>();
    
    for (const [moduleId, versionString] of moduleVersions) {
      const propertyName = moduleIdToVersionPropertyName(moduleId);
      propertyUpdates.set(propertyName, versionString);
    }
    
    // Write all properties to gradle.properties file in one atomic operation
    // This ensures consistency and prevents partial updates
    await upsertProperties(this.versionFilePath, propertyUpdates);
  }
}
