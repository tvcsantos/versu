import * as core from '@actions/core';
import { CommitInfo, getCommitsSinceLastTag } from '../git/index.js';
import { ModuleRegistry } from './module-registry.js';

/**
 * Analyzes git commits for each module in a multi-module repository.
 * 
 * @remarks
 * This service is the core of VERSE's commit analysis system, responsible for
 * determining which commits affect which modules. It solves the critical problem
 * of preventing double-counting commits in hierarchical module structures.
 * 
 * **Key Responsibilities:**
 * - Retrieve commits since the last release tag for each module
 * - Filter out commits from child modules to prevent version bump duplication
 * - Organize commits by module for accurate version calculation
 * - Handle hierarchical module structures correctly
 * 
 * **The Parent-Child Problem:**
 * In multi-module projects, a commit to `core/api/Controller.java` would normally
 * appear in:
 * - The `core/api` module's history
 * - The `core` module's history (parent directory)
 * - The root project's history
 * 
 * This would cause the same commit to trigger version bumps in multiple modules,
 * which is incorrect. The analyzer solves this by using git's native path exclusion
 * to ensure each commit is counted only in the most specific module it affects.
 * 
 * **Analysis Strategy:**
 * For each module:
 * 1. Identify all child modules (subdirectories with their own module definitions)
 * 2. Query git log for the module's path, excluding child module paths
 * 3. Parse and store commits specific to this module
 * 
 * This ensures accurate, non-overlapping commit attribution across the module hierarchy.
 * 
 * @example
 * ```typescript
 * // Create analyzer
 * const analyzer = new CommitAnalyzer(moduleRegistry, '/path/to/repo');
 * 
 * // Analyze all modules
 * const moduleCommits = await analyzer.analyzeCommitsSinceLastRelease();
 * 
 * // Access commits for specific module
 * const coreCommits = moduleCommits.get(':core');
 * console.log(`Core module has ${coreCommits.length} direct commits`);
 * 
 * // Iterate all modules
 * for (const [moduleId, commits] of moduleCommits) {
 *   console.log(`${moduleId}: ${commits.length} commits`);
 * }
 * ```
 */
export class CommitAnalyzer {
  
  /**
   * Creates a new CommitAnalyzer instance.
   * 
   * @param moduleRegistry - Registry containing all discovered modules and their metadata
   * @param repoRoot - Absolute path to the repository root directory
   * 
   * @remarks
   * The module registry provides the complete module structure needed for hierarchical
   * analysis, while the repository root is used as the working directory for git
   * operations.
   * 
   * **Module Registry Usage:**
   * The registry is queried to:
   * - Iterate through all modules for analysis
   * - Find parent-child relationships between modules
   * - Access module paths for git log operations
   * - Retrieve module metadata (name, type) for tag matching
   * 
   * **Repository Root Usage:**
   * The root path serves as:
   * - Working directory for git commands
   * - Base for resolving relative module paths
   * - Context for git history operations
   */
  constructor(
    private readonly moduleRegistry: ModuleRegistry,
    private readonly repoRoot: string
  ) {
  }

  /**
   * Analyzes commits since the last release for all modules in the repository.
   * 
   * @returns A promise that resolves to a map where:
   *   - **Key**: Module ID (e.g., `:`, `:core`, `:core:api`)
   *   - **Value**: Array of {@link CommitInfo} objects representing commits since last release
   * 
   * @throws {Error} If git operations fail (repository not found, not a git repo, etc.)
   * @throws {Error} If module paths are invalid or inaccessible
   * 
   * @remarks
   * This is the main entry point for commit analysis. It orchestrates the entire
   * analysis process across all modules in the repository.
   * 
   * **Process Flow:**
   * 
   * 1. **Module Iteration:**
   *    - Iterates through all modules in the registry
   *    - Processes each module independently
   * 
   * 2. **Child Module Discovery:**
   *    - For each module, identifies all child modules
   *    - Builds a list of paths to exclude from git log
   *    - Ensures commits are counted only in the most specific module
   * 
   * 3. **Commit Retrieval:**
   *    - Calls git log with module path and exclusions
   *    - Retrieves commits since the last release tag for this module
   *    - Parses commit messages for conventional commit types
   * 
   * 4. **Result Aggregation:**
   *    - Stores commits in a map keyed by module ID
   *    - Logs summary statistics for visibility
   * 
   * **Commit Exclusion Mechanism:**
   * For a module at `core/` with children at `core/api/` and `core/impl/`:
   * - Git log query: `git log -- core/ :(exclude)core/api/ :(exclude)core/impl/`
   * - Result: Only commits directly to files in `core/`, excluding subdirectories
   * 
   * **Last Release Tag:**
   * The "last release" is determined by git tags matching the module's version pattern:
   * - Root module: Tags like `v1.0.0`, `1.0.0`
   * - Named modules: Tags like `core-1.0.0`, `api-2.0.0`
   * 
   * **Performance Characteristics:**
   * - Time complexity: O(n) where n is the number of modules
   * - Each module requires one git log operation
   * - Total operations: Number of modules
   * - Can be slow for repositories with long histories
   * 
   * **Logging:**
   * Produces informational logs:
   * - Start of analysis
   * - Child module exclusions (debug level)
   * - Total commits and modules analyzed
   * 
   * @example
   * ```typescript
   * const moduleCommits = await analyzer.analyzeCommitsSinceLastRelease();
   * 
   * // Check if any module has commits
   * const hasChanges = Array.from(moduleCommits.values())
   *   .some(commits => commits.length > 0);
   * 
   * if (hasChanges) {
   *   console.log('Changes detected, version bump required');
   * }
   * 
   * // Analyze commit types per module
   * for (const [moduleId, commits] of moduleCommits) {
   *   const breaking = commits.filter(c => c.breaking).length;
   *   const features = commits.filter(c => c.type === 'feat').length;
   *   const fixes = commits.filter(c => c.type === 'fix').length;
   *   
   *   console.log(`${moduleId}: ${breaking} breaking, ${features} features, ${fixes} fixes`);
   * }
   * ```
   */
  async analyzeCommitsSinceLastRelease(): Promise<Map<string, CommitInfo[]>> {
    core.info('📝 Analyzing commits since last release...');
    
    const moduleCommits = new Map<string, CommitInfo[]>();

    // Iterate through all registered modules
    for (const [projectId, projectInfo] of this.moduleRegistry.getModules()) {
      // Find child module paths to exclude from this module's commits
      // This prevents double-counting commits in the module hierarchy
      const childModulePaths = this.findChildModulePaths(
        projectInfo.path,
        projectId
      );
      
      // Retrieve commits for this module, excluding child modules
      const commits = await getCommitsSinceLastTag(
        projectInfo.path, 
        projectInfo.name,
        projectInfo.type,
        { cwd: this.repoRoot },
        childModulePaths
      );
      
      // Store commits for this module
      moduleCommits.set(projectId, commits);
      
      // Log exclusions for debugging
      if (childModulePaths.length > 0) {
        core.debug(`🔍 Module ${projectInfo.id} excludes ${childModulePaths.length} child module(s): ${childModulePaths.join(', ')}`);
      }
    }

    // Calculate and log summary statistics
    const totalCommits = Array.from(moduleCommits.values()).reduce((sum, commits) => sum + commits.length, 0);
    core.info(`📊 Analyzed ${totalCommits} commits across ${moduleCommits.size} modules`);
    
    return moduleCommits;
  }

  /**
   * Finds all child module paths for a given module to enable commit exclusion.
   * 
   * @param modulePath - The file system path of the parent module (e.g., `'core'`, `'services/api'`)
   * @param moduleId - The unique identifier of the parent module (e.g., `':core'`, `':services:api'`)
   * 
   * @returns An array of child module paths relative to repository root.
   *   Returns empty array if the module has no children.
   * 
   * @remarks
   * This method identifies child modules by comparing paths. A module is considered
   * a child if its path is a subdirectory of the parent module's path.
   * 
   * **Child Module Criteria:**
   * For a path to be considered a child:
   * 1. It must start with the parent path
   * 2. It must have a path separator after the parent path
   * 3. It must be a different module (not the parent itself)
   * 
   * **Use Case:**
   * The returned paths are used in git log exclusion patterns to prevent parent
   * modules from including commits that belong to their children:
   * ```bash
   * # Without exclusion (incorrect):
   * git log -- core/
   * # Includes commits to core/, core/api/, core/impl/
   * 
   * # With exclusion (correct):
   * git log -- core/ :(exclude)core/api/ :(exclude)core/impl/
   * # Includes only commits directly to core/
   * ```
   * 
   * **Path Format:**
   * All paths are relative to the repository root:
   * - Root module: `'.'`
   * - Top-level module: `'core'`
   * - Nested module: `'core/api'`
   * - Deeply nested: `'services/api/v1'`
   * 
   * @example
   * ```typescript
   * // Module structure:
   * // .
   * // ├── core/
   * // │   ├── api/
   * // │   └── impl/
   * // └── services/
   * 
   * // Find children of 'core'
   * const coreChildren = findChildModulePaths('core', ':core');
   * // Returns: ['core/api', 'core/impl']
   * 
   * // Find children of root
   * const rootChildren = findChildModulePaths('.', ':');
   * // Returns: ['core', 'services', 'core/api', 'core/impl']
   * // (All non-root modules)
   * 
   * // Find children of leaf module
   * const leafChildren = findChildModulePaths('core/api', ':core:api');
   * // Returns: [] (no children)
   * ```
   * 
   * @private
   */
  private findChildModulePaths(
    modulePath: string,
    moduleId: string,
  ): string[] {
    const childPaths: string[] = [];

    // Iterate through all modules to find children
    for (const [otherId, otherInfo] of this.moduleRegistry.getModules()) {
      // Skip the module itself
      if (otherId !== moduleId && this.isChildPath(otherInfo.path, modulePath)) {
        childPaths.push(otherInfo.path);
      }
    }
    
    return childPaths;
  }

  /**
   * Determines whether a path represents a child subdirectory of a parent path.
   * 
   * @param childPath - The path to test (e.g., `'core/api'`, `'services/impl'`)
   * @param parentPath - The potential parent path (e.g., `'core'`, `'.'`, `'services'`)
   * 
   * @returns `true` if childPath is a subdirectory of parentPath, `false` otherwise
   * 
   * @remarks
   * This method implements simple string-based path comparison to determine
   * parent-child relationships. The implementation is intentionally simple and
   * relies on the convention that module paths use forward slashes as separators.
   * 
   * **Special Case: Root Path**
   * The root path `'.'` is treated specially:
   * - It's considered the parent of all non-root paths
   * - It's not considered a child of itself
   * - This ensures root module excludes all child modules
   * 
   * **Path Matching Logic:**
   * For non-root paths, a child must:
   * 1. Start with the parent path
   * 2. Have a `/` separator immediately after the parent path
   * 3. Have additional path components after the separator
   * 
   * This prevents false positives like:
   * - `'core2'` being considered a child of `'core'`
   * - `'core'` being considered a child of itself
   * 
   * **Limitation:**
   * This method doesn't verify that paths actually exist in the file system.
   * It only performs string comparison. The module registry should contain
   * only valid paths discovered during module detection.
   * 
   * @example
   * ```typescript
   * // Direct child
   * isChildPath('core/api', 'core')           // true
   * 
   * // Nested child (grandchild)
   * isChildPath('core/api/v1', 'core')        // true
   * 
   * // Same path (not a child)
   * isChildPath('core', 'core')               // false
   * 
   * // Unrelated paths
   * isChildPath('other', 'core')              // false
   * isChildPath('core2', 'core')              // false (no separator)
   * 
   * // Root as parent
   * isChildPath('core', '.')                  // true
   * isChildPath('services/api', '.')          // true
   * 
   * // Root as child (special case)
   * isChildPath('.', '.')                     // false
   * 
   * // Sibling paths
   * isChildPath('services', 'core')           // false
   * ```
   * 
   * @private
   */
  private isChildPath(childPath: string, parentPath: string): boolean {
    // Special handling for root path - it's the parent of all non-root paths
    if (parentPath === '.') {
      return childPath !== '.';
    }
    
    // Check if child path starts with parent path followed by a path separator
    // This ensures 'core/api' is a child of 'core', but 'core2' is not
    return childPath.startsWith(parentPath + '/');
  }
}