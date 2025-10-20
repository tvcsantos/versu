import * as core from '@actions/core';
import { ModuleRegistry } from './module-registry.js';
import { CommitInfo, getCommitsSinceLastTag } from '../git/index.js';

export class CommitAnalyzer {
  
  constructor(
    private readonly moduleRegistry: ModuleRegistry,
    private readonly repoRoot: string
  ) {}

  async analyzeCommitsSinceLastRelease(): Promise<Map<string, CommitInfo[]>> {
    core.info('📝 Analyzing commits since last release...');
    
    const moduleCommits = new Map<string, CommitInfo[]>();

    for (const [projectId, projectInfo] of this.moduleRegistry.getModules()) {
      // Find child module paths to exclude from this module's commits
      const childModulePaths = this.findChildModulePaths(
        projectInfo.path,
        projectId
      );
      
      const commits = await getCommitsSinceLastTag(
        projectInfo.path, 
        projectInfo.name,
        projectInfo.type,
        { cwd: this.repoRoot },
        childModulePaths
      );
      
      moduleCommits.set(projectId, commits);
      
      if (childModulePaths.length > 0) {
        core.debug(`🔍 Module ${projectInfo.id} excludes ${childModulePaths.length} child module(s): ${childModulePaths.join(', ')}`);
      }
    }

    const totalCommits = Array.from(moduleCommits.values()).reduce((sum, commits) => sum + commits.length, 0);
    core.info(`📊 Analyzed ${totalCommits} commits across ${moduleCommits.size} modules`);
    
    return moduleCommits;
  }

  /**
   * Find all child module paths for a given module.
   * Child modules are those whose path is a subdirectory of the parent module's path.
   */
  private findChildModulePaths(
    modulePath: string,
    moduleId: string
  ): string[] {
    const childPaths: string[] = [];

    for (const [otherId, otherInfo] of this.moduleRegistry.getModules()) {
      if (otherId !== moduleId && this.isChildPath(otherInfo.path, modulePath)) {
        childPaths.push(otherInfo.path);
      }
    }
    
    return childPaths;
  }

  /**
   * Check if childPath is a subdirectory of parentPath
   */
  private isChildPath(childPath: string, parentPath: string): boolean {
    if (parentPath === '.') {
      return childPath !== '.';
    }
    
    // Check if child path starts with parent path followed by a separator
    return childPath.startsWith(parentPath + '/');
  }
}
