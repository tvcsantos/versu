import { ModuleDetector } from "../../../services/module-detector.js";
import { ModuleRegistry } from '../../../services/module-registry.js';
/**
 * Module detector for Gradle-based projects.
 *
 * @remarks
 * This class implements the {@link ModuleDetector} interface to provide
 * module discovery capabilities for Gradle projects. It analyzes the Gradle
 * project structure to identify all modules and their dependencies.
 *
 * **Detection Process:**
 *
 * 1. **Raw Information Extraction:**
 *    - Executes a Gradle initialization script to gather project structure data
 *    - Collects information about all subprojects in multi-module builds
 *    - Extracts module metadata, versions, and dependency relationships
 *
 * 2. **Information Processing:**
 *    - Transforms raw Gradle output into normalized project information
 *    - Builds a structured representation of the module hierarchy
 *    - Identifies inter-module dependencies
 *
 * 3. **Registry Creation:**
 *    - Creates a {@link ModuleRegistry} containing all discovered modules
 *    - Provides a queryable structure for accessing module information
 *    - Enables dependency graph traversal and analysis
 *
 * **Supported Project Types:**
 * - Single-module Gradle projects
 * - Multi-module Gradle projects with subprojects
 * - Both Groovy DSL and Kotlin DSL projects
 *
 * @example
 * ```typescript
 * const detector = new GradleModuleDetector('/path/to/gradle/project');
 *
 * // Detect all modules in the project
 * const registry = await detector.detect();
 *
 * // Access discovered modules
 * const modules = registry.getAllModules();
 * console.log(`Found ${modules.length} modules`);
 * ```
 */
export declare class GradleModuleDetector implements ModuleDetector {
    readonly repoRoot: string;
    /**
     * The absolute path to the repository root directory.
     *
     * @remarks
     * This path is used as the working directory for Gradle commands and
     * serves as the base for resolving module paths. It should point to
     * the root directory containing the main build.gradle(.kts) file.
     */
    constructor(repoRoot: string);
    /**
     * Detects and catalogs all modules in the Gradle project.
     *
     * @returns A promise that resolves to a {@link ModuleRegistry} containing
     *          all discovered modules and their relationships
     *
     * @throws {Error} If Gradle execution fails (missing Gradle, build errors, etc.)
     * @throws {Error} If project information cannot be parsed
     *
     * @remarks
     * This method orchestrates the complete module detection workflow for
     * Gradle projects. It performs three main operations:
     *
     * **Step 1: Raw Data Collection**
     *
     * Calls `getRawProjectInformation()` which:
     * - Injects and executes a Gradle initialization script
     * - Runs Gradle tasks to collect project metadata
     * - Returns raw JSON output containing project structure data
     * - Handles both single and multi-module projects
     *
     * **Step 2: Data Transformation**
     *
     * Calls `getProjectInformation()` which:
     * - Parses the raw JSON output from Gradle
     * - Normalizes module names and paths
     * - Constructs dependency relationships
     * - Creates structured module information objects
     *
     * **Step 3: Registry Construction**
     *
     * Creates a `ModuleRegistry` which:
     * - Indexes all modules for efficient lookup
     * - Maintains dependency graph structure
     * - Provides query methods for module access
     * - Enables dependency traversal operations
     *
     * **Performance Considerations:**
     * - May take significant time for large multi-module projects
     * - Requires Gradle execution which involves JVM startup
     * - Caches results in the returned registry for reuse
     *
     * **Error Handling:**
     * Errors during Gradle execution or parsing will propagate up as exceptions.
     * Common failure scenarios include:
     * - Gradle not installed or not in PATH
     * - Invalid Gradle build files
     * - Gradle daemon issues
     * - File system permission problems
     *
     * @example
     * ```typescript
     * const detector = new GradleModuleDetector('/path/to/project');
     *
     * try {
     *   const registry = await detector.detect();
     *
     *   // Get all modules
     *   const allModules = registry.getAllModules();
     *   console.log(`Detected ${allModules.length} modules`);
     *
     *   // Get specific module
     *   const module = registry.getModule(':app');
     *   if (module) {
     *     console.log(`Module: ${module.name}`);
     *     console.log(`Version: ${module.version}`);
     *   }
     * } catch (error) {
     *   console.error('Module detection failed:', error.message);
     * }
     * ```
     */
    detect(): Promise<ModuleRegistry>;
}
//# sourceMappingURL=gradle-module-detector.d.ts.map