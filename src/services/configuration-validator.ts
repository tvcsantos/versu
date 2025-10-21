import { Config } from "../config/index.js";
import { BumpType } from "../semver/index.js";

/**
 * Valid bump type values for general configuration options.
 * 
 * @remarks
 * This set includes all standard semantic version bump types plus special values:
 * - `major`: Increment major version (breaking changes)
 * - `minor`: Increment minor version (new features)
 * - `patch`: Increment patch version (bug fixes)
 * - `none`: No version bump
 * - `ignore`: Ignore the commit/change entirely
 * 
 * Used for validating `defaultBump` and `commitTypes` configuration.
 */
const validBumpTypes: (BumpType | 'ignore')[] = ['major', 'minor', 'patch', 'none', 'ignore'];

/**
 * Valid bump type values for dependency-related rules.
 * 
 * @remarks
 * This set excludes `ignore` since dependency updates should always be considered,
 * not ignored. Dependency rules determine how version bumps in dependencies
 * propagate to the dependent module.
 * 
 * Used for validating `dependencyRules` configuration options.
 */
const validDepBumpTypes: BumpType[] = ['major', 'minor', 'patch', 'none'];

/**
 * Validates VERSE configuration for correctness and consistency.
 * 
 * @remarks
 * This validator ensures that all configuration values are valid and within
 * acceptable ranges. It performs schema validation to catch configuration
 * errors early, before they cause runtime issues.
 * 
 * **Validation Scope:**
 * - Default bump type configuration
 * - Commit type to bump type mappings
 * - Dependency version propagation rules
 * 
 * The validator throws descriptive errors that help users identify and fix
 * configuration problems quickly.
 * 
 * @example
 * ```typescript
 * const validator = new ConfigurationValidator();
 * 
 * try {
 *   validator.validate(config);
 *   console.log('Configuration is valid');
 * } catch (error) {
 *   console.error('Invalid configuration:', error.message);
 * }
 * ```
 */
export class ConfigurationValidator {

    /**
     * Validates the provided configuration.
     * 
     * @param config - The configuration object to validate
     * 
     * @throws {Error} If `defaultBump` contains an invalid bump type
     * @throws {Error} If any commit type mapping contains an invalid bump type
     * @throws {Error} If any dependency rule contains an invalid bump type
     * 
     * @remarks
     * This method performs comprehensive validation of the configuration structure.
     * It checks multiple aspects to ensure semantic correctness:
     * 
     * **Validation Steps:**
     * 
     * 1. **Default Bump Validation:**
     *    - Ensures `defaultBump` is one of: 'major', 'minor', 'patch', 'none', 'ignore'
     *    - This value is used when no commit type mapping matches
     * 
     * 2. **Commit Type Mappings Validation:**
     *    - Iterates through all commit type to bump type mappings
     *    - Ensures each bump type value is valid
     *    - Helps catch typos in commit type configurations (e.g., 'feat', 'fix', 'chore')
     * 
     * 3. **Dependency Rules Validation:**
     *    - Validates `onMajorOfDependency` - what to do when a dependency has a major bump
     *    - Validates `onMinorOfDependency` - what to do when a dependency has a minor bump
     *    - Validates `onPatchOfDependency` - what to do when a dependency has a patch bump
     *    - Note: Dependency rules don't allow 'ignore', only version bump types
     * 
     * **Error Messages:**
     * All errors include the invalid value and context to help users quickly
     * identify and fix the problem in their configuration files.
     * 
     * The validation is fail-fast: it throws on the first error encountered,
     * which is appropriate since configuration must be entirely valid before use.
     * 
     * @example
     * ```typescript
     * // Valid configuration
     * validator.validate({
     *   defaultBump: 'patch',
     *   commitTypes: {
     *     feat: 'minor',
     *     fix: 'patch'
     *   },
     *   dependencyRules: {
     *     onMajorOfDependency: 'major',
     *     onMinorOfDependency: 'minor',
     *     onPatchOfDependency: 'patch'
     *   }
     * });
     * 
     * // Invalid configuration - throws error
     * validator.validate({
     *   defaultBump: 'invalid',  // Error: Invalid defaultBump: invalid
     *   // ...
     * });
     * ```
     */
    validate(config: Config): void {
      // Validate default bump type
      if (!validBumpTypes.includes(config.defaultBump)) {
        throw new Error(`Invalid defaultBump: ${config.defaultBump}`);
      }
      
      // Validate all commit type mappings
      for (const [commitType, bumpType] of Object.entries(config.commitTypes)) {
        if (!validBumpTypes.includes(bumpType)) {
          throw new Error(`Invalid bump type for commit type '${commitType}': ${bumpType}`);
        }
      }
      
      const depRules = config.dependencyRules;
      
      // Validate dependency rule for major version bumps
      if (!validDepBumpTypes.includes(depRules.onMajorOfDependency)) {
        throw new Error(`Invalid onMajorOfDependency: ${depRules.onMajorOfDependency}`);
      }
      
      // Validate dependency rule for minor version bumps
      if (!validDepBumpTypes.includes(depRules.onMinorOfDependency)) {
        throw new Error(`Invalid onMinorOfDependency: ${depRules.onMinorOfDependency}`);
      }
      
      // Validate dependency rule for patch version bumps
      if (!validDepBumpTypes.includes(depRules.onPatchOfDependency)) {
        throw new Error(`Invalid onPatchOfDependency: ${depRules.onPatchOfDependency}`);
      }
    }
}