import { logger } from "../utils/logger.js";
import { ModuleSystemFactory } from "./module-system-factory.js";
import { MapModuleRegistry, type ModuleRegistry } from "./module-registry.js";
import { VersionManager } from "./version-manager.js";
import { createModuleSystemFactory } from "../factories/module-system-factory.js";
import { type Config, configSchema } from "../config/index.js";
import { isWorkingDirectoryClean } from "../git/index.js";
import { ConfigurationLoader } from "./configuration-loader.js";
import { CommitAnalyzer } from "./commit-analyzer.js";
import { VersionBumper, VersionBumperOptions } from "./version-bumper.js";
import {
  VersionApplier,
  VersionApplierOptions,
  ModuleChangeResult,
} from "./version-applier.js";
import { ChangelogGenerator } from "./changelog-generator.js";
import { GitOperations, GitOperationsOptions } from "./git-operations.js";
import { AdapterMetadata } from "./adapter-identifier.js";
import { AdapterMetadataProvider } from "./adapter-metadata-provider.js";
import { AdapterIdentifierRegistry } from "./adapter-identifier-registry.js";
import { createAdapterIdentifierRegistry } from "../factories/adapter-identifier-registry.js";
import { Module } from "../adapters/project-information.js";
import { ConfigurationValidatorFactory } from "./configuration-validator.js";
import { banner } from "../utils/banner.js";
import path from "path";
import { PluginContract, PluginLoader } from "../plugins/plugin-loader.js";
import { pluginContractSchema } from "../plugins/plugin-schema.js";
import { Commit } from "conventional-commits-parser";

export type RunnerOptions = {
  readonly repoRoot: string;
  readonly prereleaseMode: boolean;
  readonly prereleaseId: string;
  readonly bumpUnchanged: boolean;
  readonly addBuildMetadata: boolean;
  readonly timestampVersions: boolean;
  readonly appendSnapshot: boolean;
  readonly createTags: boolean;
  readonly generateChangelog: boolean;
  readonly pushChanges: boolean;
  readonly dryRun: boolean;
  readonly adapter?: string;
};

export type RunnerResult = {
  readonly bumped: boolean;
  readonly discoveredModules: Array<Module>;
  readonly changedModules: Array<ModuleChangeResult>;
  readonly createdTags: string[];
  readonly changelogPaths: string[];
};

export class VersuRunner {
  private moduleSystemFactory!: ModuleSystemFactory; // Will be initialized in run()
  private moduleRegistry!: ModuleRegistry; // Will be initialized in run()
  private versionManager!: VersionManager; // Will be initialized in run()
  private config!: Config; // Will be initialized in run()
  private adapter!: AdapterMetadata; // Will be initialized in run()
  private options: RunnerOptions;

  // Service instances
  private configurationLoader: ConfigurationLoader;
  private commitAnalyzer!: CommitAnalyzer;
  private versionBumper!: VersionBumper; // Will be initialized in run()
  private versionApplier!: VersionApplier; // Will be initialized in run()
  private changelogGenerator!: ChangelogGenerator; // Will be initialized in run()
  private gitOperations!: GitOperations; // Will be initialized in run()
  private adapterIdentifierRegistry!: AdapterIdentifierRegistry;
  private adapterMetadataProvider!: AdapterMetadataProvider;
  private pluginLoader!: PluginLoader; // Will be initialized in run()
  private configDirectory!: string; // Will be initialized in run()

  constructor(options: RunnerOptions) {
    this.options = {
      ...options,
      repoRoot: path.resolve(options.repoRoot),
    };

    // Initialize services
    this.configurationLoader = new ConfigurationLoader(
      ConfigurationValidatorFactory.create<Config>(configSchema),
    );

    this.pluginLoader = new PluginLoader(
      ConfigurationValidatorFactory.create<PluginContract>(
        pluginContractSchema,
      ),
    );
  }

  private logStartupInfo(): void {
    logger.info(banner);
    logger.info("Composing the history of your code, one version at a time");
    logger.info("Starting versioning engine", {
      repository: this.options.repoRoot,
      adapter: this.options.adapter || "(auto-detect)",
      dryRun: this.options.dryRun,
      prereleaseMode: this.options.prereleaseMode,
      prereleaseId: this.options.prereleaseMode
        ? this.options.prereleaseId
        : undefined,
      bumpUnchanged: this.options.prereleaseMode
        ? this.options.bumpUnchanged
        : undefined,
      addBuildMetadata: this.options.addBuildMetadata,
      timestampVersions: this.options.timestampVersions,
      appendSnapshot: this.options.appendSnapshot,
      createTags: this.options.createTags,
      generateChangelog: this.options.generateChangelog,
      pushChanges: this.options.pushChanges,
    });
  }

  private logShutdownInfo(result: RunnerResult | null): void {
    if (!result) return;
    if (result.bumped) {
      logger.info("Modules version updated", {
        modules: result.changedModules.map((m) => ({
          id: m.id,
          from: m.from,
          to: m.to,
        })),
      });

      if (result.createdTags.length > 0) {
        logger.info("Tags created", { tags: result.createdTags });
      }

      if (result.changelogPaths.length > 0) {
        logger.info("Changelog files generated", {
          paths: result.changelogPaths,
        });
      }
    } else {
      logger.info("All versions up to date");
    }

    logger.info("Completed successfully");
  }

  async run(): Promise<RunnerResult> {
    this.logStartupInfo();
    let result: RunnerResult | null = null;
    try {
      result = await this.doRun();
      return result;
    } finally {
      // Any cleanup if needed
      this.logShutdownInfo(result);
    }
  }

  private async loadConfiguration(): Promise<void> {
    this.configDirectory = path.join(this.options.repoRoot, ".versu");
    this.config = await this.configurationLoader.load(this.configDirectory);
  }

  private async loadPluginsAndResolveAdapter(): Promise<void> {
    await this.pluginLoader.load(this.config.plugins);
    const plugins = this.pluginLoader.plugins;

    this.adapterIdentifierRegistry = createAdapterIdentifierRegistry(plugins);

    this.adapterMetadataProvider = new AdapterMetadataProvider(
      this.adapterIdentifierRegistry,
      {
        repoRoot: this.options.repoRoot,
        adapter: this.options.adapter,
      },
    );

    this.adapter = await this.adapterMetadataProvider.getMetadata();

    // Initialize module system factory with resolved adapter
    this.moduleSystemFactory = createModuleSystemFactory(
      this.adapter.id,
      plugins.flatMap((plugin) => plugin.adapters),
      this.options.repoRoot,
    );
  }

  private async discoverModulesAndAnalyzeCommits(): Promise<
    Map<string, { commits: Commit[]; lastTag: string | null }>
  > {
    // Discover modules and get hierarchy manager
    const detector = this.moduleSystemFactory.createDetector(
      path.resolve(path.join(this.configDirectory, "project-information.json")),
    );
    this.moduleRegistry = new MapModuleRegistry(await detector.detect());

    // Log discovered modules through hierarchy manager
    const moduleIds = this.moduleRegistry.getModuleIds();
    logger.info("Module discovery completed", {
      modules: moduleIds,
    });

    // Analyze commits since last release
    this.commitAnalyzer = new CommitAnalyzer(
      this.moduleRegistry,
      this.options.repoRoot,
    );

    return await this.commitAnalyzer.analyzeCommitsSinceLastRelease();
  }

  private async calculatingBumpsAndApplyingChanges(
    moduleCommits: Map<string, { commits: Commit[]; lastTag: string | null }>,
  ): Promise<{
    discoveredModules: Array<Module>;
    changedModules: ModuleChangeResult[];
  }> {
    // Initialize version bumper service
    const versionBumperOptions: VersionBumperOptions = {
      prereleaseMode: this.options.prereleaseMode,
      bumpUnchanged: this.options.bumpUnchanged,
      addBuildMetadata: this.options.addBuildMetadata,
      appendSnapshot: this.options.appendSnapshot,
      adapter: this.adapter,
      timestampVersions: this.options.timestampVersions,
      prereleaseId: this.options.prereleaseId,
      repoRoot: this.options.repoRoot,
      config: this.config,
    };
    this.versionBumper = new VersionBumper(
      this.moduleRegistry,
      versionBumperOptions,
    );

    // Calculate version bumps with cascade effects
    const processedModuleChanges =
      await this.versionBumper.calculateVersionBumps(moduleCommits);

    const discoveredModules = Array.from(
      this.moduleRegistry.getModules().values(),
    );

    // Create version manager
    const versionUpdateStrategy =
      this.moduleSystemFactory.createVersionUpdateStrategy(this.moduleRegistry);
    this.versionManager = new VersionManager(
      this.moduleRegistry,
      versionUpdateStrategy,
    );

    // Initialize version applier and apply changes
    const versionApplierOptions: VersionApplierOptions = {
      dryRun: this.options.dryRun,
    };
    this.versionApplier = new VersionApplier(
      this.versionManager,
      versionApplierOptions,
    );

    const changedModules = await this.versionApplier.applyVersionChanges(
      processedModuleChanges,
    );

    return { discoveredModules, changedModules };
  }

  private async generateChangelogs(
    changedModules: ModuleChangeResult[],
    moduleCommits: Map<string, { commits: Commit[]; lastTag: string | null }>,
    multiModule: boolean,
  ): Promise<string[]> {
    this.changelogGenerator = new ChangelogGenerator({
      generateChangelog: this.options.generateChangelog,
      repoRoot: this.options.repoRoot,
      dryRun: this.options.dryRun,
      config: this.config.changelog,
      multiModule,
    });

    // Generate changelogs
    const changelogPaths = await this.changelogGenerator.generateChangelogs(
      changedModules,
      moduleCommits,
    );

    return changelogPaths;
  }

  private async commitChangesAndPush(
    changedModules: ModuleChangeResult[],
  ): Promise<string[]> {
    // Initialize git operations service
    const gitOperationsOptions: GitOperationsOptions = {
      pushChanges: this.options.pushChanges,
      createTags: this.options.createTags,
      repoRoot: this.options.repoRoot,
      dryRun: this.options.dryRun,
      isTemporaryVersion:
        this.options.prereleaseMode || this.options.appendSnapshot,
    };
    this.gitOperations = new GitOperations(gitOperationsOptions);

    // Commit and push changes
    await this.gitOperations.commitAndPushChanges(changedModules);

    // Create and push tags
    const createdTags =
      await this.gitOperations.createAndPushTags(changedModules);

    return createdTags;
  }

  private async doRun(): Promise<RunnerResult> {
    logger.startGroup("Loading configuration");

    await this.loadConfiguration();

    logger.endGroup();

    logger.startGroup("Loading plugins and resolving adapter");

    await this.loadPluginsAndResolveAdapter();

    logger.endGroup();

    // Check if working directory is clean
    if (
      !this.options.dryRun &&
      !isWorkingDirectoryClean({ cwd: this.options.repoRoot })
    ) {
      throw new Error(
        "Working directory is not clean. Please commit or stash your changes.",
      );
    }

    logger.startGroup("Discovering modules and analyzing commits");

    const moduleCommits = await this.discoverModulesAndAnalyzeCommits();

    logger.endGroup();

    logger.startGroup("Calculating version bumps and applying changes");

    const { discoveredModules, changedModules } =
      await this.calculatingBumpsAndApplyingChanges(moduleCommits);

    if (changedModules.length === 0) {
      return {
        bumped: false,
        discoveredModules,
        changedModules: [],
        createdTags: [],
        changelogPaths: [],
      };
    }

    logger.endGroup();

    logger.startGroup("Generating changelogs");

    const changelogPaths = await this.generateChangelogs(
      changedModules,
      moduleCommits,
      discoveredModules.length > 1,
    );

    logger.endGroup();

    logger.startGroup("Committing changes and pushing to remote");

    const createdTags = await this.commitChangesAndPush(changedModules);

    logger.endGroup();

    logger.info("Semantic evolution completed successfully");

    return {
      bumped: true,
      discoveredModules,
      changedModules,
      createdTags,
      changelogPaths,
    };
  }
}
