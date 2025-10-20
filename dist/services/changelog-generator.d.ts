import { ModuleChangeResult } from './version-applier.js';
import { CommitInfo } from '../git/index.js';
export type ChangelogGeneratorOptions = {
    generateChangelog: boolean;
    repoRoot: string;
    dryRun: boolean;
};
export declare class ChangelogGenerator {
    private readonly options;
    constructor(options: ChangelogGeneratorOptions);
    generateChangelogs(moduleResults: ModuleChangeResult[], moduleCommits: Map<string, CommitInfo[]>): Promise<string[]>;
}
//# sourceMappingURL=changelog-generator.d.ts.map