import { ModuleSystemFactory } from "../services/module-system-factory.js";
import { AdapterPluginContract } from "../plugins/plugin-loader.js";

/**
 * Creates the appropriate module system factory for a given adapter.
 * @param adapterName - The identifier of the build system adapter (e.g., 'gradle', 'maven', 'npm')
 * @param repoRoot - The absolute path to the repository root directory
 * @returns A ModuleSystemFactory instance configured for the specified adapter
 * @throws {Error} If the adapter name is not recognized or supported
 */
export function createModuleSystemFactory(
  adapterName: string,
  adapterPlugins: AdapterPluginContract[],
  repoRoot: string,
): ModuleSystemFactory {
  const lowerCasedAdapterName = adapterName.toLowerCase();
  const candidatePlugin = adapterPlugins.find(
    (plugin) => plugin.id.toLowerCase() === lowerCasedAdapterName,
  );
  if (!candidatePlugin) {
    throw new Error(`Unsupported adapter: ${adapterName}`);
  }
  return candidatePlugin.moduleSystemFactory(repoRoot);
}
