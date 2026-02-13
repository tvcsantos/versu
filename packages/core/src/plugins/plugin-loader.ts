import { AdapterIdentifier } from "../services/adapter-identifier.js";
import { ModuleSystemFactory } from "../services/module-system-factory.js";
import * as path from "path";
import { execa } from "execa";
import { exists } from "../utils/file.js";
import { logger } from "../utils/logger.js";

export type PluginContract = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  adapters: AdapterPluginContract[];
};

export type AdapterPluginContract = {
  id: string;
  adapterIdentifier: () => AdapterIdentifier;
  moduleSystemFactory: (repoRoot: string) => ModuleSystemFactory;
};

export type PluginLoaderOptions = {
  plugins: string[];
};

export class PluginLoader {
  private readonly _plugins: Map<string, PluginContract> = new Map();

  get plugins(): PluginContract[] {
    return Array.from(this._plugins.values());
  }

  /**
   * 1. Find the global node_modules path
   * This is safer than guessing strings because it varies by OS (Windows vs Mac)
   */
  private async getGlobalNodeModulesPath(): Promise<string> {
    try {
      // Ask npm where the global root is
      const { stdout } = await execa("npm", ["root", "-g"], {
        encoding: "utf8",
      });
      const root = stdout.trim();
      return root;
    } catch (e) {
      logger.error("Could not determine global path");
      return "";
    }
  }

  /**
   * 2. Load ONLY the plugins specified in the whitelist
   * @param pluginNames List of package names (e.g. ['my-plugin-alpha', '@scope/my-plugin-beta'])
   */
  public async loadSelectedPlugins(pluginNames: string[]) {
    logger.info(`🔍 Loading plugins...`);
    const globalRoot = await this.getGlobalNodeModulesPath();

    if (!globalRoot || !(await exists(globalRoot))) {
      logger.error(`❌ Global node_modules not found at: ${globalRoot}`);
      return;
    }

    logger.info(`Plugins to load: ${pluginNames.join(", ")}`);
    pluginNames.forEach(async (pluginName) => {
      // Construct the absolute path to the specific package
      const pluginPath = path.join(globalRoot, pluginName);

      if (await exists(pluginPath)) {
        await this.loadSinglePlugin(pluginPath);
      } else {
        logger.warning(
          `⚠️  Plugin not found: ${pluginName} (looked in ${globalRoot})`,
        );
        logger.warning(`   Run 'npm install -g ${pluginName}' to fix this.`);
      }
    });
  }

  /**
   * 3. Dynamically require the plugin
   */
  private async loadSinglePlugin(absolutePath: string) {
    try {
      // Dynamic require using the absolute path
      // Note: If using ESM (import), use await import(absolutePath)
      const rawModule = await import(absolutePath);

      // Handle both "export default" and "module.exports"
      const plugin: PluginContract = rawModule.default;

      const isValid = this.isValidPlugin(plugin);
      const isAlreadyLoaded = this._plugins.has(plugin.id);

      if (!isValid) {
        logger.error(
          `❌ Invalid plugin structure at ${absolutePath}. Missing required properties or methods.`,
        );
        return;
      }

      if (isAlreadyLoaded) {
        logger.warning(
          `⚠️  Plugin with ID '${plugin.id}' is already loaded. Skipping duplicate from ${absolutePath}.`,
        );
        return;
      }

      this._plugins.set(plugin.id, plugin);
      logger.info(`✅ Loaded: ${plugin.name}`);
    } catch (err) {
      logger.error(`❌ Failed to load plugin at ${absolutePath}`, {
        error: err,
      });
    }
  }

  private isValidPlugin(plugin: any): plugin is PluginContract {
    return plugin && typeof plugin.onInit === "function";
  }
}
