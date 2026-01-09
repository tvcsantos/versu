import path, { join } from 'path';
import { createInitialVersion, parseSemVer } from '../../semver/index.js';
import { exists } from '../../utils/file.js';
import { BaseModule, Module, ProjectInformation, RawProjectInformation } from '../project-information.js';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import fs from 'fs/promises';
import crypto from 'crypto';
import fg from 'fast-glob';
import { parseProperties } from '../../utils/properties.js';
import { logger } from '../../utils/logger.js';

type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

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
 * Cached project information structure with hash for validation.
 */
type CachedProjectInformation = {
  hash: string;
  data: GradleProjectInformation;
}

/**
 * Finds all Gradle build files recursively under the project root.
 * Searches for settings.gradle, settings.gradle.kts, build.gradle, and build.gradle.kts files.
 * @param projectRoot - Absolute path to the Gradle project root directory
 * @returns Promise resolving to array of relative paths to Gradle build files
 */
async function findGradleFiles(projectRoot: string): Promise<string[]> {
  const patterns = [
    '**/settings.gradle',
    '**/settings.gradle.kts',
    '**/build.gradle',
    '**/build.gradle.kts'
  ];

  const files = await fg(patterns, {
    cwd: projectRoot,
    absolute: false,
    ignore: ['**/node_modules/**', '**/build/**', '**/.gradle/**']
  });

  // Sort for consistent ordering
  return files.sort();
}

/**
 * Computes SHA-256 hash of all Gradle build files.
 * Used to detect changes in project configuration that would invalidate cached information.
 * @param projectRoot - Absolute path to the Gradle project root directory
 * @returns Promise resolving to hexadecimal hash string
 */
async function computeGradleFilesHash(projectRoot: string): Promise<string> {
  const files = await findGradleFiles(projectRoot);
  const hash = crypto.createHash('sha256');

  for (const file of files) {
    const content = await fs.readFile(join(projectRoot, file), 'utf-8');
    hash.update(file); // Include file path for uniqueness
    hash.update(content);
  }

  return hash.digest('hex');
}

/**
 * Executes the Gradle wrapper script to generate project information.
 * Runs gradlew with initialization script to create the project-information.json file.
 * @param projectRoot - Absolute path to the Gradle project root directory
 * @param outputFile - Path to output JSON file to be generated
 * @throws {Error} If initialization script not found or Gradle execution fails
 */
async function executeGradleScript(projectRoot: string, outputFile: string): Promise<void> {
  logger.info(`⚙️ Executing Gradle to collect project information...`);
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
    'structure',               // Custom task that outputs project structure
    `-PprojectInfoOutput=${outputFile}`
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

  logger.info(`✅ Gradle project information generated at ${outputFile}.`);
}

/**
 * Executes Gradle to collect raw project structure information.
 * Runs gradlew with init script to output JSON containing module hierarchy, versions, and dependencies.
 * @param projectRoot - Absolute path to the Gradle project root directory
 * @param outputFile - Path to output JSON file to be generated
 * @returns Promise resolving to raw project information as JSON
 * @throws {Error} If initialization script not found or Gradle execution fails
 */
export async function getRawProjectInformation(projectRoot: string, outputFile: string): Promise<RawProjectInformation> {
  // Step 1: Check if project-information.json exists
  const fileExists = await exists(outputFile);

  let data: GradleProjectInformation = {};
  let executeScript = true;

  // Compute hash of all Gradle build files
  const currentHash = await computeGradleFilesHash(projectRoot);
  logger.info(`🔍 Computed Gradle files hash: ${currentHash}`);
  
  if (fileExists) {
    logger.info(`💾 Cached project information found at ${outputFile}. Validating cache...`);
    // Step 2: File exists, check cache validity
    try {
      const fileContent = await fs.readFile(outputFile, 'utf-8');
      const cachedData: CachedProjectInformation = JSON.parse(fileContent);
      
      // Step 2.1: Compare hashes
      if (cachedData.hash === currentHash) {
        logger.info(`✅ Cache is valid. Using cached project information.`);
        // Cache hit - use cached data
        executeScript = false;
        data = cachedData.data;
      } else {
        logger.info(`❌ Cache is invalid. Cached hash: ${cachedData.hash}`);
        logger.info(`🔄 Gradle files changed, regenerating project information...`);
      }
      
      // Cache miss - hash mismatch, need to regenerate
    } catch (error) {
      // If there's any error reading/parsing cached file, regenerate
      logger.warning(`⚠️ Failed to read cached project information: ${error}`);
    }
  }
  
  if (executeScript) {
    // Step 3: File doesn't exist or cache is invalid - execute Gradle script
    await executeGradleScript(projectRoot, outputFile);
    // Read the output file content
    const fileContent = await fs.readFile(outputFile, 'utf-8');
    // Parse JSON output from Gradle
    data = JSON.parse(fileContent.trim() || '{}');
  }

  // Verify that the output file was created
  const fileExistsAfterExec = await exists(outputFile);
  if (!fileExistsAfterExec) {
    throw new Error(
      `Expected output file not found at ${outputFile}. ` +
      `Ensure that the Gradle init script is correctly generating the project information.`
    );
  }
  
  // Compute hash and save with cache information
  const cachedData: CachedProjectInformation = {
    hash: currentHash,
    data
  };

  // Read gradle.properites and add version
  const projectInformation = await getInformationWithVersions(projectRoot, data);

  if (!executeScript) {
    // Write back to file with hash for future cache validation
    await fs.writeFile(outputFile, JSON.stringify(cachedData, null, 2), 'utf-8');
  }
  
  return projectInformation;
}

// omit version and declaredVersion
type GradleModule = Omit<BaseModule, 'version' | 'declaredVersion'> & {
  versionProperty: string;
}

type GradleProjectInformation = {
  [id: string]: GradleModule;
};

/**
 * Reads gradle.properties to extract module versions and augment raw project information.
 * @param projectRoot - Absolute path to the Gradle project root directory
 * @param projectInformation - Gradle project information without versions
 * @returns Promise resolving to augmented RawProjectInformation with versions
 */
async function getInformationWithVersions(
  projectRoot: string, 
  projectInformation: GradleProjectInformation
): Promise<RawProjectInformation> {
  const gradlePropertiesFile = join(projectRoot, 'gradle.properties');
  const gradlePropertiesExists = await exists(gradlePropertiesFile);
  const result: Mutable<RawProjectInformation> = {};
  let moduleVersions = new Map<string, string>();

  if (gradlePropertiesExists) {
    moduleVersions = await parseProperties(gradlePropertiesFile);

    for (const [moduleId, module] of Object.entries(projectInformation)) {
      const version = moduleVersions.get(module.versionProperty);
      const resultVersion = version ? version : undefined;
      result[moduleId] = {
        ...module,
        version: resultVersion,
        declaredVersion: resultVersion !== undefined
      };
    }
  }

  return result;
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
  for (const [moduleId, rawModule] of Object.entries(projectInformation)) {
    if (rawModule.type === 'root') {
      rootModule = moduleId;
    }
    
    // Create normalized Module object
    const module: Module = {
      id: moduleId,
      name: rawModule.name,
      path: rawModule.path,
      type: rawModule.type,
      affectedModules: new Set(rawModule.affectedModules),
      // Parse version if present, otherwise create initial version
      version: rawModule.version === undefined ?
        createInitialVersion() :
        parseSemVer(rawModule.version),
      declaredVersion: rawModule.declaredVersion,
    };

    if ('versionProperty' in rawModule) {
      module['versionProperty'] = rawModule.versionProperty;
    }

    modules.set(moduleId, module);
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
