import { ModuleDetector } from "./module-detector.js";
import { VersionUpdateStrategy } from "./version-update-strategy.js";
/**
 * Factory interface for creating build system-specific module components.
 *
 * @remarks
 * ModuleSystemFactory is a key abstraction in VERSE's adapter architecture, implementing
 * the Abstract Factory pattern. Each build system (Gradle, Maven, npm, etc.) provides
 * its own implementation to create components tailored to that build system's specifics.
 *
 * **Core Responsibility:**
 * Create instances of build system-specific components without exposing their
 * concrete implementation details to client code. This enables VERSE to support
 * multiple build systems through a unified interface.
 *
 * **Abstract Factory Pattern:**
 * This interface defines the contract for a family of related components:
 * - {@link ModuleDetector}: Discovers modules in the repository
 * - {@link VersionUpdateStrategy}: Updates module versions in build files
 *
 * Each concrete factory (e.g., GradleModuleSystemFactory) creates components
 * that work together cohesively within their build system ecosystem.
 *
 * **Design Benefits:**
 *
 * 1. **Decoupling:**
 *    - Client code doesn't depend on concrete implementations
 *    - Can swap build systems without changing client code
 *    - Clear separation between interface and implementation
 *
 * 2. **Consistency:**
 *    - Ensures related components come from the same build system
 *    - Prevents mixing incompatible components (e.g., Gradle detector with Maven updater)
 *    - Cohesive component families
 *
 * 3. **Extensibility:**
 *    - New build systems can be added without modifying existing code
 *    - Just implement this interface for the new system
 *    - Register in the factory registry
 *
 * 4. **Type Safety:**
 *    - TypeScript ensures all methods are implemented
 *    - Compile-time verification of component creation
 *    - Clear API contracts
 *
 * **Component Lifecycle:**
 *
 * 1. Factory is created with repository root path:
 *    ```typescript
 *    const factory = createModuleSystemFactory('gradle', '/path/to/repo');
 *    ```
 *
 * 2. Factory creates components as needed:
 *    ```typescript
 *    const detector = factory.createDetector();
 *    const strategy = factory.createVersionUpdateStrategy();
 *    ```
 *
 * 3. Components are used in the VERSE workflow:
 *    ```typescript
 *    const modules = await detector.detect();
 *    await strategy.writeVersionUpdates(versionMap);
 *    ```
 *
 * **Implementation Requirements:**
 *
 * Concrete factories must:
 * - Accept repository root path in constructor
 * - Store repository root for component initialization
 * - Implement all factory methods
 * - Create components configured for the specific build system
 * - Ensure components share consistent configuration
 *
 * **Existing Implementations:**
 * - **GradleModuleSystemFactory**: Gradle build system support
 *
 * **Future Implementations:**
 * - MavenModuleSystemFactory: Maven build system
 * - NpmModuleSystemFactory: npm/yarn workspaces
 * - PythonModuleSystemFactory: Python setuptools/poetry
 *
 * **Usage Context:**
 * Factories are typically obtained through the factory function:
 * ```typescript
 * import { createModuleSystemFactory } from './factories/module-system-factory.js';
 *
 * const factory = createModuleSystemFactory(adapterName, repoRoot);
 * const detector = factory.createDetector();
 * ```
 *
 * @example
 * ```typescript
 * // Using factory to create components
 * const factory = createModuleSystemFactory('gradle', '/path/to/project');
 *
 * // Create detector and discover modules
 * const detector = factory.createDetector();
 * const registry = await detector.detect();
 *
 * // Create version update strategy
 * const strategy = factory.createVersionUpdateStrategy();
 * await strategy.writeVersionUpdates(newVersions);
 * ```
 *
 * @example
 * ```typescript
 * // Custom implementation for a hypothetical build system
 * class MavenModuleSystemFactory implements ModuleSystemFactory {
 *   constructor(private readonly repoRoot: string) {}
 *
 *   createDetector(): ModuleDetector {
 *     return new MavenModuleDetector(this.repoRoot);
 *   }
 *
 *   createVersionUpdateStrategy(): VersionUpdateStrategy {
 *     return new MavenVersionUpdateStrategy(this.repoRoot);
 *   }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Complete workflow with factory
 * async function processRepository(adapterName: string, repoRoot: string) {
 *   // Create factory for detected build system
 *   const factory = createModuleSystemFactory(adapterName, repoRoot);
 *
 *   // Create and use detector
 *   const detector = factory.createDetector();
 *   const modules = await detector.detect();
 *   console.log(`Detected ${modules.getModuleIds().length} modules`);
 *
 *   // Create and use version update strategy
 *   const strategy = factory.createVersionUpdateStrategy();
 *   const versionMap = new Map([[':core', '1.2.3']]);
 *   await strategy.writeVersionUpdates(versionMap);
 *   console.log('Versions updated');
 * }
 * ```
 *
 * @see {@link ModuleDetector} - Component for discovering modules
 * @see {@link VersionUpdateStrategy} - Component for updating versions
 * @see {@link createModuleSystemFactory} - Factory function for creating instances
 * @see {@link GradleModuleSystemFactory} - Gradle implementation
 */
export interface ModuleSystemFactory {
    /**
     * Creates a module detector for discovering modules in the repository.
     *
     * @returns A {@link ModuleDetector} instance configured for this build system
     *
     * @remarks
     * This factory method creates a detector capable of discovering all modules
     * in the repository using build system-specific mechanisms. The detector is
     * pre-configured with the repository root provided to the factory constructor.
     *
     * **Detector Responsibilities:**
     * The created detector will:
     * - Identify all modules in the project
     * - Extract module metadata (name, path, version, type)
     * - Build a complete module hierarchy
     * - Return a {@link ModuleRegistry} with discovered modules
     *
     * **Build System Specifics:**
     * - **Gradle**: Uses init script execution via Gradle CLI
     * - **Maven**: (Future) Parses POM hierarchy
     * - **npm**: (Future) Reads package.json workspace configuration
     *
     * **Configuration:**
     * The detector is initialized with the repository root from the factory,
     * ensuring consistent paths across all components created by this factory.
     * No additional configuration is needed by the caller.
     *
     * **Lifecycle:**
     * - Factory method is called once per detection cycle
     * - Detector instance is typically short-lived
     * - Used immediately to detect modules
     * - Can be discarded after detection completes
     *
     * **Thread Safety:**
     * Implementations should create new detector instances on each call rather
     * than returning cached instances, ensuring each detection cycle is independent.
     *
     * @example
     * ```typescript
     * const factory = createModuleSystemFactory('gradle', '/path/to/project');
     * const detector = factory.createDetector();
     *
     * // Use detector to discover modules
     * const registry = await detector.detect();
     * console.log(`Found ${registry.getModuleIds().length} modules`);
     * ```
     *
     * @example
     * ```typescript
     * // Multiple detection cycles (detector is recreated each time)
     * const factory = createModuleSystemFactory('gradle', '/path/to/project');
     *
     * // First detection
     * const detector1 = factory.createDetector();
     * const modules1 = await detector1.detect();
     *
     * // Second detection (after project changes)
     * const detector2 = factory.createDetector();
     * const modules2 = await detector2.detect();
     * ```
     *
     * @see {@link ModuleDetector} - Interface for module detection
     * @see {@link ModuleRegistry} - Container returned by detector
     */
    createDetector(): ModuleDetector;
    /**
     * Creates a version update strategy for writing new versions to build files.
     *
     * @returns A {@link VersionUpdateStrategy} instance configured for this build system
     *
     * @remarks
     * This factory method creates a strategy capable of updating module versions
     * in build system-specific files. The strategy knows how to modify version
     * information in the appropriate format and location for the build system.
     *
     * **Strategy Responsibilities:**
     * The created strategy will:
     * - Update module versions in build files
     * - Use build system-specific version storage mechanisms
     * - Handle batch updates across multiple modules
     * - Ensure atomic writes to prevent partial updates
     *
     * **Build System Specifics:**
     * - **Gradle**: Updates gradle.properties file with version properties
     * - **Maven**: (Future) Updates <version> tags in pom.xml files
     * - **npm**: (Future) Updates version fields in package.json files
     *
     * **Version Storage:**
     * Each build system stores versions differently:
     * - Gradle: Properties in gradle.properties (e.g., `coreVersion=1.2.3`)
     * - Maven: XML elements in pom.xml (<version>1.2.3</version>)
     * - npm: JSON fields in package.json ("version": "1.2.3")
     *
     * The strategy abstracts these differences behind a common interface.
     *
     * **Configuration:**
     * The strategy is initialized with the repository root from the factory,
     * ensuring it operates on the correct build files. No additional configuration
     * is needed by the caller.
     *
     * **Lifecycle:**
     * - Factory method is called once per update cycle
     * - Strategy instance is typically short-lived
     * - Used immediately to write version updates
     * - Can be discarded after updates complete
     *
     * **Thread Safety:**
     * Implementations should create new strategy instances on each call rather
     * than returning cached instances, ensuring each update cycle is independent.
     *
     * **Error Handling:**
     * Strategies should provide clear error messages for common failure scenarios:
     * - Build file not found or not writable
     * - Invalid version format
     * - Concurrent modification detected
     * - I/O errors during write operations
     *
     * @example
     * ```typescript
     * const factory = createModuleSystemFactory('gradle', '/path/to/project');
     * const strategy = factory.createVersionUpdateStrategy();
     *
     * // Update versions for multiple modules
     * const versionMap = new Map([
     *   [':core', '1.2.3'],
     *   [':api', '2.0.0'],
     *   [':utils', '0.5.0']
     * ]);
     *
     * await strategy.writeVersionUpdates(versionMap);
     * console.log('All versions updated successfully');
     * ```
     *
     * @example
     * ```typescript
     * // Complete version update workflow
     * const factory = createModuleSystemFactory('gradle', '/path/to/project');
     *
     * // Detect modules
     * const detector = factory.createDetector();
     * const registry = await detector.detect();
     *
     * // Calculate new versions (simplified)
     * const versionMap = new Map<string, string>();
     * for (const id of registry.getModuleIds()) {
     *   const module = registry.getModule(id);
     *   const newVersion = bumpVersion(module.version, 'patch');
     *   versionMap.set(id, newVersion);
     * }
     *
     * // Write version updates
     * const strategy = factory.createVersionUpdateStrategy();
     * await strategy.writeVersionUpdates(versionMap);
     * ```
     *
     * @example
     * ```typescript
     * // Error handling during version updates
     * const factory = createModuleSystemFactory('gradle', '/path/to/project');
     * const strategy = factory.createVersionUpdateStrategy();
     *
     * const versionMap = new Map([[':core', '1.2.3']]);
     *
     * try {
     *   await strategy.writeVersionUpdates(versionMap);
     *   console.log('Versions updated');
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.error('Build file missing');
     *   } else if (error.message.includes('permission')) {
     *     console.error('No write permission');
     *   } else {
     *     console.error('Update failed:', error);
     *   }
     * }
     * ```
     *
     * @see {@link VersionUpdateStrategy} - Interface for version updates
     * @see {@link ModuleRegistry} - Source of module IDs for version map
     */
    createVersionUpdateStrategy(): VersionUpdateStrategy;
}
//# sourceMappingURL=module-system-factory.d.ts.map