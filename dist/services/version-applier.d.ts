import { VersionManager } from './version-manager.js';
import { BumpType } from '../semver/index.js';
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
export declare class VersionApplier {
    private readonly versionManager;
    private readonly options;
    constructor(versionManager: VersionManager, options: VersionApplierOptions);
    applyVersionChanges(processedModuleChanges: ProcessedModuleChange[]): Promise<ModuleChangeResult[]>;
    private logPlannedChanges;
    private stageVersions;
    private commitVersions;
}
//# sourceMappingURL=version-applier.d.ts.map