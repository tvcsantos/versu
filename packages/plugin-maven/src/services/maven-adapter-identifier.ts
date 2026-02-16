import * as fs from "fs/promises";
import { MAVEN_POM_FILE, MAVEN_ID } from "../constants.js";
import { AdapterIdentifier, exists, logger } from "@versu/core";

/**
 * Adapter identifier for Maven-based projects.
 * Detects Maven projects by looking for pom.xml in the project root.
 */
export class MavenAdapterIdentifier implements AdapterIdentifier {
  /** Metadata describing this Maven adapter (id: 'maven', supports snapshots). */
  readonly metadata = {
    id: MAVEN_ID,
    capabilities: {
      supportsSnapshots: true,
    },
  };

  /**
   * Determines whether the specified project is a Maven project.
   * @param projectRoot - Absolute path to the project root directory
   * @returns True if pom.xml is found in the project root
   */
  async accept(projectRoot: string): Promise<boolean> {
    const projectRootExists = await exists(projectRoot);

    if (!projectRootExists) {
      logger.debug("Project root does not exist", { projectRoot });
      return false;
    }

    const files = await fs.readdir(projectRoot);
    return files.includes(MAVEN_POM_FILE);
  }
}
