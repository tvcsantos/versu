/**
 * Gradle-specific implementation for parsing project hierarchy dependencies
 * Uses the init-hierarchy-deps.gradle.kts script to extract dependency information
 */

import { join } from 'path';
import {
  RawProjectInformation
} from '../hierarchy.js';
import { getExecOutput } from '@actions/exec';
import { createInitialVersion, parseSemVer } from '../../semver/index.js';
import { exists } from '../../utils/file.js';
import { getGitHubActionPath } from '../../io/action.js';
import { Module, ProjectInformation } from '../core.js';

/**
 * Execute the gradle hierarchy command to get the JSON output
 */
export async function getRawProjectInformation(projectRoot: string): Promise<RawProjectInformation> {
  const gradlew = join(projectRoot, 'gradlew');
  const initScriptPath = getGitHubActionPath('init-hierarchy-deps.gradle.kts');
  
  // Check if init script exists
  const scriptExists = await exists(initScriptPath);
  if (!scriptExists) {
    throw new Error(`Init script not found at ${initScriptPath}. Please create the init-hierarchy-deps.gradle.kts file.`);
  }
  
  const args = [
    '--quiet',
    '--console=plain',
    '--init-script',
    initScriptPath,
    'hierarchy'
  ];
  
  const result = await getExecOutput(gradlew, args, {
    cwd: projectRoot,
    silent: true,
    ignoreReturnCode: true
  });

  if (result.exitCode !== 0) {
    throw new Error(`Gradle command failed with exit code ${result.exitCode}: ${result.stderr}`);
  }

  return JSON.parse(result.stdout.trim() || '{}');
}

/**
 * Parse the hierarchy structure and extract dependency relationships
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
    modules.set(moduleId, {
      id: moduleId,
      name: module.name,
      path: module.path,
      type: module.type,
      affectedModules: new Set(module.affectedModules),
      version: module.version === undefined ? createInitialVersion() : parseSemVer(module.version),
      declaredVersion: module.declaredVersion,
    });
  }
  
  if (!rootModule) {
    throw new Error('No root module found in hierarchy. Every project hierarchy must contain exactly one module with type "root".');
  }
  
  return {
    moduleIds,
    modules,
    rootModule
  };
}
