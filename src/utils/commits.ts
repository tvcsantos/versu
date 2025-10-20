import { getBumpTypeForCommit, Config } from '../config/index.js';
import { CommitInfo } from '../git/index.js';
import { BumpType, maxBumpType } from '../semver/index.js';

/**
 * Calculate the overall bump type from a collection of commits.
 * Analyzes each commit and returns the highest bump type found.
 * 
 * @param commits Array of commit information to analyze
 * @param config Configuration containing commit type mappings and rules
 * @returns The highest bump type found across all commits
 */
export function calculateBumpFromCommits(commits: CommitInfo[], config: Config): BumpType {
  const bumpTypes: BumpType[] = [];

  for (const commit of commits) {
    const bumpType = getBumpTypeForCommit(commit.type, commit.breaking, config);
    if (bumpType !== 'none') {
      bumpTypes.push(bumpType);
    }
  }

  return maxBumpType(bumpTypes);
}
