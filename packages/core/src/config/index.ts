import { z } from "zod";
import { BumpType } from "../semver/index.js";
import { Commit } from "conventional-commits-parser";
import { isBreakingCommit } from "../git/index.js";

/**
 * Zod schema for BumpType values.
 * Used for validation in configuration files.
 */
const bumpTypeSchema = z.enum(["major", "minor", "patch", "none"]);

/**
 * Zod schema for BumpType or 'ignore' values.
 * Used for commit type mappings where 'ignore' is allowed.
 */
const bumpTypeOrIgnoreSchema = z.enum([
  "major",
  "minor",
  "patch",
  "none",
  "ignore",
]);

/**
 * Zod schema for DependencyRules configuration.
 * Validates that dependency cascade rules use valid bump types.
 */
const dependencyRulesSchema = z.object({
  onMajorOfDependency: bumpTypeSchema,
  onMinorOfDependency: bumpTypeSchema,
  onPatchOfDependency: bumpTypeSchema,
});

/**
 * Zod schema for NodeJSConfig configuration.
 * Validates Node.js-specific settings.
 */
const nodeJSConfigSchema = z.object({
  versionSource: z.array(z.literal("package.json")),
  updatePackageLock: z.boolean(),
});

export const changelogSchema = z
  .object({
    context: z
      .object({
        prependPlaceholder: z.string(),
      })
      .loose(),
    options: z
      .object({
        groupBy: z.string().optional(),
        commitsGroupsSort: z.function().optional(),
        transform: z.function().optional(),
        mainTemplate: z.string().optional(),
        commitPartial: z.string().optional(),
        headerPartial: z.string().optional(),
        footerPartial: z.string().optional(),
      })
      .optional(),
  })
  .optional();

/**
 * Zod schema for the main Config object.
 * This schema is used by ConfigurationValidator to ensure type-safe
 * configuration with detailed error messages for invalid configurations.
 */
export const configSchema = z.object({
  defaultBump: bumpTypeSchema,
  commitTypes: z.record(z.string(), bumpTypeOrIgnoreSchema),
  dependencyRules: dependencyRulesSchema,
  nodejs: nodeJSConfigSchema.optional(),
  plugins: z.array(z.string()).optional().default([]),
  changelog: z
    .object({
      root: changelogSchema,
      module: changelogSchema,
    })
    .optional(),
});

/**
 * Configuration for VERSU version bumping behavior.
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
 * Default VERSU configuration following Conventional Commits specification.
 * Maps common commit types to semantic version bumps and defines dependency cascade rules.
 */
export const DEFAULT_CONFIG: Config = {
  defaultBump: "patch",
  commitTypes: {
    feat: "minor",
    fix: "patch",
    perf: "patch",
    refactor: "patch",
    docs: "ignore",
    test: "ignore",
    chore: "ignore",
    style: "ignore",
    ci: "ignore",
    build: "ignore",
  },
  plugins: [],
  dependencyRules: {
    onMajorOfDependency: "major",
    onMinorOfDependency: "minor",
    onPatchOfDependency: "patch",
  },
};

/**
 * Determines the bump type for a commit based on its type and breaking change flag.
 * @param commit - The commit to evaluate
 * @param config - Configuration containing commit type mappings
 * @returns The bump type to apply ('major', 'minor', 'patch', or 'none')
 */
export function getBumpTypeForCommit(commit: Commit, config: Config): BumpType {
  const isBreaking = isBreakingCommit(commit);
  if (isBreaking) {
    return "major";
  }

  const commitType = commit.type || "unknown";

  const configuredBump = config.commitTypes[commitType];

  if (configuredBump === "ignore") {
    return "none";
  }

  return configuredBump || config.defaultBump;
}

/**
 * Determines how a module should be bumped when one of its dependencies changes.
 * Uses dependency cascade rules from configuration to propagate version changes.
 * @param dependencyBumpType - The bump type applied to the dependency
 * @param config - Configuration containing dependency cascade rules
 * @returns The bump type to apply to the dependent module
 */
export function getDependencyBumpType(
  dependencyBumpType: BumpType,
  config: Config,
): BumpType {
  const rules = config.dependencyRules;

  switch (dependencyBumpType) {
    case "major":
      return rules.onMajorOfDependency;
    case "minor":
      return rules.onMinorOfDependency;
    case "patch":
      return rules.onPatchOfDependency;
    default:
      return "none";
  }
}

/**
 * Retrieves adapter-specific configuration from the main config object.
 * @param config - The main configuration object
 * @param adapterName - The name of the adapter configuration to retrieve
 * @returns The adapter-specific configuration, or undefined if not present
 */
export function getAdapterConfig<T extends keyof Config>(
  config: Config,
  adapterName: T,
): Config[T] {
  return config[adapterName];
}
