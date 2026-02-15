import { logger } from "../utils/logger.js";
import {
  generateChangelogsForModules,
  generateRootChangelog,
} from "../changelog/index.js";
import { ModuleChangeResult } from "./version-applier.js";
import { Commit } from "conventional-commits-parser";
import zod from "zod";
import { changelogSchema, configSchema } from "../config/index.js";

export type ModuleChangelogConfig = zod.infer<typeof changelogSchema>;
export type ChangelogConfig = zod.infer<typeof configSchema>["changelog"];

export type ChangelogGeneratorOptions = {
  generateChangelog: boolean;
  repoRoot: string;
  dryRun: boolean;
  config: ChangelogConfig;
};

export class ChangelogGenerator {
  constructor(private readonly options: ChangelogGeneratorOptions) {}

  async generateChangelogs(
    moduleResults: ModuleChangeResult[],
    moduleCommits: Map<string, { commits: Commit[]; lastTag: string | null }>,
  ): Promise<string[]> {
    if (!this.options.generateChangelog) {
      logger.info(
        "Changelog generation disabled, skipping"
      );
      return [];
    }

    if (moduleResults.length === 0) {
      logger.info(
        "No modules with declared versions, skipping changelog generation"
      );
      return [];
    }

    logger.info("Generating changelogs");

    // Generate individual module changelogs
    const changelogPaths = await generateChangelogsForModules(
      moduleResults,
      async (moduleId) =>
        moduleCommits.get(moduleId) || { commits: [], lastTag: null },
      this.options.repoRoot,
      this.options.dryRun,
      this.options.config?.module,
    );

    // Generate root changelog
    const rootChangelogPath = await generateRootChangelog(
      moduleResults,
      async (moduleId) =>
        moduleCommits.get(moduleId) || { commits: [], lastTag: null },
      this.options.repoRoot,
      this.options.dryRun,
      this.options.config?.root,
    );

    if (rootChangelogPath) {
      changelogPaths.push(rootChangelogPath);
    }

    logger.info("Changelog generation completed", { fileCount: changelogPaths.length });
    return changelogPaths;
  }
}
