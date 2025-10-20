import * as core from '@actions/core';
import { VersionManager } from './version-manager.js';
import { BumpType, formatSemVer } from '../semver/index.js';
import { ProcessedModuleChange } from './version-bumper.js';

export type VersionApplierOptions = {
  dryRun: boolean;
};

export type ModuleChangeResult = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
  readonly type: 'module' | 'root';
  readonly from: string;
  readonly to: string;
  readonly bumpType: BumpType;
  readonly declaredVersion: boolean;
};

export class VersionApplier {

  constructor(
    private readonly versionManager: VersionManager,
    private readonly options: VersionApplierOptions
  ) {
  }

  async applyVersionChanges(processedModuleChanges: ProcessedModuleChange[]): Promise<ModuleChangeResult[]> {
    if (processedModuleChanges.length === 0) {
      core.info('✨ No version changes to apply');
      return [];
    }

    this.logPlannedChanges(processedModuleChanges);
    
    if (this.options.dryRun) {
      core.info('🏃‍♂️ Dry run mode - version changes will not be written to files');
    } else {
      await this.stageVersions(processedModuleChanges);
      await this.commitVersions(processedModuleChanges.length);
    }
    
    // Create and return result objects
    return processedModuleChanges.map(change => ({
      id: change.module.id,
      name: change.module.name,
      path: change.module.path,
      type: change.module.type,
      from: formatSemVer(change.fromVersion),
      to: change.toVersion,
      bumpType: change.bumpType,
      declaredVersion: change.module.declaredVersion,
    }));
  }

  private logPlannedChanges(processedModuleChanges: ProcessedModuleChange[]): void {
    core.info(`📈 Planning to update ${processedModuleChanges.length} modules:`);
    for (const change of processedModuleChanges) {
      if (change.module.declaredVersion) {
        const from = formatSemVer(change.fromVersion);
        const to = change.toVersion;
        core.info(`  ${change.module.id}: ${from} → ${to} (${change.bumpType}, ${change.reason})`);
      }
    }
  }

  private async stageVersions(processedModuleChanges: ProcessedModuleChange[]): Promise<void> {
    core.info('✍️ Staging new versions...');
    for (const change of processedModuleChanges) {
      if (change.module.declaredVersion) {
        // Use toVersion directly (now includes all transformations like Gradle snapshots)
        this.versionManager.updateVersion(change.module.id, change.toVersion);
        core.info(`  Staged ${change.module.id} to ${change.toVersion}`);
      }
    }
  }

  private async commitVersions(changeCount: number): Promise<void> {
    core.info('💾 Committing version updates to files...');
    await this.versionManager.commit();
    core.info(`✅ Committed ${changeCount} version updates`);
  }
}
