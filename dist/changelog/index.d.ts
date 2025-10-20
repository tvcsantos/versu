import { ModuleChangeResult } from '../services/version-applier.js';
import { CommitInfo } from '../git/index.js';
export type ChangelogEntry = {
    readonly moduleResult: ModuleChangeResult;
    readonly version: string;
    readonly date: string;
    readonly changes: {
        readonly breaking: CommitInfo[];
        readonly features: CommitInfo[];
        readonly fixes: CommitInfo[];
        readonly other: CommitInfo[];
    };
};
export type ChangelogOptions = {
    readonly includeCommitHashes: boolean;
    readonly includeScopes: boolean;
    readonly groupByType: boolean;
};
/**
 * Generate changelog for a module
 */
export declare function generateChangelog(moduleResult: ModuleChangeResult, commits: CommitInfo[], options?: ChangelogOptions): Promise<string>;
/**
 * Update or create CHANGELOG.md file for a module
 */
export declare function updateChangelogFile(moduleResult: ModuleChangeResult, changelogContent: string, repoRoot: string): Promise<string>;
/**
 * Generate changelog for multiple modules
 */
export declare function generateChangelogsForModules(moduleResults: ModuleChangeResult[], getCommitsForModule: (moduleId: string) => Promise<CommitInfo[]>, repoRoot: string, options?: ChangelogOptions): Promise<string[]>;
/**
 * Generate a root changelog that summarizes all module changes
 */
export declare function generateRootChangelog(moduleResults: ModuleChangeResult[], repoRoot: string): Promise<string>;
//# sourceMappingURL=index.d.ts.map