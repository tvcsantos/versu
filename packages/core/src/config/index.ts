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
const bumpTypeOrIgnoreSchema = z.union([bumpTypeSchema, z.literal("ignore")]);

/**
 * Zod schema for DependencyRules configuration.
 * Validates that dependency cascade rules use valid bump types.
 */
const dependencyRulesSchema = z.object({
  major: bumpTypeSchema,
  minor: bumpTypeSchema,
  patch: bumpTypeSchema,
});

/**
 * Zod schema for Changelog configuration.
 * Validates the structure of changelog options and context.
 */
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
      .loose()
      .optional(),
  })
  .optional();

/**
 * Zod schema for the main Config object.
 * This schema is used by ConfigurationValidator to ensure type-safe
 * configuration with detailed error messages for invalid configurations.
 */
export const configSchema = z.object({
  versionRules: z.object({
    defaultBump: bumpTypeSchema,
    commitTypeBumps: z.record(z.string(), bumpTypeOrIgnoreSchema),
    dependencyBumps: dependencyRulesSchema,
  }),
  plugins: z.array(z.string()).optional().default([]),
  changelog: z
    .object({
      root: changelogSchema,
      module: changelogSchema,
    })
    .optional(),
});

/**
 * Configuration for version bumping behavior.
 * Controls commit type handling, dependency cascade rules, and adapter-specific settings.
 */
export type Config = z.infer<typeof configSchema>;

/**
 * Rules for propagating version changes through dependency relationships.
 * Defines how a module should be bumped when its dependencies change.
 */
export type DependencyRules = z.infer<typeof dependencyRulesSchema>;

/**
 * Default configuration following Conventional Commits specification.
 * Maps common commit types to semantic version bumps and defines dependency cascade rules.
 */
export const DEFAULT_CONFIG: Config = {
  plugins: [],
  versionRules: {
    defaultBump: "patch",
    commitTypeBumps: {
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
    dependencyBumps: {
      major: "major",
      minor: "minor",
      patch: "patch",
    },
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

  const configuredBump = config.versionRules.commitTypeBumps[commitType];

  if (configuredBump === "ignore") {
    return "none";
  }

  return configuredBump || config.versionRules.defaultBump;
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
  const rules = config.versionRules.dependencyBumps;

  switch (dependencyBumpType) {
    case "major":
      return rules.major;
    case "minor":
      return rules.minor;
    case "patch":
      return rules.patch;
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
