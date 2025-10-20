import { ModuleChangeResult } from './version-applier.js';
import { Module } from '../adapters/project-information.js';
export type RunnerOptions = {
    readonly repoRoot: string;
    readonly adapter?: string;
    readonly configPath?: string;
    readonly dryRun: boolean;
    readonly pushTags: boolean;
    readonly prereleaseMode: boolean;
    readonly prereleaseId: string;
    readonly bumpUnchanged: boolean;
    readonly addBuildMetadata: boolean;
    readonly timestampVersions: boolean;
    readonly appendSnapshot: boolean;
    readonly pushChanges: boolean;
    readonly generateChangelog: boolean;
};
export type RunnerResult = {
    readonly bumped: boolean;
    readonly discoveredModules: Array<Module>;
    readonly changedModules: Array<ModuleChangeResult>;
    readonly createdTags: string[];
    readonly changelogPaths: string[];
};
export declare class VerseRunner {
    private moduleSystemFactory;
    private moduleRegistry;
    private versionManager;
    private config;
    private adapter;
    private options;
    private configurationLoader;
    private commitAnalyzer;
    private versionBumper;
    private versionApplier;
    private changelogGenerator;
    private gitOperations;
    private adapterIdentifierRegistry;
    private adapterMetadataProvider;
    constructor(options: RunnerOptions);
    run(): Promise<RunnerResult>;
}
//# sourceMappingURL=verse-runner.d.ts.map