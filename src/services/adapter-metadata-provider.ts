import * as core from '@actions/core';
import { AdapterMetadata, AdapterIdentifier } from './adapter-identifier.js';
import { AdapterIdentifierRegistry } from './adapter-identifier-registry.js';

/**
 * Configuration options for the adapter metadata provider.
 * 
 * @remarks
 * These options control how the provider determines which adapter to use
 * for the project, either through explicit specification or auto-detection.
 */
export type AdapterMetadataProviderOptions = {
  /**
   * Optional explicit adapter identifier.
   * 
   * @remarks
   * When provided, this value overrides auto-detection and forces the use
   * of a specific adapter. The value should match one of the registered
   * adapter IDs (case-insensitive).
   * 
   * If not provided or undefined, the provider will attempt to auto-detect
   * the appropriate adapter by analyzing the project structure.
   * 
   * @example
   * ```typescript
   * { adapter: 'gradle', repoRoot: '/path/to/project' }
   * ```
   */
  adapter?: string;
  
  /**
   * The absolute path to the repository root directory.
   * 
   * @remarks
   * This path is used for auto-detection when no explicit adapter is specified.
   * The provider will analyze this directory to determine which adapter is
   * appropriate for the project.
   */
  repoRoot: string;
};

/**
 * Provides adapter metadata with support for explicit specification and auto-detection.
 * 
 * @remarks
 * This class implements a two-tier adapter resolution strategy:
 * 1. **Explicit Specification**: If an adapter ID is provided in options, use that adapter
 * 2. **Auto-Detection**: If no adapter is specified, automatically detect from project structure
 * 
 * The provider ensures that only valid, registered adapters are used and provides
 * clear error messages when resolution fails.
 * 
 * **Resolution Flow:**
 * ```
 * getMetadata() → getSpecifiedAdapter() → found? → return metadata
 *                      ↓ not found
 *                 getAutoDetectedAdapter() → found? → return metadata
 *                      ↓ not found
 *                   throw Error
 * ```
 * 
 * @example
 * ```typescript
 * const provider = new AdapterMetadataProvider(
 *   registry,
 *   { repoRoot: '/path/to/project' }
 * );
 * 
 * const metadata = await provider.getMetadata();
 * console.log(`Using adapter: ${metadata.id}`);
 * ```
 */
export class AdapterMetadataProvider {
    /**
     * The normalized adapter ID from options, if provided.
     * 
     * @remarks
     * Stored in lowercase for case-insensitive comparison with registered adapters.
     * Undefined if no explicit adapter was specified in the options.
     */
    private readonly adapterId: string | undefined;

    /**
     * Creates a new adapter metadata provider.
     * 
     * @param adapterIdentifierRegistry - The registry containing all available adapter identifiers
     * @param options - Configuration options for adapter resolution
     * 
     * @remarks
     * The constructor normalizes the adapter ID to lowercase if provided, ensuring
     * case-insensitive adapter lookups. The registry is stored for both explicit
     * lookup and auto-detection operations.
     * 
     * @example
     * ```typescript
     * const provider = new AdapterMetadataProvider(
     *   new AdapterIdentifierRegistry([new GradleAdapterIdentifier()]),
     *   { adapter: 'gradle', repoRoot: '/path/to/project' }
     * );
     * ```
     */
    constructor(
        private readonly adapterIdentifierRegistry: AdapterIdentifierRegistry,
        private readonly options: AdapterMetadataProviderOptions
    ) {
        this.adapterId = options.adapter?.toLowerCase();
    }

    /**
     * Retrieves the metadata for the resolved adapter.
     * 
     * @returns A promise that resolves to the adapter metadata
     * 
     * @throws {Error} If the specified adapter is not supported
     * @throws {Error} If no adapter can be auto-detected
     * 
     * @remarks
     * This is the main entry point for adapter metadata resolution. It implements
     * a fallback strategy:
     * 
     * 1. **Try explicit adapter**: If an adapter was specified in options, validate
     *    and use it
     * 2. **Try auto-detection**: If no adapter specified, attempt to detect from
     *    project structure
     * 3. **Fail with error**: If both strategies fail, throw a descriptive error
     * 
     * The method logs informational messages to help users understand which adapter
     * is being used and how it was determined.
     * 
     * @example
     * ```typescript
     * try {
     *   const metadata = await provider.getMetadata();
     *   console.log(`Adapter: ${metadata.id}`);
     *   console.log(`Supports snapshots: ${metadata.capabilities.supportsSnapshots}`);
     * } catch (error) {
     *   console.error('Failed to resolve adapter:', error.message);
     * }
     * ```
     */
    async getMetadata(): Promise<AdapterMetadata> {
        let identifier = await this.getSpecifiedAdapter();
        if (!identifier) {
            identifier = await this.getAutoDetectedAdapter();
        }
        return identifier.metadata;
    }

    /**
     * Attempts to retrieve the explicitly specified adapter.
     * 
     * @returns A promise that resolves to the {@link AdapterIdentifier} if one was
     *          specified and found, or `null` if no adapter was specified
     * 
     * @throws {Error} If an adapter was specified but is not registered in the registry
     * 
     * @remarks
     * This method handles explicit adapter specification from user configuration.
     * It performs validation to ensure the specified adapter is actually supported.
     * 
     * **Behavior:**
     * - Returns `null` if no adapter ID was provided in options (triggers auto-detection)
     * - Looks up the adapter in the registry if an ID was provided
     * - Throws an error with available adapters if the specified adapter is not found
     * - Logs an informational message when successfully using an explicit adapter
     * 
     * The error message includes all supported adapters to help users correct
     * configuration mistakes.
     * 
     * @example
     * ```typescript
     * // User specifies 'gradle' in configuration
     * const identifier = await provider.getSpecifiedAdapter();
     * // Logs: "📝 Using explicitly provided adapter: gradle"
     * ```
     */
    private async getSpecifiedAdapter(): Promise<AdapterIdentifier | null> {
        if (this.adapterId) {
            const identifier = this.adapterIdentifierRegistry.getIdentifierById(this.adapterId);

            if (!identifier) {
                throw new Error(
                    `Unsupported adapter '${this.adapterId}'. Supported adapters: ${
                        this.adapterIdentifierRegistry.getSupportedAdapters().join(', ')
                    }`
                );
            }

            core.info(`📝 Using explicitly provided adapter: ${this.adapterId}`);

            return identifier;
        }

        return null;
    }

    /**
     * Attempts to automatically detect the appropriate adapter for the project.
     * 
     * @returns A promise that resolves to the auto-detected {@link AdapterIdentifier}
     * 
     * @throws {Error} If no adapter could be detected for the project
     * 
     * @remarks
     * This method is called as a fallback when no explicit adapter is specified.
     * It delegates to the adapter registry to perform project analysis and identify
     * a compatible adapter.
     * 
     * **Auto-Detection Process:**
     * 1. Calls the registry's `identify()` method with the repository root
     * 2. The registry tests each registered adapter in sequence
     * 3. Returns the first adapter that accepts the project
     * 4. Throws a descriptive error if no adapter matches
     * 
     * The error message provides actionable guidance, instructing users to either:
     * - Explicitly specify an adapter in their configuration
     * - Check that their project is supported
     * - Review the documentation for help
     * 
     * Logs an informational message showing which adapter was detected to help
     * users verify the auto-detection worked as expected.
     * 
     * @example
     * ```typescript
     * // Auto-detecting a Gradle project
     * const identifier = await provider.getAutoDetectedAdapter();
     * // Logs: "🔍 Auto-detected adapter: gradle"
     * ```
     */
    private async getAutoDetectedAdapter(): Promise<AdapterIdentifier> {
        const identifier = await this.adapterIdentifierRegistry.identify(this.options.repoRoot);

        if (!identifier) {
            throw new Error(
                'No project adapter could be auto-detected. ' + 
                'Please specify the "adapter" input explicitly in your workflow. ' +
                'Supported adapters: gradle. For more information, see the documentation.'
            );
        }

        core.info(`🔍 Auto-detected adapter: ${identifier.metadata.id}`);

        return identifier;
    }
}
