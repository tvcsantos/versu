import { promises as fs } from 'fs';
import { join } from 'path';
import * as core from '@actions/core';
import { cosmiconfig } from 'cosmiconfig';
import deepmerge from 'deepmerge';
import { exists } from '../utils/file.js';
import { BumpType } from '../semver/index.js';

export type Config = {
  readonly defaultBump: BumpType;
  readonly commitTypes: Record<string, BumpType | 'ignore'>;
  readonly dependencyRules: DependencyRules;
  readonly nodejs?: NodeJSConfig;
};

export type DependencyRules = {
  readonly onMajorOfDependency: BumpType;
  readonly onMinorOfDependency: BumpType;
  readonly onPatchOfDependency: BumpType;
};

export type NodeJSConfig = {
  readonly versionSource: ('package.json')[];
  readonly updatePackageLock: boolean;
};

const DEFAULT_CONFIG: Config = {
  defaultBump: 'patch',
  commitTypes: {
    feat: 'minor',
    fix: 'patch',
    perf: 'patch',
    refactor: 'patch',
    docs: 'ignore',
    test: 'ignore',
    chore: 'ignore',
    style: 'ignore',
    ci: 'ignore',
    build: 'ignore',
  },
  dependencyRules: {
    onMajorOfDependency: 'major',
    onMinorOfDependency: 'minor',
    onPatchOfDependency: 'patch',
  }
};

/**
 * Load configuration from file or return default
 */
export async function loadConfig(configPath?: string, repoRoot?: string): Promise<Config> {
  const explorer = cosmiconfig('verse');

  try {
    let result;
    
    if (configPath && repoRoot) {
      // If specific config path provided, try to load it
      const fullPath = join(repoRoot, configPath);
      if (await exists(fullPath)) {
        result = await explorer.load(fullPath);
      } else {
        core.info(`Specified config file not found at ${configPath}, searching for config files...`);
        result = await explorer.search(repoRoot);
      }
    } else {
      // Search for config in standard locations
      const searchStart = repoRoot || process.cwd();
      result = await explorer.search(searchStart);
    }
    
    if (result?.config) {
      const configSource = result.filepath ? `from ${result.filepath}` : 'from package.json';
      core.info(`📋 Configuration loaded ${configSource}`);
      
      const userConfig = result.config;
      const validatedConfig = mergeConfig(DEFAULT_CONFIG, userConfig);
      validateConfig(validatedConfig);
      
      return validatedConfig;
    } else {
      core.info(`No configuration found, using defaults`);
      return DEFAULT_CONFIG;
    }
  } catch (error) {
    throw new Error(`Failed to load configuration: ${error}`);
  }
}

/**
 * Merge user config with default config using deepmerge
 */
function mergeConfig(defaultConfig: Config, userConfig: Partial<Config>): Config {
  return deepmerge(defaultConfig, userConfig, {
    // Custom merge for arrays - replace instead of concatenating
    arrayMerge: (target, source) => source,
  }) as Config;
}

/**
 * Get bump type for a commit based on configuration
 */
export function getBumpTypeForCommit(
  commitType: string,
  isBreaking: boolean,
  config: Config
): BumpType {
  if (isBreaking) {
    return 'major';
  }
  
  const configuredBump = config.commitTypes[commitType];
  
  if (configuredBump === 'ignore') {
    return 'none';
  }
  
  return configuredBump || config.defaultBump;
}

/**
 * Get bump type for a module when one of its dependencies changes
 */
export function getDependencyBumpType(
  dependencyBumpType: BumpType,
  config: Config
): BumpType {
  const rules = config.dependencyRules;
  
  switch (dependencyBumpType) {
    case 'major':
      return rules.onMajorOfDependency;
    case 'minor':
      return rules.onMinorOfDependency;
    case 'patch':
      return rules.onPatchOfDependency;
    default:
      return 'none';
  }
}

/**
 * Validate configuration object
 */
export function validateConfig(config: Config): void {
  const validBumpTypes: (BumpType | 'ignore')[] = ['major', 'minor', 'patch', 'none', 'ignore'];
  
  if (!validBumpTypes.includes(config.defaultBump)) {
    throw new Error(`Invalid defaultBump: ${config.defaultBump}`);
  }
  
  for (const [commitType, bumpType] of Object.entries(config.commitTypes)) {
    if (!validBumpTypes.includes(bumpType)) {
      throw new Error(`Invalid bump type for commit type '${commitType}': ${bumpType}`);
    }
  }
  
  const depRules = config.dependencyRules;
  const validDepBumpTypes: BumpType[] = ['major', 'minor', 'patch', 'none'];
  
  if (!validDepBumpTypes.includes(depRules.onMajorOfDependency)) {
    throw new Error(`Invalid onMajorOfDependency: ${depRules.onMajorOfDependency}`);
  }
  
  if (!validDepBumpTypes.includes(depRules.onMinorOfDependency)) {
    throw new Error(`Invalid onMinorOfDependency: ${depRules.onMinorOfDependency}`);
  }
  
  if (!validDepBumpTypes.includes(depRules.onPatchOfDependency)) {
    throw new Error(`Invalid onPatchOfDependency: ${depRules.onPatchOfDependency}`);
  }
}

/**
 * Create a default config file
 */
export async function createDefaultConfig(configPath: string, repoRoot: string): Promise<void> {
  const fullPath = join(repoRoot, configPath);
  
  const configContent = JSON.stringify(DEFAULT_CONFIG, null, 2);
  
  try {
    await fs.writeFile(fullPath, configContent, 'utf8');
    core.info(`Created default config file at ${configPath}`);
  } catch (error) {
    throw new Error(`Failed to create config file at ${configPath}: ${error}`);
  }
}

/**
 * Get adapter-specific configuration
 */
export function getAdapterConfig<T extends keyof Config>(
  config: Config,
  adapterName: T
): Config[T] {
  return config[adapterName];
}
