import { ModuleDetector } from "./module-detector.js";
import { ModuleRegistry } from "./module-registry.js";
import { VersionUpdateStrategy } from "./version-update-strategy.js";

/**
 * Factory for creating build system-specific module components.
 *
 * @remarks
 * Implements the Abstract Factory pattern. Each build system (Gradle, Maven, npm)
 * provides its own implementation to create compatible detector and strategy instances.
 */
export interface ModuleSystemFactory {
  /**
   * Creates a module detector for discovering modules.
   *
   * @returns {@link ModuleDetector} configured for this build system
   */
  createDetector(): ModuleDetector;

  /**
   * Creates a version update strategy for writing versions to build files.
   *
   * @returns {@link VersionUpdateStrategy} configured for this build system
   */
  createVersionUpdateStrategy(
    moduleRegistry: ModuleRegistry,
  ): VersionUpdateStrategy;
}
