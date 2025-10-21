/**
 * Version Bumper Service for VERSE
 *
 * This module implements the core version calculation logic for VERSE's semantic versioning
 * system. It handles the complete version bump workflow:
 *
 * 1. **Initial Bump Calculation**: Analyzes commits using Conventional Commits to determine
 *    the required version bump (major, minor, patch) for each module.
 *
 * 2. **Cascade Effect Processing**: Propagates version changes through module dependencies.
 *    When a module changes, dependent modules are automatically bumped according to
 *    configured dependency bump rules.
 *
 * 3. **Version Application**: Applies calculated bumps with support for:
 *    - Regular semantic versioning (1.0.0 → 1.1.0)
 *    - Prerelease versions (1.0.0 → 1.1.0-alpha.1)
 *    - Timestamp-based prereleases (1.1.0-alpha.20251021143022)
 *    - Build metadata (+sha.a1b2c3d)
 *    - Snapshot suffixes (-SNAPSHOT for Gradle)
 *
 * **Key Features**:
 * - **Monorepo Support**: Handles multiple modules with interdependencies
 * - **Flexible Versioning**: Supports regular releases, prereleases, and snapshots
 * - **Intelligent Cascading**: Automatically propagates changes through dependency graphs
 * - **Adapter-Aware**: Respects build system capabilities (e.g., Gradle snapshots)
 * - **Configurable Behavior**: Extensive options for different versioning strategies
 *
 * **Version Bump Workflow**:
 * ```
 * [Commits] → [Calculate Initial Bumps] → [Apply Cascade Effects] → [Apply Versions]
 *     ↓              ↓                            ↓                         ↓
 * Analyze      Determine bump            Propagate through         Format with
 * changes      for each module           dependencies              prerelease/metadata
 * ```
 *
 * **Change Reasons**:
 * - `commits`: Module has semantic commits requiring version bump
 * - `dependency`: Module bumped due to dependency version change
 * - `cascade`: Module bumped due to transitive dependency cascade
 * - `prerelease-unchanged`: Module included in prerelease despite no changes (bumpUnchanged)
 * - `build-metadata`: Module version unchanged but metadata added
 * - `gradle-snapshot`: Gradle snapshot suffix appended
 *
 * @module services/version-bumper
 * @see {@link VersionBumper} - Main class implementing version calculation logic
 * @see {@link ../semver/index} - Semantic versioning utilities
 * @see {@link ../utils/commits} - Commit analysis functions
 */
import { Config } from '../config/index.js';
import { ModuleRegistry } from './module-registry.js';
import { BumpType } from '../semver/index.js';
import { CommitInfo } from '../git/index.js';
import { SemVer } from 'semver';
import { AdapterMetadata } from './adapter-identifier.js';
import { Module } from '../adapters/project-information.js';
/**
 * Configuration options for the version bumper service.
 *
 * Controls all aspects of version calculation including prerelease modes,
 * build metadata, snapshot suffixes, and dependency handling.
 *
 * @property prereleaseMode - Enable prerelease version generation (e.g., 1.0.0-alpha.1).
 *                           When true, versions include prerelease identifiers.
 *
 * @property bumpUnchanged - Bump modules with no commits in prerelease mode.
 *                          Useful for including all modules in a prerelease even if unchanged.
 *
 * @property addBuildMetadata - Append git SHA as build metadata (+sha.a1b2c3d).
 *                             Build metadata doesn't affect version precedence.
 *
 * @property appendSnapshot - Append '-SNAPSHOT' suffix for Gradle compatibility.
 *                           Only applied if adapter supports snapshots.
 *
 * @property adapter - Build system adapter metadata with capability information.
 *                    Used to determine feature support (e.g., snapshot suffixes).
 *
 * @property timestampVersions - Generate timestamp-based prerelease IDs.
 *                              Creates versions like 1.0.0-alpha.20251021143022.
 *
 * @property prereleaseId - Prerelease identifier string (e.g., 'alpha', 'beta', 'rc').
 *                         Used as base for prerelease versions.
 *
 * @property repoRoot - Absolute path to repository root directory.
 *                     Used for git operations like retrieving commit SHA.
 *
 * @property config - VERSE configuration object with commit type mappings
 *                   and dependency bump rules.
 *
 * @example
 * **Standard Release Configuration**:
 * ```typescript
 * const options: VersionBumperOptions = {
 *   prereleaseMode: false,
 *   bumpUnchanged: false,
 *   addBuildMetadata: false,
 *   appendSnapshot: false,
 *   adapter: gradleAdapter,
 *   timestampVersions: false,
 *   prereleaseId: '',
 *   repoRoot: '/repo',
 *   config: verseConfig
 * };
 * // Produces: 1.0.0 → 1.1.0
 * ```
 *
 * @example
 * **Prerelease with Timestamps**:
 * ```typescript
 * const options: VersionBumperOptions = {
 *   prereleaseMode: true,
 *   bumpUnchanged: true,  // Include unchanged modules
 *   addBuildMetadata: true,
 *   appendSnapshot: false,
 *   adapter: gradleAdapter,
 *   timestampVersions: true,  // Use timestamps
 *   prereleaseId: 'alpha',
 *   repoRoot: '/repo',
 *   config: verseConfig
 * };
 * // Produces: 1.0.0 → 1.1.0-alpha.20251021143022+sha.a1b2c3d
 * ```
 *
 * @example
 * **Gradle Snapshot Mode**:
 * ```typescript
 * const options: VersionBumperOptions = {
 *   prereleaseMode: false,
 *   bumpUnchanged: false,
 *   addBuildMetadata: false,
 *   appendSnapshot: true,  // Gradle snapshots
 *   adapter: gradleAdapter,  // Must support snapshots
 *   timestampVersions: false,
 *   prereleaseId: '',
 *   repoRoot: '/repo',
 *   config: verseConfig
 * };
 * // Produces: 1.0.0 → 1.1.0-SNAPSHOT
 * ```
 */
export type VersionBumperOptions = {
    prereleaseMode: boolean;
    bumpUnchanged: boolean;
    addBuildMetadata: boolean;
    appendSnapshot: boolean;
    adapter: AdapterMetadata;
    timestampVersions: boolean;
    prereleaseId: string;
    repoRoot: string;
    config: Config;
};
/**
 * Final processed module version change result.
 *
 * This type represents a completed version calculation with all fields populated
 * and immutable. It's the output of the version bumper process and is used by
 * downstream services to apply version updates.
 *
 * Unlike `ProcessingModuleChange`, this type:
 * - Has all fields as `readonly`
 * - Always has `toVersion` populated
 * - Never has reason 'unchanged' (filtered out)
 * - Represents modules that definitely need version updates
 *
 * @property module - The module with calculated version change (immutable).
 *
 * @property fromVersion - Original semantic version before changes.
 *                        Example: SemVer('1.0.0')
 *
 * @property toVersion - New calculated version string.
 *                      Example: '1.1.0', '1.1.0-alpha.1', '1.1.0-SNAPSHOT'
 *
 * @property bumpType - Final bump type applied ('major', 'minor', 'patch', or 'none').
 *                     'none' indicates version format changed without semantic bump
 *                     (e.g., adding build metadata or snapshot suffix).
 *
 * @property reason - Reason for version change. Never 'unchanged'.
 *
 * @example
 * **Commit-Based Change**:
 * ```typescript
 * const change: ProcessedModuleChange = {
 *   module: { id: 'api', name: 'API', path: '/api', version: SemVer('1.0.0') },
 *   fromVersion: SemVer('1.0.0'),
 *   toVersion: '1.1.0',
 *   bumpType: 'minor',
 *   reason: 'commits'
 * };
 * ```
 *
 * @example
 * **Cascade Effect Change**:
 * ```typescript
 * const change: ProcessedModuleChange = {
 *   module: { id: 'web', name: 'Web', path: '/web', version: SemVer('2.0.0') },
 *   fromVersion: SemVer('2.0.0'),
 *   toVersion: '2.0.1',
 *   bumpType: 'patch',
 *   reason: 'cascade'  // Bumped because dependency changed
 * };
 * ```
 *
 * @example
 * **Prerelease with Metadata**:
 * ```typescript
 * const change: ProcessedModuleChange = {
 *   module: { id: 'core', name: 'Core', path: '/core', version: SemVer('3.0.0') },
 *   fromVersion: SemVer('3.0.0'),
 *   toVersion: '3.1.0-alpha.20251021143022+sha.a1b2c3d',
 *   bumpType: 'minor',
 *   reason: 'commits'
 * };
 * ```
 *
 * @see {@link ProcessingModuleChange} - Internal mutable version during calculation
 * @see {@link ChangeReason} - Possible reasons for version changes
 */
export type ProcessedModuleChange = {
    readonly module: Module;
    readonly fromVersion: SemVer;
    readonly toVersion: string;
    readonly bumpType: BumpType;
    readonly reason: ChangeReason;
};
/**
 * Reason why a module's version is being changed.
 *
 * This type categorizes version changes into distinct reasons, which is useful for:
 * - Logging and transparency (understanding why versions changed)
 * - Debugging version calculation issues
 * - Generating changelogs with context
 * - Audit trails and compliance
 *
 * **Change Reason Categories**:
 *
 * - **`'commits'`**: Module has Conventional Commits requiring a version bump.
 *   This is the primary reason for version changes based on actual code changes.
 *   Example: feat: or fix: commits.
 *
 * - **`'dependency'`**: Module version changed because a direct dependency changed.
 *   The module itself has no commits, but a dependency it uses was updated.
 *   Example: Module A uses Module B, B changed, so A needs updating.
 *
 * - **`'cascade'`**: Module version changed due to transitive dependency effects.
 *   Similar to 'dependency' but for indirect dependencies through the dependency graph.
 *   Example: A → B → C, C changed, causing B to change, cascading to A.
 *
 * - **`'prerelease-unchanged'`**: Module included in prerelease despite no changes.
 *   Occurs when `bumpUnchanged` is enabled in prerelease mode to version all modules together.
 *   Example: Creating alpha.1 release for all modules even if some are unchanged.
 *
 * - **`'build-metadata'`**: Version unchanged but build metadata added.
 *   The semantic version number stays the same, only metadata (+sha.xxx) is appended.
 *   Example: 1.0.0 → 1.0.0+sha.a1b2c3d
 *
 * - **`'gradle-snapshot'`**: Gradle snapshot suffix appended to version.
 *   Module version format changed to include -SNAPSHOT for Gradle compatibility.
 *   Example: 1.0.0 → 1.0.0-SNAPSHOT
 *
 * @example
 * **Interpreting Change Reasons**:
 * ```typescript
 * function logVersionChange(change: ProcessedModuleChange) {
 *   switch (change.reason) {
 *     case 'commits':
 *       console.log(`${change.module.name}: Updated due to commits`);
 *       break;
 *     case 'cascade':
 *       console.log(`${change.module.name}: Updated due to dependency changes`);
 *       break;
 *     case 'prerelease-unchanged':
 *       console.log(`${change.module.name}: Included in prerelease (no changes)`);
 *       break;
 *     case 'build-metadata':
 *       console.log(`${change.module.name}: Build metadata added only`);
 *       break;
 *     case 'gradle-snapshot':
 *       console.log(`${change.module.name}: Snapshot suffix added`);
 *       break;
 *   }
 * }
 * ```
 *
 * @example
 * **Filtering by Reason**:
 * ```typescript
 * // Get only modules with actual code changes
 * const codeChanges = changes.filter(c =>
 *   c.reason === 'commits' || c.reason === 'cascade'
 * );
 *
 * // Get modules with formatting changes only
 * const formatChanges = changes.filter(c =>
 *   c.reason === 'build-metadata' || c.reason === 'gradle-snapshot'
 * );
 * ```
 *
 * @see {@link ProcessedModuleChange} - Contains the reason field
 */
export type ChangeReason = 'commits' | 'dependency' | 'cascade' | 'prerelease-unchanged' | 'build-metadata' | 'gradle-snapshot';
/**
 * Service for calculating version bumps across modules.
 *
 * This class implements the core version bump algorithm for VERSE, handling:
 * - Analyzing commits to determine required version changes
 * - Propagating changes through module dependency graphs
 * - Applying various versioning strategies (regular, prerelease, snapshot)
 * - Respecting build system capabilities and constraints
 *
 * **Version Bump Process**:
 * ```
 * calculateVersionBumps()
 *   ↓
 * calculateInitialBumps()      → Analyze commits for each module
 *   ↓
 * calculateCascadeEffects()    → Propagate changes through dependencies
 *   ↓
 * applyVersionCalculations()   → Format final versions with metadata
 * ```
 *
 * The class is designed to be stateless for each calculation - all state is passed
 * through method parameters and the constructor options.
 *
 * @example
 * **Basic Usage**:
 * ```typescript
 * import { VersionBumper } from './services/version-bumper.js';
 * import { ModuleRegistry } from './services/module-registry.js';
 *
 * // Set up module registry
 * const registry = new ModuleRegistry([...modules]);
 *
 * // Configure version bumper
 * const bumper = new VersionBumper(registry, {
 *   prereleaseMode: false,
 *   bumpUnchanged: false,
 *   addBuildMetadata: false,
 *   appendSnapshot: false,
 *   adapter: gradleAdapter,
 *   timestampVersions: false,
 *   prereleaseId: '',
 *   repoRoot: '/repo',
 *   config: verseConfig
 * });
 *
 * // Calculate version bumps
 * const moduleCommits = new Map([
 *   ['module-a', [commit1, commit2]],
 *   ['module-b', [commit3]]
 * ]);
 *
 * const changes = await bumper.calculateVersionBumps(moduleCommits);
 * // Result: [{ module, fromVersion, toVersion, bumpType, reason }, ...]
 * ```
 *
 * @example
 * **Prerelease Workflow**:
 * ```typescript
 * // Configure for alpha prerelease
 * const bumper = new VersionBumper(registry, {
 *   prereleaseMode: true,
 *   bumpUnchanged: true,  // Include all modules
 *   addBuildMetadata: true,
 *   appendSnapshot: false,
 *   adapter: gradleAdapter,
 *   timestampVersions: true,
 *   prereleaseId: 'alpha',
 *   repoRoot: '/repo',
 *   config: verseConfig
 * });
 *
 * const changes = await bumper.calculateVersionBumps(moduleCommits);
 * // Versions like: 1.1.0-alpha.20251021143022+sha.a1b2c3d
 * ```
 *
 * @see {@link calculateVersionBumps} - Main entry point for version calculation
 * @see {@link VersionBumperOptions} - Configuration options
 * @see {@link ProcessedModuleChange} - Output format
 */
export declare class VersionBumper {
    private readonly moduleRegistry;
    private readonly options;
    /**
     * Creates a new VersionBumper instance.
     *
     * @param moduleRegistry - Registry containing all modules and their interdependencies.
     *                        Used to look up module information and dependency graphs.
     *
     * @param options - Configuration options controlling version bump behavior.
     *                 See {@link VersionBumperOptions} for detailed option descriptions.
     *
     * @example
     * ```typescript
     * const bumper = new VersionBumper(moduleRegistry, {
     *   prereleaseMode: false,
     *   bumpUnchanged: false,
     *   addBuildMetadata: true,
     *   appendSnapshot: false,
     *   adapter: gradleAdapter,
     *   timestampVersions: false,
     *   prereleaseId: '',
     *   repoRoot: '/repo',
     *   config: verseConfig
     * });
     * ```
     */
    constructor(moduleRegistry: ModuleRegistry, options: VersionBumperOptions);
    /**
     * Calculates version bumps for all modules based on their commits.
     *
     * This is the main entry point for version calculation. It orchestrates a three-phase
     * process to determine final versions:
     *
     * **Phase 1 - Initial Bumps**: Analyzes commits for each module using Conventional Commits
     * to determine the required version bump type (major, minor, patch, none).
     *
     * **Phase 2 - Cascade Effects**: Propagates version changes through the dependency graph.
     * When a module changes, its dependents are automatically bumped according to configured
     * dependency bump rules.
     *
     * **Phase 3 - Version Application**: Applies version bumps with support for:
     * - Regular semantic versioning (1.0.0 → 1.1.0)
     * - Prerelease versions (1.0.0 → 1.1.0-alpha.1)
     * - Timestamp-based prereleases (1.1.0-alpha.20251021143022)
     * - Build metadata (+sha.a1b2c3d)
     * - Snapshot suffixes (-SNAPSHOT)
     *
     * @param moduleCommits - Map of module IDs to their commits since last version.
     *                       Key: Module ID (string)
     *                       Value: Array of parsed commits following Conventional Commits spec
     *
     * @returns Promise resolving to array of processed module changes.
     *          Only includes modules that require version updates.
     *          Modules with no changes are filtered out unless `bumpUnchanged` is enabled.
     *
     * @throws {Error} If git operations fail (e.g., retrieving commit SHA).
     *
     * @remarks
     * **Timestamp Prerelease IDs**:
     * When `timestampVersions` is enabled in prerelease mode, the prerelease ID is
     * augmented with a timestamp. For example, `alpha` becomes `alpha.20251021143022`.
     * This ensures each prerelease has a unique, sortable version.
     *
     * **Build Metadata**:
     * When `addBuildMetadata` is enabled, the current commit's short SHA is retrieved
     * and appended to versions as build metadata (+sha.xxx). This doesn't affect
     * version precedence but provides traceability.
     *
     * **Filtering Logic**:
     * The method returns only modules with `needsProcessing: true`. Modules can be
     * marked for processing due to:
     * - Having commits requiring version changes
     * - Being in prerelease mode with `bumpUnchanged` enabled
     * - Having `addBuildMetadata` enabled (all modules get metadata)
     * - Cascade effects from dependency changes
     *
     * **Performance**:
     * For large monorepos with many modules, the cascade calculation uses efficient
     * algorithms (O(V + E) where V = modules, E = dependencies) to handle complex
     * dependency graphs.
     *
     * @example
     * **Basic Version Bump Calculation**:
     * ```typescript
     * import { VersionBumper } from './services/version-bumper.js';
     * import { getCommitsSinceLastTag } from './git/index.js';
     *
     * // Get commits for each module
     * const moduleCommits = new Map([
     *   ['api', [
     *     { type: 'feat', header: 'feat: add users endpoint', ... },
     *     { type: 'fix', header: 'fix: handle errors', ... }
     *   ]],
     *   ['web', [
     *     { type: 'docs', header: 'docs: update README', ... }
     *   ]]
     * ]);
     *
     * // Calculate version bumps
     * const bumper = new VersionBumper(registry, options);
     * const changes = await bumper.calculateVersionBumps(moduleCommits);
     *
     * // Result:
     * // [
     * //   {
     * //     module: { id: 'api', ... },
     * //     fromVersion: SemVer('1.0.0'),
     * //     toVersion: '1.1.0',
     * //     bumpType: 'minor',
     * //     reason: 'commits'
     * //   }
     * // ]
     * // Note: 'web' not included - docs commit doesn't require version bump
     * ```
     *
     * @example
     * **Prerelease with Timestamps**:
     * ```typescript
     * const bumper = new VersionBumper(registry, {
     *   prereleaseMode: true,
     *   timestampVersions: true,
     *   prereleaseId: 'alpha',
     *   bumpUnchanged: true,  // Include all modules
     *   addBuildMetadata: true,
     *   // ... other options
     * });
     *
     * const changes = await bumper.calculateVersionBumps(moduleCommits);
     * // Generated timestamp prerelease ID: alpha.20251021143022
     * // Build metadata includes: +sha.a1b2c3d
     *
     * // Result versions:
     * // 1.0.0 → 1.1.0-alpha.20251021143022+sha.a1b2c3d
     * ```
     *
     * @example
     * **Cascade Effect Demonstration**:
     * ```typescript
     * // Module structure:
     * // api (1.0.0) → core (1.0.0)
     * // web (1.0.0) → api (1.0.0)
     *
     * const moduleCommits = new Map([
     *   ['core', [{ type: 'feat', ... }]],  // Core gets feat commit
     *   ['api', []],  // API has no commits
     *   ['web', []]   // Web has no commits
     * ]);
     *
     * const changes = await bumper.calculateVersionBumps(moduleCommits);
     *
     * // Result:
     * // [
     * //   { module: 'core', toVersion: '1.1.0', reason: 'commits' },
     * //   { module: 'api', toVersion: '1.0.1', reason: 'cascade' },
     * //   { module: 'web', toVersion: '1.0.1', reason: 'cascade' }
     * // ]
     * // Cascade propagates: core → api → web
     * ```
     *
     * @example
     * **Gradle Snapshot Mode**:
     * ```typescript
     * const bumper = new VersionBumper(registry, {
     *   prereleaseMode: false,
     *   appendSnapshot: true,
     *   adapter: gradleAdapter,  // Must support snapshots
     *   // ... other options
     * });
     *
     * const changes = await bumper.calculateVersionBumps(moduleCommits);
     * // Result versions: 1.0.0 → 1.1.0-SNAPSHOT
     * ```
     *
     * @example
     * **Processing Results**:
     * ```typescript
     * const changes = await bumper.calculateVersionBumps(moduleCommits);
     *
     * console.log(`Calculated versions for ${changes.length} modules`);
     *
     * for (const change of changes) {
     *   console.log(`${change.module.name}:`);
     *   console.log(`  ${change.fromVersion.version} → ${change.toVersion}`);
     *   console.log(`  Bump: ${change.bumpType}`);
     *   console.log(`  Reason: ${change.reason}`);
     * }
     * ```
     *
     * @see {@link calculateInitialBumps} - Phase 1: Initial bump calculation
     * @see {@link calculateCascadeEffects} - Phase 2: Dependency cascade
     * @see {@link applyVersionCalculations} - Phase 3: Version formatting
     * @see {@link ../utils/commits.calculateBumpFromCommits} - Commit analysis
     */
    calculateVersionBumps(moduleCommits: Map<string, CommitInfo[]>): Promise<ProcessedModuleChange[]>;
    /**
     * Calculates initial version bump types for all modules based on commits.
     *
     * This is Phase 1 of the version calculation process. It analyzes commits for each
     * module to determine the required version bump type using Conventional Commits
     * specification.
     *
     * The method creates a `ProcessingModuleChange` for **every** module in the registry,
     * not just those with commits. The `needsProcessing` flag determines which modules
     * will ultimately be updated.
     *
     * **Processing Decision Logic**:
     * - Module has commits requiring bump: `needsProcessing = true, reason = 'commits'`
     * - Prerelease mode with bumpUnchanged: `needsProcessing = true, reason = 'prerelease-unchanged'`
     * - Build metadata enabled: `needsProcessing = true, reason = 'build-metadata'`
     * - Otherwise: `needsProcessing = false, reason = 'unchanged'`
     *
     * @param moduleCommits - Map of module IDs to their commits since last version.
     *
     * @returns Array of processing module changes for **all** modules in the registry.
     *          Each change includes initial bump type and processing requirements.
     *
     * @remarks
     * **Why Include All Modules?**:
     * Even modules with no commits are included because:
     * - Cascade effects may require them to be bumped later
     * - Build metadata mode needs to update all modules
     * - Prerelease mode with bumpUnchanged needs all modules
     *
     * The `needsProcessing` flag acts as a filter - only modules with this flag
     * set to true will appear in the final output.
     *
     * **Bump Type Determination**:
     * Uses `calculateBumpFromCommits()` which analyzes commit types according to
     * Conventional Commits:
     * - `feat:` → minor bump
     * - `fix:` → patch bump
     * - `feat!:` or `BREAKING CHANGE:` → major bump
     * - Other types → no bump
     *
     * @example
     * **Module with Commits**:
     * ```typescript
     * const moduleCommits = new Map([
     *   ['api', [{ type: 'feat', ... }, { type: 'fix', ... }]]
     * ]);
     *
     * const changes = this.calculateInitialBumps(moduleCommits);
     * // Result for 'api':
     * // {
     * //   module: { id: 'api', ... },
     * //   fromVersion: SemVer('1.0.0'),
     * //   toVersion: '',  // Not yet calculated
     * //   bumpType: 'minor',  // Highest bump from commits
     * //   reason: 'commits',
     * //   needsProcessing: true
     * // }
     * ```
     *
     * @example
     * **Module without Commits (Normal Mode)**:
     * ```typescript
     * // options.prereleaseMode = false
     * // options.addBuildMetadata = false
     *
     * const moduleCommits = new Map([['web', []]]);
     * const changes = this.calculateInitialBumps(moduleCommits);
     * // Result for 'web':
     * // {
     * //   bumpType: 'none',
     * //   reason: 'unchanged',
     * //   needsProcessing: false  // Will be filtered out
     * // }
     * ```
     *
     * @example
     * **Module without Commits (Prerelease Mode with bumpUnchanged)**:
     * ```typescript
     * // options.prereleaseMode = true
     * // options.bumpUnchanged = true
     *
     * const moduleCommits = new Map([['web', []]]);
     * const changes = this.calculateInitialBumps(moduleCommits);
     * // Result for 'web':
     * // {
     * //   bumpType: 'none',
     * //   reason: 'prerelease-unchanged',
     * //   needsProcessing: true  // Included in prerelease
     * // }
     * ```
     *
     * @example
     * **Module without Commits (Build Metadata Mode)**:
     * ```typescript
     * // options.addBuildMetadata = true
     *
     * const moduleCommits = new Map([['web', []]]);
     * const changes = this.calculateInitialBumps(moduleCommits);
     * // Result for 'web':
     * // {
     * //   bumpType: 'none',
     * //   reason: 'build-metadata',
     * //   needsProcessing: true  // Needs metadata update
     * // }
     * ```
     *
     * @see {@link calculateBumpFromCommits} - Analyzes commits to determine bump type
     * @see {@link calculateCascadeEffects} - Next phase: propagate changes
     */
    private calculateInitialBumps;
    /**
     * Calculates cascade effects when modules change.
     *
     * This is Phase 2 of the version calculation process. It propagates version changes
     * through the module dependency graph, ensuring that when a module changes, all
     * modules that depend on it are also bumped appropriately.
     *
     * **Algorithm**: Uses a breadth-first traversal of the dependency graph:
     * 1. Start with all modules marked for processing (needsProcessing = true)
     * 2. For each module being processed, find all modules that depend on it
     * 3. Calculate required bump for dependents using dependency bump rules
     * 4. If dependent needs a higher bump, update it and add to processing queue
     * 5. Continue until no more cascades are needed
     *
     * **Complexity**: O(V + E) where V = number of modules, E = number of dependencies
     *
     * **In-Place Modification**: This method modifies the input array in place for
     * efficiency. The same array reference is returned with cascade effects applied.
     *
     * @param allModuleChanges - Array of all module changes (will be modified in place).
     *                          Should include all modules from calculateInitialBumps().
     *
     * @returns The same array with cascade effects applied.
     *          Modules may have updated bumpType, reason, and needsProcessing flags.
     *
     * @remarks
     * **Cascade Logic**:
     * When Module A depends on Module B, and B changes:
     * - B's bump type determines required bump for A
     * - Bump rules from config specify how changes propagate
     * - Example: minor change in B might require patch bump in A
     *
     * **Bump Type Merging**:
     * If a module is affected by multiple dependencies:
     * - Takes the maximum bump type required
     * - Uses `maxBumpType()` to determine: major > minor > patch > none
     *
     * **Processing Optimization**:
     * - Already processed modules are skipped (tracked in `processed` Set)
     * - Modules with no processing needed are skipped
     * - Modules with 'none' bump type don't trigger cascades
     * - Uses Map for O(1) module lookups
     *
     * @example
     * **Simple Cascade**:
     * ```typescript
     * // Dependency: web → api → core
     * // Initial: core has 'minor' bump, api and web have 'none'
     *
     * const changes = [
     *   { module: core, bumpType: 'minor', needsProcessing: true, reason: 'commits' },
     *   { module: api, bumpType: 'none', needsProcessing: false, reason: 'unchanged' },
     *   { module: web, bumpType: 'none', needsProcessing: false, reason: 'unchanged' }
     * ];
     *
     * const cascaded = this.calculateCascadeEffects(changes);
     * // Result:
     * // core: bumpType='minor', reason='commits'
     * // api: bumpType='patch', reason='cascade' (bumped due to core)
     * // web: bumpType='patch', reason='cascade' (bumped due to api)
     * ```
     *
     * @example
     * **Multiple Dependencies**:
     * ```typescript
     * // Dependencies:
     * // app → [ui, api]
     * // ui has 'minor' bump, api has 'patch' bump
     *
     * const changes = [
     *   { module: ui, bumpType: 'minor', needsProcessing: true },
     *   { module: api, bumpType: 'patch', needsProcessing: true },
     *   { module: app, bumpType: 'none', needsProcessing: false }
     * ];
     *
     * const cascaded = this.calculateCascadeEffects(changes);
     * // app: bumpType='minor' (max of minor and patch)
     * //      reason='cascade'
     * ```
     *
     * @example
     * **No Cascade Needed**:
     * ```typescript
     * // Module with no dependents
     * const changes = [
     *   { module: standalone, bumpType: 'minor', needsProcessing: true }
     * ];
     *
     * const cascaded = this.calculateCascadeEffects(changes);
     * // No changes - standalone has no dependents
     * ```
     *
     * @example
     * **Diamond Dependency**:
     * ```typescript
     * // Dependencies:
     * //     app
     * //    /   \\
     * //  ui     api
     * //    \\   /
     * //    core
     * // core changes with 'minor' bump
     *
     * const cascaded = this.calculateCascadeEffects(changes);
     * // core: 'minor', reason='commits'
     * // ui: 'patch', reason='cascade'
     * // api: 'patch', reason='cascade'
     * // app: 'patch', reason='cascade' (processed only once despite two paths)
     * ```
     *
     * @see {@link getDependencyBumpType} - Determines required bump for dependents
     * @see {@link maxBumpType} - Merges multiple bump types
     * @see {@link applyVersionCalculations} - Next phase: apply version formats
     */
    private calculateCascadeEffects;
    /**
     * Applies version calculations and transformations to all modules.
     *
     * This is Phase 3 (final) of the version calculation process. It takes modules
     * with calculated bump types and applies version transformations including:
     * - Semantic version bumping (major, minor, patch)
     * - Prerelease version generation
     * - Build metadata appending
     * - Snapshot suffix appending
     *
     * **Version Application Scenarios**:
     * 1. **Commits + Regular Mode**: Bump semantic version normally
     * 2. **Commits + Prerelease Mode**: Bump to prerelease version
     * 3. **No Commits + Prerelease + bumpUnchanged**: Force prerelease bump
     * 4. **Build Metadata Mode**: Append git SHA as metadata
     * 5. **Snapshot Mode**: Append -SNAPSHOT suffix
     *
     * @param processingModuleChanges - All module changes with calculated bump types
     *                                 from cascade effects phase.
     *
     * @param effectivePrereleaseId - Prerelease identifier to use (may include timestamp).
     *                               Example: 'alpha', 'alpha.20251021143022'
     *
     * @param shortSha - Optional git commit short SHA for build metadata.
     *                  Example: 'a1b2c3d'
     *
     * @returns Array of processed module changes ready for application.
     *          Only includes modules with `needsProcessing = true`.
     *          Filtered to remove modules with no changes.
     *
     * @remarks
     * **Version Format Examples**:
     * - Regular: 1.0.0 → 1.1.0
     * - Prerelease: 1.0.0 → 1.1.0-alpha.1
     * - With metadata: 1.1.0 → 1.1.0+sha.a1b2c3d
     * - Snapshot: 1.1.0 → 1.1.0-SNAPSHOT
     * - Combined: 1.0.0 → 1.1.0-alpha.20251021143022+sha.a1b2c3d
     *
     * **Snapshot Suffix Handling**:
     * Snapshots are applied last and only if:
     * - `appendSnapshot` option is enabled
     * - Adapter supports snapshots capability
     *
     * If snapshot suffix is added to a module that wasn't being processed,
     * it's marked for processing with reason 'gradle-snapshot'.
     *
     * **Filtering Logic**:
     * Only modules with `needsProcessing = true` appear in final output.
     * This ensures unchanged modules don't get version updates.
     *
     * @example
     * **Regular Version Bump**:
     * ```typescript
     * const changes = [{
     *   module: api,
     *   fromVersion: SemVer('1.0.0'),
     *   bumpType: 'minor',
     *   needsProcessing: true,
     *   reason: 'commits'
     * }];
     *
     * // options.prereleaseMode = false
     * const result = this.applyVersionCalculations(changes, '', undefined);
     * // result[0].toVersion = '1.1.0'
     * ```
     *
     * @example
     * **Prerelease Version**:
     * ```typescript
     * const changes = [{
     *   module: api,
     *   fromVersion: SemVer('1.0.0'),
     *   bumpType: 'minor',
     *   needsProcessing: true,
     *   reason: 'commits'
     * }];
     *
     * // options.prereleaseMode = true
     * const result = this.applyVersionCalculations(changes, 'alpha.20251021143022', 'a1b2c3d');
     * // result[0].toVersion = '1.1.0-alpha.20251021143022+sha.a1b2c3d'
     * ```
     *
     * @example
     * **Force Prerelease (No Commits)**:
     * ```typescript
     * const changes = [{
     *   module: api,
     *   fromVersion: SemVer('1.0.0'),
     *   bumpType: 'none',
     *   needsProcessing: true,
     *   reason: 'prerelease-unchanged'
     * }];
     *
     * // options.prereleaseMode = true, options.bumpUnchanged = true
     * const result = this.applyVersionCalculations(changes, 'alpha', undefined);
     * // result[0].toVersion = '1.0.0-alpha.1' (no semantic bump, just prerelease)
     * ```
     *
     * @example
     * **Build Metadata Only**:
     * ```typescript
     * const changes = [{
     *   module: api,
     *   fromVersion: SemVer('1.0.0'),
     *   bumpType: 'none',
     *   needsProcessing: true,
     *   reason: 'build-metadata'
     * }];
     *
     * const result = this.applyVersionCalculations(changes, '', 'a1b2c3d');
     * // result[0].toVersion = '1.0.0+sha.a1b2c3d' (version unchanged, metadata added)
     * ```
     *
     * @example
     * **Gradle Snapshot**:
     * ```typescript
     * const changes = [{
     *   module: api,
     *   fromVersion: SemVer('1.0.0'),
     *   bumpType: 'minor',
     *   needsProcessing: true,
     *   reason: 'commits'
     * }];
     *
     * // options.appendSnapshot = true, adapter supports snapshots
     * const result = this.applyVersionCalculations(changes, '', undefined);
     * // result[0].toVersion = '1.1.0-SNAPSHOT'
     * ```
     *
     * @example
     * **Filtering Unchanged Modules**:
     * ```typescript
     * const changes = [
     *   { module: api, bumpType: 'minor', needsProcessing: true, ... },
     *   { module: web, bumpType: 'none', needsProcessing: false, ... }
     * ];
     *
     * const result = this.applyVersionCalculations(changes, '', undefined);
     * // result.length = 1 (only api, web filtered out)
     * ```
     *
     * @see {@link bumpSemVer} - Regular semantic version bumping
     * @see {@link bumpToPrerelease} - Prerelease version generation
     * @see {@link addBuildMetadata} - Build metadata appending
     * @see {@link applySnapshotSuffix} - Snapshot suffix appending
     */
    private applyVersionCalculations;
}
//# sourceMappingURL=version-bumper.d.ts.map