import { BumpType } from '../semver/index.js';
/**
 * Configuration for VERSE version bumping behavior.
 * Controls commit type handling, dependency cascade rules, and adapter-specific settings.
 */
export type Config = {
    /** Default bump type to apply when commit type is not in commitTypes map. */
    readonly defaultBump: BumpType;
    /** Map of Conventional Commit types to their corresponding bump types or 'ignore'. */
    readonly commitTypes: Record<string, BumpType | 'ignore'>;
    /** Rules defining how dependency changes propagate to dependent modules. */
    readonly dependencyRules: DependencyRules;
    /** Optional Node.js/npm-specific configuration. */
    readonly nodejs?: NodeJSConfig;
};
/**
 * Rules for propagating version changes through dependency relationships.
 * Defines how a module should be bumped when its dependencies change.
 */
export type DependencyRules = {
    /** Bump type to apply when a major dependency changes. */
    readonly onMajorOfDependency: BumpType;
    /** Bump type to apply when a minor dependency changes. */
    readonly onMinorOfDependency: BumpType;
    /** Bump type to apply when a patch dependency changes. */
    readonly onPatchOfDependency: BumpType;
};
/**
 * Configuration for Node.js/npm projects.
 */
export type NodeJSConfig = {
    /** Source files to read/write version information (currently only package.json supported). */
    readonly versionSource: ('package.json')[];
    /** Whether to update package-lock.json when package.json version changes. */
    readonly updatePackageLock: boolean;
};
/**
 * Default VERSE configuration following Conventional Commits specification.
 * Maps common commit types to semantic version bumps and defines dependency cascade rules.
 */
export declare const DEFAULT_CONFIG: Config;
/**
 * Determines the bump type for a commit based on its type and breaking change flag.
 * @param commitType - The Conventional Commit type (e.g., 'feat', 'fix', 'chore')
 * @param isBreaking - Whether the commit contains breaking changes
 * @param config - Configuration containing commit type mappings
 * @returns The bump type to apply ('major', 'minor', 'patch', or 'none')
 */
export declare function getBumpTypeForCommit(commitType: string, isBreaking: boolean, config: Config): BumpType;
/**
 * Determines how a module should be bumped when one of its dependencies changes.
 * Uses dependency cascade rules from configuration to propagate version changes.
 * @param dependencyBumpType - The bump type applied to the dependency
 * @param config - Configuration containing dependency cascade rules
 * @returns The bump type to apply to the dependent module
 */
export declare function getDependencyBumpType(dependencyBumpType: BumpType, config: Config): BumpType;
/**
 * Retrieves adapter-specific configuration from the main config object.
 * @param config - The main configuration object
 * @param adapterName - The name of the adapter configuration to retrieve
 * @returns The adapter-specific configuration, or undefined if not present
 */
export declare function getAdapterConfig<T extends keyof Config>(config: Config, adapterName: T): Config[T];
//# sourceMappingURL=index.d.ts.map