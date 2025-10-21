import * as core from '@actions/core';
import { Config, DEFAULT_CONFIG } from '../config/index.js';
import { cosmiconfig } from 'cosmiconfig';
import deepmerge from 'deepmerge';
import { exists } from '../utils/file.js';
import { join } from 'path';
import { ConfigurationValidator } from './configuration-validator.js';

/**
 * Loads and merges VERSE configuration from various sources.
 * 
 * @remarks
 * This service handles configuration discovery, loading, merging, and validation.
 * It supports multiple configuration sources and locations using the cosmiconfig
 * library, which searches for configuration in standard locations:
 * 
 * **Supported Configuration Files:**
 * - `.verserc` (JSON or YAML)
 * - `.verserc.json`
 * - `.verserc.yaml` / `.verserc.yml`
 * - `verse.config.js` / `verse.config.cjs` / `verse.config.mjs`
 * - `verse` field in `package.json`
 * 
 * **Configuration Resolution:**
 * 1. If a specific config path is provided, try to load it
 * 2. If not found or not provided, search standard locations
 * 3. Merge user config with defaults
 * 4. Validate the merged configuration
 * 5. Return the final configuration or defaults if none found
 * 
 * @example
 * ```typescript
 * const loader = new ConfigurationLoader(validator);
 * 
 * // Auto-discover configuration
 * const config = await loader.load();
 * 
 * // Load specific config file
 * const config = await loader.load('.verse/config.json', '/path/to/repo');
 * ```
 */
export class ConfigurationLoader {

  /**
   * Creates a new configuration loader.
   * 
   * @param configurationValidator - Validator to ensure configuration integrity
   * 
   * @remarks
   * The validator is injected as a dependency to maintain separation of concerns
   * and enable easier testing. It's used to validate the merged configuration
   * before returning it to the caller.
   */
  constructor(private readonly configurationValidator: ConfigurationValidator) {}

  /**
   * Loads and validates the VERSE configuration.
   * 
   * @param configPath - Optional relative path to a specific configuration file
   * @param repoRoot - Optional absolute path to the repository root directory
   * 
   * @returns A promise that resolves to the fully merged and validated configuration
   * 
   * @throws {Error} If configuration loading fails (file read errors, parse errors, etc.)
   * @throws {Error} If configuration validation fails (delegated to validator)
   * 
   * @remarks
   * This method implements a flexible configuration loading strategy with fallbacks:
   * 
   * **Loading Strategy:**
   * 
   * 1. **Explicit Path Provided:**
   *    - Construct full path from `repoRoot` and `configPath`
   *    - If file exists, load it directly
   *    - If file doesn't exist, fall back to auto-discovery
   * 
   * 2. **Auto-Discovery:**
   *    - Start search from `repoRoot` if provided, otherwise use current working directory
   *    - Search standard locations using cosmiconfig
   *    - Support multiple file formats (JSON, YAML, JS)
   * 
   * 3. **Configuration Processing:**
   *    - If config found: merge with defaults, validate, and return
   *    - If no config found: return defaults
   * 
   * **Merge Behavior:**
   * User configuration is deep-merged with defaults, where:
   * - User values override default values
   * - Arrays are replaced (not concatenated)
   * - Objects are merged recursively
   * 
   * **Logging:**
   * The method logs informational messages throughout the process to help users
   * understand which configuration is being used and where it was found.
   * 
   * @example
   * ```typescript
   * // Auto-discover configuration from current directory
   * const config = await loader.load();
   * 
   * // Load from specific path
   * const config = await loader.load(
   *   'config/verse.config.js',
   *   '/path/to/repository'
   * );
   * 
   * // Load with only repo root (searches standard locations)
   * const config = await loader.load(undefined, '/path/to/repository');
   * ```
   */
  async load(configPath?: string, repoRoot?: string): Promise<Config> {    
    try {
      core.info(`🔍 Searching for VERSE configuration...`);
      
      // Initialize cosmiconfig explorer for 'verse' module
      const explorer = cosmiconfig('verse');

      let result;
      
      if (configPath && repoRoot) {
        // If specific config path provided, try to load it
        const fullPath = join(repoRoot, configPath);
        if (await exists(fullPath)) {
          result = await explorer.load(fullPath);
        } else {
          // Fallback to auto-discovery if specified file doesn't exist
          core.info(`Specified config file not found at ${configPath}, searching for config files...`);
          result = await explorer.search(repoRoot);
        }
      } else {
        // Search for config in standard locations
        const searchStart = repoRoot || process.cwd();
        result = await explorer.search(searchStart);
      }

      let config: Config;
      
      if (result?.config) {
        // Configuration found - merge, validate, and use it
        const configSource = result.filepath ? `from ${result.filepath}` : 'from package.json';
        core.info(`📋 Configuration loaded ${configSource}`);
        
        const userConfig = result.config;
        const validatedConfig = mergeConfig(DEFAULT_CONFIG, userConfig);
        this.configurationValidator.validate(validatedConfig);

        config = validatedConfig;
      } else {
        // No configuration found - use defaults
        core.info(`No configuration found, using defaults`);
        config = DEFAULT_CONFIG;
      }

      core.info(`✅ Configuration loaded successfully`);

      return config;

    } catch (error) {
      // Wrap any errors with context for better debugging
      throw new Error(`Failed to load configuration: ${error}`);
    }
  }
}

/**
 * Merges user configuration with default configuration.
 * 
 * @param defaultConfig - The default configuration to use as a base
 * @param userConfig - The user-provided configuration to merge
 * 
 * @returns The merged configuration
 * 
 * @remarks
 * This function uses deep merge to combine configurations, with special handling
 * for arrays. The merge strategy is:
 * 
 * **Merge Rules:**
 * - **Primitives**: User values replace default values
 * - **Objects**: Deep merge - nested properties are merged recursively
 * - **Arrays**: User arrays replace default arrays entirely (no concatenation)
 * 
 * The array replacement behavior is intentional to avoid unexpected array growth
 * when users want to override default arrays completely.
 * 
 * @example
 * ```typescript
 * const defaults = {
 *   adapters: ['gradle'],
 *   options: { debug: false, verbose: true }
 * };
 * 
 * const userConfig = {
 *   adapters: ['maven'],
 *   options: { debug: true }
 * };
 * 
 * const result = mergeConfig(defaults, userConfig);
 * // Result: {
 * //   adapters: ['maven'],           // Replaced, not concatenated
 * //   options: { debug: true, verbose: true }  // Merged
 * // }
 * ```
 */
function mergeConfig(defaultConfig: Config, userConfig: Partial<Config>): Config {
  return deepmerge(defaultConfig, userConfig, {
    // Custom merge for arrays - replace instead of concatenating
    // This ensures user arrays override defaults completely
    arrayMerge: (target, source) => source,
  }) as Config;
}
