import { ModuleDetector, type ProjectInformation } from "@versu/core";
import {
  getRawProjectInformation,
  getProjectInformation,
} from "../maven-project-information.js";

/**
 * Module detector for Maven-based projects.
 * Parses pom.xml files to discover all modules and their dependencies.
 */
export class MavenModuleDetector implements ModuleDetector {
  /** Absolute path to the repository root directory. */
  constructor(readonly repoRoot: string) {}

  async detect(): Promise<ProjectInformation> {
    const rawProjectInformation = await getRawProjectInformation(this.repoRoot);
    return getProjectInformation(rawProjectInformation);
  }
}
