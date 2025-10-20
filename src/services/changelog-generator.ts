import * as core from '@actions/core';
import { generateChangelogsForModules, generateRootChangelog } from '../changelog/index.js';
import { ModuleChangeResult } from './version-applier.js';
import { CommitInfo } from '../git/index.js';

export type ChangelogGeneratorOptions = {
  generateChangelog: boolean;
  repoRoot: string;
  dryRun: boolean;
};

export class ChangelogGenerator {
  
  constructor(private readonly options: ChangelogGeneratorOptions) {
  }

  async generateChangelogs(
    moduleResults: ModuleChangeResult[],
    moduleCommits: Map<string, CommitInfo[]>
  ): Promise<string[]> {
    if (!this.options.generateChangelog) {
      core.info('📚 Skipping changelog generation (disabled by generate-changelog input)');
      return [];
    }

    core.info('📚 Generating changelogs...');
    
    if (this.options.dryRun) {
      core.info('🏃‍♂️ Dry run mode - changelogs will not be written to files');
      return [];
    }
    
    // Generate individual module changelogs
    const changelogPaths = await generateChangelogsForModules(
      moduleResults,
      async (moduleId) => moduleCommits.get(moduleId) || [],
      this.options.repoRoot
    );

    // Generate root changelog
    const rootChangelogPath = await generateRootChangelog(moduleResults, this.options.repoRoot);
    changelogPaths.push(rootChangelogPath);

    core.info(`📝 Generated ${changelogPaths.length} changelog files`);
    return changelogPaths;
  }
}
