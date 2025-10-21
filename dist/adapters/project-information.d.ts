import { SemVer } from "semver";
/**
 * Represents a module within a project, containing all metadata and relationships.
 *
 * @remarks
 * This type encapsulates complete information about a single module (project or subproject)
 * in a multi-module build system. It includes identity, location, version, and dependency
 * information needed for version management operations.
 *
 * **Key Concepts:**
 *
 * - **Module Identity**: Each module has a unique identifier (id) within the project
 * - **Module Hierarchy**: Modules can have parent-child relationships (expressed via affected modules)
 * - **Version Management**: Each module tracks its version and whether it's explicitly declared
 * - **Dependency Propagation**: The `affectedModules` set enables tracking which modules are
 *   impacted when this module changes
 *
 * **Use Cases:**
 * - Determining which modules need version bumps when dependencies change
 * - Analyzing project structure for version coordination
 * - Generating changelogs for specific modules
 * - Computing dependency graphs for build optimization
 *
 * @example
 * ```typescript
 * const module: Module = {
 *   id: ':app',
 *   name: 'app',
 *   path: 'app',
 *   type: 'module',
 *   affectedModules: new Set([':app:ui', ':app:core']),
 *   version: parseSemVer('1.0.0'),
 *   declaredVersion: true
 * };
 * ```
 */
export type Module = {
    /**
     * Unique identifier for the module within the project.
     *
     * @remarks
     * The format depends on the build system:
     * - **Gradle**: Colon-separated paths (`:`, `:app`, `:lib:core`)
     * - **Maven**: Group and artifact coordinates
     * - **npm**: Package names
     *
     * The root project typically has a special identifier (`:` for Gradle).
     *
     * @example
     * - `":"` - Root project (Gradle)
     * - `":app"` - App module (Gradle)
     * - `":lib:core"` - Nested module (Gradle)
     */
    readonly id: string;
    /**
     * Human-readable name of the module.
     *
     * @remarks
     * This is typically the directory name or the name specified in the build file.
     * For Gradle, it's usually the last component of the module path.
     *
     * @example
     * - `"myproject"` - Root project name
     * - `"app"` - Application module
     * - `"core"` - Core library module
     */
    readonly name: string;
    /**
     * Relative path from the repository root to this module's directory.
     *
     * @remarks
     * This path uses forward slashes as separators and is relative to the
     * repository root. The root project uses "." to indicate its directory.
     *
     * Used for:
     * - Locating module files for version updates
     * - Reading module-specific configuration
     * - Generating file paths in changelogs
     *
     * @example
     * - `"."` - Root project directory
     * - `"app"` - App module in /app directory
     * - `"lib/core"` - Core module in /lib/core directory
     */
    readonly path: string;
    /**
     * Type of the module in the project hierarchy.
     *
     * @remarks
     * - **root**: The top-level project that may contain submodules
     * - **module**: A subproject or submodule within the hierarchy
     *
     * The root designation is important for:
     * - Identifying the entry point of the project
     * - Determining default behavior for operations
     * - Aggregating information across all modules
     */
    readonly type: 'module' | 'root';
    /**
     * Set of module IDs that are affected when this module changes.
     *
     * @remarks
     * This set contains the IDs of all modules that depend on or are children
     * of this module. It enables dependency propagation analysis:
     *
     * - When a parent module changes, all its submodules are affected
     * - When a library module changes, dependent modules may need version bumps
     * - Used for calculating transitive impacts of changes
     *
     * **Relationship Types:**
     * - Parent-child relationships (multi-module projects)
     * - Dependency relationships (inter-module dependencies)
     * - Transitive relationships (indirect dependencies)
     *
     * Using a Set ensures:
     * - O(1) lookup for checking if a module is affected
     * - No duplicate entries
     * - Efficient iteration
     *
     * @example
     * ```typescript
     * // Parent module affects its children
     * affectedModules: new Set([':app:ui', ':app:core'])
     *
     * // Library affects dependent modules
     * affectedModules: new Set([':app', ':service'])
     * ```
     */
    readonly affectedModules: Set<string>;
    /**
     * Current semantic version of the module.
     *
     * @remarks
     * The version is parsed into a SemVer object for structured access to
     * version components (major, minor, patch, prerelease, build metadata).
     *
     * This enables:
     * - Version comparison operations
     * - Version bumping (incrementing major/minor/patch)
     * - Prerelease and snapshot handling
     * - Version constraint validation
     *
     * @see {@link https://semver.org} for semantic versioning specification
     */
    readonly version: SemVer;
    /**
     * Indicates whether the version is explicitly declared in build configuration.
     *
     * @remarks
     * - **true**: Version is explicitly set in gradle.properties or equivalent
     * - **false**: Version is inherited from parent or uses default value
     *
     * This distinction is important for:
     * - Determining which modules to update during version bumps
     * - Identifying modules under active version management
     * - Avoiding overriding inherited versions
     * - Respecting user's versioning strategy
     *
     * @example
     * ```typescript
     * // Explicitly versioned module
     * { version: parseSemVer('1.0.0'), declaredVersion: true }
     *
     * // Inherited version from parent
     * { version: parseSemVer('1.0.0'), declaredVersion: false }
     * ```
     */
    readonly declaredVersion: boolean;
};
/**
 * Structured representation of project information after processing.
 *
 * @remarks
 * This type represents the fully processed and normalized project structure,
 * ready for use in version management operations. It provides efficient access
 * to module information through multiple access patterns.
 *
 * **Data Organization:**
 * - **Array of IDs**: For iteration and counting
 * - **Map of Modules**: For O(1) lookup by ID
 * - **Root Reference**: For quick access to the entry point
 *
 * **Usage Patterns:**
 * - Iterate all modules: Use `moduleIds` array
 * - Lookup specific module: Use `modules` Map
 * - Access root project: Use `rootModule` key in Map
 * - Check module existence: Check if key exists in Map
 *
 * @example
 * ```typescript
 * const projectInfo: ProjectInformation = {
 *   moduleIds: [':', ':app', ':lib:core'],
 *   modules: new Map([
 *     [':', rootModuleData],
 *     [':app', appModuleData],
 *     [':lib:core', coreModuleData]
 *   ]),
 *   rootModule: ':'
 * };
 *
 * // Iterate all modules
 * projectInfo.moduleIds.forEach(id => {
 *   const module = projectInfo.modules.get(id);
 *   console.log(`${module.name}: ${module.version}`);
 * });
 *
 * // Access root directly
 * const root = projectInfo.modules.get(projectInfo.rootModule);
 * ```
 */
export type ProjectInformation = {
    /**
     * Array of all module identifiers in the project.
     *
     * @remarks
     * Provides a list of all modules for iteration. The order may be significant
     * depending on the build system (e.g., dependency order, declaration order).
     *
     * Use this when you need to:
     * - Iterate over all modules
     * - Count total modules
     * - Process modules in sequence
     */
    readonly moduleIds: string[];
    /**
     * Map of module IDs to their complete module information.
     *
     * @remarks
     * Provides O(1) lookup of module information by ID. This is the primary
     * data structure for accessing module details during version management.
     *
     * The Map is readonly to prevent modifications after creation, ensuring
     * data consistency throughout the version management process.
     */
    readonly modules: ReadonlyMap<string, Module>;
    /**
     * The module ID of the root project.
     *
     * @remarks
     * Every project must have exactly one root module, which serves as the
     * top-level entry point. This is typically:
     * - `":"` for Gradle projects
     * - `"."` for other build systems
     *
     * Use this to:
     * - Access the root module quickly
     * - Start traversal of the module hierarchy
     * - Determine the base version for the entire project
     */
    readonly rootModule: string;
};
/**
 * Raw module data as extracted from the build system.
 *
 * @remarks
 * This type represents module information in its raw, unprocessed form as
 * returned by the build system (e.g., Gradle init script output). It contains
 * the same logical information as {@link Module} but in a simpler format
 * suitable for JSON serialization.
 *
 * **Key Differences from Module:**
 * - `affectedModules` is an array instead of a Set
 * - `version` is an optional string instead of a parsed SemVer object
 * - No computed or derived fields
 *
 * This raw format is later transformed into the structured {@link Module} type
 * for efficient processing.
 *
 * @see {@link Module} for the processed version of this data
 */
export type RawModule = {
    /**
     * Human-readable name of the module.
     */
    readonly name: string;
    /**
     * Relative path from repository root to the module directory.
     */
    readonly path: string;
    /**
     * Array of module IDs affected when this module changes.
     *
     * @remarks
     * This is an array in the raw format for easier JSON serialization.
     * It gets converted to a Set in the processed {@link Module} type.
     */
    readonly affectedModules: string[];
    /**
     * Version string if the module has a version.
     *
     * @remarks
     * Optional because not all modules may have explicit versions.
     * When present, should be a valid semantic version string.
     *
     * @example
     * - `"1.0.0"`
     * - `"2.5.3-SNAPSHOT"`
     * - `"0.1.0-alpha.1"`
     */
    readonly version?: string;
    /**
     * Type of the module in the project hierarchy.
     */
    readonly type: 'module' | 'root';
    /**
     * Whether the version is explicitly declared in build configuration.
     */
    readonly declaredVersion: boolean;
};
/**
 * Raw project structure information as extracted from the build system.
 *
 * @remarks
 * This type represents the complete project hierarchy in its raw form,
 * typically as JSON output from a build system introspection tool (e.g.,
 * Gradle init script). It maps module IDs to their raw module data.
 *
 * **Structure:**
 * - Keys: Module identifiers (`:`, `:app`, `:lib:core`, etc.)
 * - Values: {@link RawModule} data for each module
 *
 * **Processing:**
 * This raw structure is transformed into {@link ProjectInformation} through:
 * 1. Parsing version strings into SemVer objects
 * 2. Converting arrays to Sets for efficient lookup
 * 3. Validating required fields (e.g., root module existence)
 * 4. Creating indexed data structures (Maps)
 *
 * **Special Identifiers:**
 * - Root project: Usually `":"` for Gradle, may vary by build system
 * - Subprojects: Format depends on build system conventions
 *
 * @example
 * ```typescript
 * const rawInfo: RawProjectInformation = {
 *   ":": {
 *     name: "myproject",
 *     path: ".",
 *     affectedModules: [":app", ":lib"],
 *     version: "1.0.0",
 *     type: "root",
 *     declaredVersion: true
 *   },
 *   ":app": {
 *     name: "app",
 *     path: "app",
 *     affectedModules: [],
 *     version: "1.0.0",
 *     type: "module",
 *     declaredVersion: false
 *   }
 * };
 * ```
 *
 * @see {@link ProjectInformation} for the processed version of this data
 */
export type RawProjectInformation = {
    readonly [id: string]: RawModule;
};
//# sourceMappingURL=project-information.d.ts.map