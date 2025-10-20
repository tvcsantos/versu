import { Config } from '../config/index.js';
import { ModuleRegistry } from './module-registry.js';
import { BumpType } from '../semver/index.js';
import { CommitInfo } from '../git/index.js';
import { SemVer } from 'semver';
import { AdapterMetadata } from './adapter-identifier.js';
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
export type ProcessedModuleChange = {
    readonly module: Module;
    readonly fromVersion: SemVer;
    readonly toVersion: string;
    readonly bumpType: BumpType;
    readonly reason: ChangeReason;
};
export type ChangeReason = 'commits' | 'dependency' | 'cascade' | 'prerelease-unchanged' | 'build-metadata' | 'gradle-snapshot';
export declare class VersionBumper {
    private readonly moduleRegistry;
    private readonly options;
    constructor(moduleRegistry: ModuleRegistry, options: VersionBumperOptions);
    calculateVersionBumps(moduleCommits: Map<string, CommitInfo[]>): Promise<ProcessedModuleChange[]>;
    private calculateInitialBumps;
    /**
     * Calculate cascade effects when modules change.
     * Modifies the input array in place and returns all modules with cascade effects applied.
     */
    private calculateCascadeEffects;
    private applyVersionCalculations;
}
//# sourceMappingURL=version-bumper.d.ts.map