export type GitTag = {
    readonly name: string;
    readonly hash: string;
    readonly module?: string;
    readonly version?: string;
};
export type GitOptions = {
    readonly cwd?: string;
};
export type CommitInfo = {
    readonly hash: string;
    readonly type: string;
    readonly scope?: string;
    readonly subject: string;
    readonly body?: string;
    readonly breaking: boolean;
    readonly module?: string;
};
/**
 * Get commits since the last tag for a specific module
 * @param modulePath Path to the module from repository root
 * @param moduleName Name of the module
 * @param moduleType Type of module (root or module)
 * @param options Git options including cwd
 * @param excludePaths Paths to exclude from the commit search (e.g., child modules)
 */
export declare function getCommitsSinceLastTag(modulePath: string, moduleName: string, moduleType: 'root' | 'module', options?: GitOptions, excludePaths?: string[]): Promise<CommitInfo[]>;
/**
 * Get commits in a specific range, optionally filtered by path
 * @param range Git range (e.g., 'tag..HEAD' or empty for all commits)
 * @param pathFilter Path to include in the search
 * @param options Git options including cwd
 * @param excludePaths Paths to exclude from the search (uses git pathspec exclusion)
 */
export declare function getCommitsInRange(range: string, pathFilter?: string, options?: GitOptions, excludePaths?: string[]): Promise<CommitInfo[]>;
/**
 * Get the last tag for a specific module
 */
export declare function getLastTagForModule(moduleName: string, moduleType: 'root' | 'module', options?: GitOptions): Promise<string | null>;
/**
 * Get all tags in the repository
 */
export declare function getAllTags(options?: GitOptions): Promise<GitTag[]>;
/**
 * Create a git tag
 */
export declare function createTag(tagName: string, message: string, options?: GitOptions): Promise<void>;
/**
 * Push tags to remote
 */
export declare function pushTags(options?: GitOptions): Promise<void>;
/**
 * Check if the working directory is clean
 */
export declare function isWorkingDirectoryClean(options?: GitOptions): Promise<boolean>;
/**
 * Get the current branch name
 */
export declare function getCurrentBranch(options?: GitOptions): Promise<string>;
/**
 * Get the current commit short SHA
 */
export declare function getCurrentCommitShortSha(options?: GitOptions): Promise<string>;
/**
 * Add all changed files to git staging area
 */
export declare function addChangedFiles(options?: GitOptions): Promise<void>;
/**
 * Commit changes with a message
 */
export declare function commitChanges(message: string, options?: GitOptions): Promise<void>;
/**
 * Push commits to remote
 */
export declare function pushCommits(options?: GitOptions): Promise<void>;
/**
 * Check if there are changes to commit (staged or unstaged)
 */
export declare function hasChangesToCommit(options?: GitOptions): Promise<boolean>;
//# sourceMappingURL=index.d.ts.map