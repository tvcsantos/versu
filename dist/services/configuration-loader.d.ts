import { Config } from '../config/index.js';
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
export declare class ConfigurationLoader {
    private readonly configurationValidator;
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
    constructor(configurationValidator: ConfigurationValidator);
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
    load(configPath?: string, repoRoot?: string): Promise<Config>;
}
//# sourceMappingURL=configuration-loader.d.ts.map