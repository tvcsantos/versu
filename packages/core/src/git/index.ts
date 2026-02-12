/**
 * Git operations module for VERSU version management.
 * Provides interfaces for commit analysis, tagging, and conventional commit parsing.
 * Supports monorepo and multi-module projects with module-specific tag management.
 */

import { Commit, CommitParser } from "conventional-commits-parser";
import { logger } from "../utils/logger.js";
import { execa } from "execa";
import { Module } from "../index.js";

/**
 * Shared CommitParser instance for parsing conventional commits.
 * Reused across all commit parsing operations to avoid repeated instantiation.
 */
const commitParser = new CommitParser({
  breakingHeaderPattern: /^(\w*)(?:\(([\w$@.\-*/ ]*)\))?!: (.*)$/,
});

/**
 * Represents a parsed git tag with extracted module and version metadata.
 * Supports module tags (moduleName@version) and general tags (v{version}).
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
 * @property cwd - Working directory for git commands (defaults to process.cwd())
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
 * Extracts type, scope, breaking changes, and descriptive content for version bumping.
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

  readonly parsed?: Commit;
};

/**
 * Retrieves all commits for a module since its last release tag.
 * Handles monorepo and single-repo scenarios with path filtering.
 * @param projectInfo - Module information including path and type
 * @param options - Git operation options
 * @param excludePaths - Paths to exclude using git pathspec syntax
 * @returns Promise resolving to array of parsed commits (oldest to newest)
 */
export async function getCommitsSinceLastTag(
  projectInfo: Module,
  options: GitOptions = {},
  excludePaths: string[] = [],
): Promise<{ commits: Commit[]; lastTag: string | null }> {
  // Resolve the working directory, defaulting to current process directory
  const cwd = options.cwd || process.cwd();

  logger.debug(
    `🔍 Getting commits for module '${projectInfo.name}' at path '${projectInfo.path}' since last tag...`,
  );

  try {
    // Find the most recent tag for this module
    // For root modules, this finds general tags (v1.0.0)
    // For submodules, this finds module-specific tags (module@1.0.0)
    const lastTag = await getLastTagForModule(projectInfo, { cwd });

    logger.debug(
      `🔍 Last tag for module '${projectInfo.name}' of type '${projectInfo.type}': ${lastTag}`,
    );

    // Build the git revision range
    // If tag exists: 'tag..HEAD' means commits after tag up to HEAD
    // If no tag: empty string means all commits in history
    const range = lastTag ? `${lastTag}..HEAD` : "";
    const commits = await getCommitsInRange(
      range,
      projectInfo.path,
      { cwd },
      excludePaths,
    );
    return { commits, lastTag };
  } catch (error) {
    // If tag lookup fails for any reason, fall back to all commits
    // This ensures we always have commit history for version determination
    const commits = await getCommitsInRange(
      "",
      projectInfo.path,
      { cwd },
      excludePaths,
    );
    return { commits, lastTag: null };
  }
}

/**
 * Retrieves commits within a specific git revision range with path filtering.
 * Uses git's native pathspec syntax for efficient filtering in monorepos.
 * @param range - Git revision range (e.g., 'tag1..tag2', 'tag..HEAD', or '' for all)
 * @param pathFilter - Optional path to filter commits (use '.' for root)
 * @param options - Git operation options
 * @param excludePaths - Paths to exclude using ':(exclude)path' syntax
 * @returns Promise resolving to array of parsed commits (oldest to newest)
 */
export async function getCommitsInRange(
  range: string,
  pathFilter?: string,
  options: GitOptions = {},
  excludePaths: string[] = [],
): Promise<Commit[]> {
  // Resolve working directory, defaulting to current directory
  const cwd = options.cwd || process.cwd();

  logger.debug(
    `🔍 Getting commits in range '${range}' with path filter '${pathFilter}' and excluding paths: ${excludePaths.join(", ")}`,
  );

  try {
    // Build git log command with custom format for easy parsing
    // Format: hash, subject, body, delimiter
    const args = [
      "log",
      "--format=%s%n%b%n-hash-%n%H%n-decorations-%n%D%n-authorName-%n%an%n-authorEmail-%n%ae%n-committerName-%n%cn%n-committerEmail-%n%ce%n---COMMIT-END---",
    ];

    // Only add range if it's not empty
    // Empty range means "all commits" which is valid
    if (range.trim()) {
      args.push(range);
    }

    // Add pathspec separator ('--') if we have paths or excludes
    // This separates revision arguments from path arguments
    // Add path filter if provided and not root
    if (pathFilter && pathFilter !== ".") {
      args.push("--", pathFilter);
    } else if (excludePaths.length > 0) {
      // For root path, we still need to add the pathspec separator
      // when we have exclude patterns
      args.push("--");
    }

    // Add each exclude pattern using git's pathspec syntax
    // :(exclude)path tells git to ignore commits touching that path
    for (const excludePath of excludePaths) {
      if (excludePath && excludePath !== ".") {
        args.push(`:(exclude)${excludePath}`);
      }
    }

    logger.debug(`🐙 Executing git command: git ${args.join(" ")}`);

    // Execute git log command
    // Silent mode prevents output pollution in GitHub Actions
    const { stdout } = await execa("git", args, { cwd });

    // Parse the formatted output into CommitInfo objects
    return parseGitLog(stdout);
  } catch (error) {
    // Non-throwing error handling: log warning and return empty array
    // This allows the system to continue even if git operations fail
    logger.warning(`Warning: Failed to get git commits: ${error}`);
    return [];
  }
}

/**
 * Parses raw git log output into structured Commit objects with Conventional Commits analysis.
 * Resilient to parsing failures - classifies non-conventional commits as 'unknown' type.
 * @param output - Raw git log output using custom format
 * @returns Array of parsed Commit objects (empty if no valid commits)
 * @internal
 */
function parseGitLog(output: string): Commit[] {
  // Early return for empty output - no commits to parse
  if (!output.trim()) {
    return [];
  }

  logger.debug(`Raw git log output:\n${output}`);

  const commits: Commit[] = [];

  // Split output into individual commit blocks using custom delimiter
  // Filter removes empty blocks (trailing delimiters, etc.)
  const commitBlocks = output
    .split("---COMMIT-END---")
    .filter((block) => block.trim());

  for (const block of commitBlocks) {
    const parsed = commitParser.parse(block);

    if (!parsed.hash) {
      throw new Error("Parsed commit is missing hash");
    }

    logger.debug(`Parsed commit ${parsed.hash}: ${JSON.stringify(parsed)}`);

    commits.push(parsed);
  }

  return commits;
}

export function isBreakingCommit(commit: Commit): boolean {
  return (
    commit?.notes?.some((note) => note.title === "BREAKING CHANGE") || false
  );
}

/**
 * Finds the most recent git tag for a specific module with fallback to general tags.
 * Searches module-specific tags first (moduleName@*), then falls back to general tags.
 * @param projectInfo - Module information for tag pattern construction
 * @param options - Git operation options
 * @returns Most recent tag name or null if no tags exist
 */
export async function getLastTagForModule(
  projectInfo: Module,
  options: GitOptions = {},
): Promise<string | null> {
  // Resolve working directory, defaulting to current directory
  const cwd = options.cwd || process.cwd();

  logger.debug(
    `🔍 Finding last tag for module '${projectInfo.name}' of type '${projectInfo.type}'...`,
  );

  try {
    // Generate glob pattern for module-specific tags (e.g., 'api@*')
    const moduleTagPattern = getModuleTagPattern(projectInfo.name);

    // Only search for module-specific tags if it's not root and version is declared
    // Root projects use general tags (v1.0.0) rather than module tags (root@1.0.0)
    if (projectInfo.type !== "root" && projectInfo.declaredVersion) {
      // Search for module-specific tags with version sorting
      // --sort=-version:refname: Sort by version in descending order (newest first)

      logger.debug(
        `🐙 Executing git command: git tag -l ${moduleTagPattern} --sort=-version:refname`,
      );

      const { stdout } = await execa(
        "git",
        ["tag", "-l", moduleTagPattern, "--sort=-version:refname"],
        {
          cwd,
        },
      );

      // If we found module-specific tags, return the first (most recent)
      if (stdout.trim()) {
        return stdout.trim().split("\n")[0];
      }
    }

    // Fallback to general tags when:
    // 1. Module type is 'root', or
    // 2. No module-specific tags were found
    try {
      // git describe finds the most recent tag reachable from HEAD
      // --tags: Consider all tags (not just annotated)
      // --abbrev=0: Don't show commit hash suffix

      logger.debug(
        `🐙 Executing git command: git describe --tags --abbrev=0 HEAD`,
      );

      const { stdout: fallbackOutput } = await execa(
        "git",
        ["describe", "--tags", "--abbrev=0", "HEAD"],
        {
          cwd,
        },
      );

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
 * Returns array with tag name, commit hash, and parsed module/version information.
 * @param options - Git operation options
 * @returns Promise resolving to array of GitTag objects (empty array if no tags exist)
 */
export async function getAllTags(options: GitOptions = {}): Promise<GitTag[]> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // List all tags with custom format to get name and commit hash
    // %(refname:short): Tag name without refs/tags/ prefix
    // %(objectname): Full commit SHA that the tag points to

    logger.debug(
      `🐙 Executing git command: git tag -l --format=%(refname:short) %(objectname)`,
    );

    const { stdout } = await execa(
      "git",
      ["tag", "-l", "--format=%(refname:short) %(objectname)"],
      {
        cwd,
      },
    );

    // Parse each line into a GitTag object
    return stdout
      .trim()
      .split("\n")
      .filter((line: string) => line.trim()) // Remove empty lines
      .map((line: string) => {
        // Each line format: "tagname commithash"
        const [name, hash] = line.split(" ");

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
 * Annotated tags include tagger metadata, date, message, and can be GPG signed.
 * @param tagName - The tag name (e.g., 'core@1.0.0' or 'v1.0.0'). Must not already exist
 * @param message - The annotation message for the tag
 * @param options - Git operation options
 * @returns Promise that resolves when the tag is successfully created
 * @throws {Error} If tag creation fails (tag exists, invalid name, etc.)
 */
export async function createTag(
  tagName: string,
  message: string,
  options: GitOptions = {},
): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Create annotated tag with message
    // -a: Create an annotated tag (full git object)
    // -m: Provide tag message inline
    await execa("git", ["tag", "-a", tagName, "-m", message], { cwd });
  } catch (error) {
    // Wrap error with more context for debugging
    // Common failures: tag exists, no git repo, no user config
    throw new Error(`Failed to create tag ${tagName}: ${error}`);
  }
}

/**
 * Pushes all local tags to the configured remote repository.
 * Only pushes tags that don't exist on remote. Does NOT push commits.
 * @param options - Git operation options
 * @returns Promise that resolves when all tags are successfully pushed
 * @throws {Error} If push fails (no remote, authentication, network, conflicts, etc.)
 */
export async function pushTags(options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Push all tags to the remote repository
    // --tags: Push all tags (annotated and lightweight)
    // This does NOT push commits, only tags
    await execa("git", ["push", "--tags"], { cwd });
  } catch (error) {
    // Wrap error with context
    // Common failures: no remote, auth, network, conflicts
    throw new Error(`Failed to push tags: ${error}`);
  }
}

/**
 * Generates a glob pattern for searching module-specific git tags (moduleName@*).
 * @param moduleName - The name of the module
 * @returns A glob pattern string matching all tags for the module
 * @internal
 */
function getModuleTagPattern(moduleName: string): string {
  // Create glob pattern for module-specific tags
  // Format: moduleName@* where * matches any version
  return `${moduleName}@*`;
}

export function getModuleTagName(moduleName: string, version: string): string {
  // Construct tag name for a module and version
  // Format: moduleName@version (e.g., 'core@1.0.0')
  return `${moduleName}@${version}`;
}

/**
 * Parses a git tag name to extract module and version components.
 *
 * This internal utility function handles multiple tag naming conventions used in
 * VERSU and returns a structured object with extracted metadata. It supports:
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
 * Uses `git status --porcelain` to detect modified, staged, deleted, or untracked files.
 * @param options - Git operation options
 * @returns Promise resolving to true if clean, false if there are changes or on error
 */
export async function isWorkingDirectoryClean(
  options: GitOptions = {},
): Promise<boolean> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Get machine-readable status output
    // --porcelain: Stable, easy-to-parse format
    const { stdout } = await execa("git", ["status", "--porcelain"], {
      cwd,
    });

    // Empty output means clean working directory
    // Any output indicates changes (modified, untracked, staged, etc.)
    return stdout.trim() === "";
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
 * Returns empty string if in detached HEAD state.
 * @param options - Git operation options
 * @returns Promise resolving to the current branch name (empty string if detached HEAD)
 * @throws {Error} If git command fails
 */
export async function getCurrentBranch(
  options: GitOptions = {},
): Promise<string> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Get the current branch name
    // --show-current: Returns active branch name or empty string if detached
    const { stdout } = await execa("git", ["branch", "--show-current"], {
      cwd,
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
 */
export async function getCurrentCommitShortSha(
  options: GitOptions = {},
): Promise<string> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Get abbreviated commit SHA
    // rev-parse: Resolve git revision to commit hash
    // --short: Return abbreviated version (typically 7 chars)
    // HEAD: The current commit
    const { stdout } = await execa("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
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
 */
export async function addChangedFiles(options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Stage all changes in the working directory
    // '.': Current directory and all subdirectories
    await execa("git", ["add", "."], { cwd });
  } catch (error) {
    // Wrap error with context
    throw new Error(`Failed to add changed files: ${error}`);
  }
}

/**
 * Creates a git commit with the specified message using currently staged changes.
 * Files must be staged first (via `git add`). Follows Conventional Commits format.
 * @param message - The commit message (e.g., 'feat: description', 'fix: description')
 * @param options - Git operation options
 * @returns Promise that resolves when commit is created
 * @throws {Error} If commit fails (no staged changes, no git user, empty message, etc.)
 */
export async function commitChanges(
  message: string,
  options: GitOptions = {},
): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Create commit with staged changes
    // -m: Specify commit message inline
    await execa("git", ["commit", "-m", message], { cwd });
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
 */
export async function pushCommits(options: GitOptions = {}): Promise<void> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Push commits to remote
    // No arguments: Push current branch to configured upstream
    await execa("git", ["push"], { cwd });
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
 */
export async function hasChangesToCommit(
  options: GitOptions = {},
): Promise<boolean> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Get machine-readable status output
    // --porcelain: Stable, easy-to-parse format
    const { stdout } = await execa("git", ["status", "--porcelain"], {
      cwd,
    });

    // If output is not empty, there are changes
    // Returns true if changes exist, false if clean
    return stdout.trim().length > 0;
  } catch (error) {
    // Throw on error (unlike isWorkingDirectoryClean which returns false)
    throw new Error(`Failed to check git status: ${error}`);
  }
}

export async function getCurrentRepoUrl(
  options: GitOptions = {},
): Promise<string> {
  // Resolve working directory
  const cwd = options.cwd || process.cwd();

  try {
    // Get the URL of the 'origin' remote
    const { stdout } = await execa("git", ["remote", "get-url", "origin"], {
      cwd,
    });

    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get repository URL: ${error}`);
  }
}

/**
 * Parses a git repository URL (SSH or HTTP/HTTPS) and extracts its components.
 *
 * Supports multiple URL formats:
 * - SSH: `git@github.com:owner/repo.git`
 * - HTTPS: `https://github.com/owner/repo.git`
 * - HTTP: `http://github.com/owner/repo.git`
 *
 * @param repoUrl - The repository URL to parse
 * @returns Object containing host, owner, and repo name
 * @throws {Error} If URL format is invalid or cannot be parsed
 * @internal
 */
export function parseRepoUrl(repoUrl: string): {
  host: string;
  owner: string;
  repo: string;
} {
  // Handle SSH format: git@github.com:owner/repo.git
  const sshMatch = repoUrl.match(/^git@([^:]+):(.+?)\/([^/]+?)(\.git)?$/);
  if (sshMatch) {
    return {
      host: sshMatch[1],
      owner: sshMatch[2],
      repo: sshMatch[3],
    };
  }

  // Handle HTTP/HTTPS format: https://github.com/owner/repo.git
  const httpsMatch = repoUrl.match(
    /^https?:\/\/([^/]+)\/(.+?)\/([^/]+?)(\.git)?$/,
  );
  if (httpsMatch) {
    return {
      host: httpsMatch[1],
      owner: httpsMatch[2],
      repo: httpsMatch[3],
    };
  }

  throw new Error(`Invalid repository URL format: ${repoUrl}`);
}

/**
 * Retrieves the current repository URL and converts it to HTTPS format.
 *
 * This function is useful for:
 * - Generating consistent HTTPS URLs for documentation
 * - Creating web links to the repository
 * - CI/CD systems that prefer HTTPS over SSH
 *
 * Converts SSH URLs (git@github.com:owner/repo.git) to HTTPS format
 * (https://github.com/owner/repo.git).
 *
 * @param options - Git operation options, primarily for specifying working directory.
 *
 * @returns Promise resolving to the repository URL in HTTPS format.
 *
 * @throws {Error} If:
 *                 - Unable to get remote URL
 *                 - URL format is invalid
 *                 - Not in a git repository
 */
export async function getRepoUrlAsHttps(
  options: GitOptions = {},
): Promise<string> {
  const repoUrl = await getCurrentRepoUrl(options);
  const { host, owner, repo } = parseRepoUrl(repoUrl);
  return `https://${host}/${owner}/${repo}.git`;
}

/**
 * Extracts the hostname from the current repository's remote URL.
 *
 * Returns the hosting service domain (e.g., 'github.com', 'gitlab.com',
 * 'bitbucket.org', or custom Git server hostname).
 *
 * Supports both SSH and HTTP/HTTPS URL formats.
 *
 * @param options - Git operation options, primarily for specifying working directory.
 *
 * @returns Promise resolving to the repository host (e.g., 'github.com').
 *
 * @throws {Error} If:
 *                 - Unable to get remote URL
 *                 - URL format is invalid
 *                 - Not in a git repository
 */
export async function getRepoHost(options: GitOptions = {}): Promise<string> {
  const repoUrl = await getCurrentRepoUrl(options);
  const { host } = parseRepoUrl(repoUrl);
  return host;
}

/**
 * Extracts the repository owner/organization name from the current repository's remote URL.
 *
 * Returns the account or organization that owns the repository.
 * For example:
 * - `git@github.com:microsoft/vscode.git` → 'microsoft'
 * - `https://github.com/facebook/react.git` → 'facebook'
 *
 * Supports both SSH and HTTP/HTTPS URL formats.
 *
 * @param options - Git operation options, primarily for specifying working directory.
 *
 * @returns Promise resolving to the repository owner name.
 *
 * @throws {Error} If:
 *                 - Unable to get remote URL
 *                 - URL format is invalid
 *                 - Not in a git repository
 */
export async function getRepoOwner(options: GitOptions = {}): Promise<string> {
  const repoUrl = await getCurrentRepoUrl(options);
  const { owner } = parseRepoUrl(repoUrl);
  return owner;
}

/**
 * Extracts the repository name from the current repository's remote URL.
 *
 * Returns the name of the repository without the owner prefix or .git suffix.
 * For example:
 * - `git@github.com:microsoft/vscode.git` → 'vscode'
 * - `https://github.com/facebook/react.git` → 'react'
 *
 * Supports both SSH and HTTP/HTTPS URL formats.
 *
 * @param options - Git operation options, primarily for specifying working directory.
 *
 * @returns Promise resolving to the repository name.
 *
 * @throws {Error} If:
 *                 - Unable to get remote URL
 *                 - URL format is invalid
 *                 - Not in a git repository
 */
export async function getRepoName(options: GitOptions = {}): Promise<string> {
  const repoUrl = await getCurrentRepoUrl(options);
  const { repo } = parseRepoUrl(repoUrl);
  return repo;
}
