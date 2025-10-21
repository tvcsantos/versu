import { Config } from '../config/index.js';
import { CommitInfo } from '../git/index.js';
import { BumpType } from '../semver/index.js';
/**
 * Calculates the overall semantic version bump type from a collection of commits.
 *
 * @param commits - Array of commit information to analyze for version impact
 * @param config - Configuration containing commit type mappings and versioning rules
 *
 * @returns The highest {@link BumpType} required across all commits:
 *   - `'major'`: Breaking changes detected
 *   - `'minor'`: New features added
 *   - `'patch'`: Bug fixes or other changes
 *   - `'none'`: No version bump needed (no relevant commits)
 *
 * @remarks
 * This function is the core of VERSE's commit-based version calculation. It analyzes
 * a collection of commits and determines the minimum semantic version bump required
 * to properly reflect the changes according to SemVer rules.
 *
 * **Analysis Process:**
 *
 * 1. **Iterate Through Commits:**
 *    - Process each commit individually
 *    - Extract commit type and breaking change flag
 *    - Determine bump type for each commit
 *
 * 2. **Map Commit to Bump Type:**
 *    - Use {@link getBumpTypeForCommit} to map commit characteristics to bump type
 *    - Apply configuration rules (commit type mappings)
 *    - Breaking changes always result in major bump
 *
 * 3. **Collect Non-None Bump Types:**
 *    - Filter out `'none'` bump types (commits that don't affect version)
 *    - Build array of required bumps
 *    - Preserve all meaningful version changes
 *
 * 4. **Determine Maximum:**
 *    - Use {@link maxBumpType} to find the highest bump type
 *    - Major > Minor > Patch > None
 *    - Returns `'none'` if no meaningful commits found
 *
 * **Semantic Versioning Logic:**
 *
 * Following SemVer rules (https://semver.org/):
 * - **Major (X.0.0)**: Breaking changes - incompatible API changes
 * - **Minor (0.X.0)**: New features - backward-compatible functionality
 * - **Patch (0.0.X)**: Bug fixes - backward-compatible fixes
 *
 * The function ensures the version bump reflects the most significant change:
 * - Any breaking change → Major bump (even if features/fixes also present)
 * - Any feature (no breaking) → Minor bump (even if fixes also present)
 * - Only fixes (no breaking/features) → Patch bump
 * - No relevant commits → No bump
 *
 * **Conventional Commits:**
 * The function works with Conventional Commits format:
 * ```
 * <type>(<scope>): <description>
 *
 * [optional body]
 *
 * [optional footer(s)]
 * ```
 *
 * Common commit types and their bump mappings:
 * - `feat:` → Minor bump (new feature)
 * - `fix:` → Patch bump (bug fix)
 * - `feat!:` or `BREAKING CHANGE:` → Major bump
 * - `fix!:` or `BREAKING CHANGE:` → Major bump
 * - `docs:`, `style:`, `chore:` → No bump (if configured)
 *
 * **Configuration Impact:**
 * The `config` parameter allows customization of commit type mappings:
 * ```typescript
 * {
 *   commitTypes: {
 *     feat: 'minor',    // Features bump minor version
 *     fix: 'patch',     // Fixes bump patch version
 *     perf: 'patch',    // Performance improvements bump patch
 *     docs: 'none',     // Documentation changes don't bump version
 *     chore: 'none'     // Chore commits don't bump version
 *   }
 * }
 * ```
 *
 * **Edge Cases:**
 *
 * - **Empty Commit Array:**
 *   ```typescript
 *   calculateBumpFromCommits([], config) // Returns 'none'
 *   ```
 *
 * - **Only Non-Versioning Commits:**
 *   ```typescript
 *   // Only docs and chore commits
 *   calculateBumpFromCommits([
 *     { type: 'docs', breaking: false, ... },
 *     { type: 'chore', breaking: false, ... }
 *   ], config) // Returns 'none'
 *   ```
 *
 * - **Mixed Commit Types:**
 *   ```typescript
 *   // Breaking change + feature + fix
 *   calculateBumpFromCommits([
 *     { type: 'feat', breaking: true, ... },  // major
 *     { type: 'feat', breaking: false, ... }, // minor
 *     { type: 'fix', breaking: false, ... }   // patch
 *   ], config) // Returns 'major' (highest)
 *   ```
 *
 * **Performance:**
 * - Time complexity: O(n) where n is the number of commits
 * - Space complexity: O(n) for storing bump types array
 * - Efficient for typical commit counts (hundreds to thousands)
 *
 * **Use in VERSE Workflow:**
 * ```
 * 1. CommitAnalyzer retrieves commits for each module
 * 2. calculateBumpFromCommits determines required bump type
 * 3. VersionBumper applies the bump to current version
 * 4. VersionManager stages the new version
 * ```
 *
 * @example
 * ```typescript
 * // Example with feature commits
 * const commits: CommitInfo[] = [
 *   { type: 'feat', breaking: false, message: 'add new API', subject: '...', hash: '...' },
 *   { type: 'fix', breaking: false, message: 'fix bug', subject: '...', hash: '...' },
 *   { type: 'docs', breaking: false, message: 'update docs', subject: '...', hash: '...' }
 * ];
 *
 * const bumpType = calculateBumpFromCommits(commits, config);
 * console.log(bumpType); // "minor" (highest is feat → minor)
 * ```
 *
 * @example
 * ```typescript
 * // Example with breaking change
 * const commits: CommitInfo[] = [
 *   { type: 'feat', breaking: true, message: 'feat!: remove old API', subject: '...', hash: '...' },
 *   { type: 'feat', breaking: false, message: 'feat: add feature', subject: '...', hash: '...' },
 *   { type: 'fix', breaking: false, message: 'fix: patch bug', subject: '...', hash: '...' }
 * ];
 *
 * const bumpType = calculateBumpFromCommits(commits, config);
 * console.log(bumpType); // "major" (breaking change present)
 * ```
 *
 * @example
 * ```typescript
 * // Example with only documentation changes
 * const commits: CommitInfo[] = [
 *   { type: 'docs', breaking: false, message: 'docs: update README', subject: '...', hash: '...' },
 *   { type: 'chore', breaking: false, message: 'chore: update deps', subject: '...', hash: '...' }
 * ];
 *
 * const bumpType = calculateBumpFromCommits(commits, config);
 * console.log(bumpType); // "none" (no version-affecting commits)
 * ```
 *
 * @example
 * ```typescript
 * // Example with empty commits
 * const commits: CommitInfo[] = [];
 *
 * const bumpType = calculateBumpFromCommits(commits, config);
 * console.log(bumpType); // "none" (no commits)
 * ```
 *
 * @example
 * ```typescript
 * // Complete workflow example
 * import { calculateBumpFromCommits } from './utils/commits.js';
 * import { bumpSemVer } from './semver/index.js';
 * import { parse } from 'semver';
 *
 * // Get commits for a module
 * const moduleCommits = await commitAnalyzer.analyzeCommitsSinceLastRelease();
 * const coreCommits = moduleCommits.get(':core') || [];
 *
 * // Calculate required bump
 * const bumpType = calculateBumpFromCommits(coreCommits, config);
 *
 * if (bumpType !== 'none') {
 *   // Get current version
 *   const currentVersion = parse('1.2.3')!;
 *
 *   // Calculate new version
 *   const newVersion = bumpSemVer(currentVersion, bumpType);
 *
 *   console.log(`Version bump: ${currentVersion} → ${newVersion} (${bumpType})`);
 *   // Output: "Version bump: 1.2.3 → 1.3.0 (minor)"
 * } else {
 *   console.log('No version bump required');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Custom configuration example
 * const customConfig: Config = {
 *   commitTypes: {
 *     feat: 'minor',
 *     fix: 'patch',
 *     perf: 'patch',      // Performance improvements bump patch
 *     refactor: 'patch',  // Refactors bump patch
 *     docs: 'none',
 *     style: 'none',
 *     test: 'none',
 *     chore: 'none'
 *   },
 *   // ... other config
 * };
 *
 * const commits: CommitInfo[] = [
 *   { type: 'perf', breaking: false, message: 'perf: optimize query', subject: '...', hash: '...' }
 * ];
 *
 * const bumpType = calculateBumpFromCommits(commits, customConfig);
 * console.log(bumpType); // "patch" (perf mapped to patch)
 * ```
 *
 * @see {@link getBumpTypeForCommit} - Maps individual commit to bump type
 * @see {@link maxBumpType} - Determines highest bump type from array
 * @see {@link BumpType} - Semantic version bump type values
 * @see {@link CommitInfo} - Commit information structure
 * @see {@link Config} - Configuration structure with commit type mappings
 */
export declare function calculateBumpFromCommits(commits: CommitInfo[], config: Config): BumpType;
//# sourceMappingURL=commits.d.ts.map