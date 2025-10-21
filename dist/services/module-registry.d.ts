import { Module, ProjectInformation } from "../adapters/project-information.js";
/**
 * Registry for managing module hierarchy and metadata in a multi-module repository.
 *
 * @remarks
 * ModuleRegistry serves as a centralized container and access layer for all discovered
 * modules in a project. It wraps {@link ProjectInformation} and provides a clean,
 * type-safe API for querying module data throughout the VERSE workflow.
 *
 * **Core Responsibilities:**
 * - Store complete module hierarchy discovered during detection
 * - Provide fast lookup operations for modules by ID
 * - Expose iteration capabilities for batch processing
 * - Validate module existence before access
 * - Maintain immutable view of module structure
 *
 * **Design Philosophy:**
 * This class follows the Facade pattern, simplifying access to the underlying
 * {@link ProjectInformation} structure. It provides:
 * - Clear, focused API for module queries
 * - Protection against direct manipulation of module data
 * - Consistent error handling for missing modules
 * - Type safety for all module operations
 *
 * **Data Immutability:**
 * The registry provides readonly access to module data through:
 * - Readonly map returned by {@link getModules}
 * - Direct module access via {@link getModule} (returns Module objects)
 * - No mutation methods (add, remove, update)
 * - Once created, the registry's contents are fixed
 *
 * This immutability ensures that the module structure remains stable throughout
 * the version calculation and update process, preventing inconsistencies.
 *
 * **Module ID Format:**
 * All module IDs follow Gradle's module path convention:
 * - Root module: `':'`
 * - Top-level subproject: `':core'`
 * - Nested subproject: `':core:api'`
 * - Deeply nested: `':services:api:v1'`
 *
 * **Usage in VERSE Workflow:**
 * The registry is created by {@link ModuleDetector} and used throughout:
 * ```
 * 1. ModuleDetector.detect() → Creates ModuleRegistry
 * 2. CommitAnalyzer → Iterates modules to analyze commits
 * 3. VersionManager → Queries modules to calculate new versions
 * 4. VersionUpdateStrategy → Accesses module metadata for updates
 * 5. ChangelogGenerator → Retrieves module info for changelog entries
 * ```
 *
 * **Performance Characteristics:**
 * - Module lookup by ID: O(1) via Map
 * - Check module existence: O(1) via Map.has()
 * - Get all modules: O(1) - returns readonly reference
 * - Get all IDs: O(n) - creates array from Map keys
 * - Iteration: O(n) where n is the number of modules
 *
 * @example
 * ```typescript
 * // Create registry from project information
 * const projectInfo: ProjectInformation = await getProjectInformation();
 * const registry = new ModuleRegistry(projectInfo);
 *
 * // Query basic information
 * const moduleIds = registry.getModuleIds();
 * console.log(`Project has ${moduleIds.length} modules`);
 *
 * // Check if specific module exists
 * if (registry.hasModule(':core')) {
 *   const coreModule = registry.getModule(':core');
 *   console.log(`Core module at ${coreModule.path}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Iterate through all modules
 * for (const [id, module] of registry.getModules()) {
 *   console.log(`${id}: ${module.name} v${module.version}`);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Filter modules by criteria
 * const moduleIds = registry.getModuleIds();
 * const rootModules = moduleIds.filter(id => id === ':');
 * const subprojects = moduleIds.filter(id => id !== ':');
 *
 * // Get modules with specific characteristics
 * const apiModules = moduleIds
 *   .filter(id => id.includes('api'))
 *   .map(id => registry.getModule(id));
 * ```
 *
 * @see {@link ProjectInformation} - Underlying data structure
 * @see {@link Module} - Module metadata type
 * @see {@link ModuleDetector} - Creates ModuleRegistry instances
 */
export declare class ModuleRegistry {
    private readonly projectInformation;
    /**
     * Creates a new ModuleRegistry wrapping project information.
     *
     * @param projectInformation - Complete project structure with all discovered modules
     *
     * @remarks
     * This constructor is typically called by {@link ModuleDetector} implementations
     * after successfully detecting and parsing the project structure. It should not
     * be called directly by application code.
     *
     * **Validation:**
     * The constructor assumes that the provided {@link ProjectInformation} is valid:
     * - Contains at least one module (typically the root module)
     * - All module IDs are unique
     * - Module paths are valid and consistent
     * - Module metadata is complete
     *
     * These validations should be performed during module detection, before creating
     * the registry. The constructor itself does not perform additional validation
     * to maintain construction efficiency.
     *
     * **Encapsulation:**
     * The projectInformation parameter is stored as a private readonly field,
     * ensuring that:
     * - External code cannot modify the underlying data structure
     * - Module data remains consistent throughout the registry's lifetime
     * - All access goes through the registry's public API
     *
     * @example
     * ```typescript
     * // Typical usage within a ModuleDetector implementation
     * class GradleModuleDetector implements ModuleDetector {
     *   async detect(): Promise<ModuleRegistry> {
     *     // Execute Gradle and parse output
     *     const projectInfo = await this.getProjectInformation();
     *
     *     // Create registry with discovered modules
     *     return new ModuleRegistry(projectInfo);
     *   }
     * }
     * ```
     */
    constructor(projectInformation: ProjectInformation);
    /**
     * Gets an array of all module IDs in the project.
     *
     * @returns Array of module ID strings in no particular order
     *
     * @remarks
     * This method provides access to all module identifiers, which can be used for:
     * - Iteration when you need only module IDs
     * - Filtering to find specific subsets of modules
     * - Counting total modules
     * - Checking module existence via array methods
     *
     * **Performance Note:**
     * This method creates a new array on each call from the underlying module IDs
     * stored in {@link ProjectInformation}. For frequently called code, consider
     * caching the result:
     * ```typescript
     * const ids = registry.getModuleIds(); // Cache this
     * for (const id of ids) { ... }        // Use cached version
     * ```
     *
     * **Module ID Format:**
     * All IDs follow Gradle's module path convention:
     * - Root: `':'`
     * - Subproject: `':moduleName'`
     * - Nested: `':parent:child'`
     *
     * **Order:**
     * The order of IDs is not guaranteed and may vary between calls or across
     * different project structures. Do not rely on any specific ordering.
     *
     * @example
     * ```typescript
     * const moduleIds = registry.getModuleIds();
     * console.log(`Found ${moduleIds.length} modules`);
     *
     * // Iterate over IDs
     * for (const id of moduleIds) {
     *   console.log(`Module: ${id}`);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Filter for specific modules
     * const moduleIds = registry.getModuleIds();
     * const apiModules = moduleIds.filter(id => id.includes(':api'));
     * const coreModules = moduleIds.filter(id => id.startsWith(':core'));
     *
     * // Check if any modules match criteria
     * const hasTests = moduleIds.some(id => id.includes('test'));
     * ```
     *
     * @example
     * ```typescript
     * // Get module details for all IDs
     * const moduleIds = registry.getModuleIds();
     * const modules = moduleIds.map(id => registry.getModule(id));
     *
     * // Calculate statistics
     * const totalModules = moduleIds.length;
     * const avgNameLength = moduleIds.reduce((sum, id) => sum + id.length, 0) / totalModules;
     * ```
     */
    getModuleIds(): string[];
    /**
     * Retrieves module information by its unique identifier.
     *
     * @param moduleId - The unique module identifier (e.g., `':'`, `':core'`, `':core:api'`)
     *
     * @returns The {@link Module} object containing complete module metadata including:
     *   - `id`: The module identifier
     *   - `name`: Display name used for git tags
     *   - `path`: Relative path from repository root
     *   - `type`: Module category (root, subproject, etc.)
     *   - `version`: Current semantic version
     *   - Additional adapter-specific metadata
     *
     * @throws {Error} If the module ID does not exist in the registry.
     *   Error message format: `"Module {moduleId} not found"`
     *
     * @remarks
     * This is the primary method for accessing detailed module information. It provides
     * O(1) lookup time via the underlying Map structure.
     *
     * **When to Use:**
     * - Need complete module metadata (name, path, version, type)
     * - Already know the module ID exists (or handling error)
     * - Performing operations on a specific module
     *
     * **Error Handling:**
     * Always verify module existence with {@link hasModule} if the ID is uncertain,
     * or wrap the call in try-catch to handle missing modules gracefully:
     *
     * ```typescript
     * // Option 1: Check first
     * if (registry.hasModule(id)) {
     *   const module = registry.getModule(id);
     * }
     *
     * // Option 2: Handle error
     * try {
     *   const module = registry.getModule(id);
     * } catch (error) {
     *   console.error(`Module ${id} not found`);
     * }
     * ```
     *
     * **Module Data:**
     * The returned {@link Module} object includes:
     * - **id**: Full module identifier (`:core:api`)
     * - **name**: Display name for tags (`core-api`)
     * - **path**: File system path (`core/api`)
     * - **type**: Module category (`subproject`)
     * - **version**: Current SemVer (`1.2.3`)
     *
     * @example
     * ```typescript
     * // Get root module
     * const root = registry.getModule(':');
     * console.log(`Root: ${root.name} at ${root.path}`);
     * console.log(`Current version: ${root.version}`);
     * ```
     *
     * @example
     * ```typescript
     * // Get specific subproject
     * const coreModule = registry.getModule(':core');
     * console.log(`Module ID: ${coreModule.id}`);
     * console.log(`Display name: ${coreModule.name}`);
     * console.log(`Path: ${coreModule.path}`);
     * console.log(`Type: ${coreModule.type}`);
     * console.log(`Version: ${coreModule.version}`);
     * ```
     *
     * @example
     * ```typescript
     * // Safe access with existence check
     * const moduleId = ':services:api';
     * if (registry.hasModule(moduleId)) {
     *   const module = registry.getModule(moduleId);
     *   // Use module safely
     * } else {
     *   console.warn(`Module ${moduleId} not found in registry`);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Batch module retrieval with error handling
     * const targetIds = [':core', ':api', ':utils'];
     * const modules = targetIds
     *   .filter(id => registry.hasModule(id))
     *   .map(id => registry.getModule(id));
     *
     * console.log(`Found ${modules.length}/${targetIds.length} modules`);
     * ```
     */
    getModule(moduleId: string): Module;
    /**
     * Checks whether a module with the given ID exists in the registry.
     *
     * @param moduleId - The module identifier to check (e.g., `':'`, `':core'`)
     *
     * @returns `true` if the module exists, `false` otherwise
     *
     * @remarks
     * This method provides a safe way to verify module existence before attempting
     * to access module data with {@link getModule}. It performs O(1) lookup via
     * the underlying Map structure.
     *
     * **When to Use:**
     * - Before calling {@link getModule} when module existence is uncertain
     * - Validating user input or configuration
     * - Conditional logic based on module presence
     * - Filtering modules from external lists
     *
     * **Pattern Comparison:**
     * ```typescript
     * // Check then access (recommended when existence is uncertain)
     * if (registry.hasModule(id)) {
     *   const module = registry.getModule(id);
     * }
     *
     * // Direct access with error handling (recommended when module should exist)
     * try {
     *   const module = registry.getModule(id);
     * } catch (error) {
     *   // Handle unexpected missing module
     * }
     * ```
     *
     * **Performance:**
     * Very fast O(1) operation, safe to call frequently without caching.
     *
     * @example
     * ```typescript
     * // Check before accessing
     * if (registry.hasModule(':core')) {
     *   const core = registry.getModule(':core');
     *   console.log(`Core version: ${core.version}`);
     * } else {
     *   console.log('No core module in this project');
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Validate multiple modules
     * const requiredModules = [':core', ':api', ':common'];
     * const missingModules = requiredModules.filter(id => !registry.hasModule(id));
     *
     * if (missingModules.length > 0) {
     *   throw new Error(`Missing required modules: ${missingModules.join(', ')}`);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Filter external list to valid modules
     * const requestedIds = [':core', ':nonexistent', ':api'];
     * const validIds = requestedIds.filter(id => registry.hasModule(id));
     * // Result: [':core', ':api']
     *
     * const modules = validIds.map(id => registry.getModule(id));
     * ```
     *
     * @example
     * ```typescript
     * // Conditional processing based on module presence
     * const modules = registry.getModuleIds();
     *
     * for (const id of modules) {
     *   const module = registry.getModule(id);
     *
     *   // Check for related test module
     *   const testId = `${id}:test`;
     *   if (registry.hasModule(testId)) {
     *     console.log(`${id} has dedicated test module`);
     *   }
     * }
     * ```
     */
    hasModule(moduleId: string): boolean;
    /**
     * Gets all modules as a readonly map for efficient iteration and lookup.
     *
     * @returns Readonly map where:
     *   - **Key**: Module ID (e.g., `':'`, `':core'`, `':core:api'`)
     *   - **Value**: {@link Module} object with complete module metadata
     *
     * @remarks
     * This method provides direct access to the complete module collection for
     * efficient batch operations. The returned map is readonly to prevent
     * accidental modification of the registry's internal state.
     *
     * **When to Use:**
     * - Iterating through all modules with both IDs and data
     * - Performing batch operations on multiple modules
     * - Filtering modules based on their properties
     * - Building derived data structures from module information
     * - Need both key and value during iteration (more efficient than separate lookups)
     *
     * **Performance Advantages:**
     * - O(1) access to the underlying map (no copying)
     * - Efficient iteration via Map.entries()
     * - Can use Map methods (size, has, get, keys, values, entries)
     * - Better than getModuleIds() + getModule() when you need both ID and data
     *
     * **Readonly Protection:**
     * The return type is `ReadonlyMap<string, Module>`, which prevents:
     * - Adding new modules via `.set()`
     * - Removing modules via `.delete()` or `.clear()`
     * - Any modification of the registry's internal state
     *
     * However, note that readonly only applies to the map structure itself, not to
     * the Module objects. Module properties should be treated as immutable.
     *
     * **Map Iteration Patterns:**
     * ```typescript
     * // Destructuring entries
     * for (const [id, module] of registry.getModules()) { }
     *
     * // Iterate keys only
     * for (const id of registry.getModules().keys()) { }
     *
     * // Iterate values only
     * for (const module of registry.getModules().values()) { }
     *
     * // Convert to arrays
     * const entries = Array.from(registry.getModules());
     * const ids = Array.from(registry.getModules().keys());
     * const modules = Array.from(registry.getModules().values());
     * ```
     *
     * @example
     * ```typescript
     * // Iterate all modules with both ID and data
     * for (const [id, module] of registry.getModules()) {
     *   console.log(`${id}: ${module.name} v${module.version} at ${module.path}`);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Filter modules by properties
     * const modules = registry.getModules();
     *
     * // Find modules with specific characteristics
     * const apiModules = Array.from(modules)
     *   .filter(([id, module]) => module.path.includes('api'))
     *   .map(([id, module]) => module);
     *
     * // Find modules by type
     * const subprojects = Array.from(modules)
     *   .filter(([_, module]) => module.type === 'subproject');
     * ```
     *
     * @example
     * ```typescript
     * // Build derived data structures
     * const modules = registry.getModules();
     *
     * // Create path-to-module map
     * const byPath = new Map(
     *   Array.from(modules).map(([id, module]) => [module.path, module])
     * );
     *
     * // Create name-to-ID map
     * const byName = new Map(
     *   Array.from(modules).map(([id, module]) => [module.name, id])
     * );
     *
     * // Group by type
     * const byType = new Map<string, Module[]>();
     * for (const [_, module] of modules) {
     *   if (!byType.has(module.type)) byType.set(module.type, []);
     *   byType.get(module.type)!.push(module);
     * }
     * ```
     *
     * @example
     * ```typescript
     * // Calculate statistics across all modules
     * const modules = registry.getModules();
     *
     * const stats = {
     *   total: modules.size,
     *   types: new Set(Array.from(modules.values()).map(m => m.type)).size,
     *   avgPathDepth: Array.from(modules.values())
     *     .reduce((sum, m) => sum + m.path.split('/').length, 0) / modules.size,
     *   versions: Array.from(modules.values()).map(m => m.version)
     * };
     *
     * console.log(`Project has ${stats.total} modules of ${stats.types} types`);
     * ```
     *
     * @example
     * ```typescript
     * // Check size without calling getModuleIds()
     * const moduleCount = registry.getModules().size;
     * console.log(`Registry contains ${moduleCount} modules`);
     *
     * // Verify specific module exists (alternative to hasModule)
     * const hasCore = registry.getModules().has(':core');
     *
     * // Get module directly from map (alternative to getModule)
     * const core = registry.getModules().get(':core');
     * if (core) {
     *   console.log(`Core at ${core.path}`);
     * }
     * ```
     */
    getModules(): ReadonlyMap<string, Module>;
}
//# sourceMappingURL=module-registry.d.ts.map