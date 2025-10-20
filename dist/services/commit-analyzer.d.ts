import { ModuleRegistry } from './module-registry.js';
import { CommitInfo } from '../git/index.js';
export declare class CommitAnalyzer {
    private readonly moduleRegistry;
    private readonly repoRoot;
    constructor(moduleRegistry: ModuleRegistry, repoRoot: string);
    analyzeCommitsSinceLastRelease(): Promise<Map<string, CommitInfo[]>>;
    /**
     * Find all child module paths for a given module.
     * Child modules are those whose path is a subdirectory of the parent module's path.
     */
    private findChildModulePaths;
    /**
     * Check if childPath is a subdirectory of parentPath
     */
    private isChildPath;
}
//# sourceMappingURL=commit-analyzer.d.ts.map