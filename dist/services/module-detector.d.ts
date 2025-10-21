import { ModuleRegistry } from "./module-registry.js";
/**
 * Interface for detecting modules in a multi-module repository.
 *
 * @remarks
 * ModuleDetector defines the contract for discovering all modules within a repository,
 * regardless of the underlying build system (Gradle, Maven, npm, etc.). This abstraction
 * allows VERSE to support multiple build systems through adapter implementations.
 *
 * **Core Responsibility:**
 * Transform a repository's file structure into a structured {@link ModuleRegistry}
 * containing all discovered modules with their metadata (name, path, type, etc.).
 *
 * **Detection Process:**
 * Implementations typically follow these steps:
 * 1. Identify the build system (e.g., by presence of build files)
 * 2. Execute build system-specific commands or scripts to introspect the project structure
 * 3. Parse the output to extract module information
 * 4. Create and populate a ModuleRegistry with discovered modules
 * 5. Handle any errors or edge cases (malformed projects, missing files)
 *
 * **Build System Support:**
 * Different implementations exist for different build systems:
 * - **Gradle**: Executes init script via `gradle` CLI to extract project structure
 * - **Maven**: (Future) Parses `pom.xml` hierarchy
 * - **npm/yarn**: (Future) Parses `package.json` workspaces
 * - **Custom**: Build system-agnostic implementations possible
 *
 * **Design Pattern:**
 * This interface is part of the Abstract Factory pattern, where:
 * - {@link ModuleSystemFactory} creates appropriate ModuleDetector implementations
 * - Each build system has its own detector (e.g., GradleModuleDetector)
 * - Detectors are obtained via factory, not instantiated directly
 *
 * **Why Asynchronous:**
 * Module detection is async because it typically involves:
 * - File system I/O (reading build files, checking directories)
 * - Process execution (running build tools like `gradle`, `mvn`)
 * - Network operations (downloading dependencies, if needed)
 * - Parsing large outputs (project structures can be complex)
 *
 * **Usage Context:**
 * ModuleDetector is invoked early in the VERSE workflow:
 * ```
 * 1. Detect build system (AdapterIdentifier)
 * 2. Create detector (ModuleSystemFactory)
 * 3. Detect modules (ModuleDetector) ← This interface
 * 4. Analyze commits (CommitAnalyzer)
 * 5. Calculate versions (VersionManager)
 * ```
 *
 * @example
 * ```typescript
 * // Typical usage through factory
 * const factory = createModuleSystemFactory('gradle', '/path/to/repo');
 * const detector = factory.createDetector();
 *
 * // Detect all modules in the repository
 * const registry = await detector.detect();
 *
 * // Access detected modules
 * const moduleIds = registry.getModuleIds();
 * console.log(`Found ${moduleIds.length} modules`);
 *
 * for (const id of moduleIds) {
 *   const module = registry.getModule(id);
 *   console.log(`- ${id}: ${module.name} at ${module.path}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom implementation for a hypothetical build system
 * class CustomModuleDetector implements ModuleDetector {
 *   constructor(public readonly repoRoot: string) {}
 *
 *   async detect(): Promise<ModuleRegistry> {
 *     // Custom detection logic to get project information
 *     const projectInfo = await this.findModules();
 *
 *     // Create and return registry with discovered modules
 *     return new ModuleRegistry(projectInfo);
 *   }
 *
 *   private async findModules(): Promise<ProjectInformation> {
 *     // Implementation-specific logic
 *   }
 * }
 * ```
 *
 * @see {@link ModuleRegistry} - Container for discovered modules
 * @see {@link ModuleSystemFactory} - Factory for creating detector instances
 * @see {@link GradleModuleDetector} - Gradle implementation (adapters/gradle/)
 */
export interface ModuleDetector {
    /**
     * The absolute path to the repository root directory.
     *
     * @remarks
     * This property provides the base directory for all module detection operations.
     * It serves multiple purposes:
     *
     * **Path Resolution:**
     * - Used to resolve relative module paths to absolute paths
     * - Ensures all file system operations have a consistent working directory
     * - Allows modules to be located at any depth in the repository
     *
     * **Build Tool Execution:**
     * - Serves as the working directory for build tool commands
     * - Example: `gradle` commands are executed from this directory
     * - Ensures build tools can find their configuration files
     *
     * **Module Path Calculation:**
     * - Module paths in the registry are relative to this root
     * - Root module uses `'.'` as its path
     * - Nested modules use paths like `'core/api'`, `'services/impl'`
     *
     * **Immutability:**
     * This property is readonly because:
     * - The repository root should never change during detection
     * - It's set at construction time and remains constant
     * - Changing it would invalidate all detected module paths
     *
     * @example
     * ```typescript
     * // Create factory with repo root, then detector
     * const factory = createModuleSystemFactory('gradle', '/Users/dev/my-project');
     * const detector = factory.createDetector();
     * console.log(detector.repoRoot); // "/Users/dev/my-project"
     *
     * // Used internally for path resolution
     * const modulePath = path.join(detector.repoRoot, 'core', 'api');
     * // Result: "/Users/dev/my-project/core/api"
     * ```
     */
    readonly repoRoot: string;
    /**
     * Detects all modules in the repository and returns a populated module registry.
     *
     * @returns A promise that resolves to a {@link ModuleRegistry} containing all discovered
     *   modules with their complete metadata (ID, name, path, type, etc.)
     *
     * @throws {Error} If the repository is not a valid project for this build system
     * @throws {Error} If required build files are missing or malformed
     * @throws {Error} If build tool execution fails (tool not installed, incorrect version, etc.)
     * @throws {Error} If module information cannot be parsed from build tool output
     * @throws {Error} If file system operations fail (permissions, disk errors, etc.)
     *
     * @remarks
     * This is the main operation of the ModuleDetector interface. It orchestrates the
     * entire module discovery process and returns a complete view of the repository's
     * module structure.
     *
     * **Detection Workflow:**
     *
     * 1. **Validation:**
     *    - Verify repository root exists and is accessible
     *    - Check for required build files (e.g., `build.gradle`, `settings.gradle`)
     *    - Validate build tool availability and version
     *
     * 2. **Introspection:**
     *    - Execute build system-specific commands to gather project structure
     *    - Gradle: Run init script with `gradle` command
     *    - Maven: Parse POM hierarchy
     *    - npm: Read package.json and workspace configuration
     *
     * 3. **Parsing:**
     *    - Extract module information from build tool output
     *    - Parse module names, paths, dependencies, and metadata
     *    - Handle different module types (root, subproject, composite, etc.)
     *
     * 4. **Registry Population:**
     *    - Create ModuleRegistry instance
     *    - Register each discovered module
     *    - Validate module uniqueness and hierarchy
     *
     * 5. **Validation:**
     *    - Ensure at least one module (root) was found
     *    - Verify all module paths exist in file system
     *    - Check for naming conflicts or invalid structures
     *
     * **Module Information:**
     * Each discovered module includes:
     * - **ID**: Unique identifier (e.g., `:`, `:core`, `:core:api`)
     * - **Name**: Display name for tagging (e.g., `'my-app'`, `'core'`)
     * - **Path**: Relative path from repository root (e.g., `'.'`, `'core'`)
     * - **Type**: Module category (e.g., `'root'`, `'subproject'`)
     * - **Metadata**: Additional build system-specific data
     *
     * **Performance Considerations:**
     * - May take several seconds for large multi-module projects
     * - Build tool execution is typically the slowest operation
     * - Result should be cached; avoid repeated calls
     * - Some implementations may optimize by parsing files instead of executing tools
     *
     * **Error Handling:**
     * Implementations should provide clear error messages for common failure scenarios:
     * - "Build tool not found" → User needs to install Gradle/Maven/npm
     * - "Invalid build file" → Syntax error in build.gradle or pom.xml
     * - "No modules found" → Project structure not recognized
     * - "Execution failed" → Build command returned non-zero exit code
     *
     * **Idempotency:**
     * Multiple calls to detect() should return equivalent results (assuming repository
     * hasn't changed). However, implementations typically don't cache results internally;
     * caching should be handled by callers if needed.
     *
     * @example
     * ```typescript
     * // Basic usage
     * const registry = await detector.detect();
     * const moduleIds = registry.getModuleIds();
     * console.log(`Discovered ${moduleIds.length} modules`);
     *
     * // Access root module
     * const root = registry.getModule(':');
     * console.log(`Root module: ${root.name}`);
     *
     * // Iterate all modules
     * for (const [id, module] of registry.getModules()) {
     *   console.log(`${id}: ${module.name} (${module.type}) at ${module.path}`);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Error handling
     * try {
     *   const registry = await detector.detect();
     *   // Success - use registry
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.error('Build tool not installed');
     *   } else if (error.message.includes('failed')) {
     *     console.error('Build execution failed');
     *   } else {
     *     console.error('Unexpected error:', error);
     *   }
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Using detected modules for further processing
     * const registry = await detector.detect();
     *
     * // Filter specific module types
     * const subprojects = Array.from(registry.getModules())
     *   .filter(([_, module]) => module.type === 'subproject');
     *
     * // Find modules by checking their properties
     * const hasCore = registry.hasModule(':core');
     *
     * // Get specific module details
     * if (hasCore) {
     *   const coreModule = registry.getModule(':core');
     *   console.log(`Core module path: ${coreModule.path}`);
     * }
     * ```
     *
     * @see {@link ModuleRegistry} - Container returned by this method
     * @see {@link ModuleSystemFactory.createDetector} - Method that creates detector instances
     */
    detect(): Promise<ModuleRegistry>;
}
//# sourceMappingURL=module-detector.d.ts.map