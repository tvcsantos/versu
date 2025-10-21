import { ModuleSystemFactory } from "../services/module-system-factory.js";
/**
 * Creates the appropriate module system factory for a given adapter.
 *
 * @param adapterName - The identifier of the build system adapter (e.g., 'gradle', 'maven', 'npm')
 * @param repoRoot - The absolute path to the repository root directory
 *
 * @returns A {@link ModuleSystemFactory} instance configured for the specified adapter
 *
 * @throws {Error} If the adapter name is not recognized or supported
 *
 * @remarks
 * This function implements the Factory Method pattern, creating adapter-specific
 * module system factories based on the adapter identifier. It serves as the central
 * point for instantiating the correct factory implementation.
 *
 * **Design Pattern:**
 * This is a factory of factories - it creates {@link ModuleSystemFactory} instances,
 * which themselves create module detectors and version update strategies. This
 * two-level factory pattern provides:
 * - Decoupling between adapter selection and component creation
 * - Centralized factory instantiation logic
 * - Type-safe adapter-specific implementations
 * - Easy extensibility for new adapters
 *
 * **Adapter Resolution:**
 * - The adapter name is case-insensitive (converted to lowercase)
 * - Matches against known adapter identifiers (constants)
 * - Throws descriptive error for unsupported adapters
 *
 * **Factory Responsibilities:**
 * Each returned factory can create:
 * - {@link ModuleDetector}: For discovering project modules
 * - {@link VersionUpdateStrategy}: For updating module versions
 *
 * **Currently Supported Adapters:**
 * - **gradle**: Gradle build system (Java/Kotlin/Groovy projects)
 *
 * **Adding New Adapters:**
 * To add support for a new build system:
 * 1. Create an adapter-specific module system factory (e.g., `MavenModuleSystemFactory`)
 * 2. Implement {@link ModuleSystemFactory} interface
 * 3. Define an adapter ID constant (e.g., `MAVEN_ID`)
 * 4. Import the factory and constant in this file
 * 5. Add a new case to the switch statement
 *
 * **Error Handling:**
 * If an unsupported adapter name is provided, a descriptive error is thrown.
 * This helps users quickly identify configuration issues or typos in adapter names.
 *
 * @example
 * ```typescript
 * // Create Gradle factory
 * const factory = createModuleSystemFactory('gradle', '/path/to/project');
 *
 * // Create components from factory
 * const detector = factory.createDetector();
 * const versionStrategy = factory.createVersionUpdateStrategy();
 *
 * // Use components
 * const modules = await detector.detect();
 * await versionStrategy.writeVersionUpdates(versionMap);
 * ```
 *
 * @example
 * ```typescript
 * // Case-insensitive adapter name
 * const factory1 = createModuleSystemFactory('GRADLE', '/path/to/project');
 * const factory2 = createModuleSystemFactory('Gradle', '/path/to/project');
 * const factory3 = createModuleSystemFactory('gradle', '/path/to/project');
 * // All three create the same type of factory
 * ```
 *
 * @example
 * ```typescript
 * // Handling unsupported adapter
 * try {
 *   const factory = createModuleSystemFactory('maven', '/path/to/project');
 * } catch (error) {
 *   console.error(error.message); // "Unsupported adapter: maven"
 * }
 * ```
 *
 * @see {@link ModuleSystemFactory} for the factory interface
 * @see {@link GradleModuleSystemFactory} for Gradle implementation
 */
export declare function createModuleSystemFactory(adapterName: string, repoRoot: string): ModuleSystemFactory;
//# sourceMappingURL=module-system-factory.d.ts.map