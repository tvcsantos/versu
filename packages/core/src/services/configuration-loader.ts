import { logger } from "../utils/logger.js";
import { Config, DEFAULT_CONFIG } from "../config/index.js";
import { cosmiconfig, type PublicExplorer } from "cosmiconfig";
import deepmerge from "deepmerge";
import { ConfigurationValidator } from "./configuration-validator.js";

/**
 * Loads and merges VERSU configuration from various sources (.versu, versu.config.js, package.json).
 * Uses cosmiconfig for auto-discovery and merges user config with defaults.
 */
export class ConfigurationLoader {
  private readonly explorer: PublicExplorer;

  /**
   * Creates a new configuration loader.
   * @param configurationValidator - Validator to ensure configuration integrity
   */
  constructor(
    private readonly configurationValidator: ConfigurationValidator<Config>,
  ) {
    // Initialize cosmiconfig explorer once for reuse across multiple loads
    this.explorer = cosmiconfig("versu", { searchStrategy: "global" });
  }

  /**
   * Loads and validates the VERSU configuration.
   * @param repoRoot - Absolute path to the repository root directory
   * @returns A promise that resolves to the fully merged and validated configuration
   * @throws {Error} If configuration loading or validation fails
   */
  async load(repoRoot: string): Promise<Config> {
    try {
      logger.info("Searching configuration file", { repoRoot });

      // Search for config in standard locations
      const result = await this.explorer.search(repoRoot);

      let config: Config;

      if (result?.config) {
        // Configuration found - merge, validate, and use it
        const configSource = result.filepath
          ? `from ${result.filepath}`
          : "from package.json";
        logger.info("Configuration loaded", { source: configSource });

        const userConfig = result.config;
        const validatedConfig = mergeWithDefaults(userConfig);
        config = this.configurationValidator.validate(validatedConfig);
      } else {
        // No configuration found - use defaults
        logger.info("No configuration found, using defaults");
        config = DEFAULT_CONFIG;
      }

      return config;
    } catch (error) {
      // Wrap any errors with context for better debugging
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }
}

/**
 * Custom array merge strategy for deepmerge.
 * Replaces target array with source array instead of concatenating.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const replaceArrayMerge = (_target: any[], source: any[]) => source;

/**
 * Deepmerge options for merging user configuration with defaults.
 * Configures array replacement instead of concatenation.
 */
const defaultMergeOptions = {
  arrayMerge: replaceArrayMerge,
};

/**
 * Merges user configuration with default configuration.
 * User values take precedence over defaults. Arrays are replaced entirely rather than concatenated.
 * @param userConfig - User-provided configuration to merge with defaults
 * @returns Merged configuration with user values overriding defaults
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeWithDefaults(userConfig: any): any {
  return deepmerge(DEFAULT_CONFIG, userConfig, defaultMergeOptions);
}
