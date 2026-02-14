import { AdapterIdentifierRegistry } from "../services/adapter-identifier-registry.js";
import { PluginContract } from "../plugins/plugin-loader.js";

/**
 * Creates and configures the global adapter identifier registry.
 *
 * @returns Configured {@link AdapterIdentifierRegistry} with all available adapters
 */
export function createAdapterIdentifierRegistry(
  plugins: PluginContract[],
): AdapterIdentifierRegistry {
  // Array of all registered adapter identifiers
  // Order matters: first matching adapter is selected during auto-detection
  const identifiers = plugins.flatMap((plugin) =>
    plugin.adapters.map((adapter) => adapter.adapterIdentifier()),
  );

  // Create and return the registry with all registered identifiers
  return new AdapterIdentifierRegistry(identifiers);
}
