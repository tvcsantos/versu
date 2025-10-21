import { ModuleSystemFactory } from "../../../services/module-system-factory.js";
import { ModuleDetector } from "../../../services/module-detector.js";
import { VersionUpdateStrategy } from "../../../services/version-update-strategy.js";
import { GradleModuleDetector } from './gradle-module-detector.js';
import { GradleVersionUpdateStrategy } from './gradle-version-update-strategy.js';

/**
 * Factory for creating Gradle-specific module system components.
 * 
 * @remarks
 * This class implements the {@link ModuleSystemFactory} interface to provide
 * Gradle-specific implementations of core module system services. It follows
 * the Abstract Factory pattern, encapsulating the creation logic for related
 * Gradle components.
 * 
 * **Factory Pattern Benefits:**
 * - **Decoupling**: Separates component creation from usage
 * - **Consistency**: Ensures all Gradle components use the same repository root
 * - **Flexibility**: Makes it easy to swap implementations or add new components
 * - **Testability**: Simplifies mocking in unit tests
 * 
 * **Created Components:**
 * - **Module Detector**: Discovers modules and dependencies in Gradle projects
 * - **Version Update Strategy**: Handles version updates in Gradle build files
 * 
 * Both components are configured with the same repository root to ensure they
 * operate on the same project structure consistently.
 * 
 * @example
 * ```typescript
 * const factory = new GradleModuleSystemFactory('/path/to/gradle/project');
 * 
 * // Create components
 * const detector = factory.createDetector();
 * const updateStrategy = factory.createVersionUpdateStrategy();
 * 
 * // Use components
 * const modules = await detector.detect();
 * await updateStrategy.updateVersion(':app', '2.0.0');
 * ```
 */
export class GradleModuleSystemFactory implements ModuleSystemFactory {
  /**
   * The absolute path to the repository root directory.
   * 
   * @remarks
   * This path is passed to all created components to ensure they operate
   * on the same project. It should point to the root directory containing
   * the main Gradle build files.
   */
  constructor(private readonly repoRoot: string) {}
  
  /**
   * Creates a Gradle-specific module detector.
   * 
   * @returns A new {@link GradleModuleDetector} instance configured with
   *          the repository root
   * 
   * @remarks
   * The returned detector is capable of:
   * - Analyzing Gradle project structure
   * - Discovering single and multi-module projects
   * - Identifying module dependencies
   * - Extracting version information
   * 
   * The detector uses Gradle's own introspection capabilities to gather
   * accurate project information, supporting both Groovy and Kotlin DSL
   * build scripts.
   * 
   * **Usage Pattern:**
   * Typically called once per operation, as the detection process involves
   * Gradle execution which can be resource-intensive. Cache the result if
   * multiple operations need module information.
   * 
   * @example
   * ```typescript
   * const detector = factory.createDetector();
   * const registry = await detector.detect();
   * 
   * // Access detected modules
   * const modules = registry.getAllModules();
   * modules.forEach(module => {
   *   console.log(`${module.name}: ${module.version}`);
   * });
   * ```
   */
  createDetector(): ModuleDetector {
    return new GradleModuleDetector(this.repoRoot);
  }
  
  /**
   * Creates a Gradle-specific version update strategy.
   * 
   * @returns A new {@link GradleVersionUpdateStrategy} instance configured
   *          with the repository root
   * 
   * @remarks
   * The returned strategy is capable of:
   * - Updating version properties in gradle.properties
   * - Handling both regular and snapshot versions
   * - Updating versions across multi-module projects
   * - Preserving file formatting and comments
   * 
   * **Version Update Mechanism:**
   * The strategy modifies the `version` property in gradle.properties files,
   * which is the standard Gradle convention for managing project versions.
   * It supports:
   * - Single-module projects (root gradle.properties)
   * - Multi-module projects (per-module gradle.properties)
   * - Snapshot version suffixes (e.g., '-SNAPSHOT')
   * 
   * **File Safety:**
   * The strategy performs atomic updates with proper error handling to
   * prevent partial updates or file corruption.
   * 
   * @example
   * ```typescript
   * const strategy = factory.createVersionUpdateStrategy();
   * 
   * // Update root project version
   * await strategy.updateVersion(':', '2.0.0');
   * 
   * // Update subproject version
   * await strategy.updateVersion(':app', '1.5.0');
   * 
   * // Update with snapshot
   * await strategy.updateVersion(':lib', '1.0.0-SNAPSHOT');
   * ```
   */
  createVersionUpdateStrategy(): VersionUpdateStrategy {
    return new GradleVersionUpdateStrategy(this.repoRoot);
  }
}
