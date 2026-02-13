import * as fs from 'fs/promises';
import { GRADLE_PROPERTIES_FILE, GRADLE_BUILD_FILE, GRADLE_BUILD_KTS_FILE, GRADLE_SETTINGS_FILE, GRADLE_SETTINGS_KTS_FILE, GRADLE_ID } from '../constants.js';
import { AdapterIdentifier, exists, logger } from '@versu/core';

/** List of file names that indicate a Gradle project. */
const GRADLE_FILES = [
  GRADLE_PROPERTIES_FILE,
  GRADLE_BUILD_FILE,
  GRADLE_BUILD_KTS_FILE,
  GRADLE_SETTINGS_FILE,
  GRADLE_SETTINGS_KTS_FILE
];

/**
 * Adapter identifier for Gradle-based projects.
 * Detects Gradle projects by looking for gradle.properties, build.gradle(.kts), or settings.gradle(.kts) files.
 */
export class GradleAdapterIdentifier implements AdapterIdentifier {
  /** Metadata describing this Gradle adapter (id: 'gradle', supports snapshots). */
  readonly metadata = {
    id: GRADLE_ID,
    capabilities: {
      supportsSnapshots: true
    }
  };

  /**
   * Determines whether the specified project is a Gradle project.
   * @param projectRoot - Absolute path to the project root directory
   * @returns True if any Gradle-specific file is found in the project root
   */
  async accept(projectRoot: string): Promise<boolean> {
    // Check if project root directory exists
    const projectRootExists = await exists(projectRoot);

    if (!projectRootExists) {
      // Log for debugging and return false immediately
      logger.debug(`Project root does not exist: ${projectRoot}`);
      return false;
    }

    // Read directory contents (only top-level files)
    const files = await fs.readdir(projectRoot);
    
    // Check if any known Gradle file is present in the directory
    const hasGradleFile = GRADLE_FILES.some(file => files.includes(file));
    
    return hasGradleFile;
  }
}
