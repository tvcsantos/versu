export type AdapterMetadata = {
  readonly id: string;
  readonly capabilities: AdapterCapabilities
};

export type AdapterCapabilities = {
  readonly supportsSnapshots: boolean;
};

/**
 * Interface for adapter identification.
 * Each adapter should implement this interface to provide auto-discovery capabilities.
 */
export interface AdapterIdentifier {
  /**
   * The metadata for this adapter.
   */
  readonly metadata: AdapterMetadata;

  /**
   * Checks if the given project is accepted by this adapter.
   * @param projectRoot - The root directory of the project to analyze
   * @returns True if the project is accepted, false otherwise
   */
  accept(projectRoot: string): Promise<boolean>;
}
