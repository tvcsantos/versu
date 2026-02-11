import { promises as fs } from "fs";
import path, { join } from "path";
import { ModuleChangeResult } from "../services/version-applier.js";
import { writeChangelogString } from "conventional-changelog-writer";
import { logger } from "../utils/logger.js";
import { Commit } from "conventional-commits-parser";
import { exists } from "../utils/file.js";
import { getCurrentRepoUrl, GitOptions, parseRepoUrl } from "../git/index.js";
import { isReleaseVersion } from "../semver/index.js";

/** Update or create a changelog file for a module. */
export async function updateChangelogFile(
  changelogContent: string,
  changelogPath: string,
  prependPlaceholder: string,
): Promise<void> {
  let fileContent = changelogContent;
  if (await exists(changelogPath)) {
    logger.info(`Updating existing changelog at ${changelogPath}...`);
    // Try to read existing changelog
    const existingContent = await fs.readFile(changelogPath, "utf8");
    const newContent = `${prependPlaceholder}\n\n${changelogContent.trimEnd()}`;

    fileContent = existingContent.replace(prependPlaceholder, newContent);
  }
  await fs.writeFile(changelogPath, fileContent, "utf8");
}

type ContextRepository = {
  repoUrl: string;
  host: string;
  owner: string;
  repository: string;
};

async function buildContextRepository(
  options: GitOptions = {},
): Promise<ContextRepository> {
  const repoUrl = await getCurrentRepoUrl(options);
  const { host, owner, repo } = parseRepoUrl(repoUrl);
  return {
    repoUrl: `https://${host}/${owner}/${repo}`,
    host: `https://${host}`,
    owner,
    repository: repo,
  };
}

/** Generate changelog for multiple modules. */
export async function generateChangelogsForModules(
  moduleResults: ModuleChangeResult[],
  getCommitsForModule: (
    moduleId: string,
  ) => Promise<{ commits: Commit[]; lastTag: string | null }>,
  repoRoot: string,
): Promise<string[]> {
  const changelogPaths: string[] = [];

  const configPath = path.resolve(repoRoot, "changelog.config.js");

  if (!(await exists(configPath))) {
    throw new Error(
      `Missing required changelog configuration file at ${configPath}`,
    );
  }

  logger.info(`Loading changelog configuration from ${configPath}...`);
  const userConfig = (await import(configPath)).default.module;

  const prependPlaceholder = userConfig.context.prependPlaceholder;

  if (!prependPlaceholder) {
    throw new Error(
      "Missing required context property 'prependPlaceholder' in changelog.config.js",
    );
  }

  const contextRepository = await buildContextRepository({ cwd: repoRoot });

  for (const moduleResult of moduleResults) {
    if (!moduleResult.declaredVersion) {
      logger.info(
        `Module ${moduleResult.id} has no declared version, skipping changelog generation...`,
      );
      continue;
    }

    const { commits, lastTag } = await getCommitsForModule(moduleResult.id);

    if (commits.length === 0) {
      logger.info(
        `No commits to include in changelog for module ${moduleResult.id}, skipping...`,
      );
      continue;
    }

    const changelogPath = join(repoRoot, moduleResult.path, "CHANGELOG.md");

    let prepend = true;
    if (await exists(changelogPath)) {
      prepend = false;
    }

    const isRelease = isReleaseVersion(moduleResult.to);
    const version = isRelease ? moduleResult.to : undefined;
    const currentTag = isRelease
      ? `${moduleResult.name}@${moduleResult.to}`
      : undefined;
    const previousTag = lastTag || undefined;

    const changelogContent = await writeChangelogString(
      commits,
      {
        version: version,
        previousTag: previousTag,
        currentTag: currentTag,
        linkCompare: previousTag && currentTag ? true : false,
        ...contextRepository,
        ...userConfig.context,
        prepend,
      },
      userConfig.options,
    );

    logger.info(changelogContent);

    await updateChangelogFile(
      changelogContent,
      changelogPath,
      prependPlaceholder,
    );

    changelogPaths.push(changelogPath);
  }

  return changelogPaths;
}

export async function generateRootChangelog(
  moduleResults: ModuleChangeResult[],
  getCommitsForModule: (
    moduleId: string,
  ) => Promise<{ commits: Commit[]; lastTag: string | null }>,
  repoRoot: string,
): Promise<string | undefined> {
  const moduleResult = moduleResults.find((result) => result.type === "root");

  if (!moduleResult) {
    logger.info("No root module found, skipping root changelog generation...");
    return;
  }

  const configPath = path.resolve(repoRoot, "changelog.config.js");

  if (!(await exists(configPath))) {
    throw new Error(
      `Missing required changelog configuration file at ${configPath}`,
    );
  }

  logger.info(`Loading root changelog configuration from ${configPath}...`);
  const userConfig = (await import(configPath)).default.root;

  const prependPlaceholder = userConfig.context.prependPlaceholder;

  if (!prependPlaceholder) {
    throw new Error(
      "Missing required context property 'prependPlaceholder' in changelog.config.js",
    );
  }

  const contextRepository = await buildContextRepository({ cwd: repoRoot });

  /*if (!moduleResult.declaredVersion) {
      logger.info(
        `Module ${moduleResult.id} has no declared version, skipping changelog generation...`,
      );
      return;
    }*/

  const { commits, lastTag } = await getCommitsForModule(moduleResult.id);

  if (commits.length === 0) {
    logger.info(
      `No commits to include in changelog for module ${moduleResult.id}, skipping...`,
    );
    return;
  }

  const changelogPath = join(repoRoot, moduleResult.path, "CHANGELOG.md");

  let prepend = true;
  if (await exists(changelogPath)) {
    prepend = false;
  }

  const isRelease = isReleaseVersion(moduleResult.to);
  const version = isRelease ? moduleResult.to : undefined;
  const currentTag = isRelease
    ? `${moduleResult.name}@${moduleResult.to}`
    : undefined;
  const previousTag = lastTag || undefined;

  const changelogContent = await writeChangelogString(
    commits,
    {
      moduleResults,
      version: version,
      previousTag: previousTag,
      currentTag: currentTag,
      linkCompare: previousTag && currentTag ? true : false,
      ...contextRepository,
      ...userConfig.context,
      prepend,
    },
    userConfig.options,
  );

  logger.info(changelogContent);

  await updateChangelogFile(
    changelogContent,
    changelogPath,
    prependPlaceholder,
  );

  return changelogPath;
}
