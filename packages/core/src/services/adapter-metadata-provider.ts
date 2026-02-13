import { logger } from "../utils/logger.js";
import { AdapterMetadata, AdapterIdentifier } from "./adapter-identifier.js";
import { AdapterIdentifierRegistry } from "./adapter-identifier-registry.js";

/**
 * Configuration options for the adapter metadata provider.
 */
export type AdapterMetadataProviderOptions = {
  /**
   * Optional explicit adapter identifier. When provided, overrides auto-detection.
   */
  adapter?: string;

  /**
   * The absolute path to the repository root directory.
   */
  repoRoot: string;
};

/**
 * Provides adapter metadata with support for explicit specification and auto-detection.
 */
export class AdapterMetadataProvider {
  /**
   * The normalized adapter ID from options, if provided.
   */
  private readonly adapterId: string | undefined;

  /**
   * Creates a new adapter metadata provider.
   * @param adapterIdentifierRegistry - The registry containing all available adapter identifiers
   * @param options - Configuration options for adapter resolution
   */
  constructor(
    private readonly adapterIdentifierRegistry: AdapterIdentifierRegistry,
    private readonly options: AdapterMetadataProviderOptions,
  ) {
    this.adapterId = options.adapter?.toLowerCase();
  }

  /**
   * Retrieves the metadata for the resolved adapter.
   * @returns A promise that resolves to the adapter metadata
   * @throws {Error} If the specified adapter is not supported or no adapter can be auto-detected
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
   * @returns A promise that resolves to the adapter if specified and found, or `null` if not specified
   * @throws {Error} If an adapter was specified but is not registered in the registry
   */
  private async getSpecifiedAdapter(): Promise<AdapterIdentifier | null> {
    if (!this.adapterId) return null;

    const identifier = this.adapterIdentifierRegistry.getIdentifierById(
      this.adapterId,
    );

    if (!identifier) {
      throw new Error(
        `Unsupported adapter '${this.adapterId}'. Supported adapters: ${this.adapterIdentifierRegistry
          .getSupportedAdapters()
          .join(", ")}`,
      );
    }

    logger.info(`📝 Using explicitly provided adapter: ${this.adapterId}`);

    return identifier;
  }

  /**
   * Attempts to automatically detect the appropriate adapter for the project.
   * @returns A promise that resolves to the auto-detected adapter
   * @throws {Error} If no adapter could be detected for the project
   */
  private async getAutoDetectedAdapter(): Promise<AdapterIdentifier> {
    const identifier = await this.adapterIdentifierRegistry.identify(
      this.options.repoRoot,
    );

    if (!identifier) {
      throw new Error(
        "No project adapter could be auto-detected. " +
          'Please specify the "adapter" input explicitly in your workflow. ' +
          "Supported adapters: " +
          this.adapterIdentifierRegistry.getSupportedAdapters().join(", ") +
          ". For more information, see the documentation.",
      );
    }

    logger.info(`🔍 Auto-detected adapter: ${identifier.metadata.id}`);

    return identifier;
  }
}
