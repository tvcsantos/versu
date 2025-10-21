import { GradleAdapterIdentifier } from "../adapters/gradle/services/gradle-adapter-identifier.js";
import { AdapterIdentifier } from "../services/adapter-identifier.js";
import { AdapterIdentifierRegistry } from "../services/adapter-identifier-registry.js";

/**
 * Creates and configures the global adapter identifier registry.
 * 
 * @returns A configured {@link AdapterIdentifierRegistry} with all available adapter identifiers
 * 
 * @remarks
 * This factory function serves as the central point for registering all supported
 * project adapters in the VERSE system. It instantiates all adapter identifiers
 * and bundles them into a registry for use throughout the application.
 * 
 * **Purpose:**
 * - **Centralized Registration**: Single location to manage all supported adapters
 * - **Dependency Injection**: Provides a configured registry for dependency injection
 * - **Extensibility**: Easy to add new adapters by adding entries to the array
 * - **Testability**: Can be mocked or replaced in tests
 * 
 * **Registry Behavior:**
 * The registry uses the order of identifiers to determine the precedence during
 * auto-detection. When multiple adapters could match a project (unlikely but possible),
 * the first matching adapter in the array is selected.
 * 
 * **Adding New Adapters:**
 * To add support for a new build system:
 * 1. Implement the {@link AdapterIdentifier} interface
 * 2. Create the adapter class (e.g., `MavenAdapterIdentifier`)
 * 3. Import it in this file
 * 4. Add an instance to the `identifiers` array
 * 
 * **Currently Supported:**
 * - **Gradle**: Java/Kotlin projects using Gradle build system
 * 
 * **Planned Support:**
 * - Maven: Java projects using Maven
 * - Node.js: JavaScript/TypeScript projects using npm/yarn/pnpm
 * - Python: Python projects using setuptools/poetry
 * 
 * @example
 * ```typescript
 * // Create the registry
 * const registry = createAdapterIdentifierRegistry();
 * 
 * // Use for auto-detection
 * const adapter = await registry.identify('/path/to/project');
 * 
 * // Use for explicit lookup
 * const gradleAdapter = registry.getIdentifierById('gradle');
 * 
 * // Check supported adapters
 * const supported = registry.getSupportedAdapters();
 * console.log('Supported adapters:', supported.join(', '));
 * ```
 * 
 * @see {@link AdapterIdentifierRegistry} for registry operations
 * @see {@link AdapterIdentifier} for implementing new adapters
 */
export function createAdapterIdentifierRegistry(): AdapterIdentifierRegistry {
    // Array of all registered adapter identifiers
    // Order matters: first matching adapter is selected during auto-detection
    const identifiers: AdapterIdentifier[] = [
        new GradleAdapterIdentifier(),
        
        // Add future adapter identifiers here as they are implemented:
        // new MavenAdapterIdentifier(),
        // new NodeJSAdapterIdentifier(),
        // new PythonAdapterIdentifier(),
    ];

    // Create and return the registry with all registered identifiers
    return new AdapterIdentifierRegistry(identifiers);
}