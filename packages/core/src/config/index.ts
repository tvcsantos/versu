import { z } from "zod";
import { BumpType } from "../semver/index.js";
import { Commit } from "conventional-commits-parser";
import { isBreakingCommit } from "../git/index.js";
import { Context, Options } from "conventional-changelog-writer";

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

const commitNoteSchema = z.object({
  title: z.string(),
  text: z.string(),
});

const commitReferenceSchema = z.object({
  raw: z.string(),
  action: z.string().nullable(),
  owner: z.string().nullable(),
  repository: z.string().nullable(),
  issue: z.string(),
  prefix: z.string(),
});

const commitBaseSchema = z.object({
  merge: z.string().nullable(),
  revert: z.record(z.string(), z.string().nullable()).nullable(),
  header: z.string().nullable(),
  body: z.string().nullable(),
  footer: z.string().nullable(),
  notes: z.array(commitNoteSchema),
  mentions: z.array(z.string()),
  references: z.array(commitReferenceSchema),

  type: z.string().nullable().optional(),
  version: z.string().nullable().optional(),
  hash: z.string().nullable().optional(),
  committerDate: z.string().nullable().optional(),
});

const commitSchema = z.intersection(
  commitBaseSchema,
  z.record(z.string(), z.string().nullable()),
);

const commitGroupSchema = z.object({
  title: z.string(),
  commits: z.array(commitSchema),
});

const noteGroupSchema = z.object({
  title: z.string(),
  notes: z.array(commitNoteSchema),
});

const contextSchema = z.object({
  prependPlaceholder: z.string(),
  version: z.string().optional(),
  isPatch: z.boolean().optional(),
  title: z.string().optional(),
  date: z.string().optional(),
  linkReferences: z.boolean().optional(),
  commit: z.string().optional(),
  issue: z.string().optional(),
  repository: z.string().optional(),
  host: z.string().optional(),
  owner: z.string().optional(),
  repoUrl: z.string().optional(),
  commitGroups: z.array(commitGroupSchema).optional(),
  noteGroups: z.array(noteGroupSchema).optional(),
  linkCompare: z.boolean().optional(),
});

const optionsSchema = z.object({
  groupBy: z.string().optional(), // not accurate
  commitsSort: z.any().optional(),
  commitGroupsSort: z.any().optional(),
  notesSort: z.any().optional(),
  noteGroupsSort: z.any().optional(),
  ignoreReverted: z.boolean().optional(),
  reverse: z.boolean().optional(),
  doFlush: z.boolean().optional(),
  transform: z
    .function({ input: [z.any(), z.any(), z.any()], output: z.any() })
    .optional(),
  generateOn: z
    .union([
      z.function({
        input: [z.any(), z.any(), z.any(), z.any()],
        output: z.boolean(),
      }),
      z.string(),
    ])
    .nullable()
    .optional(),
  finalizeContext: z
    .function({
      input: [z.any(), z.any(), z.any(), z.any(), z.any()],
      output: z.any(),
    })
    .optional(),
  debug: z.function({ input: [z.string()], output: z.void() }).optional(),
  formatDate: z
    .function({ input: [z.union([z.string(), z.date()])], output: z.string() })
    .optional(),
  skip: z.function({ input: [z.any()], output: z.boolean() }).optional(),
  mainTemplate: z.string().optional(),
  headerPartial: z.string().optional(),
  commitPartial: z.string().optional(),
  footerPartial: z.string().optional(),
  partials: z.record(z.string(), z.string().nullable()).optional(),
});

/**
 * Zod schema for Changelog configuration.
 * Validates the structure of changelog options and context.
 */
export const changelogSchema = z.object({
  context: contextSchema.optional(),
  options: optionsSchema.optional(),
});

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
      root: changelogSchema.optional(),
      module: changelogSchema.optional(),
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

export type VersuConfig = {
  plugins?: string[];
  versionRules?: {
    defaultBump: BumpType;
    commitTypeBumps: Record<string, BumpType | "ignore">;
    dependencyBumps: {
      major: BumpType;
      minor: BumpType;
      patch: BumpType;
    };
  };
  changelog?: {
    root?: ModuleChangelogConfig;
    module?: ModuleChangelogConfig;
  };
};

export type ModuleChangelogConfig = {
  context?: Context<Commit> & { prependPlaceholder: string };
  options?: Options<Commit>;
};

export type ChangelogConfig = {
  root?: ModuleChangelogConfig;
  module?: ModuleChangelogConfig;
};

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
