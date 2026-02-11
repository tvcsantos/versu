/**
 * Version Bumper Service for VERSU.
 * Implements core version calculation logic: analyzes commits, cascades changes through
 * dependencies, and applies versions with support for prereleases, metadata, and snapshots.
 */

import { logger } from "../utils/logger.js";
import { Config, getDependencyBumpType } from "../config/index.js";
import { ModuleRegistry } from "./module-registry.js";
import { calculateBumpFromCommits } from "../utils/commits.js";
import {
  bumpSemVer,
  bumpToPrerelease,
  formatSemVer,
  addBuildMetadata,
  generateTimestampPrereleaseId,
  maxBumpType,
  BumpType,
} from "../semver/index.js";
import { getCurrentCommitShortSha } from "../git/index.js";
import { SemVer } from "semver";
import { AdapterMetadata } from "./adapter-identifier.js";
import { applySnapshotSuffix } from "../utils/versioning.js";
import { Module } from "../adapters/project-information.js";
import { Commit } from "conventional-commits-parser";

/**
 * Configuration options for the version bumper service.
 */
export type VersionBumperOptions = {
  /** Whether to generate prerelease versions (e.g., 1.0.0-alpha.1). */
  prereleaseMode: boolean;
  /** Whether to bump versions of unchanged modules in prerelease mode. */
  bumpUnchanged: boolean;
  /** Whether to add build metadata (commit SHA) to versions. */
  addBuildMetadata: boolean;
  /** Whether to append -SNAPSHOT suffix for Gradle projects. */
  appendSnapshot: boolean;
  /** Adapter metadata providing project-specific capabilities. */
  adapter: AdapterMetadata;
  /** Whether to include timestamps in prerelease identifiers. */
  timestampVersions: boolean;
  /** Base prerelease identifier (e.g., 'alpha', 'beta', 'rc'). */
  prereleaseId: string;
  /** Absolute path to the repository root directory. */
  repoRoot: string;
  /** Project configuration including dependency bump rules. */
  config: Config;
};

/**
 * Internal representation of a module version change during processing.
 * Tracks mutable state as cascade effects are calculated.
 * @internal
 */
type ProcessingModuleChange = {
  /** The module being processed. */
  readonly module: Module;
  /** Original version before any changes. */
  readonly fromVersion: SemVer;
  /** Calculated new version string (initially empty, populated in final phase). */
  toVersion: string;
  /** Type of version bump to apply (can be upgraded during cascade processing). */
  bumpType: BumpType;
  /** Why this module's version is changing ('unchanged' indicates no processing needed). */
  reason: ChangeReason | "unchanged";
  /** Whether this module requires a version update. */
  needsProcessing: boolean;
};

/**
 * Final processed module version change result.
 * Represents a completed version calculation ready for application.
 */
export type ProcessedModuleChange = {
  /** The module with calculated version change. */
  readonly module: Module;
  /** Original semantic version before changes. */
  readonly fromVersion: SemVer;
  /** New calculated version string (e.g., '1.1.0', '1.1.0-alpha.1', '1.1.0-SNAPSHOT'). */
  readonly toVersion: string;
  /** Final bump type applied ('major', 'minor', 'patch', or 'none'). */
  readonly bumpType: BumpType;
  /** Reason for version change. */
  readonly reason: ChangeReason;
};

/**
 * Reason why a module's version is being changed.
 */
export type ChangeReason =
  | "commits" // Has Conventional Commits requiring a bump
  | "dependency" // Direct dependency changed
  | "cascade" // Transitive dependency changed
  | "prerelease-unchanged" // Included in prerelease despite no changes (bumpUnchanged enabled)
  | "build-metadata" // Build metadata added only
  | "gradle-snapshot"; // Gradle snapshot suffix appended

/**
 * Service for calculating version bumps across modules.
 * Handles commit analysis, dependency cascade effects, and various versioning strategies
 * (regular, prerelease, snapshot).
 */
export class VersionBumper {
  /**
   * Creates a new VersionBumper instance.
   * @param moduleRegistry - Registry containing all modules and their interdependencies
   * @param options - Configuration options controlling version bump behavior
   */
  constructor(
    private readonly moduleRegistry: ModuleRegistry,
    private readonly options: VersionBumperOptions,
  ) {}

  /**
   * Calculates version bumps for all modules based on their commits.
   * Orchestrates a three-phase process: initial bumps (commit analysis), cascade effects (dependency propagation),
   * and version application (applying strategies like prerelease, timestamps, build metadata).
   * @param moduleCommits - Map of module IDs to their commits since last version
   * @returns Promise resolving to array of processed module changes (only modules that need updates)
   * @throws {Error} If git operations fail
   */
  async calculateVersionBumps(
    moduleCommits: Map<string, { commits: Commit[]; lastTag: string | null }>,
  ): Promise<ProcessedModuleChange[]> {
    logger.info("🔢 Calculating version bumps from commits...");

    // Generate timestamp-based prerelease ID if timestamp versions are enabled
    let effectivePrereleaseId = this.options.prereleaseId;
    if (this.options.timestampVersions && this.options.prereleaseMode) {
      effectivePrereleaseId = generateTimestampPrereleaseId(
        this.options.prereleaseId,
      );
      logger.info(
        `🕐 Generated timestamp prerelease ID: ${effectivePrereleaseId}`,
      );
    }

    // Get current commit short SHA if build metadata is enabled
    let shortSha: string | undefined;
    if (this.options.addBuildMetadata) {
      shortSha = await getCurrentCommitShortSha({ cwd: this.options.repoRoot });
      logger.info(`📋 Build metadata will include short SHA: ${shortSha}`);
    }

    // Step 1: Calculate initial bump types for all modules
    const processingModuleChanges = this.calculateInitialBumps(moduleCommits);

    // Step 2: Calculate cascade effects
    logger.info("🌊 Calculating cascade effects...");
    const cascadedChanges = this.calculateCascadeEffects(
      processingModuleChanges,
    );

    // Step 3: Apply version calculations and transformations
    logger.info("🔢 Calculating actual versions...");
    return this.applyVersionCalculations(
      cascadedChanges,
      effectivePrereleaseId,
      shortSha,
    );
  }

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
   * @returns Array of processing module changes for all modules in the registry
   */
  private calculateInitialBumps(
    moduleCommits: Map<string, { commits: Commit[]; lastTag: string | null }>,
  ): ProcessingModuleChange[] {
    const processingModuleChanges: ProcessingModuleChange[] = [];

    // Iterate through ALL modules in the registry
    for (const [projectId, projectInfo] of this.moduleRegistry.getModules()) {
      const commits = moduleCommits.get(projectId)?.commits || [];

      // Determine bump type from commits only
      // Uses Conventional Commits spec to analyze commit types
      const bumpType = calculateBumpFromCommits(commits, this.options.config);

      // Determine processing requirements and reason
      let reason: ChangeReason | "unchanged" = "unchanged";
      let needsProcessing = false;

      if (bumpType !== "none") {
        // Module has commits that require version changes
        needsProcessing = true;
        reason = "commits";
      } else if (this.options.prereleaseMode && this.options.bumpUnchanged) {
        // Prerelease mode with bumpUnchanged - include modules with no changes
        needsProcessing = true;
        reason = "prerelease-unchanged";
      } else if (this.options.addBuildMetadata) {
        // Build metadata mode - all modules need updates for metadata
        needsProcessing = true;
        reason = "build-metadata";
      }

      // Create module change for ALL modules - processing flag determines behavior
      processingModuleChanges.push({
        module: projectInfo,
        fromVersion: projectInfo.version,
        toVersion: "", // Will be calculated later
        bumpType: bumpType,
        reason: reason,
        needsProcessing: needsProcessing,
      });
    }

    return processingModuleChanges;
  }

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
   * @returns The same array with cascade effects applied
   */
  private calculateCascadeEffects(
    allModuleChanges: ProcessingModuleChange[],
  ): ProcessingModuleChange[] {
    const processed = new Set<string>();
    const moduleMap = new Map<string, ProcessingModuleChange>();

    // Create module map for O(1) lookups
    for (const change of allModuleChanges) {
      moduleMap.set(change.module.id, change);
    }

    // Start with ALL modules - treat them completely equally
    const queue = [...allModuleChanges];

    while (queue.length > 0) {
      const currentChange = queue.shift()!;

      // No processing needed, mark as processed
      if (!currentChange.needsProcessing || currentChange.bumpType === "none") {
        logger.debug(
          `🔄 Skipping module ${currentChange.module.id} - no processing needed`,
        );
        processed.add(currentChange.module.id);
        continue;
      }

      // Skip if already processed
      if (processed.has(currentChange.module.id)) {
        logger.debug(
          `🔄 Skipping module ${currentChange.module.id} - already processed`,
        );
        continue;
      }

      // Mark as processed to avoid duplicate work
      processed.add(currentChange.module.id);
      const currentModuleInfo = this.moduleRegistry.getModule(
        currentChange.module.id,
      );

      // Iterate through all modules that depend on the current module
      for (const dependentName of currentModuleInfo.affectedModules) {
        logger.debug(
          `➡️ Processing dependent module ${dependentName} affected by ${currentChange.module.id} with bump ${currentChange.bumpType}`,
        );

        // Get the dependent module using O(1) lookup
        const existingChange = moduleMap.get(dependentName);
        if (!existingChange) {
          logger.debug(
            `⚠️ Dependent module ${dependentName} not found in module changes list`,
          );
          continue; // Module not found in our module list
        }

        // Calculate the bump needed for the dependent
        // Uses configuration rules to determine how changes propagate
        const requiredBump = getDependencyBumpType(
          currentChange.bumpType,
          this.options.config,
        );

        if (requiredBump === "none") {
          logger.debug(
            `➡️ No cascade bump needed for module ${dependentName} from ${currentChange.module.id}`,
          );
          continue; // No cascade needed
        }

        // Update the existing change with cascade information
        // Take the maximum bump type if multiple dependencies affect this module
        const mergedBump = maxBumpType([existingChange.bumpType, requiredBump]);
        if (mergedBump !== existingChange.bumpType) {
          logger.debug(
            `🔄 Cascading bump for module ${dependentName} from ${existingChange.bumpType} to ${mergedBump} due to ${currentChange.module.id}`,
          );
          // Update the module change in place
          existingChange.bumpType = mergedBump;
          existingChange.reason = "cascade";
          existingChange.needsProcessing = true;

          // Add to queue for further processing (transitive cascades)
          processed.delete(dependentName); // Allow re-processing
          queue.push(existingChange);
        } else {
          logger.debug(
            `🔄 No changes needed for module ${dependentName} - already at ${existingChange.bumpType}`,
          );
        }
      }
    }

    // Return the modified array (same reference, but with cascade effects applied)
    return allModuleChanges;
  }

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
   * @returns Array of processed module changes ready for application (only modules with needsProcessing = true)
   */
  private applyVersionCalculations(
    processingModuleChanges: ProcessingModuleChange[],
    effectivePrereleaseId: string,
    shortSha?: string,
  ): ProcessedModuleChange[] {
    const processedModuleChanges: ProcessedModuleChange[] = [];

    for (const change of processingModuleChanges) {
      let newVersion: SemVer = change.fromVersion;

      // Only apply version changes if module needs processing
      if (change.needsProcessing) {
        // Apply version bumps based on module state
        if (change.bumpType !== "none" && this.options.prereleaseMode) {
          // Scenario 1: Commits with changes in prerelease mode
          // Bump semantic version AND add prerelease identifier
          newVersion = bumpToPrerelease(
            change.fromVersion,
            change.bumpType,
            effectivePrereleaseId,
          );
        } else if (change.bumpType !== "none" && !this.options.prereleaseMode) {
          // Scenario 2: Commits with changes in normal mode
          // Standard semantic version bump (major.minor.patch)
          newVersion = bumpSemVer(change.fromVersion, change.bumpType);
        } else if (change.reason === "prerelease-unchanged") {
          // Scenario 3: No changes but force prerelease bump (bumpUnchanged enabled)
          // Keep semantic version, just add prerelease identifier
          newVersion = bumpToPrerelease(
            change.fromVersion,
            "none",
            effectivePrereleaseId,
          );
        }
        // Scenario 4: reason === 'build-metadata' or 'unchanged' - no version bump, keep fromVersion

        // Add build metadata if enabled (applies to all scenarios)
        // Build metadata doesn't affect version precedence per semver spec
        if (this.options.addBuildMetadata && shortSha) {
          newVersion = addBuildMetadata(newVersion, shortSha);
        }
      }

      // Convert to string version
      change.toVersion = formatSemVer(newVersion);

      // Apply append snapshot suffix if enabled (to all modules in append mode)
      if (
        this.options.appendSnapshot &&
        this.options.adapter.capabilities.supportsSnapshots
      ) {
        const originalVersion = change.toVersion;
        change.toVersion = applySnapshotSuffix(change.toVersion);

        // If snapshot suffix was actually added and module wasn't already being processed, mark it for processing
        if (!change.needsProcessing && change.toVersion !== originalVersion) {
          change.needsProcessing = true;
          change.reason = "gradle-snapshot";
        }
      }

      // Add to update collection only if module needs processing
      if (change.needsProcessing) {
        // Convert to ProcessedModuleChange since we know needsProcessing is true
        const processedChange: ProcessedModuleChange = {
          module: change.module,
          fromVersion: change.fromVersion,
          toVersion: change.toVersion,
          bumpType: change.bumpType,
          reason: change.reason as ChangeReason, // Safe cast since needsProcessing is true
        };
        processedModuleChanges.push(processedChange);
      }
    }

    logger.info(
      `📈 Calculated versions for ${processedModuleChanges.length} modules requiring updates`,
    );
    return processedModuleChanges;
  }
}
