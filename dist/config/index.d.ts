import { z } from 'zod';
import { BumpType } from '../semver/index.js';
/**
 * Zod schema for DependencyRules configuration.
 * Validates that dependency cascade rules use valid bump types.
 */
declare const dependencyRulesSchema: z.ZodObject<{
    onMajorOfDependency: z.ZodEnum<{
        major: "major";
        minor: "minor";
        patch: "patch";
        none: "none";
    }>;
    onMinorOfDependency: z.ZodEnum<{
        major: "major";
        minor: "minor";
        patch: "patch";
        none: "none";
    }>;
    onPatchOfDependency: z.ZodEnum<{
        major: "major";
        minor: "minor";
        patch: "patch";
        none: "none";
    }>;
}, z.core.$strip>;
/**
 * Zod schema for NodeJSConfig configuration.
 * Validates Node.js-specific settings.
 */
declare const nodeJSConfigSchema: z.ZodObject<{
    versionSource: z.ZodArray<z.ZodLiteral<"package.json">>;
    updatePackageLock: z.ZodBoolean;
}, z.core.$strip>;
/**
 * Zod schema for the main Config object.
 * This schema is used by ConfigurationValidator to ensure type-safe
 * configuration with detailed error messages for invalid configurations.
 */
export declare const configSchema: z.ZodObject<{
    defaultBump: z.ZodEnum<{
        major: "major";
        minor: "minor";
        patch: "patch";
        none: "none";
    }>;
    commitTypes: z.ZodRecord<z.ZodString, z.ZodEnum<{
        major: "major";
        minor: "minor";
        patch: "patch";
        none: "none";
        ignore: "ignore";
    }>>;
    dependencyRules: z.ZodObject<{
        onMajorOfDependency: z.ZodEnum<{
            major: "major";
            minor: "minor";
            patch: "patch";
            none: "none";
        }>;
        onMinorOfDependency: z.ZodEnum<{
            major: "major";
            minor: "minor";
            patch: "patch";
            none: "none";
        }>;
        onPatchOfDependency: z.ZodEnum<{
            major: "major";
            minor: "minor";
            patch: "patch";
            none: "none";
        }>;
    }, z.core.$strip>;
    nodejs: z.ZodOptional<z.ZodObject<{
        versionSource: z.ZodArray<z.ZodLiteral<"package.json">>;
        updatePackageLock: z.ZodBoolean;
    }, z.core.$strip>>;
}, z.core.$strip>;
/**
 * Configuration for VERSE version bumping behavior.
 * Controls commit type handling, dependency cascade rules, and adapter-specific settings.
 */
export type Config = z.infer<typeof configSchema>;
/**
 * Rules for propagating version changes through dependency relationships.
 * Defines how a module should be bumped when its dependencies change.
 */
export type DependencyRules = z.infer<typeof dependencyRulesSchema>;
/**
 * Configuration for Node.js/npm projects.
 */
export type NodeJSConfig = z.infer<typeof nodeJSConfigSchema>;
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
export {};
//# sourceMappingURL=index.d.ts.map