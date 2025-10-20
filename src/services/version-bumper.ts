import * as core from '@actions/core';
import { Config, getDependencyBumpType } from '../config/index.js';
import { ModuleRegistry } from './module-registry.js';
import { calculateBumpFromCommits } from '../utils/commits.js';
import { bumpSemVer, bumpToPrerelease, formatSemVer, addBuildMetadata, generateTimestampPrereleaseId, maxBumpType, BumpType } from '../semver/index.js';
import { CommitInfo, getCurrentCommitShortSha } from '../git/index.js';
import { SemVer } from 'semver';
import { AdapterMetadata } from './adapter-identifier.js';
import { applySnapshotSuffix } from '../utils/versioning.js';
import { Module } from '../adapters/project-information.js';

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

type ProcessingModuleChange = {
  readonly module: Module;
  readonly fromVersion: SemVer;
  toVersion: string;
  bumpType: BumpType;
  reason: ChangeReason | 'unchanged';
  needsProcessing: boolean;
};

export type ProcessedModuleChange = {
  readonly module: Module;
  readonly fromVersion: SemVer;
  readonly toVersion: string;
  readonly bumpType: BumpType;
  readonly reason: ChangeReason;
};

export type ChangeReason = 
  'commits' | 'dependency' | 
  'cascade' | 'prerelease-unchanged' | 
  'build-metadata' | 'gradle-snapshot';

export class VersionBumper {

  constructor(
    private readonly moduleRegistry: ModuleRegistry,
    private readonly options: VersionBumperOptions,
  ) {
  }

  async calculateVersionBumps(
    moduleCommits: Map<string, CommitInfo[]>
  ): Promise<ProcessedModuleChange[]> {
    core.info('🔢 Calculating version bumps from commits...');
    
    // Generate timestamp-based prerelease ID if timestamp versions are enabled
    let effectivePrereleaseId = this.options.prereleaseId;
    if (this.options.timestampVersions && this.options.prereleaseMode) {
      effectivePrereleaseId = generateTimestampPrereleaseId(this.options.prereleaseId);
      core.info(`🕐 Generated timestamp prerelease ID: ${effectivePrereleaseId}`);
    }

    // Get current commit short SHA if build metadata is enabled
    let shortSha: string | undefined;
    if (this.options.addBuildMetadata) {
      shortSha = await getCurrentCommitShortSha({ cwd: this.options.repoRoot });
      core.info(`📋 Build metadata will include short SHA: ${shortSha}`);
    }
    
    // Step 1: Calculate initial bump types for all modules
    const processingModuleChanges = this.calculateInitialBumps(moduleCommits);

    // Step 2: Calculate cascade effects
    core.info('🌊 Calculating cascade effects...');
    const cascadedChanges = this.calculateCascadeEffects(processingModuleChanges);
    
    // Step 3: Apply version calculations and transformations
    core.info('🔢 Calculating actual versions...');
    return this.applyVersionCalculations(cascadedChanges, effectivePrereleaseId, shortSha);
  }

  private calculateInitialBumps(
    moduleCommits: Map<string, CommitInfo[]>,
  ): ProcessingModuleChange[] {
    const processingModuleChanges: ProcessingModuleChange[] = [];
    
    for (const [projectId, projectInfo] of this.moduleRegistry.getModules()) {
      const commits = moduleCommits.get(projectId) || [];
      
      // Determine bump type from commits only
      const bumpType = calculateBumpFromCommits(commits, this.options.config);
      
      // Determine processing requirements and reason
      let reason: ChangeReason | 'unchanged' = 'unchanged';
      let needsProcessing = false;
      
      if (bumpType !== 'none') {
        // Module has commits that require version changes
        needsProcessing = true;
        reason = 'commits';
      } else if (this.options.prereleaseMode && this.options.bumpUnchanged) {
        // Prerelease mode with bumpUnchanged - include modules with no changes
        needsProcessing = true;
        reason = 'prerelease-unchanged';
      } else if (this.options.addBuildMetadata) {
        // Build metadata mode - all modules need updates for metadata
        needsProcessing = true;
        reason = 'build-metadata';
      }
      
      // Create module change for ALL modules - processing flag determines behavior
      processingModuleChanges.push({
        module: projectInfo,
        fromVersion: projectInfo.version,
        toVersion: '', // Will be calculated later
        bumpType: bumpType,
        reason: reason,
        needsProcessing: needsProcessing,
      });
    }

    return processingModuleChanges;
  }


  /**
   * Calculate cascade effects when modules change.
   * Modifies the input array in place and returns all modules with cascade effects applied.
   */
  private calculateCascadeEffects(
    allModuleChanges: ProcessingModuleChange[]
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
      
      // Skip if already processed or no processing needed or no actual bump
      if (processed.has(currentChange.module.id) || !currentChange.needsProcessing || currentChange.bumpType === 'none') {
        core.debug(`🔄 Skipping module ${currentChange.module.id} - already processed or no processing needed`);
        continue;
      }
      
      processed.add(currentChange.module.id);
      const currentModuleInfo = this.moduleRegistry.getModule(currentChange.module.id);

      for (const dependentName of currentModuleInfo.affectedModules) {
        core.debug(`➡️ Processing dependent module ${dependentName} affected by ${currentChange.module.id} with bump ${currentChange.bumpType}`);
        
        if (processed.has(dependentName)) {
          core.debug(`🔄 Skipping dependent module ${dependentName} - already processed`);
          continue; // Already processed this module
        }

        // Get the dependent module using O(1) lookup
        const existingChange = moduleMap.get(dependentName);
        if (!existingChange) {
          core.debug(`⚠️ Dependent module ${dependentName} not found in module changes list`);
          continue; // Module not found in our module list
        }

        // Calculate the bump needed for the dependent
        const requiredBump = getDependencyBumpType(currentChange.bumpType, this.options.config)
        
        if (requiredBump === 'none') {
          core.debug(`➡️ No cascade bump needed for module ${dependentName} from ${currentChange.module.id}`);
          continue; // No cascade needed
        }

        // Update the existing change with cascade information
        const mergedBump = maxBumpType([existingChange.bumpType, requiredBump]);
        if (mergedBump !== existingChange.bumpType || !existingChange.needsProcessing) {
          core.debug(`🔄 Cascading bump for module ${dependentName} from ${existingChange.bumpType} to ${mergedBump} due to ${currentChange.module.id}`);
          // Update the module change in place
          existingChange.bumpType = mergedBump;
          existingChange.reason = 'cascade';
          existingChange.needsProcessing = true;
          
          // Add to queue for further processing
          queue.push(existingChange);
        } else {
          core.debug(`🔄 No changes needed for module ${dependentName} - already at ${existingChange.bumpType}`);
        }
      }
    }

    // Return the modified array (same reference, but with cascade effects applied)
    return allModuleChanges;
  }


  private applyVersionCalculations(
    processingModuleChanges: ProcessingModuleChange[],
    effectivePrereleaseId: string,
    shortSha?: string
  ): ProcessedModuleChange[] {
    const processedModuleChanges: ProcessedModuleChange[] = [];
    
    for (const change of processingModuleChanges) {
      let newVersion: SemVer = change.fromVersion;
      
      // Only apply version changes if module needs processing
      if (change.needsProcessing) {
        // Apply version bumps based on module state
        if (change.bumpType !== 'none' && this.options.prereleaseMode) {
          // Scenario 1: Commits with changes in prerelease mode
          newVersion = bumpToPrerelease(change.fromVersion, change.bumpType, effectivePrereleaseId);
        } else if (change.bumpType !== 'none' && !this.options.prereleaseMode) {
          // Scenario 2: Commits with changes in normal mode
          newVersion = bumpSemVer(change.fromVersion, change.bumpType);
        } else if (change.reason === 'prerelease-unchanged') {
          // Scenario 3: No changes but force prerelease bump (bumpUnchanged enabled)
          newVersion = bumpToPrerelease(change.fromVersion, 'none', effectivePrereleaseId);
        }
        // Scenario 4: reason === 'build-metadata' or 'unchanged' - no version bump, keep fromVersion
        
        // Add build metadata if enabled (applies to all scenarios)
        if (this.options.addBuildMetadata && shortSha) {
          newVersion = addBuildMetadata(newVersion, shortSha);
        }
      }
      
      // Convert to string version
      change.toVersion = formatSemVer(newVersion);

      // Apply append snapshot suffix if enabled (to all modules in append mode)
      if (this.options.appendSnapshot && this.options.adapter.capabilities.supportsSnapshots) {
        const originalVersion = change.toVersion;
        change.toVersion = applySnapshotSuffix(change.toVersion);

        // If snapshot suffix was actually added and module wasn't already being processed, mark it for processing
        if (!change.needsProcessing && change.toVersion !== originalVersion) {
          change.needsProcessing = true;
          change.reason = 'gradle-snapshot';
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

    core.info(`📈 Calculated versions for ${processedModuleChanges.length} modules requiring updates`);
    return processedModuleChanges;
  }
}
