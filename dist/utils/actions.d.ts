/**
 * Constructs an absolute path to a file within the GitHub Action directory.
 *
 * @param relativePath - Path relative to the action's root directory
 *   (e.g., `'dist/index.js'`, `'scripts/init.sh'`, `'config/settings.json'`)
 *
 * @returns Absolute path to the file on the GitHub Actions runner
 *
 * @remarks
 * This function constructs the full file system path to resources within the
 * executing GitHub Action. It combines the action's base path with a relative
 * path to locate specific files.
 *
 * **Path Construction:**
 * ```
 * /home/runner/_work/_actions/{owner}/{repo}/{ref}/{relativePath}
 * ```
 *
 * **Use Cases:**
 * - Locate action scripts for execution
 * - Find configuration files within the action
 * - Access embedded resources or templates
 * - Reference static files needed by the action
 *
 * **Platform Independence:**
 * While the base path uses POSIX format (GitHub-hosted runners use Linux),
 * the `path.join()` function ensures proper path construction on any platform.
 *
 * **When to Use:**
 * Use this function when the action needs to reference its own files during
 * execution. This is common for:
 * - Multi-file actions with separate script files
 * - Actions that use configuration files or templates
 * - Actions that execute helper scripts
 *
 * **Alternative for User Files:**
 * For accessing files in the user's repository (not the action's files),
 * use `process.env.GITHUB_WORKSPACE` instead.
 *
 * @example
 * ```typescript
 * // Get path to action's initialization script
 * const initScript = getGitHubActionPath('scripts/init.sh');
 * // Result: /home/runner/_work/_actions/tvcsantos/verse/main/scripts/init.sh
 *
 * // Execute the script
 * await exec('bash', [initScript]);
 * ```
 *
 * @example
 * ```typescript
 * // Get path to action's configuration file
 * const configPath = getGitHubActionPath('config/defaults.json');
 * // Result: /home/runner/_work/_actions/tvcsantos/verse/v1.0.0/config/defaults.json
 *
 * // Read configuration
 * const config = JSON.parse(await fs.readFile(configPath, 'utf-8'));
 * ```
 *
 * @example
 * ```typescript
 * // Get path to embedded Gradle init script
 * const gradleInitScript = getGitHubActionPath('dist/init-project-information.gradle.kts');
 *
 * // Use in Gradle command
 * await exec('gradle', [
 *   '--init-script', gradleInitScript,
 *   'printProjectInformation'
 * ]);
 * ```
 *
 * @example
 * ```typescript
 * // Multiple files within action
 * const paths = {
 *   script: getGitHubActionPath('scripts/process.sh'),
 *   template: getGitHubActionPath('templates/output.md'),
 *   schema: getGitHubActionPath('schemas/config.json')
 * };
 * ```
 */
export declare function getGitHubActionPath(relativePath: string): string;
/**
 * Parses a string input as a boolean value for GitHub Actions inputs.
 *
 * @param input - String value to parse (typically from GitHub Actions input)
 *
 * @returns `true` if input is `"true"` (case-insensitive), `false` otherwise
 *
 * @remarks
 * This utility function converts GitHub Actions string inputs to boolean values.
 * GitHub Actions inputs are always provided as strings, even for boolean values,
 * so this function performs the necessary conversion.
 *
 * **Parsing Logic:**
 * - Case-insensitive comparison against `"true"`
 * - Returns `true` only if input equals `"true"` (any case)
 * - Returns `false` for all other values (including `"false"`, `"0"`, empty string, etc.)
 *
 * **GitHub Actions Context:**
 * In action.yml, boolean inputs are defined as:
 * ```yaml
 * inputs:
 *   enable-feature:
 *     description: 'Enable feature'
 *     required: false
 *     default: 'false'
 * ```
 *
 * But retrieved as strings via `@actions/core`:
 * ```typescript
 * const input = core.getInput('enable-feature'); // Returns string "true" or "false"
 * const enabled = parseBooleanInput(input);      // Converts to boolean
 * ```
 *
 * **Accepted True Values:**
 * - `"true"` → `true`
 * - `"True"` → `true`
 * - `"TRUE"` → `true`
 * - `"TrUe"` → `true` (any case combination)
 *
 * **False for Everything Else:**
 * - `"false"` → `false`
 * - `"0"` → `false`
 * - `"no"` → `false`
 * - `""` (empty) → `false`
 * - `"anything"` → `false`
 *
 * **Why Only "true":**
 * This function follows GitHub Actions' convention where only the string `"true"`
 * represents a true boolean value. This provides:
 * - Clear, unambiguous boolean semantics
 * - Consistency with GitHub Actions' own boolean handling
 * - Safe defaults (anything unexpected is false)
 *
 * **Alternative Approaches:**
 * For more flexible boolean parsing, consider using libraries like:
 * - `js-yaml` for YAML-style boolean parsing (`yes`, `no`, `on`, `off`)
 * - Custom parsing for project-specific conventions
 *
 * However, for GitHub Actions, this simple approach is recommended.
 *
 * @example
 * ```typescript
 * // Standard GitHub Actions usage
 * import * as core from '@actions/core';
 *
 * const enableFeature = parseBooleanInput(core.getInput('enable-feature'));
 *
 * if (enableFeature) {
 *   console.log('Feature enabled');
 * } else {
 *   console.log('Feature disabled');
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Various input values
 * parseBooleanInput('true')   // true
 * parseBooleanInput('True')   // true
 * parseBooleanInput('TRUE')   // true
 * parseBooleanInput('false')  // false
 * parseBooleanInput('FALSE')  // false
 * parseBooleanInput('0')      // false
 * parseBooleanInput('1')      // false (only "true" returns true)
 * parseBooleanInput('yes')    // false
 * parseBooleanInput('')       // false
 * ```
 *
 * @example
 * ```typescript
 * // Multiple boolean inputs
 * import * as core from '@actions/core';
 *
 * const options = {
 *   dryRun: parseBooleanInput(core.getInput('dry-run')),
 *   verbose: parseBooleanInput(core.getInput('verbose')),
 *   force: parseBooleanInput(core.getInput('force')),
 *   skipTests: parseBooleanInput(core.getInput('skip-tests'))
 * };
 *
 * console.log('Options:', options);
 * ```
 *
 * @example
 * ```typescript
 * // With default values
 * import * as core from '@actions/core';
 *
 * // If input is not provided, getInput returns empty string
 * const enableCache = parseBooleanInput(
 *   core.getInput('enable-cache') || 'true' // Default to 'true' if not set
 * );
 * ```
 */
export declare function parseBooleanInput(input: string): boolean;
//# sourceMappingURL=actions.d.ts.map