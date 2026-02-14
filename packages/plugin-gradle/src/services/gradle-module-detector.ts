import { ModuleDetector, type ProjectInformation } from "@versu/core";
import {
  getRawProjectInformation,
  getProjectInformation,
} from "../gradle-project-information.js";

/**
 * Module detector for Gradle-based projects.
 * Executes Gradle to discover all modules and their dependencies, returning a ModuleRegistry.
 */
export class GradleModuleDetector implements ModuleDetector {
  /** Absolute path to the repository root directory. */
  constructor(
    readonly repoRoot: string,
    readonly outputFile: string,
  ) {}

  /**
   * Detects and catalogs all modules in the Gradle project.
   * @returns ModuleRegistry containing all discovered modules and their relationships
   * @throws {Error} If Gradle execution fails or project information cannot be parsed
   */
  async detect(): Promise<ProjectInformation> {
    // Step 1: Execute Gradle and collect raw project structure data
    const rawProjectInformation = await getRawProjectInformation(
      this.repoRoot,
      this.outputFile,
    );

    // Step 2: Parse and transform raw data into structured module information
    const projectInformation = getProjectInformation(rawProjectInformation);

    // Step 3: Create a registry for efficient module access and querying
    return projectInformation;
  }
}
