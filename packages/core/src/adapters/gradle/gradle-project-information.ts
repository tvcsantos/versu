import path, { join } from 'path';
import { createInitialVersion, parseSemVer } from '../../semver/index.js';
import { exists } from '../../utils/file.js';
import { Module, ProjectInformation, RawProjectInformation } from '../project-information.js';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import fs from 'fs/promises';

/**
 * Name of the Gradle wrapper script file.
 * Ensures consistent builds without requiring pre-installed Gradle.
 */
const GRADLE_WRAPPER = 'gradlew'

/**
 * Relative path to the Gradle initialization script within the action.
 * Injected into Gradle to collect project structure information as JSON.
 */
const GRADLE_INIT_SCRIPT = './init-project-information.gradle.kts'

/**
 * Executes Gradle to collect raw project structure information.
 * Runs gradlew with init script to output JSON containing module hierarchy, versions, and dependencies.
 * @param projectRoot - Absolute path to the Gradle project root directory
 * @returns Promise resolving to raw project information as JSON
 * @throws {Error} If initialization script not found or Gradle execution fails
 */
export async function getRawProjectInformation(projectRoot: string): Promise<RawProjectInformation> {
  const gradlew = join(projectRoot, GRADLE_WRAPPER);
  const dirname = path.dirname(fileURLToPath(import.meta.url));
  const initScriptPath = join(dirname, GRADLE_INIT_SCRIPT);

  // Check if init script exists
  const scriptExists = await exists(initScriptPath);
  if (!scriptExists) {
    throw new Error(
      `Init script not found at ${initScriptPath}. ` +
      `Please create the ${GRADLE_INIT_SCRIPT} file.`
    );
  }

  // Prepare Gradle command arguments
  const args = [
    '--quiet',                // Suppress non-error output for clean JSON
    '--console=plain',        // Disable ANSI formatting
    '--init-script',          // Inject initialization script
    initScriptPath,
    'structure'               // Custom task that outputs project structure
  ];

  // Execute Gradle wrapper with the prepared arguments
  const result = await execa(gradlew, args, {
    cwd: projectRoot,        // Run from project root
    reject: false            // Handle non-zero exit codes ourselves
  });

  // Check for Gradle execution failure
  if (result.exitCode !== 0) {
    throw new Error(
      `Gradle command failed with exit code ${result.exitCode}: ${result.stderr}`
    );
  }

  const file = join(projectRoot, 'build', 'project-information.json');

  // Verify that the output file was created
  const fileExists = await exists(file);
  if (!fileExists) {
    throw new Error(
      `Expected output file not found at ${file}. ` +
      `Ensure that the Gradle init script is correctly generating the project information.`
    );
  }

  // Read the output file content
  const projectInformation = await fs.readFile(file, 'utf-8');

  // Parse JSON output from Gradle
  return JSON.parse(projectInformation.trim() || '{}');
}

/**
 * Transforms raw project information into structured, queryable format.
 * Normalizes modules, identifies root, parses versions, and maps dependencies.
 * @param projectInformation - Raw project information from Gradle
 * @returns Structured ProjectInformation with normalized data
 * @throws {Error} If no root module found in hierarchy
 */
export function getProjectInformation(projectInformation: RawProjectInformation): ProjectInformation {
  const moduleIds = Object.keys(projectInformation);
  const modules = new Map<string, Module>();

  // Find root module by looking for the one with type 'root'
  let rootModule: string | undefined;
  for (const [moduleId, module] of Object.entries(projectInformation)) {
    if (module.type === 'root') {
      rootModule = moduleId;
    }
    
    // Create normalized Module object
    modules.set(moduleId, {
      id: moduleId,
      name: module.name,
      path: module.path,
      type: module.type,
      affectedModules: new Set(module.affectedModules),
      // Parse version if present, otherwise create initial version
      version: module.version === undefined ?
        createInitialVersion() :
        parseSemVer(module.version),
      declaredVersion: module.declaredVersion,
    });
  }

  // Validate that a root module was found
  if (!rootModule) {
    throw new Error(
      'No root module found in hierarchy. ' +
      'Every project hierarchy must contain exactly one module with type "root".'
    );
  }

  return {
    moduleIds,
    modules,
    rootModule
  };
}
