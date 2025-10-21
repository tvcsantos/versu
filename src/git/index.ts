/**
 * Git operations module for VERSE version management.
 * 
 * This module provides a comprehensive interface for interacting with git repositories,
 * specifically tailored for version management in monorepo and multi-module projects.
 * It handles commit analysis, tagging, version extraction, and conventional commit parsing.
 * 
 * @remarks
 * **Key Features**:
 * - Conventional Commits parsing for semantic version determination
 * - Module-specific tag management for monorepo support
 * - Commit range queries with path filtering
 * - Git operations abstraction (tag, commit, push)
 * - Working directory state checking
 * 
 * **Tag Conventions**:
 * - Module tags: `moduleName@version` (e.g., `core@1.0.0`)
 * - Root tags: `v{version}` or `{version}` (e.g., `v1.0.0`)
 * - Both formats are supported for backward compatibility
 * 
 * **Conventional Commits**:
 * All commit parsing follows the Conventional Commits specification:
 * - Format: `type(scope): subject`
 * - Breaking changes: Identified via `BREAKING CHANGE:` footer
 * - Version bumping: Based on commit types (feat → minor, fix → patch, BREAKING → major)
 * 
 * @see https://www.conventionalcommits.org/ - Conventional Commits specification
 * @see https://semver.org/ - Semantic Versioning specification
 * 
 * @module git
 */

import { getExecOutput, exec } from '@actions/exec';
import * as conventionalCommitsParser from 'conventional-commits-parser';
import * as core from '@actions/core';

/**
 * Represents a parsed git tag with extracted module and version metadata.
 * 
 * Git tags in VERSE can follow different naming conventions:
 * - **Module-specific tags**: `moduleName@version` (e.g., `core@1.0.0`, `api@2.1.0`)
 * - **General/root tags**: `v{version}` or `{version}` (e.g., `v1.0.0`, `2.0.0`)
 * 
 * This type provides structured access to both the raw tag information (name and commit hash)
 * and parsed semantic components (module name and version number).
 * 
 * @remarks
 * **Tag Parsing**:
 * - Module tags are parsed to extract both module name and version
 * - General tags only extract the version (module field is undefined)
 * - Invalid or unrecognized tag formats leave module and version undefined
 * 
 * **Use Cases**:
 * - Finding the latest version for a specific module in a monorepo
 * - Determining which modules need new releases
 * - Building release notes from tagged versions
 * - Version comparison and ordering
 * 
 * @example
 * ```typescript
 * // Module-specific tag
 * const moduleTag: GitTag = {
 *   name: 'core@1.0.0',
 *   hash: 'abc123def456',
 *   module: 'core',
 *   version: '1.0.0'
 * };
 * 
 * // General version tag
 * const versionTag: GitTag = {
 *   name: 'v2.0.0',
 *   hash: 'def456abc123',
 *   version: '2.0.0'
 *   // module is undefined for general tags
 * };
 * 
 * // Unrecognized tag format
 * const otherTag: GitTag = {
 *   name: 'release-candidate',
 *   hash: '123abc456def'
 *   // Both module and version are undefined
 * };
 * ```
 * 
 * @see {@link getAllTags} - Function to retrieve all tags from a repository
 * @see {@link parseTagName} - Internal function that performs tag name parsing
 */
export type GitTag = {
  /** The full tag name as it appears in git (e.g., 'core@1.0.0', 'v2.0.0') */
  readonly name: string;
  /** The full SHA-1 commit hash that this tag points to */
  readonly hash: string;
  /** 
   * The module name extracted from the tag (e.g., 'core' from 'core@1.0.0').
   * Undefined for general tags or unparseable tag names.
   */
  readonly module?: string;
  /** 
   * The semantic version extracted from the tag (e.g., '1.0.0' from 'core@1.0.0' or 'v1.0.0').
   * Undefined for unparseable tag names.
   */
  readonly version?: string;
};

/**
 * Configuration options for executing git operations.
 * 
 * This type provides optional parameters that control where and how git commands
 * are executed. All git functions in this module accept these options to enable
 * flexible operation across different repository locations.
 * 
 * @remarks
 * **Default Behavior**:
 * - When `cwd` is omitted, git commands execute in `process.cwd()`
 * - The working directory must be inside a git repository
 * - Relative paths in git commands are resolved from the `cwd` directory
 * 
 * **Use Cases**:
 * - Operating on repositories outside the current working directory
 * - Testing with temporary or fixture repositories
 * - Multi-repository operations in CI/CD pipelines
 * - Monorepo management across different sub-projects
 * 
 * @example
 * ```typescript
 * // Use default directory (process.cwd())
 * const commits = await getCommitsSinceLastTag('core', 'core', 'module');
 * 
 * // Specify custom working directory
 * const options: GitOptions = { cwd: '/path/to/repo' };
 * const tags = await getAllTags(options);
 * 
 * // Useful for testing with fixtures
 * const testOptions: GitOptions = { cwd: '__fixtures__/test-repo' };
 * const isClean = await isWorkingDirectoryClean(testOptions);
 * ```
 */
export type GitOptions = {
  /** 
   * The working directory in which to execute git commands.
   * Must be inside a git repository or a subdirectory of one.
   * Defaults to `process.cwd()` if not specified.
   */
  readonly cwd?: string;
};

/**
 * Represents a parsed git commit following the Conventional Commits specification.
 * 
 * This type provides structured access to commit metadata that drives semantic versioning
 * decisions. Commits are parsed to extract:
 * - **Type**: Determines the version bump (feat → minor, fix → patch)
 * - **Scope**: Optional context about what area was changed
 * - **Breaking changes**: Forces a major version bump
 * - **Subject and body**: Descriptive content for changelogs
 * 
 * The parsing follows the Conventional Commits format:
 * ```
 * <type>(<scope>): <subject>
 * 
 * <body>
 * 
 * BREAKING CHANGE: <description>
 * ```
 * 
 * @remarks
 * **Commit Types**:
 * - `feat`: New feature (triggers minor version bump)
 * - `fix`: Bug fix (triggers patch version bump)
 * - `docs`: Documentation changes (no version bump)
 * - `chore`: Maintenance tasks (no version bump)
 * - `refactor`: Code refactoring (no version bump)
 * - `test`: Test additions or modifications (no version bump)
 * - `unknown`: Unparseable commits (treated as no version bump)
 * 
 * **Breaking Changes**:
 * - Detected via `BREAKING CHANGE:` footer in commit body
 * - Can also use `BREAKING-CHANGE:` (hyphen variant)
 * - Always triggers a major version bump regardless of type
 * - The `!` suffix (e.g., `feat!:`) is also recognized
 * 
 * **Scope Usage**:
 * - Provides additional context: `feat(api): add endpoint`
 * - Can represent modules, components, or functional areas
 * - Optional and not used for version bump decisions
 * - Useful for changelog organization and filtering
 * 
 * **Version Bump Logic**:
 * - `breaking === true` → Major bump (e.g., 1.0.0 → 2.0.0)
 * - `type === 'feat'` → Minor bump (e.g., 1.0.0 → 1.1.0)
 * - `type === 'fix'` → Patch bump (e.g., 1.0.0 → 1.0.1)
 * - Other types → No bump
 * 
 * @example
 * ```typescript
 * // Feature commit
 * const featureCommit: CommitInfo = {
 *   hash: 'abc123',
 *   type: 'feat',
 *   scope: 'api',
 *   subject: 'add user authentication',
 *   body: 'Implements JWT-based authentication',
 *   breaking: false
 * };
 * // Results in minor version bump
 * 
 * // Breaking change commit
 * const breakingCommit: CommitInfo = {
 *   hash: 'def456',
 *   type: 'refactor',
 *   scope: 'core',
 *   subject: 'restructure API',
 *   body: 'BREAKING CHANGE: API endpoints have been renamed',
 *   breaking: true
 * };
 * // Results in major version bump (despite refactor type)
 * 
 * // Bug fix commit
 * const fixCommit: CommitInfo = {
 *   hash: 'ghi789',
 *   type: 'fix',
 *   subject: 'correct validation logic',
 *   breaking: false
 * };
 * // Results in patch version bump
 * 
 * // Non-versioning commit
 * const docsCommit: CommitInfo = {
 *   hash: 'jkl012',
 *   type: 'docs',
 *   subject: 'update README',
 *   breaking: false
 * };
 * // No version bump
 * ```
 * 
 * @see https://www.conventionalcommits.org/ - Conventional Commits specification
 * @see {@link parseGitLog} - Internal function that parses commits
 * @see {@link getCommitsSinceLastTag} - Function to retrieve commits for analysis
 */
export type CommitInfo = {
  /** The full SHA-1 commit hash (40 hexadecimal characters) */
  readonly hash: string;
  /** 
   * The commit type indicating the nature of the change.
   * Common values: 'feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'unknown'.
   * Used to determine version bump strategy.
   */
  readonly type: string;
  /** 
   * Optional scope providing additional context about what was changed.
   * Examples: 'api', 'core', 'ui', 'auth'.
   * Not used for version bumping but useful for changelog organization.
   */
  readonly scope?: string;
  /** 
   * The commit subject line without type and scope prefix.
   * Should be a concise description of the change.
   */
  readonly subject: string;
  /** 
   * The full commit body text, if present.
   * May contain detailed explanations, breaking change descriptions, and footer metadata.
   */
  readonly body?: string;
  /** 
   * Whether this commit introduces breaking changes.
   * Detected from 'BREAKING CHANGE:' footer or '!' suffix in commit message.
   * When true, always triggers a major version bump.
   */
  readonly breaking: boolean;
  /** 
   * Optional module name if the commit is specific to a module in a monorepo.
   * Not currently extracted by the parser but reserved for future use.
   */
  readonly module?: string;
};

/**
 * Retrieves all commits for a module since its last release tag.
 * 
 * This function is central to VERSE's version determination strategy. It finds the most
 * recent tag for a module and retrieves all commits from that point to HEAD. These commits
 * are then analyzed to determine the next version number based on Conventional Commits.
 * 
 * The function handles both monorepo and single-repo scenarios:
 * - **Monorepo**: Filters commits by module path and excludes child module commits
 * - **Single repo**: Returns all commits since the last tag
 * - **No tags**: Returns all commits in the repository history
 * 
 * @param modulePath - Relative path to the module from repository root.
 *                     Use '.' for root module.
 *                     Examples: 'core', 'packages/api', 'services/auth'
 * @param moduleName - Name of the module used for tag searching.
 *                     Used to find module-specific tags like 'core@1.0.0'.
 *                     Should match the module identifier in your tag naming convention.
 * @param moduleType - Type of module that affects tag searching strategy:
 *                     - 'root': Skips module-specific tag search, uses general tags
 *                     - 'module': Searches for module-specific tags first
 * @param options - Git operation options. Primarily used to specify the repository directory.
 * @param excludePaths - Paths to exclude from commit history using git pathspec.
 *                       Critical for monorepos to prevent parent modules from
 *                       including child module commits. Each path should be relative
 *                       to the repository root.
 * 
 * @returns Promise resolving to an array of parsed commit information.
 *          Commits are ordered from oldest to newest.
 *          Empty array if no commits exist or git operations fail.
 * 
 * @throws {Error} Rarely throws - most git errors are caught and result in returning all commits
 * 
 * @remarks
 * **Tag Search Strategy**:
 * 1. For modules: Try to find module-specific tags (e.g., 'core@1.0.0')
 * 2. Fallback: Use general tags (e.g., 'v1.0.0')
 * 3. No tags: Return all commits in history
 * 
 * **Path Filtering**:
 * - Commits are filtered to only include changes in `modulePath`
 * - `excludePaths` uses git's native `:(exclude)path` pathspec syntax
 * - This prevents double-counting commits in parent/child module relationships
 * - Example: Parent module 'core' excludes 'core/api' and 'core/impl'
 * 
 * **Commit Ordering**:
 * - Commits are returned in chronological order (oldest first)
 * - This order is important for accurate version bump calculation
 * - Breaking changes should be detected regardless of order
 * 
 * **Performance Considerations**:
 * - Uses `git log` with path filtering for efficiency
 * - Pathspec filtering happens at git level (fast)
 * - Parsing overhead scales with number of commits, not repository size
 * - Suitable for large repositories with thousands of commits
 * 
 * **Error Handling**:
 * - If tag lookup fails, falls back to all commits
 * - If commit retrieval fails, returns empty array with warning
 * - Parsing errors for individual commits don't affect others
 * 
 * @example
 * **Root Module (No Tag Prefix)**:
 * ```typescript
 * // Get commits for root project since last general tag
 * const commits = await getCommitsSinceLastTag(
 *   '.',           // Root path
 *   'myproject',   // Project name
 *   'root',        // Root type - skips module-specific tags
 *   { cwd: '/home/user/repo' }
 * );
 * // Searches for tags like 'v1.0.0' or '1.0.0'
 * // Returns all commits since last tag touching any file
 * ```
 * 
 * @example
 * **Submodule in Monorepo**:
 * ```typescript
 * // Get commits for 'api' module in a monorepo
 * const commits = await getCommitsSinceLastTag(
 *   'packages/api',     // Path to module
 *   'api',              // Module name for tags
 *   'module',           // Module type
 *   { cwd: '/home/user/monorepo' },
 *   ['packages/api/v1', 'packages/api/v2']  // Exclude child modules
 * );
 * // Searches for tags like 'api@1.0.0', falls back to 'v1.0.0'
 * // Returns commits in 'packages/api' excluding subdirectories
 * ```
 * 
 * @example
 * **Module Without Previous Tags**:
 * ```typescript
 * // New module with no release history
 * const commits = await getCommitsSinceLastTag(
 *   'packages/new-module',
 *   'new-module',
 *   'module',
 *   { cwd: '/home/user/repo' }
 * );
 * // No tags found - returns all commits in 'packages/new-module'
 * // Useful for initial version determination (usually 0.1.0 or 1.0.0)
 * ```
 * 
 * @example
 * **Complex Monorepo with Nested Modules**:
 * ```typescript
 * // Parent module 'core' with multiple child modules
 * const coreCommits = await getCommitsSinceLastTag(
 *   'core',
 *   'core',
 *   'module',
 *   { cwd: '/home/user/repo' },
 *   [
 *     'core/api',      // Child module 1
 *     'core/impl',     // Child module 2
 *     'core/utils'     // Child module 3
 *   ]
 * );
 * // Only includes commits in 'core' directory
 * // Excludes commits in child module directories
 * // Useful for independent versioning of parent and children
 * ```
 * 
 * @example
 * **Integration with Version Calculation**:
 * ```typescript
 * import { getCommitsSinceLastTag } from './git/index.js';
 * import { analyzeCommits } from './services/commit-analyzer.js';
 * 
 * // Get commits since last release
 * const commits = await getCommitsSinceLastTag(
 *   'packages/api',
 *   'api',
 *   'module',
 *   { cwd: process.cwd() },
 *   ['packages/api/v1']
 * );
 * 
 * // Analyze commits to determine version bump
 * const bumpType = analyzeCommits(commits);
 * console.log(`Version bump type: ${bumpType}`);
 * // Output: 'major', 'minor', 'patch', or null
 * ```
 * 
 * @see {@link getCommitsInRange} - Lower-level function for custom commit ranges
 * @see {@link getLastTagForModule} - Function that finds the last tag
 * @see {@link CommitInfo} - Type definition for parsed commit information
 */
export async function getCommitsSinceLastTag(
  modulePath: string,
  moduleName: string,
  moduleType: 'root' | 'module',
  options: GitOptions = {},
  excludePaths: string[] = []
): Promise<CommitInfo[]> {
  // Resolve the working directory, defaulting to current process directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Find the most recent tag for this module
    // For root modules, this finds general tags (v1.0.0)
    // For submodules, this finds module-specific tags (module@1.0.0)
    const lastTag = await getLastTagForModule(moduleName, moduleType, { cwd });
    
    // Build the git revision range
    // If tag exists: 'tag..HEAD' means commits after tag up to HEAD
    // If no tag: empty string means all commits in history
    const range = lastTag ? `${lastTag}..HEAD` : '';
    return getCommitsInRange(range, modulePath, { cwd }, excludePaths);
  } catch (error) {
    // If tag lookup fails for any reason, fall back to all commits
    // This ensures we always have commit history for version determination
    return getCommitsInRange('', modulePath, { cwd }, excludePaths);
  }
}

/**
 * Retrieves commits within a specific git revision range with path filtering support.
 * 
 * This lower-level function provides precise control over which commits are retrieved
 * from a git repository. It uses git's native pathspec syntax for efficient server-side
 * filtering, avoiding the need for post-processing large commit histories.
 * 
 * The pathspec `:(exclude)path` syntax is particularly powerful for monorepos where
 * you need to isolate commits to specific directories while excluding subdirectories.
 * 
 * @param range - Git revision range specification. Supports multiple formats:
 *                - `'tag1..tag2'`: Commits between two tags
 *                - `'tag..HEAD'`: Commits since a tag
 *                - `'branch1..branch2'`: Commits between branches
 *                - `''` (empty): All commits in repository history
 * @param pathFilter - Optional path to filter commits by. When specified, only commits
 *                     that modify files in this path are returned. Use '.' for root path.
 * @param options - Git operation options, primarily for specifying working directory.
 * @param excludePaths - Array of paths to exclude using git pathspec `:(exclude)` syntax.
 *                       Each path is relative to repository root. Filtering happens at
 *                       git level for efficiency.
 * 
 * @returns Promise resolving to an array of parsed CommitInfo objects.
 *          Empty array if no commits match or if git command fails.
 *          Commits are ordered from oldest to newest.
 * 
 * @remarks
 * **Git Command Construction**:
 * The function builds a `git log` command with these components:
 * 1. Custom format: `--format=%H%n%s%n%b%n---COMMIT-END---`
 * 2. Range: Added only if non-empty (e.g., `v1.0.0..HEAD`)
 * 3. Path separator: `--` separates revisions from paths
 * 4. Path filter: Included if not root ('.')
 * 5. Exclude patterns: Each as `:(exclude)path`
 * 
 * **Pathspec Syntax**:
 * - `:(exclude)path` excludes all files under `path`
 * - Pathspecs are relative to repository root
 * - Multiple excludes create an intersection (exclude all listed paths)
 * - See `git help pathspec` for full syntax reference
 * 
 * **Performance**:
 * - Filtering at git level is highly efficient (written in C)
 * - Scales well with large repositories (millions of commits)
 * - Path filtering uses git's internal tree walking
 * - No memory overhead for excluded commits
 * 
 * **Error Handling**:
 * - Git errors are caught and logged as warnings
 * - Returns empty array on failure (non-throwing)
 * - Individual commit parse errors don't affect other commits
 * 
 * @example
 * **Simple Range Query**:
 * ```typescript
 * // Get all commits between two tags
 * const commits = await getCommitsInRange(
 *   'v1.0.0..v2.0.0',
 *   undefined,
 *   { cwd: '/home/user/repo' }
 * );
 * // Equivalent to: git log v1.0.0..v2.0.0
 * ```
 * 
 * @example
 * **Path-Filtered Query**:
 * ```typescript
 * // Get commits since tag affecting a specific directory
 * const commits = await getCommitsInRange(
 *   'v1.0.0..HEAD',
 *   'src/core',
 *   { cwd: '/repo' }
 * );
 * // Equivalent to: git log v1.0.0..HEAD -- src/core
 * ```
 * 
 * @example
 * **Excluding Subdirectories (Monorepo)**:
 * ```typescript
 * // Get commits in 'packages/api' excluding child modules
 * const commits = await getCommitsInRange(
 *   'api@1.0.0..HEAD',
 *   'packages/api',
 *   { cwd: '/monorepo' },
 *   ['packages/api/v1', 'packages/api/v2']
 * );
 * // Equivalent to:
 * // git log api@1.0.0..HEAD -- packages/api :(exclude)packages/api/v1 :(exclude)packages/api/v2
 * ```
 * 
 * @example
 * **All Commits (No Range)**:
 * ```typescript
 * // Get entire commit history for a path
 * const allCommits = await getCommitsInRange(
 *   '',  // Empty range = all history
 *   'docs',
 *   { cwd: '/repo' }
 * );
 * // Equivalent to: git log -- docs
 * ```
 * 
 * @example
 * **Root Path with Exclusions**:
 * ```typescript
 * // Get all commits except those in specific directories
 * const commits = await getCommitsInRange(
 *   'v1.0.0..HEAD',
 *   '.',  // Root path
 *   { cwd: '/repo' },
 *   ['node_modules', 'build', 'dist']
 * );
 * // Equivalent to:
 * // git log v1.0.0..HEAD -- :(exclude)node_modules :(exclude)build :(exclude)dist
 * ```
 * 
 * @see {@link getCommitsSinceLastTag} - Higher-level function for module commits
 * @see {@link parseGitLog} - Internal function that parses the git log output
 * @see https://git-scm.com/docs/gitrevisions - Git revision syntax reference
 * @see https://git-scm.com/docs/gitglossary#Documentation/gitglossary.txt-aiddefpathspecapathspec - Pathspec documentation
 */
export async function getCommitsInRange(
  range: string,
  pathFilter?: string,
  options: GitOptions = {},
  excludePaths: string[] = []
): Promise<CommitInfo[]> {
  // Resolve working directory, defaulting to current directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Build git log command with custom format for easy parsing
    // Format: hash, subject, body, delimiter
    const args = ['log', '--format=%H%n%s%n%b%n---COMMIT-END---'];
    
    // Only add range if it's not empty
    // Empty range means "all commits" which is valid
    if (range.trim()) {
      args.push(range);
    }
    
    // Add pathspec separator ('--') if we have paths or excludes
    // This separates revision arguments from path arguments
    // Add path filter if provided and not root
    if (pathFilter && pathFilter !== '.') {
      args.push('--', pathFilter);
    } else if (excludePaths.length > 0) {
      // For root path, we still need to add the pathspec separator
      // when we have exclude patterns
      args.push('--');
    }

    // Add each exclude pattern using git's pathspec syntax
    // :(exclude)path tells git to ignore commits touching that path
    for (const excludePath of excludePaths) {
      if (excludePath && excludePath !== '.') {
        args.push(`:(exclude)${excludePath}`);
      }
    }
    
    // Execute git log command
    // Silent mode prevents output pollution in GitHub Actions
    const { stdout } = await getExecOutput('git', args, {
      cwd,
      silent: true
    });
    
    // Parse the formatted output into CommitInfo objects
    return parseGitLog(stdout);
  } catch (error) {
    // Non-throwing error handling: log warning and return empty array
    // This allows the system to continue even if git operations fail
    core.warning(`Warning: Failed to get git commits: ${error}`);
    return [];
  }
}

/**
 * Parses raw git log output into structured CommitInfo objects with Conventional Commits analysis.
 * 
 * This internal function is responsible for transforming git's text output into typed JavaScript
 * objects that can be used for version bump analysis. It handles the parsing in two stages:
 * 1. **Structural parsing**: Splits output into individual commit blocks
 * 2. **Semantic parsing**: Applies Conventional Commits rules to extract type, scope, breaking changes
 * 
 * The function is resilient to parsing failures - if a commit doesn't follow Conventional Commits
 * format, it's classified as 'unknown' type and won't trigger version bumps.
 * 
 * @param output - Raw output from `git log` using the custom format:
 *                 `--format=%H%n%s%n%b%n---COMMIT-END---`
 *                 This produces: hash, subject, body, delimiter for each commit.
 * 
 * @returns Array of CommitInfo objects with parsed metadata.
 *          Empty array if output is empty or contains no valid commits.
 *          Invalid commits are skipped (not included in result).
 * 
 * @remarks
 * **Input Format**:
 * The expected input format from git is:
 * ```
 * <hash>
 * <subject>
 * <body line 1>
 * <body line 2>
 * ---COMMIT-END---
 * <hash>
 * <subject>
 * ...
 * ```
 * 
 * **Parsing Strategy**:
 * 1. Split on `---COMMIT-END---` delimiter to isolate commits
 * 2. For each block, extract: line 1 (hash), line 2 (subject), remaining (body)
 * 3. Feed subject + body to `conventional-commits-parser`
 * 4. Extract type, scope, breaking changes, etc.
 * 5. Handle parsing failures gracefully (classify as 'unknown')
 * 
 * **Conventional Commits Detection**:
 * - **Type**: First word before `(scope):` or `:` (e.g., 'feat', 'fix')
 * - **Scope**: Optional text in parentheses (e.g., `feat(api):`)
 * - **Breaking**: Detected from `BREAKING CHANGE:` footer or `!` suffix
 * - **Subject**: Remainder of first line after type/scope
 * - **Body**: All subsequent lines
 * 
 * **Error Resilience**:
 * - Empty output returns empty array (no error)
 * - Commits with fewer than 2 lines are skipped
 * - Parser exceptions result in 'unknown' type commit
 * - Individual failures don't affect other commits
 * 
 * **Performance**:
 * - O(n) complexity where n = number of commits
 * - Regex parsing via conventional-commits-parser
 * - No DOM parsing or heavy operations
 * - Suitable for thousands of commits
 * 
 * @example
 * **Single Conventional Commit**:
 * ```typescript
 * const output = [
 *   'abc123def456',
 *   'feat(auth): add login endpoint',
 *   'Implements JWT authentication',
 *   '---COMMIT-END---'
 * ].join('\n');
 * 
 * const commits = parseGitLog(output);
 * // Returns:
 * // [{
 * //   hash: 'abc123def456',
 * //   type: 'feat',
 * //   scope: 'auth',
 * //   subject: 'add login endpoint',
 * //   body: 'Implements JWT authentication',
 * //   breaking: false
 * // }]
 * ```
 * 
 * @example
 * **Multiple Commits with Breaking Change**:
 * ```typescript
 * const output = [
 *   'hash1', 'fix: correct bug', '', '---COMMIT-END---',
 *   'hash2', 'feat!: new API', 'BREAKING CHANGE: API changed', '---COMMIT-END---'
 * ].join('\n');
 * 
 * const commits = parseGitLog(output);
 * // Returns:
 * // [{
 * //   hash: 'hash1', type: 'fix', subject: 'correct bug',
 * //   body: undefined, breaking: false
 * // }, {
 * //   hash: 'hash2', type: 'feat', subject: 'new API',
 * //   body: 'BREAKING CHANGE: API changed', breaking: true
 * // }]
 * ```
 * 
 * @example
 * **Non-Conventional Commit**:
 * ```typescript
 * const output = 'abc123\nImprove code\nSome changes\n---COMMIT-END---';
 * const commits = parseGitLog(output);
 * // Returns:
 * // [{
 * //   hash: 'abc123',
 * //   type: 'unknown',  // No conventional format detected
 * //   subject: 'Improve code',
 * //   body: 'Some changes',
 * //   breaking: false
 * // }]
 * ```
 * 
 * @example
 * **Empty or Invalid Input**:
 * ```typescript
 * parseGitLog('');              // Returns: []
 * parseGitLog('   \n   ');      // Returns: []
 * parseGitLog('hash1');         // Returns: [] (fewer than 2 lines)
 * ```
 * 
 * @see {@link CommitInfo} - Type definition for parsed commit objects
 * @see https://www.conventionalcommits.org/ - Conventional Commits specification
 * @see https://github.com/conventional-changelog/conventional-commits-parser - Parser library
 * 
 * @internal
 */
function parseGitLog(output: string): CommitInfo[] {
  // Early return for empty output - no commits to parse
  if (!output.trim()) {
    return [];
  }
  
  const commits: CommitInfo[] = [];
  
  // Split output into individual commit blocks using custom delimiter
  // Filter removes empty blocks (trailing delimiters, etc.)
  const commitBlocks = output.split('---COMMIT-END---').filter(block => block.trim());
  
  for (const block of commitBlocks) {
    // Split block into lines: [hash, subject, body...]
    const lines = block.trim().split('\n');
    
    // Skip malformed blocks (need at least hash and subject)
    if (lines.length < 2) continue;
    
    // Extract structured data from the block
    const hash = lines[0];           // Line 1: commit SHA
    const subject = lines[1];        // Line 2: commit message subject
    const body = lines.slice(2).join('\n').trim();  // Remaining: commit body
    
    try {
      // Parse using Conventional Commits specification
      // Combines subject and body for full context (breaking changes may be in body)
      const parsed = conventionalCommitsParser.sync(subject + '\n\n' + body);
      
      // Build CommitInfo from parsed data
      commits.push({
        hash,
        type: parsed.type || 'unknown',  // Default to 'unknown' if type missing
        scope: parsed.scope || undefined,
        subject: parsed.subject || subject,  // Fallback to raw subject if parsing fails
        body: body || undefined,
        // Check if any note has title 'BREAKING CHANGE'
        breaking: parsed.notes?.some(note => note.title === 'BREAKING CHANGE') || false,
      });
    } catch (error) {
      // If conventional commits parsing fails, treat as unknown type
      // This ensures non-conventional commits don't break the system
      commits.push({
        hash,
        type: 'unknown',
        subject,
        body: body || undefined,
        breaking: false,
      });
    }
  }
  
  return commits;
}

/**
 * Finds the most recent git tag for a specific module with fallback to general tags.
 * 
 * This function implements VERSE's tag search strategy, which accommodates both
 * module-specific tags in monorepos and general version tags in single-repo projects.
 * The search follows a priority order:
 * 1. Module-specific tags (e.g., `core@1.0.0`) - for monorepo modules
 * 2. General version tags (e.g., `v1.0.0`) - for root modules or fallback
 * 3. null - when no tags exist at all
 * 
 * @param moduleName - The name of the module to search tags for.
 *                     This is used to construct the module tag pattern (`moduleName@*`).
 *                     Should match your module naming convention.
 * @param moduleType - Determines the search strategy:
 *                     - `'root'`: Skips module-specific search, goes directly to general tags
 *                     - `'module'`: Attempts module-specific search first, then falls back
 * @param options - Git operation options, primarily for specifying the working directory.
 * 
 * @returns Promise resolving to:
 *          - The most recent tag name (e.g., `'core@2.1.0'` or `'v1.5.0'`)
 *          - `null` if no tags exist in the repository
 * 
 * @remarks
 * **Search Strategy Details**:
 * 
 * For `moduleType === 'module'`:
 * 1. Search for `moduleName@*` pattern (e.g., `api@*`)
 * 2. Sort results by version (descending)
 * 3. Return first result if found
 * 4. If none found, use `git describe --tags` for general tags
 * 5. Return null if still no tags
 * 
 * For `moduleType === 'root'`:
 * 1. Skip module-specific search entirely
 * 2. Use `git describe --tags --abbrev=0 HEAD`
 * 3. Return null if no tags found
 * 
 * **Tag Sorting**:
 * - Uses `--sort=-version:refname` for correct semantic version ordering
 * - Sorts in descending order (newest first)
 * - Works with semantic versions, pre-releases, and build metadata
 * 
 * **Error Handling**:
 * - Non-throwing: Always returns null on errors
 * - Catches both module tag search failures and general tag failures
 * - Silent operation (no warnings logged)
 * 
 * **Use Cases**:
 * - Finding last release version before bumping
 * - Determining commits since last release
 * - Changelog generation starting point
 * - Version initialization in new repositories
 * 
 * @example
 * **Module in Monorepo**:
 * ```typescript
 * // Search for 'core' module tags, fallback to general
 * const tag = await getLastTagForModule('core', 'module', { cwd: '/monorepo' });
 * 
 * // Possible returns:
 * // 'core@1.2.3'  - Found module-specific tag
 * // 'v0.5.0'      - No module tags, found general tag
 * // null          - No tags at all (new repository)
 * ```
 * 
 * @example
 * **Root Project**:
 * ```typescript
 * // Skip module-specific search for root project
 * const tag = await getLastTagForModule('myapp', 'root', { cwd: '/repo' });
 * 
 * // Possible returns:
 * // 'v2.0.0'  - Found general tag
 * // '2.0.0'   - Found general tag without 'v' prefix
 * // null      - No tags exist
 * ```
 * 
 * @example
 * **New Module (No Tags)**:
 * ```typescript
 * const tag = await getLastTagForModule('new-feature', 'module', { cwd: '/repo' });
 * console.log(tag);  // null
 * 
 * // This indicates it's a first release - typically use version 0.1.0 or 1.0.0
 * const initialVersion = tag ? calculateNextVersion(tag) : '0.1.0';
 * ```
 * 
 * @example
 * **Version Comparison**:
 * ```typescript
 * import { parse, gt } from 'semver';
 * 
 * const lastTag = await getLastTagForModule('api', 'module', { cwd: '/repo' });
 * if (lastTag) {
 *   // Extract version and parse
 *   const version = lastTag.replace(/^.*@/, '').replace(/^v/, '');
 *   const semver = parse(version);
 *   
 *   console.log(`Last release: ${semver?.format()}`);
 * }
 * ```
 * 
 * @see {@link getModuleTagPattern} - Internal function that creates the search pattern
 * @see {@link getCommitsSinceLastTag} - Function that uses this to find commit range
 * @see {@link getAllTags} - Function to retrieve all tags (not just latest)
 */
export async function getLastTagForModule(
  moduleName: string,
  moduleType: 'root' | 'module',
  options: GitOptions = {}
): Promise<string | null> {
  // Resolve working directory, defaulting to current directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Generate glob pattern for module-specific tags (e.g., 'api@*')
    const moduleTagPattern = getModuleTagPattern(moduleName);
    
    // Only search for module-specific tags if it's not root
    // Root projects use general tags (v1.0.0) rather than module tags (root@1.0.0)
    if (moduleType !== 'root') {
      // Search for module-specific tags with version sorting
      // --sort=-version:refname: Sort by version in descending order (newest first)
      const { stdout } = await getExecOutput('git', ['tag', '-l', moduleTagPattern, '--sort=-version:refname'], {
        cwd,
        silent: true
      });
      
      // If we found module-specific tags, return the first (most recent)
      if (stdout.trim()) {
        return stdout.trim().split('\n')[0];
      }
    }
    
    // Fallback to general tags when:
    // 1. Module type is 'root', or
    // 2. No module-specific tags were found
    try {
      // git describe finds the most recent tag reachable from HEAD
      // --tags: Consider all tags (not just annotated)
      // --abbrev=0: Don't show commit hash suffix
      const { stdout: fallbackOutput } = await getExecOutput('git', ['describe', '--tags', '--abbrev=0', 'HEAD'], {
        cwd,
        silent: true
      });
      
      return fallbackOutput.trim();
    } catch {
      // If no tags at all, return null
      // This typically means it's a new repository or no releases yet
      return null;
    }
  } catch (error) {
    // Catch-all error handler: return null if any unexpected error occurs
    // This makes the function non-throwing, which is safer for version calculations
    return null;
  }
}

/**
 * Retrieves all git tags in the repository with parsed metadata.
 * 
 * This function fetches the complete list of tags from a repository and parses
 * each one to extract module names and version numbers. It's useful for:
 * - Listing all available versions
 * - Finding gaps in version history
 * - Generating release notes across all releases
 * - Identifying which modules have been released
 * 
 * Each tag is returned with both raw information (name and commit hash) and
 * parsed semantic information (module name and version number, when extractable).
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise resolving to an array of GitTag objects.
 *          Empty array if no tags exist or if git command fails.
 *          Tags are returned in the order provided by git (typically chronological).
 * 
 * @remarks
 * **Tag Format**:
 * - Uses `git tag -l` to list all tags
 * - Custom format: `%(refname:short) %(objectname)` provides name and hash
 * - Each tag is parsed using `parseTagName()` to extract module/version
 * 
 * **Parsing Behavior**:
 * - Module tags like `core@1.0.0` → `{ module: 'core', version: '1.0.0' }`
 * - Version tags like `v1.0.0` → `{ version: '1.0.0' }`
 * - Unparseable tags → `{ }` (empty module and version)
 * 
 * **Error Handling**:
 * - Non-throwing: Returns empty array on failure
 * - Individual parse failures don't affect other tags
 * - No warning logged (silent operation)
 * 
 * **Performance**:
 * - Single git command fetches all tags at once
 * - O(n) parsing where n = number of tags
 * - Suitable for repositories with thousands of tags
 * 
 * @example
 * **Mixed Tag Types**:
 * ```typescript
 * const tags = await getAllTags({ cwd: '/monorepo' });
 * 
 * // Example output:
 * // [
 * //   { name: 'core@1.0.0', hash: 'abc123...', module: 'core', version: '1.0.0' },
 * //   { name: 'api@2.1.0', hash: 'def456...', module: 'api', version: '2.1.0' },
 * //   { name: 'v0.5.0', hash: 'ghi789...', version: '0.5.0' },
 * //   { name: 'release-candidate', hash: 'jkl012...' }
 * // ]
 * ```
 * 
 * @example
 * **Finding Module Versions**:
 * ```typescript
 * const allTags = await getAllTags({ cwd: '/repo' });
 * 
 * // Filter to specific module
 * const coreTags = allTags.filter(tag => tag.module === 'core');
 * console.log(`Core module has ${coreTags.length} releases`);
 * 
 * // Get all versions
 * const versions = coreTags
 *   .map(tag => tag.version)
 *   .filter(v => v !== undefined);
 * ```
 * 
 * @example
 * **Version History Analysis**:
 * ```typescript
 * import { parse, compare } from 'semver';
 * 
 * const tags = await getAllTags({ cwd: '/repo' });
 * 
 * // Sort by semantic version
 * const sorted = tags
 *   .filter(t => t.version)
 *   .map(t => ({ ...t, semver: parse(t.version!) }))
 *   .filter(t => t.semver !== null)
 *   .sort((a, b) => compare(a.semver!, b.semver!));
 * 
 * console.log('Version history:', sorted.map(t => t.version));
 * ```
 * 
 * @example
 * **Changelog Generation**:
 * ```typescript
 * const tags = await getAllTags({ cwd: '/repo' });
 * 
 * // Get all module releases
 * const releases = tags.filter(tag => tag.module && tag.version);
 * 
 * // Generate changelog for each release
 * for (const release of releases) {
 *   const commits = await getCommitsInRange(
 *     `${release.name}^..${release.name}`,
 *     undefined,
 *     { cwd: '/repo' }
 *   );
 *   console.log(`## ${release.name}`);
 *   commits.forEach(c => console.log(`- ${c.subject}`));
 * }
 * ```
 * 
 * @example
 * **Empty Repository**:
 * ```typescript
 * const tags = await getAllTags({ cwd: '/new-repo' });
 * console.log(tags);  // []
 * 
 * if (tags.length === 0) {
 *   console.log('No releases yet - this is the first version');
 * }
 * ```
 * 
 * @see {@link GitTag} - Type definition for returned tag objects
 * @see {@link parseTagName} - Internal function that parses tag names
 * @see {@link getLastTagForModule} - Function to get only the latest tag
 */
export async function getAllTags(options: GitOptions = {}): Promise<GitTag[]> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // List all tags with custom format to get name and commit hash
    // %(refname:short): Tag name without refs/tags/ prefix
    // %(objectname): Full commit SHA that the tag points to
    const { stdout } = await getExecOutput('git', ['tag', '-l', '--format=%(refname:short) %(objectname)'], {
      cwd,
      silent: true
    });
    
    // Parse each line into a GitTag object
    return stdout
      .trim()
      .split('\n')
      .filter((line: string) => line.trim())  // Remove empty lines
      .map((line: string) => {
        // Each line format: "tagname commithash"
        const [name, hash] = line.split(' ');
        
        // Parse tag name to extract module and version (if present)
        const { module, version } = parseTagName(name);
        
        // Return structured tag object
        return {
          name,
          hash,
          module,
          version,
        };
      });
  } catch (error) {
    // Non-throwing: return empty array if git command fails
    // This could happen if not in a git repository or no tags exist
    return [];
  }
}

/**
 * Creates an annotated git tag at the current HEAD commit.
 * 
 * This function creates an annotated tag (as opposed to a lightweight tag), which
 * includes important metadata:
 * - Tagger name and email
 * - Tagging date and time
 * - Tag message/annotation
 * - GPG signature (if configured)
 * 
 * Annotated tags are **strongly recommended** for releases because:
 * 1. They contain more information than lightweight tags
 * 2. They can be signed for verification
 * 3. They're treated as full objects in git's object database
 * 4. GitHub and other platforms give them special treatment
 * 
 * @param tagName - The name for the new tag. Should follow your project's naming convention:
 *                  - Module tags: `moduleName@version` (e.g., `core@1.0.0`)
 *                  - Root tags: `v{version}` (e.g., `v1.0.0`)
 *                  - Must not already exist in the repository
 * @param message - The annotation message for the tag. Typically describes the release:
 *                  - Release version and date
 *                  - Major changes or highlights
 *                  - Links to changelog or release notes
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise that resolves when the tag is successfully created.
 * 
 * @throws {Error} If tag creation fails for any reason:
 *                 - Tag already exists
 *                 - Not in a git repository
 *                 - No git user configured
 *                 - Invalid tag name
 * 
 * @remarks
 * **Annotated vs Lightweight Tags**:
 * - This function creates *annotated* tags (`-a` flag)
 * - Annotated tags are objects with metadata
 * - Lightweight tags are just pointers to commits
 * - Always use annotated tags for releases
 * 
 * **Tag Naming Conventions**:
 * - Should match your existing tag pattern
 * - Module tags for monorepos: `module@version`
 * - Root tags for single repos: `v{version}` or `{version}`
 * - Follow semantic versioning: `MAJOR.MINOR.PATCH`
 * 
 * **After Creating**:
 * - Tag is created locally only
 * - Use `pushTags()` to upload to remote repository
 * - Tag points to current HEAD (working directory state doesn't matter)
 * 
 * **Error Scenarios**:
 * - Duplicate tag: Tag with same name already exists
 * - No git user: Git config `user.name` and `user.email` not set
 * - Invalid name: Contains spaces or special characters
 * 
 * @example
 * **Basic Release Tag**:
 * ```typescript
 * // Create a release tag for version 1.0.0
 * await createTag(
 *   'v1.0.0',
 *   'Release version 1.0.0\n\n- First stable release\n- Production ready',
 *   { cwd: '/repo' }
 * );
 * ```
 * 
 * @example
 * **Module Tag in Monorepo**:
 * ```typescript
 * // Tag a specific module in a monorepo
 * await createTag(
 *   'api@2.1.0',
 *   'API Module v2.1.0\n\nAdded new authentication endpoints',
 *   { cwd: '/monorepo' }
 * );
 * ```
 * 
 * @example
 * **Complete Release Flow**:
 * ```typescript
 * import { createTag, pushTags } from './git/index.js';
 * import { applySnapshotSuffix } from './utils/versioning.js';
 * 
 * // Determine next version (e.g., from commit analysis)
 * const nextVersion = '1.2.0';
 * 
 * // Update version in project files
 * await updateProjectVersion(nextVersion);
 * 
 * // Commit version changes
 * await addChangedFiles({ cwd: '/repo' });
 * await commitChanges(`chore: release ${nextVersion}`, { cwd: '/repo' });
 * 
 * // Create release tag
 * await createTag(
 *   `v${nextVersion}`,
 *   `Release version ${nextVersion}`,
 *   { cwd: '/repo' }
 * );
 * 
 * // Push commits and tags
 * await pushCommits({ cwd: '/repo' });
 * await pushTags({ cwd: '/repo' });
 * 
 * // Bump to next snapshot version
 * const snapshotVersion = applySnapshotSuffix(nextVersion);
 * await updateProjectVersion(snapshotVersion);
 * ```
 * 
 * @example
 * **Error Handling**:
 * ```typescript
 * try {
 *   await createTag('v1.0.0', 'Release v1.0.0', { cwd: '/repo' });
 *   console.log('Tag created successfully');
 * } catch (error) {
 *   if (error.message.includes('already exists')) {
 *     console.error('Tag v1.0.0 already exists!');
 *   } else {
 *     console.error('Failed to create tag:', error);
 *   }
 * }
 * ```
 * 
 * @example
 * **With Changelog in Message**:
 * ```typescript
 * const changelog = [
 *   'Release v2.0.0',
 *   '',
 *   '## Breaking Changes',
 *   '- API endpoints restructured',
 *   '',
 *   '## Features',
 *   '- New authentication system',
 *   '- Improved performance',
 *   '',
 *   '## Bug Fixes',
 *   '- Fixed memory leak in cache'
 * ].join('\n');
 * 
 * await createTag('v2.0.0', changelog, { cwd: '/repo' });
 * ```
 * 
 * @see {@link pushTags} - Function to push tags to remote repository
 * @see {@link getLastTagForModule} - Function to find existing tags
 * @see https://git-scm.com/book/en/v2/Git-Basics-Tagging - Git tagging documentation
 */
export async function createTag(
  tagName: string,
  message: string,
  options: GitOptions = {}
): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Create annotated tag with message
    // -a: Create an annotated tag (full git object)
    // -m: Provide tag message inline
    await exec('git', ['tag', '-a', tagName, '-m', message], {
      cwd
    });
  } catch (error) {
    // Wrap error with more context for debugging
    // Common failures: tag exists, no git repo, no user config
    throw new Error(`Failed to create tag ${tagName}: ${error}`);
  }
}

/**
 * Pushes all local tags to the configured remote repository.
 * 
 * This function uploads all tags that exist locally but not on the remote.
 * It's equivalent to running `git push --tags`, which:
 * - Pushes **only tags**, not commits
 * - Pushes **all tags** at once (not selective)
 * - Requires network access and authentication
 * - May fail if remote has conflicting tags
 * 
 * **Important**: This function only pushes tags. If you have unpushed commits,
 * you need to call `pushCommits()` separately.
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise that resolves when all tags are successfully pushed.
 * 
 * @throws {Error} If push operation fails for any reason:
 *                 - No remote repository configured
 *                 - Authentication failure (credentials, SSH key)
 *                 - Network connectivity issues
 *                 - Remote rejects (e.g., conflicting tags)
 *                 - Protected tags (branch protection rules)
 * 
 * @remarks
 * **What Gets Pushed**:
 * - All annotated tags
 * - All lightweight tags
 * - Only tags that don't exist on remote
 * - Does NOT push commits
 * 
 * **Remote Configuration**:
 * - Requires a remote named 'origin' (or other configured remote)
 * - Remote must be accessible (network, authentication)
 * - Push access required on remote repository
 * 
 * **Authentication**:
 * - HTTPS: May prompt for username/password or use credential helper
 * - SSH: Uses SSH key configured in ~/.ssh
 * - GitHub Actions: Uses GITHUB_TOKEN automatically
 * 
 * **Error Scenarios**:
 * - No remote: Repository has no remote configured
 * - Auth failure: Invalid credentials or SSH key
 * - Network: Timeout or connectivity issues
 * - Conflicts: Tag exists on remote with different commit
 * 
 * **Best Practices**:
 * 1. Always push commits before or after pushing tags
 * 2. Verify tags locally before pushing (`getAllTags()`)
 * 3. Use CI/CD for automated pushing
 * 4. Handle authentication in secure manner
 * 
 * @example
 * **Basic Usage**:
 * ```typescript
 * // Push all local tags to remote
 * await pushTags({ cwd: '/repo' });
 * console.log('All tags pushed successfully');
 * ```
 * 
 * @example
 * **Complete Release Workflow**:
 * ```typescript
 * import { createTag, pushTags, pushCommits } from './git/index.js';
 * 
 * // Create release tag locally
 * await createTag('v1.0.0', 'Release v1.0.0', { cwd: '/repo' });
 * 
 * // Push commits first (release commit)
 * await pushCommits({ cwd: '/repo' });
 * 
 * // Then push tags
 * await pushTags({ cwd: '/repo' });
 * 
 * console.log('Release v1.0.0 published!');
 * ```
 * 
 * @example
 * **Error Handling**:
 * ```typescript
 * try {
 *   await pushTags({ cwd: '/repo' });
 * } catch (error) {
 *   if (error.message.includes('authentication')) {
 *     console.error('Authentication failed. Check credentials.');
 *   } else if (error.message.includes('remote')) {
 *     console.error('No remote repository configured.');
 *   } else {
 *     console.error('Failed to push tags:', error);
 *   }
 * }
 * ```
 * 
 * @example
 * **CI/CD Pipeline (GitHub Actions)**:
 * ```typescript
 * // In GitHub Actions, authentication is automatic
 * import { pushTags } from './git/index.js';
 * 
 * // GitHub Actions automatically configures git credentials
 * // using GITHUB_TOKEN
 * await pushTags({ cwd: process.cwd() });
 * 
 * // Tags are now visible on GitHub releases page
 * ```
 * 
 * @example
 * **Dry Run (Check Before Push)**:
 * ```typescript
 * import { getAllTags, pushTags } from './git/index.js';
 * 
 * // Get all local tags
 * const localTags = await getAllTags({ cwd: '/repo' });
 * console.log('Local tags:', localTags.map(t => t.name));
 * 
 * // Confirm before pushing
 * const confirm = await askUser('Push these tags?');
 * if (confirm) {
 *   await pushTags({ cwd: '/repo' });
 * }
 * ```
 * 
 * @see {@link createTag} - Function to create tags locally
 * @see {@link pushCommits} - Function to push commits
 * @see {@link getAllTags} - Function to list local tags
 * @see https://git-scm.com/docs/git-push - Git push documentation
 */
export async function pushTags(options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Push all tags to the remote repository
    // --tags: Push all tags (annotated and lightweight)
    // This does NOT push commits, only tags
    await exec('git', ['push', '--tags'], { cwd });
  } catch (error) {
    // Wrap error with context
    // Common failures: no remote, auth, network, conflicts
    throw new Error(`Failed to push tags: ${error}`);
  }
}

/**
 * Generates a glob pattern for searching module-specific git tags.
 * 
 * This internal utility creates a pattern string used by `git tag -l` to find
 * all tags belonging to a specific module in a monorepo. The pattern follows
 * the convention: `moduleName@*`
 * 
 * This matches tags like:
 * - `core@1.0.0`
 * - `core@2.1.0-beta`
 * - `core@3.0.0-rc.1+build.123`
 * 
 * @param moduleName - The name of the module to create a pattern for.
 *                     Should match the naming convention used in your tags.
 * 
 * @returns A glob pattern string that matches all tags for the module.
 *          Format: `moduleName@*` where `*` matches any version string.
 * 
 * @remarks
 * **Pattern Syntax**:
 * - Uses shell glob pattern (not regex)
 * - `*` matches zero or more characters
 * - Pattern is case-sensitive
 * - No validation is performed on module name
 * 
 * **Usage Context**:
 * - Used internally by `getLastTagForModule()`
 * - Passed to `git tag -l` command
 * - Only matches module-specific tags, not general tags
 * 
 * **Monorepo Convention**:
 * - Assumes tags follow `module@version` format
 * - The `@` separator distinguishes module tags from general tags
 * - Consistent with npm package naming (`@scope/package`)
 * 
 * @example
 * **Basic Pattern Generation**:
 * ```typescript
 * const pattern = getModuleTagPattern('core');
 * console.log(pattern);  // 'core@*'
 * 
 * // This pattern matches:
 * // - 'core@1.0.0'
 * // - 'core@2.1.0-alpha'
 * // - 'core@3.0.0+build123'
 * 
 * // Does NOT match:
 * // - 'v1.0.0'
 * // - 'api@1.0.0'
 * // - 'core-1.0.0'  (wrong separator)
 * ```
 * 
 * @example
 * **Usage in Git Command**:
 * ```typescript
 * const moduleName = 'api';
 * const pattern = getModuleTagPattern(moduleName);
 * 
 * // Equivalent to running:
 * // git tag -l 'api@*'
 * const { stdout } = await getExecOutput('git', [
 *   'tag', '-l', pattern, '--sort=-version:refname'
 * ]);
 * ```
 * 
 * @example
 * **Pattern Matching Behavior**:
 * ```typescript
 * // Different module names produce different patterns
 * getModuleTagPattern('core');     // 'core@*'
 * getModuleTagPattern('api');      // 'api@*'
 * getModuleTagPattern('frontend'); // 'frontend@*'
 * 
 * // Each pattern matches only its own module's tags
 * ```
 * 
 * @see {@link getLastTagForModule} - Function that uses this pattern
 * @see {@link parseTagName} - Function that parses matched tags
 * 
 * @internal
 */
function getModuleTagPattern(moduleName: string): string {
  // Create glob pattern for module-specific tags
  // Format: moduleName@* where * matches any version
  return `${moduleName}@*`;
}

/**
 * Parses a git tag name to extract module and version components.
 * 
 * This internal utility function handles multiple tag naming conventions used in
 * VERSE and returns a structured object with extracted metadata. It supports:
 * - **Module tags**: `moduleName@version` (monorepo convention)
 * - **Version tags**: `v{version}` or `{version}` (single repo convention)
 * - **Custom tags**: Returns empty object for unrecognized formats
 * 
 * @param tagName - The full git tag name to parse.
 *                  Can be any string, but structured formats are recognized.
 * 
 * @returns Object with optional `module` and `version` fields:
 *          - Both present: Module tag (e.g., `core@1.0.0`)
 *          - Only version: General tag (e.g., `v1.0.0`)
 *          - Empty object: Unrecognized format
 * 
 * @remarks
 * **Parsing Strategies**:
 * 
 * 1. **Module Tag Pattern** (`^(.+)@(.+)$`):
 *    - Matches: `moduleName@version`
 *    - Example: `core@1.0.0` → `{ module: 'core', version: '1.0.0' }`
 *    - The `@` is the definitive separator
 * 
 * 2. **Version Pattern** (`^v?(\d+\.\d+\.\d+.*)$`):
 *    - Matches: Semantic versions with optional 'v' prefix
 *    - Example: `v1.0.0` → `{ version: '1.0.0' }`
 *    - Example: `2.1.0-beta` → `{ version: '2.1.0-beta' }`
 *    - Requires at least MAJOR.MINOR.PATCH
 * 
 * 3. **Unrecognized**:
 *    - Returns: `{}`
 *    - Examples: `release-candidate`, `latest`, `stable`
 * 
 * **Regex Details**:
 * - Module pattern: Greedy match on both sides of `@`
 * - Version pattern: Matches `MAJOR.MINOR.PATCH` followed by any characters
 * - The `.*` in version pattern captures pre-release and build metadata
 * 
 * **Case Sensitivity**:
 * - All matching is case-sensitive
 * - `Core@1.0.0` and `core@1.0.0` are different modules
 * 
 * @example
 * **Module-Specific Tags**:
 * ```typescript
 * parseTagName('core@1.0.0');
 * // Returns: { module: 'core', version: '1.0.0' }
 * 
 * parseTagName('api@2.1.0-beta.1');
 * // Returns: { module: 'api', version: '2.1.0-beta.1' }
 * 
 * parseTagName('frontend@1.0.0+build.123');
 * // Returns: { module: 'frontend', version: '1.0.0+build.123' }
 * ```
 * 
 * @example
 * **General Version Tags**:
 * ```typescript
 * parseTagName('v1.0.0');
 * // Returns: { version: '1.0.0' }
 * 
 * parseTagName('2.1.0');
 * // Returns: { version: '2.1.0' }
 * 
 * parseTagName('v1.0.0-rc.1');
 * // Returns: { version: '1.0.0-rc.1' }
 * ```
 * 
 * @example
 * **Unrecognized Formats**:
 * ```typescript
 * parseTagName('release-candidate');
 * // Returns: {}
 * 
 * parseTagName('latest');
 * // Returns: {}
 * 
 * parseTagName('v1.0');  // Missing patch version
 * // Returns: {}
 * ```
 * 
 * @example
 * **Edge Cases**:
 * ```typescript
 * // Empty string
 * parseTagName('');  // Returns: {}
 * 
 * // Multiple @ symbols (greedy match)
 * parseTagName('scope@module@1.0.0');
 * // Returns: { module: 'scope@module', version: '1.0.0' }
 * 
 * // Version with @ (matched as module tag)
 * parseTagName('v1.0.0@test');
 * // Returns: { module: 'v1.0.0', version: 'test' }
 * ```
 * 
 * @example
 * **Usage in Tag Processing**:
 * ```typescript
 * const tags = ['core@1.0.0', 'api@2.0.0', 'v0.5.0', 'latest'];
 * 
 * const parsed = tags.map(tag => ({
 *   name: tag,
 *   ...parseTagName(tag)
 * }));
 * 
 * // Filter to only module tags
 * const moduleTags = parsed.filter(t => t.module);
 * console.log(moduleTags);
 * // [{ name: 'core@1.0.0', module: 'core', version: '1.0.0' }, ...]
 * ```
 * 
 * @see {@link GitTag} - Type that uses this parsed data
 * @see {@link getAllTags} - Function that uses this parser
 * @see {@link getModuleTagPattern} - Function that creates search patterns
 * 
 * @internal
 */
function parseTagName(tagName: string): { module?: string; version?: string } {
  // Try to match module-specific tag pattern: moduleName@version
  // Regex: ^(.+)@(.+)$
  //   ^(.+)  - Start of string, capture group 1 (module name, greedy)
  //   @      - Literal @ separator
  //   (.+)$  - Capture group 2 (version, greedy), end of string
  const match = tagName.match(/^(.+)@(.+)$/);
  
  if (match) {
    // Module tag matched - return both components
    return {
      module: match[1],
      version: match[2],
    };
  }
  
  // Try to match version-only tag pattern: v?MAJOR.MINOR.PATCH...
  // Regex: ^v?(\d+\.\d+\.\d+.*)$
  //   ^v?           - Start, optional 'v' prefix
  //   (\d+\.\d+\.\d+  - Capture group: MAJOR.MINOR.PATCH (digits)
  //   .*)$          - Any remaining characters (pre-release, metadata), end
  const versionMatch = tagName.match(/^v?(\d+\.\d+\.\d+.*)$/);
  if (versionMatch) {
    // Version tag matched - return only version (no module)
    return {
      version: versionMatch[1],
    };
  }
  
  // Unrecognized format - return empty object
  return {};
}

/**
 * Checks if the git working directory is clean (no uncommitted changes).
 * 
 * This function uses `git status --porcelain` to detect any changes in the working
 * directory or staging area. A "clean" state means:
 * - No modified files (tracked or untracked)
 * - No staged changes
 * - No deleted files
 * - No renamed files
 * - No untracked files
 * 
 * This is useful for:
 * - Pre-release checks to ensure no uncommitted work
 * - CI/CD validation before tagging
 * - Safety checks before destructive operations
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise resolving to:
 *          - `true`: Working directory is clean (no changes)
 *          - `false`: There are uncommitted changes OR git command failed
 * 
 * @remarks
 * **What is Detected**:
 * - Modified tracked files (M)
 * - New untracked files (??)
 * - Deleted files (D)
 * - Renamed files (R)
 * - Staged but uncommitted changes (A, M, D in index)
 * 
 * **Porcelain Format**:
 * - `git status --porcelain` provides machine-readable output
 * - Empty output = clean working directory
 * - Any output = changes present
 * - Format: `XY path` where X=index, Y=working tree
 * 
 * **Error Handling**:
 * - Non-throwing: Returns `false` on error
 * - Git command failures treated as "not clean"
 * - Safe default behavior for safety checks
 * 
 * **Use Cases**:
 * - Pre-commit hooks
 * - Release validation
 * - Deployment readiness checks
 * - Preventing accidental overwrites
 * 
 * @example
 * **Pre-Release Check**:
 * ```typescript
 * const isClean = await isWorkingDirectoryClean({ cwd: '/repo' });
 * 
 * if (!isClean) {
 *   console.error('Cannot release: uncommitted changes detected');
 *   console.error('Please commit or stash your changes first');
 *   process.exit(1);
 * }
 * 
 * // Proceed with release
 * await createTag('v1.0.0', 'Release v1.0.0');
 * ```
 * 
 * @example
 * **CI/CD Validation**:
 * ```typescript
 * // Ensure build didn't modify files
 * await runBuild();
 * 
 * const stillClean = await isWorkingDirectoryClean({ cwd: process.cwd() });
 * if (!stillClean) {
 *   console.error('Build process modified files!');
 *   console.error('Check your build configuration');
 *   throw new Error('Dirty working directory after build');
 * }
 * ```
 * 
 * @example
 * **Interactive Prompt**:
 * ```typescript
 * if (!await isWorkingDirectoryClean({ cwd: '/repo' })) {
 *   const proceed = await askUser(
 *     'You have uncommitted changes. Continue anyway?'
 *   );
 *   
 *   if (!proceed) {
 *     console.log('Operation cancelled');
 *     return;
 *   }
 * }
 * ```
 * 
 * @example
 * **With Detailed Status**:
 * ```typescript
 * import { isWorkingDirectoryClean } from './git/index.js';
 * import { getExecOutput } from '@actions/exec';
 * 
 * if (!await isWorkingDirectoryClean({ cwd: '/repo' })) {
 *   console.log('Working directory has changes:');
 *   
 *   // Show detailed status
 *   const { stdout } = await getExecOutput('git', ['status'], {
 *     cwd: '/repo'
 *   });
 *   console.log(stdout);
 * }
 * ```
 * 
 * @see {@link hasChangesToCommit} - Similar function (returns opposite boolean)
 * @see https://git-scm.com/docs/git-status - Git status documentation
 */
export async function isWorkingDirectoryClean(options: GitOptions = {}): Promise<boolean> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Get machine-readable status output
    // --porcelain: Stable, easy-to-parse format
    const { stdout } = await getExecOutput('git', ['status', '--porcelain'], {
      cwd,
      silent: true
    });
    
    // Empty output means clean working directory
    // Any output indicates changes (modified, untracked, staged, etc.)
    return stdout.trim() === '';
  } catch (error) {
    // On error, assume directory is not clean (safe default)
    // This could happen if not a git repo, or permissions issue
    return false;
  }
}

/**
 * Retrieves the name of the currently checked out git branch.
 * 
 * This function returns the active branch name, which is useful for:
 * - Conditional logic based on branch (e.g., only release from 'main')
 * - CI/CD branch-specific workflows
 * - Logging and debugging
 * - Branch validation before operations
 * 
 * **Special Case**: In detached HEAD state (not on any branch), this returns
 * an empty string. This happens when checking out a specific commit or tag.
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise resolving to the current branch name.
 *          Empty string if in detached HEAD state.
 *          Examples: 'main', 'develop', 'feature/new-feature'
 * 
 * @throws {Error} If git command fails:
 *                 - Not in a git repository
 *                 - Permissions issues
 *                 - Git binary not found
 * 
 * @remarks
 * **Detached HEAD State**:
 * - Occurs when `git checkout <commit>` or `git checkout <tag>`
 * - Not on any branch, HEAD points directly to a commit
 * - Returns empty string (not an error)
 * - Use `git rev-parse HEAD` to get commit hash instead
 * 
 * **Branch Naming**:
 * - Returns full branch name as-is
 * - Includes slashes: `feature/new-feature`
 * - No `refs/heads/` prefix (short name)
 * 
 * @example
 * **Branch-Specific Logic**:
 * ```typescript
 * const branch = await getCurrentBranch({ cwd: '/repo' });
 * 
 * if (branch !== 'main' && branch !== 'master') {
 *   console.error('Releases can only be created from main/master branch');
 *   console.error(`Current branch: ${branch}`);
 *   process.exit(1);
 * }
 * 
 * // Proceed with release
 * ```
 * 
 * @example
 * **Detached HEAD Detection**:
 * ```typescript
 * const branch = await getCurrentBranch({ cwd: '/repo' });
 * 
 * if (branch === '') {
 *   console.warn('In detached HEAD state');
 *   const sha = await getCurrentCommitShortSha({ cwd: '/repo' });
 *   console.log(`Current commit: ${sha}`);
 * } else {
 *   console.log(`Current branch: ${branch}`);
 * }
 * ```
 * 
 * @example
 * **CI/CD Branch Detection**:
 * ```typescript
 * const branch = await getCurrentBranch({ cwd: process.cwd() });
 * 
 * // GitHub Actions
 * const githubRef = process.env.GITHUB_REF;  // refs/heads/main
 * const githubBranch = githubRef?.replace('refs/heads/', '');
 * 
 * console.log(`Git branch: ${branch}`);
 * console.log(`GitHub branch: ${githubBranch}`);
 * ```
 * 
 * @see {@link getCurrentCommitShortSha} - Function to get commit hash
 * @see https://git-scm.com/docs/git-branch - Git branch documentation
 */
export async function getCurrentBranch(options: GitOptions = {}): Promise<string> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Get the current branch name
    // --show-current: Returns active branch name or empty string if detached
    const { stdout } = await getExecOutput('git', ['branch', '--show-current'], {
      cwd,
      silent: true
    });
    
    // Return branch name (or empty string for detached HEAD)
    return stdout.trim();
  } catch (error) {
    // Wrap error with context
    throw new Error(`Failed to get current branch: ${error}`);
  }
}

/**
 * Retrieves the abbreviated (short) SHA-1 hash of the current HEAD commit.
 * 
 * This function returns a shortened version of the commit hash (typically 7 characters),
 * which is:
 * - Human-readable and easier to reference
 * - Suitable for build metadata in semantic versions
 * - Commonly used in CI/CD for build identification
 * - Still unique enough for most repositories
 * 
 * The short SHA is git's default abbreviated format and balances uniqueness with brevity.
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise resolving to the abbreviated commit SHA.
 *          Typically 7 characters (e.g., 'abc1234').
 *          Length may vary based on repository size to ensure uniqueness.
 * 
 * @throws {Error} If git command fails:
 *                 - Not in a git repository
 *                 - No commits exist (empty repository)
 *                 - Permissions issues
 * 
 * @remarks
 * **Short vs Full SHA**:
 * - Full SHA: 40 hexadecimal characters
 * - Short SHA: 7 characters by default (git's abbreviation)
 * - Git ensures short SHA is unique within the repository
 * - Larger repos may use longer abbreviations automatically
 * 
 * **Use Cases**:
 * - **Build metadata**: `1.0.0+abc1234`
 * - **Version identification**: Link code to exact commit
 * - **CI/CD tracking**: Identify which commit was built/deployed
 * - **Debug information**: Include in error reports
 * 
 * **Semantic Versioning**:
 * - Build metadata format: `version+sha` (e.g., `1.0.0+abc1234`)
 * - Metadata doesn't affect version precedence
 * - Helps track exact code for each build
 * 
 * @example
 * **Build Metadata in Version**:
 * ```typescript
 * import { getCurrentCommitShortSha } from './git/index.js';
 * 
 * const version = '1.0.0';
 * const sha = await getCurrentCommitShortSha({ cwd: '/repo' });
 * 
 * // Create version with build metadata
 * const versionWithBuild = `${version}+${sha}`;
 * console.log(versionWithBuild);  // '1.0.0+abc1234'
 * 
 * // This is SemVer compliant build metadata
 * ```
 * 
 * @example
 * **CI/CD Build Identification**:
 * ```typescript
 * const sha = await getCurrentCommitShortSha({ cwd: process.cwd() });
 * 
 * console.log(`Building commit: ${sha}`);
 * console.log(`Docker tag: myapp:${sha}`);
 * 
 * // Set as environment variable for runtime
 * process.env.BUILD_SHA = sha;
 * ```
 * 
 * @example
 * **Error Reports with Commit Info**:
 * ```typescript
 * try {
 *   // Application logic
 *   await runApplication();
 * } catch (error) {
 *   const sha = await getCurrentCommitShortSha({ cwd: '/repo' });
 *   
 *   console.error('Application error:');
 *   console.error(`Commit: ${sha}`);
 *   console.error(`Error: ${error.message}`);
 *   
 *   // Send to error tracking with commit information
 *   await reportError({ error, commit: sha });
 * }
 * ```
 * 
 * @example
 * **Deployment Tracking**:
 * ```typescript
 * import { getCurrentCommitShortSha, getCurrentBranch } from './git/index.js';
 * 
 * const sha = await getCurrentCommitShortSha({ cwd: '/repo' });
 * const branch = await getCurrentBranch({ cwd: '/repo' });
 * 
 * console.log(`Deploying ${branch}@${sha} to production`);
 * 
 * // Log deployment
 * await logDeployment({
 *   environment: 'production',
 *   branch,
 *   commit: sha,
 *   timestamp: new Date()
 * });
 * ```
 * 
 * @see {@link getCurrentBranch} - Function to get current branch name
 * @see https://git-scm.com/docs/git-rev-parse - Git rev-parse documentation
 * @see https://semver.org/#spec-item-10 - SemVer build metadata specification
 */
export async function getCurrentCommitShortSha(options: GitOptions = {}): Promise<string> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Get abbreviated commit SHA
    // rev-parse: Resolve git revision to commit hash
    // --short: Return abbreviated version (typically 7 chars)
    // HEAD: The current commit
    const { stdout } = await getExecOutput('git', ['rev-parse', '--short', 'HEAD'], {
      cwd,
      silent: true
    });
    
    // Return the short SHA
    return stdout.trim();
  } catch (error) {
    // Wrap error with context
    throw new Error(`Failed to get current commit SHA: ${error}`);
  }
}

/**
 * Stages all changed files in the working directory for the next commit.
 * 
 * This function executes `git add .` which stages:
 * - All modified tracked files
 * - All new untracked files
 * - All deleted files
 * 
 * **Warning**: This stages **everything** in the working directory. Use with caution
 * in interactive environments. For selective staging, use git commands directly.
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise that resolves when all files are successfully staged.
 * 
 * @throws {Error} If git add command fails:
 *                 - Not in a git repository
 *                 - Permissions issues
 *                 - Invalid .gitignore patterns
 * 
 * @remarks
 * **What Gets Staged**:
 * - Modified files (M)
 * - New files (A)
 * - Deleted files (D)
 * - Respects .gitignore (won't stage ignored files)
 * 
 * **What Doesn't Get Staged**:
 * - Files explicitly ignored in .gitignore
 * - Files in .git/ directory
 * - Already-staged files (no duplicate staging)
 * 
 * **Best Practices**:
 * - Review changes before staging (`git status`, `git diff`)
 * - Use in automated contexts (CI/CD, release scripts)
 * - Consider selective staging in interactive workflows
 * - Always check working directory state before committing
 * 
 * @example
 * **Automated Release Flow**:
 * ```typescript
 * // Update version files
 * await updateVersionFiles('1.0.0');
 * 
 * // Stage all changes
 * await addChangedFiles({ cwd: '/repo' });
 * 
 * // Commit the release
 * await commitChanges('chore: release 1.0.0', { cwd: '/repo' });
 * ```
 * 
 * @example
 * **With Pre-Check**:
 * ```typescript
 * import { addChangedFiles, hasChangesToCommit } from './git/index.js';
 * 
 * // Verify there are changes to stage
 * if (await hasChangesToCommit({ cwd: '/repo' })) {
 *   await addChangedFiles({ cwd: '/repo' });
 *   console.log('Files staged successfully');
 * } else {
 *   console.log('No changes to stage');
 * }
 * ```
 * 
 * @example
 * **Error Handling**:
 * ```typescript
 * try {
 *   await addChangedFiles({ cwd: '/repo' });
 * } catch (error) {
 *   console.error('Failed to stage files:', error.message);
 *   
 *   // Show what failed to stage
 *   const { stdout } = await getExecOutput('git', ['status'], {
 *     cwd: '/repo'
 *   });
 *   console.log(stdout);
 * }
 * ```
 * 
 * @see {@link commitChanges} - Function to commit staged changes
 * @see {@link hasChangesToCommit} - Function to check for changes
 * @see https://git-scm.com/docs/git-add - Git add documentation
 */
export async function addChangedFiles(options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Stage all changes in the working directory
    // '.': Current directory and all subdirectories
    await exec('git', ['add', '.'], { cwd });
  } catch (error) {
    // Wrap error with context
    throw new Error(`Failed to add changed files: ${error}`);
  }
}

/**
 * Creates a git commit with the specified message using currently staged changes.
 * 
 * This function commits all files that have been staged (via `git add`).
 * Files must be staged before calling this function, or the commit will fail
 * with a "nothing to commit" error.
 * 
 * @param message - The commit message. Should follow Conventional Commits format
 *                  for proper semantic versioning:
 *                  - `feat: description` - New feature
 *                  - `fix: description` - Bug fix
 *                  - `chore: description` - Maintenance
 *                  - `docs: description` - Documentation
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise that resolves when commit is created successfully.
 * 
 * @throws {Error} If commit fails:
 *                 - No changes staged (nothing to commit)
 *                 - No git user configured (user.name or user.email)
 *                 - Not in a git repository
 *                 - Empty commit message
 * 
 * @remarks
 * **Prerequisites**:
 * - Files must be staged first (`git add`)
 * - Git user must be configured:
 *   - `git config user.name "Your Name"`
 *   - `git config user.email "you@example.com"`
 * 
 * **Conventional Commits**:
 * - Format: `<type>(<scope>): <subject>`
 * - Types: feat, fix, docs, chore, refactor, test, style
 * - Breaking changes: Add `!` or `BREAKING CHANGE:` footer
 * - Example: `feat(auth): add JWT authentication`
 * 
 * **CI/CD Context**:
 * - GitHub Actions: User configured automatically
 * - Other CI: May need to configure git user first
 * - Use bot accounts for automated commits
 * 
 * @example
 * **Basic Commit**:
 * ```typescript
 * // Stage changes
 * await addChangedFiles({ cwd: '/repo' });
 * 
 * // Commit with message
 * await commitChanges('fix: correct validation logic', { cwd: '/repo' });
 * ```
 * 
 * @example
 * **Release Commit**:
 * ```typescript
 * await addChangedFiles({ cwd: '/repo' });
 * await commitChanges('chore: release 1.0.0', { cwd: '/repo' });
 * 
 * // Create tag after commit
 * await createTag('v1.0.0', 'Release v1.0.0', { cwd: '/repo' });
 * ```
 * 
 * @example
 * **Conventional Commits**:
 * ```typescript
 * // Feature commit
 * await commitChanges('feat(api): add user authentication');
 * 
 * // Bug fix
 * await commitChanges('fix(validation): handle empty input');
 * 
 * // Breaking change
 * await commitChanges('feat!: redesign API endpoints\n\nBREAKING CHANGE: All endpoints now require authentication');
 * ```
 * 
 * @example
 * **Error Handling**:
 * ```typescript
 * try {
 *   await commitChanges('chore: update', { cwd: '/repo' });
 * } catch (error) {
 *   if (error.message.includes('nothing to commit')) {
 *     console.log('No changes to commit');
 *   } else if (error.message.includes('user')) {
 *     console.error('Git user not configured');
 *     console.error('Run: git config user.name "Your Name"');
 *   } else {
 *     console.error('Commit failed:', error);
 *   }
 * }
 * ```
 * 
 * @see {@link addChangedFiles} - Function to stage files before committing
 * @see {@link pushCommits} - Function to push commits to remote
 * @see https://www.conventionalcommits.org/ - Conventional Commits specification
 * @see https://git-scm.com/docs/git-commit - Git commit documentation
 */
export async function commitChanges(message: string, options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Create commit with staged changes
    // -m: Specify commit message inline
    await exec('git', ['commit', '-m', message], { cwd });
  } catch (error) {
    // Wrap error with context
    throw new Error(`Failed to commit changes: ${error}`);
  }
}

/**
 * Pushes local commits to the remote repository.
 * 
 * This function uploads all commits from the current branch that don't exist
 * on the remote. It uses `git push` without arguments, which:
 * - Pushes the current branch to its configured upstream
 * - Only pushes commits (use `pushTags()` for tags)
 * - Requires network access and authentication
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise that resolves when commits are successfully pushed.
 * 
 * @throws {Error} If push fails:
 *                 - No remote configured
 *                 - No upstream branch set
 *                 - Authentication failure
 *                 - Network issues
 *                 - Remote rejects (e.g., force push needed, protected branch)
 * 
 * @remarks
 * **What Gets Pushed**:
 * - All local commits not on remote
 * - Only current branch
 * - Does NOT push tags (use `pushTags()` separately)
 * 
 * **Prerequisites**:
 * - Remote repository configured (e.g., 'origin')
 * - Upstream branch set (`git push -u origin branch`)
 * - Valid authentication (SSH key or HTTPS credentials)
 * - Network connectivity
 * 
 * **Authentication**:
 * - HTTPS: Credential helper or token
 * - SSH: SSH key in ~/.ssh/
 * - GitHub Actions: GITHUB_TOKEN automatic
 * 
 * **Common Errors**:
 * - No upstream: Set with `git push -u origin branch`
 * - Rejected: Remote has commits you don't (pull first)
 * - Auth failure: Check credentials/SSH keys
 * - Protected branch: Configure branch protection rules
 * 
 * @example
 * **Complete Push Flow**:
 * ```typescript
 * // Make changes and commit
 * await addChangedFiles({ cwd: '/repo' });
 * await commitChanges('feat: add feature', { cwd: '/repo' });
 * 
 * // Push to remote
 * await pushCommits({ cwd: '/repo' });
 * 
 * console.log('Changes pushed successfully');
 * ```
 * 
 * @example
 * **Release Workflow**:
 * ```typescript
 * // Commit release version
 * await commitChanges('chore: release 1.0.0', { cwd: '/repo' });
 * 
 * // Create tag
 * await createTag('v1.0.0', 'Release v1.0.0', { cwd: '/repo' });
 * 
 * // Push commits first
 * await pushCommits({ cwd: '/repo' });
 * 
 * // Then push tags
 * await pushTags({ cwd: '/repo' });
 * ```
 * 
 * @example
 * **Error Handling**:
 * ```typescript
 * try {
 *   await pushCommits({ cwd: '/repo' });
 * } catch (error) {
 *   if (error.message.includes('rejected')) {
 *     console.error('Push rejected - remote has newer commits');
 *     console.error('Pull latest changes first: git pull');
 *   } else if (error.message.includes('authentication')) {
 *     console.error('Authentication failed');
 *   } else {
 *     console.error('Push failed:', error);
 *   }
 * }
 * ```
 * 
 * @example
 * **CI/CD Automated Push**:
 * ```typescript
 * // In GitHub Actions workflow
 * import { pushCommits } from './git/index.js';
 * 
 * // GitHub Actions provides GITHUB_TOKEN automatically
 * // Git is already configured to use it
 * try {
 *   await pushCommits({ cwd: process.cwd() });
 *   console.log('✓ Pushed to GitHub');
 * } catch (error) {
 *   console.error('✗ Push failed:', error.message);
 *   process.exit(1);
 * }
 * ```
 * 
 * @see {@link commitChanges} - Function to create commits
 * @see {@link pushTags} - Function to push tags separately
 * @see https://git-scm.com/docs/git-push - Git push documentation
 */
export async function pushCommits(options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Push commits to remote
    // No arguments: Push current branch to configured upstream
    await exec('git', ['push'], { cwd });
  } catch (error) {
    // Wrap error with context
    throw new Error(`Failed to push commits: ${error}`);
  }
}

/**
 * Checks if there are any changes in the working directory or staging area.
 * 
 * This function is similar to `isWorkingDirectoryClean()` but returns the opposite
 * boolean value. It's useful when you want to check if there's work to commit.
 * 
 * Uses `git status --porcelain` to detect:
 * - Modified tracked files
 * - New untracked files
 * - Deleted files
 * - Staged changes
 * 
 * @param options - Git operation options, primarily for specifying working directory.
 * 
 * @returns Promise resolving to:
 *          - `true`: There are changes (modified, staged, untracked files)
 *          - `false`: Working directory is clean OR git command failed
 * 
 * @throws {Error} If git status command fails.
 *                 Unlike `isWorkingDirectoryClean()`, this function throws on errors.
 * 
 * @remarks
 * **Difference from `isWorkingDirectoryClean()`**:
 * - This function: Returns true if changes exist
 * - `isWorkingDirectoryClean()`: Returns true if NO changes
 * - This function: Throws on error
 * - `isWorkingDirectoryClean()`: Returns false on error
 * 
 * **What Is Detected**:
 * - Modified files (staged and unstaged)
 * - New untracked files
 * - Deleted files
 * - Any staging area changes
 * 
 * **Use Cases**:
 * - Conditional commit logic
 * - Avoiding empty commits
 * - Pre-operation validation
 * - CI/CD change detection
 * 
 * @example
 * **Conditional Commit**:
 * ```typescript
 * // Only commit if there are changes
 * if (await hasChangesToCommit({ cwd: '/repo' })) {
 *   await addChangedFiles({ cwd: '/repo' });
 *   await commitChanges('chore: auto-update', { cwd: '/repo' });
 *   console.log('Changes committed');
 * } else {
 *   console.log('No changes to commit');
 * }
 * ```
 * 
 * @example
 * **Version Update Flow**:
 * ```typescript
 * // Update version files
 * await updateVersionFiles('1.0.0');
 * 
 * // Check if files were actually modified
 * if (await hasChangesToCommit({ cwd: '/repo' })) {
 *   // Files changed - commit them
 *   await addChangedFiles({ cwd: '/repo' });
 *   await commitChanges('chore: bump version to 1.0.0', { cwd: '/repo' });
 * } else {
 *   // No changes - version files already at 1.0.0
 *   console.log('Version files unchanged');
 * }
 * ```
 * 
 * @example
 * **Comparison with isWorkingDirectoryClean**:
 * ```typescript
 * import { hasChangesToCommit, isWorkingDirectoryClean } from './git/index.js';
 * 
 * const hasChanges = await hasChangesToCommit({ cwd: '/repo' });
 * const isClean = await isWorkingDirectoryClean({ cwd: '/repo' });
 * 
 * // These are opposite:
 * console.log(hasChanges === !isClean);  // true
 * ```
 * 
 * @see {@link isWorkingDirectoryClean} - Similar function with opposite return value
 * @see {@link addChangedFiles} - Function to stage changes
 * @see {@link commitChanges} - Function to commit staged changes
 * @see https://git-scm.com/docs/git-status - Git status documentation
 */
export async function hasChangesToCommit(options: GitOptions = {}): Promise<boolean> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();
  
  try {
    // Get machine-readable status output
    // --porcelain: Stable, easy-to-parse format
    const { stdout } = await getExecOutput('git', ['status', '--porcelain'], {
      cwd,
      silent: true
    });
    
    // If output is not empty, there are changes
    // Returns true if changes exist, false if clean
    return stdout.trim().length > 0;
  } catch (error) {
    // Throw on error (unlike isWorkingDirectoryClean which returns false)
    throw new Error(`Failed to check git status: ${error}`);
  }
}
