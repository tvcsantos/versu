import { AdapterIdentifier } from './adapter-identifier.js';

/**
 * Registry for managing and discovering adapter identifiers.
 * 
 * @remarks
 * This class implements a composite pattern for adapter identification, allowing
 * multiple adapter identifiers to be registered and queried. It provides:
 * - Automatic project adapter detection through sequential testing
 * - Fast lookup of adapters by ID
 * - Discovery of all supported adapter types
 * 
 * The registry maintains an internal map for O(1) lookup performance and
 * ensures that only one adapter identifier exists per adapter ID.
 * 
 * @example
 * ```typescript
 * const registry = new AdapterIdentifierRegistry([
 *   new GradleAdapterIdentifier(),
 *   new MavenAdapterIdentifier(),
 *   new NpmAdapterIdentifier()
 * ]);
 * 
 * // Automatically detect project adapter
 * const adapter = await registry.identify('/path/to/project');
 * 
 * // Lookup specific adapter
 * const gradleAdapter = registry.getIdentifierById('gradle');
 * ```
 */
export class AdapterIdentifierRegistry {
  /**
   * Internal map of adapter identifiers keyed by their unique ID.
   * 
   * @remarks
   * Uses a ReadonlyMap to prevent external modification while allowing
   * efficient O(1) lookups by adapter ID.
   */
  private readonly identifiers: ReadonlyMap<string, AdapterIdentifier>;
  
  /**
   * Cached array of all supported adapter IDs.
   * 
   * @remarks
   * Precomputed during construction to avoid repeated array allocations
   * when querying supported adapters.
   */
  private readonly supportedAdapters: string[];

  /**
   * Creates a new adapter identifier registry.
   * 
   * @param identifiers - Array of adapter identifiers to register
   * 
   * @remarks
   * The constructor processes the array of identifiers and creates an internal
   * map indexed by adapter ID. If multiple identifiers share the same ID, only
   * the last one in the array will be registered (Map behavior).
   * 
   * The order of identifiers in the array affects the `identify()` method,
   * as adapters are tested in the order they were registered.
   * 
   * @example
   * ```typescript
   * const registry = new AdapterIdentifierRegistry([
   *   new GradleAdapterIdentifier(),
   *   new MavenAdapterIdentifier()
   * ]);
   * ```
   */
  constructor(identifiers: AdapterIdentifier[]) {
    this.identifiers = new Map(identifiers.map(id => [id.metadata.id, id]));
    this.supportedAdapters = Array.from(this.identifiers.keys());
  }

  /**
   * Automatically identifies which adapter can handle the specified project.
   * 
   * @param projectRoot - The absolute path to the root directory of the project to analyze
   * 
   * @returns A promise that resolves to the first matching {@link AdapterIdentifier},
   *          or `null` if no registered adapter can handle the project
   * 
   * @remarks
   * This method implements the Chain of Responsibility pattern, iterating through
   * all registered adapters in registration order until one accepts the project.
   * 
   * **Behavior:**
   * - Adapters are tested sequentially in the order they were registered
   * - Returns immediately when the first adapter accepts the project
   * - Continues to the next adapter if one throws an error (fail-safe)
   * - Returns `null` if no adapter accepts the project
   * 
   * **Performance Considerations:**
   * - Best case: O(1) if first adapter matches
   * - Worst case: O(n) if no adapter matches or last one matches
   * - Each adapter's `accept()` method may perform I/O operations
   * 
   * **Error Handling:**
   * Individual adapter failures are silently caught and the search continues.
   * This prevents one faulty adapter from breaking the entire discovery process.
   * 
   * @example
   * ```typescript
   * const adapter = await registry.identify('/path/to/gradle-project');
   * if (adapter) {
   *   console.log(`Detected ${adapter.metadata.id} project`);
   * } else {
   *   console.log('No compatible adapter found');
   * }
   * ```
   */
  async identify(projectRoot: string): Promise<AdapterIdentifier | null> {
    for (const [id, identifier] of this.identifiers) {
      try {
        const result = await identifier.accept(projectRoot);
        if (result) {
          return identifier;
        }
      } catch (error) {
        // Continue to the next identifier if this one fails
        // This ensures robustness - one faulty adapter won't break discovery
        continue;
      }
    }
    
    return null;
  }

  /**
   * Retrieves a specific adapter identifier by its unique ID.
   * 
   * @param id - The unique identifier of the adapter to retrieve
   * 
   * @returns The {@link AdapterIdentifier} if found, or `null` if no adapter
   *          with the specified ID is registered
   * 
   * @remarks
   * This method provides direct O(1) access to a specific adapter when you
   * already know which adapter type you need, bypassing the auto-detection
   * mechanism.
   * 
   * Useful when:
   * - Configuration explicitly specifies an adapter
   * - Caching previous detection results
   * - Testing specific adapter implementations
   * 
   * @example
   * ```typescript
   * const gradleAdapter = registry.getIdentifierById('gradle');
   * if (gradleAdapter) {
   *   const canHandle = await gradleAdapter.accept('/path/to/project');
   * }
   * ```
   */
  getIdentifierById(id: string): AdapterIdentifier | null {
    return this.identifiers.get(id) || null;
  }

  /**
   * Returns a list of all supported adapter IDs in this registry.
   * 
   * @returns An array of adapter ID strings
   * 
   * @remarks
   * This method returns a cached array created during construction, making it
   * very efficient for repeated calls. The returned array reflects the adapters
   * that were registered at construction time.
   * 
   * The order of IDs in the array matches the iteration order of the internal
   * Map, which corresponds to the registration order.
   * 
   * Useful for:
   * - Displaying available adapters to users
   * - Validation of adapter configuration
   * - Logging and diagnostics
   * - Generating help messages
   * 
   * @example
   * ```typescript
   * const supported = registry.getSupportedAdapters();
   * console.log(`Supported adapters: ${supported.join(', ')}`);
   * // Output: "Supported adapters: gradle, maven, npm"
   * ```
   */
  getSupportedAdapters(): string[] {
    return this.supportedAdapters;
  }
}
