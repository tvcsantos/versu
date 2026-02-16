import {
  ModuleDetector,
  ModuleRegistry,
  ModuleSystemFactory,
  VersionUpdateStrategy,
} from "@versu/core";
import { MavenModuleDetector } from "./maven-module-detector.js";
import { MavenVersionUpdateStrategy } from "./maven-version-update-strategy.js";

/**
 * Factory for creating Maven-specific module system components.
 */
export class MavenModuleSystemFactory implements ModuleSystemFactory {
  /** Absolute path to the repository root directory. */
  constructor(private readonly repoRoot: string) {}

  createDetector(_outputFile: string): ModuleDetector {
    return new MavenModuleDetector(this.repoRoot);
  }

  createVersionUpdateStrategy(
    moduleRegistry: ModuleRegistry,
  ): VersionUpdateStrategy {
    return new MavenVersionUpdateStrategy(this.repoRoot, moduleRegistry);
  }
}
