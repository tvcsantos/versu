import { join } from "path";

/**
 * Base path where GitHub Actions are stored on the runner.
 * 
 * @remarks
 * This constant represents the standard location where GitHub Actions runners
 * store checked-out action repositories during workflow execution.
 * 
 * **Path Structure:**
 * - Fixed location: `/home/runner/_work/_actions`
 * - Used by GitHub-hosted runners (Ubuntu, macOS, Windows)
 * - May differ on self-hosted runners with custom configurations
 * 
 * **Usage:**
 * Combined with action repository and ref to construct full action paths:
 * ```
 * /home/runner/_work/_actions/{owner}/{repo}/{ref}
 * ```
 * 
 * @private
 */
const RUNNER_ACTIONS_PATH = '/home/runner/_work/_actions'

/**
 * Retrieves the GitHub Action repository identifier from environment variables.
 * 
 * @returns The action repository in `owner/repo` format (e.g., `'tvcsantos/verse'`)
 * 
 * @throws {Error} If `GITHUB_ACTION_REPOSITORY` environment variable is not set.
 *   Error message: `"GITHUB_ACTION_REPOSITORY environment variable is not set"`
 * 
 * @remarks
 * This function reads the `GITHUB_ACTION_REPOSITORY` environment variable, which is
 * automatically set by GitHub Actions when running within a workflow context.
 * 
 * **Environment Variable:**
 * - Name: `GITHUB_ACTION_REPOSITORY`
 * - Format: `owner/repo` (e.g., `'tvcsantos/verse'`, `'actions/checkout'`)
 * - Set by: GitHub Actions runtime automatically
 * - Availability: Only when running as a GitHub Action
 * 
 * **When Available:**
 * - During GitHub Actions workflow execution
 * - When this code is running as a GitHub Action step
 * - Not available in local development or non-GitHub CI environments
 * 
 * **Error Handling:**
 * The function throws an error if the environment variable is missing, which typically
 * indicates:
 * - Code is not running in a GitHub Actions environment
 * - GitHub Actions runtime has an unexpected configuration issue
 * - Environment has been modified or cleared
 * 
 * @example
 * ```typescript
 * // In a GitHub Actions workflow context
 * const repo = getGitHubActionRepository();
 * console.log(repo); // "tvcsantos/verse"
 * ```
 * 
 * @private
 */
function getGitHubActionRepository(): string {
  const repo = process.env.GITHUB_ACTION_REPOSITORY
  if (!repo) throw new Error("GITHUB_ACTION_REPOSITORY environment variable is not set");
  return repo;
}

/**
 * Retrieves the GitHub Action ref (branch, tag, or commit SHA) from environment variables.
 * 
 * @returns The action ref string (e.g., `'main'`, `'v1.0.0'`, `'abc123...'`), 
 *   defaults to `'main'` if not set
 * 
 * @remarks
 * This function reads the `GITHUB_ACTION_REF` environment variable, which specifies
 * the git ref (branch, tag, or commit) of the action being executed.
 * 
 * **Environment Variable:**
 * - Name: `GITHUB_ACTION_REF`
 * - Format: Git ref string (branch name, tag, or SHA)
 * - Set by: GitHub Actions runtime automatically
 * - Default: `'main'` if not set
 * 
 * **Common Values:**
 * - `'main'`: Action checked out from main branch
 * - `'v1'`, `'v1.0.0'`: Action checked out from a version tag
 * - `'abc123...'`: Action checked out from specific commit SHA
 * - `'feature-branch'`: Action checked out from a feature branch
 * 
 * **Default Behavior:**
 * If the environment variable is not set, the function returns `'main'` as a
 * sensible default, assuming the action is running from the main branch.
 * 
 * **Why Default:**
 * The default prevents errors in edge cases where the ref is not set, allowing
 * graceful degradation rather than throwing an error.
 * 
 * @example
 * ```typescript
 * // With GITHUB_ACTION_REF='v1.0.0'
 * const ref = getGitHubActionRef();
 * console.log(ref); // "v1.0.0"
 * 
 * // Without GITHUB_ACTION_REF set
 * const ref = getGitHubActionRef();
 * console.log(ref); // "main"
 * ```
 * 
 * @private
 */
function getGitHubActionRef(): string {
  return process.env.GITHUB_ACTION_REF || 'main'
}

/**
 * The repository identifier for the currently executing GitHub Action.
 * 
 * @remarks
 * This constant is initialized at module load time by reading the
 * `GITHUB_ACTION_REPOSITORY` environment variable.
 * 
 * **Format:** `owner/repo` (e.g., `'tvcsantos/verse'`)
 * 
 * **Initialization:**
 * - Evaluated once when the module is first imported
 * - Throws error if environment variable is not set
 * - Subsequent accesses use cached value
 * 
 * **Usage:**
 * Combined with other constants to construct action file paths.
 * 
 * @private
 */
const GITHUB_ACTION_REPOSITORY = getGitHubActionRepository()

/**
 * The git ref (branch, tag, or commit) of the currently executing GitHub Action.
 * 
 * @remarks
 * This constant is initialized at module load time by reading the
 * `GITHUB_ACTION_REF` environment variable, with a default of `'main'`.
 * 
 * **Format:** Git ref string (e.g., `'main'`, `'v1.0.0'`, commit SHA)
 * 
 * **Initialization:**
 * - Evaluated once when the module is first imported
 * - Uses default value `'main'` if environment variable not set
 * - Subsequent accesses use cached value
 * 
 * **Usage:**
 * Combined with other constants to construct action file paths.
 * 
 * @private
 */
const GITHUB_ACTION_REF = getGitHubActionRef()

/**
 * Absolute path to the root directory of the currently executing GitHub Action.
 * 
 * @remarks
 * This constant represents the full file system path where the action's files
 * are located on the GitHub Actions runner.
 * 
 * **Path Construction:**
 * ```
 * /home/runner/_work/_actions/{owner}/{repo}/{ref}
 * ```
 * 
 * **Example Values:**
 * - `/home/runner/_work/_actions/tvcsantos/verse/main`
 * - `/home/runner/_work/_actions/tvcsantos/verse/v1.0.0`
 * - `/home/runner/_work/_actions/actions/checkout/v4`
 * 
 * **Initialization:**
 * - Evaluated once when module is first imported
 * - Combines `RUNNER_ACTIONS_PATH`, `GITHUB_ACTION_REPOSITORY`, and `GITHUB_ACTION_REF`
 * - Subsequent accesses use cached value
 * 
 * **Usage:**
 * Base path for locating action resources (scripts, configuration files, etc.)
 * via {@link getGitHubActionPath}.
 * 
 * @private
 */
const ACTION_FILE_PATH = join(
  RUNNER_ACTIONS_PATH,
  GITHUB_ACTION_REPOSITORY,
  GITHUB_ACTION_REF
)

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
export function getGitHubActionPath(relativePath: string): string {
  return join(ACTION_FILE_PATH, relativePath);
}

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
export function parseBooleanInput(input: string): boolean {
  return input.toLowerCase() === 'true';
}