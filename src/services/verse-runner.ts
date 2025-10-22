import * as core from '@actions/core';
import { ModuleSystemFactory } from "./module-system-factory.js";
import { ModuleRegistry } from './module-registry.js';
import { VersionManager } from './version-manager.js';
import { createModuleSystemFactory } from '../factories/module-system-factory.js';
import { Config } from '../config/index.js';
import {
  isWorkingDirectoryClean
} from '../git/index.js';

// Service imports
import { ConfigurationLoader } from './configuration-loader.js';
import { CommitAnalyzer } from './commit-analyzer.js';
import { VersionBumper, VersionBumperOptions } from './version-bumper.js';
import { VersionApplier, VersionApplierOptions, ModuleChangeResult } from './version-applier.js';
import { ChangelogGenerator } from './changelog-generator.js';
import { GitOperations, GitOperationsOptions } from './git-operations.js';
import { AdapterMetadata } from './adapter-identifier.js';
import { AdapterMetadataProvider } from './adapter-metadata-provider.js';
import { AdapterIdentifierRegistry } from './adapter-identifier-registry.js';
import { createAdapterIdentifierRegistry } from '../factories/adapter-identifier-registry.js';
import { Module } from '../adapters/project-information.js';
import { ConfigurationValidator } from './configuration-validator.js';

export type RunnerOptions = {
  readonly repoRoot: string;
  readonly adapter?: string;
  readonly dryRun: boolean;
  readonly pushTags: boolean;
  readonly prereleaseMode: boolean;
  readonly prereleaseId: string;
  readonly bumpUnchanged: boolean;
  readonly addBuildMetadata: boolean;
  readonly timestampVersions: boolean;
  readonly appendSnapshot: boolean;
  readonly pushChanges: boolean;
  readonly generateChangelog: boolean;
};

export type RunnerResult = {
  readonly bumped: boolean;
  readonly discoveredModules: Array<Module>;
  readonly changedModules: Array<ModuleChangeResult>;
  readonly createdTags: string[];
  readonly changelogPaths: string[];
};

export class VerseRunner {
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
  private changelogGenerator: ChangelogGenerator;
  private gitOperations!: GitOperations; // Will be initialized in run()
  private adapterIdentifierRegistry: AdapterIdentifierRegistry;
  private adapterMetadataProvider: AdapterMetadataProvider;

  constructor(options: RunnerOptions) {
    this.options = options;

    // Initialize services
    this.configurationLoader = new ConfigurationLoader(new ConfigurationValidator());
    this.changelogGenerator = new ChangelogGenerator({
      generateChangelog: options.generateChangelog,
      repoRoot: options.repoRoot,
      dryRun: options.dryRun
    });
    this.adapterIdentifierRegistry = createAdapterIdentifierRegistry();
    this.adapterMetadataProvider = new AdapterMetadataProvider(
      this.adapterIdentifierRegistry, {
      repoRoot: options.repoRoot,
      adapter: options.adapter
    });
  }

  async run(): Promise<RunnerResult> {
    core.info('🏃 Running VERSE semantic evolution pipeline...');

    this.adapter = await this.adapterMetadataProvider.getMetadata();

    // Initialize module system factory with resolved adapter
    this.moduleSystemFactory = createModuleSystemFactory(this.adapter.id, this.options.repoRoot);

    // Load configuration
    this.config = await this.configurationLoader.load(
      this.options.repoRoot
    );

    // Check if working directory is clean
    if (!this.options.dryRun && !isWorkingDirectoryClean({ cwd: this.options.repoRoot })) {
      throw new Error('Working directory is not clean. Please commit or stash your changes.');
    }

    // Discover modules and get hierarchy manager
    core.info('🔍 Discovering modules...');
    const detector = this.moduleSystemFactory.createDetector();
    this.moduleRegistry = await detector.detect();

    // Log discovered modules through hierarchy manager
    const moduleIds = this.moduleRegistry.getModuleIds();
    core.info(`Found ${moduleIds.length} modules: ${moduleIds.join(', ')}`);

    // Analyze commits since last release
    this.commitAnalyzer = new CommitAnalyzer(this.moduleRegistry, this.options.repoRoot);
    const moduleCommits = await this.commitAnalyzer.analyzeCommitsSinceLastRelease();

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
    this.versionBumper = new VersionBumper(this.moduleRegistry, versionBumperOptions);

    // Calculate version bumps with cascade effects
    const processedModuleChanges = await this.versionBumper.calculateVersionBumps(moduleCommits);

    const discoveredModules = Array.from(this.moduleRegistry.getModules().values());

    if (processedModuleChanges.length === 0) {
      core.info('✨ No version changes needed');
      return {
        bumped: false,
        discoveredModules,
        changedModules: [],
        createdTags: [],
        changelogPaths: [],
      };
    }

    // Create version manager  
    const versionUpdateStrategy = this.moduleSystemFactory.createVersionUpdateStrategy();
    this.versionManager = new VersionManager(this.moduleRegistry, versionUpdateStrategy);

    // Initialize version applier and apply changes
    const versionApplierOptions: VersionApplierOptions = {
      dryRun: this.options.dryRun
    };
    this.versionApplier = new VersionApplier(this.versionManager, versionApplierOptions);
    const changedModules = await this.versionApplier.applyVersionChanges(processedModuleChanges);

    // Generate changelogs
    const changelogPaths = await this.changelogGenerator.generateChangelogs(
      changedModules,
      moduleCommits
    );

    // Initialize git operations service
    const gitOperationsOptions: GitOperationsOptions = {
      pushChanges: this.options.pushChanges,
      pushTags: this.options.pushTags,
      repoRoot: this.options.repoRoot,
      dryRun: this.options.dryRun,
      isTemporaryVersion: this.options.prereleaseMode || this.options.appendSnapshot,
    };
    this.gitOperations = new GitOperations(gitOperationsOptions);

    // Commit and push changes
    await this.gitOperations.commitAndPushChanges(changedModules);

    // Create and push tags
    const createdTags = await this.gitOperations.createAndPushTags(changedModules);

    core.info('✅ VERSE semantic evolution pipeline completed successfully!');

    return {
      bumped: true,
      discoveredModules,
      changedModules,
      createdTags,
      changelogPaths,
    };
  }
}
