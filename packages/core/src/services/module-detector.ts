import type { ProjectInformation } from "../adapters/project-information.js";

/**
 * Interface for detecting modules in a multi-module repository.
 *
 * @remarks
 * Transforms repository file structure into a structured {@link ProjectInformation}.
 * Different implementations exist for different build systems (Gradle, Maven, npm).
 * Created by {@link ModuleSystemFactory}.
 */
export interface ModuleDetector {
  /**
   * The absolute path to the repository root directory.
   * Used for resolving module paths and executing build commands.
   */
  readonly repoRoot: string;

  /**
   * Detects all modules in the repository and returns a populated project information object.
   *
   * @returns Promise resolving to {@link ProjectInformation} with all discovered modules
   * @throws {Error} If repository is invalid, build files are missing, or detection fails
   */
  detect(): Promise<ProjectInformation>;
}
