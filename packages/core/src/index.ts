// Core VERSU exports - business logic without GitHub Actions dependency

// Configuration
export * from './config/index.js';

// Plugins
export type { PluginContract, AdapterPluginContract } from './plugins/plugin-loader.js';

// Services
export { VersuRunner } from './services/versu-runner.js';
export type { RunnerOptions, RunnerResult } from './services/versu-runner.js';
export { VersionManager } from './services/version-manager.js';
export { ModuleRegistry } from './services/module-registry.js';
export { VersionBumper } from './services/version-bumper.js';
export type { VersionBumperOptions } from './services/version-bumper.js';
export { VersionApplier } from './services/version-applier.js';
export type { VersionApplierOptions, ModuleChangeResult } from './services/version-applier.js';
export { ChangelogGenerator } from './services/changelog-generator.js';
export { GitOperations } from './services/git-operations.js';
export type { GitOperationsOptions } from './services/git-operations.js';
export { CommitAnalyzer } from './services/commit-analyzer.js';
export { ConfigurationLoader } from './services/configuration-loader.js';
export type { AdapterIdentifier, AdapterMetadata } from './services/adapter-identifier.js';
export { AdapterIdentifierRegistry } from './services/adapter-identifier-registry.js';
export type { ModuleDetector } from './services/module-detector.js';
export type { VersionUpdateStrategy } from './services/version-update-strategy.js';

// Adapters
export type { RawProjectInformation, ProjectInformation, Module, BaseModule } from './adapters/project-information.js';

// Factories
export { createModuleSystemFactory } from './factories/module-system-factory.js';
export type { ModuleSystemFactory } from './services/module-system-factory.js';

// Git utilities
export * from './git/index.js';

// Semver utilities
export * from './semver/index.js';

// Utilities
export * from './utils/index.js';
