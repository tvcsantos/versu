import { Config } from '../config/index.js';
import { CommitInfo } from '../git/index.js';
import { BumpType } from '../semver/index.js';
/**
 * Calculate the overall bump type from a collection of commits.
 * Analyzes each commit and returns the highest bump type found.
 *
 * @param commits Array of commit information to analyze
 * @param config Configuration containing commit type mappings and rules
 * @returns The highest bump type found across all commits
 */
export declare function calculateBumpFromCommits(commits: CommitInfo[], config: Config): BumpType;
//# sourceMappingURL=commits.d.ts.map