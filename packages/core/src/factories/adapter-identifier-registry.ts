import { AdapterIdentifier } from "../services/adapter-identifier.js";
import { AdapterIdentifierRegistry } from "../services/adapter-identifier-registry.js";
import { PluginContract } from "../plugins/plugin-loader.js";

/**
 * Creates and configures the global adapter identifier registry.
 *
 * @returns Configured {@link AdapterIdentifierRegistry} with all available adapters
 *
 * @remarks
 * Central point for registering all supported project adapters.
 * To add a new adapter, implement {@link AdapterIdentifier} and add it to the array.
 */
export function createAdapterIdentifierRegistry(plugins: PluginContract[]): AdapterIdentifierRegistry {
  // Array of all registered adapter identifiers
  // Order matters: first matching adapter is selected during auto-detection
  const identifiers: AdapterIdentifier[] = [
    // Add future adapter identifiers here as they are implemented:
    // new MavenAdapterIdentifier(),
    // new NodeJSAdapterIdentifier(),
    // new PythonAdapterIdentifier(),
    ...plugins.flatMap((plugin) => plugin.adapters.map(adapter => adapter.adapterIdentifier())),
  ];

  // Create and return the registry with all registered identifiers
  return new AdapterIdentifierRegistry(identifiers);
}
