import * as path from "path";
import { execa } from "execa";
import { exists } from "../utils/file.js";
import { logger } from "../utils/logger.js";
import type { AdapterIdentifier } from "../services/adapter-identifier.js";
import type { ModuleSystemFactory } from "../services/module-system-factory.js";
import {
  ConfigurationValidator,
} from "../services/configuration-validator.js";

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
  private readonly pluginsMap: Map<string, PluginContract> = new Map();

  constructor(
    private readonly pluginValidator: ConfigurationValidator<PluginContract>,
  ) {}

  get plugins(): PluginContract[] {
    return Array.from(this.pluginsMap.values());
  }

  /**
   * 1. Find the global node_modules path
   * This is safer than guessing strings because it varies by OS (Windows vs Mac)
   */
  private async getGlobalNodeModulesPath(): Promise<string> {
    try {
      logger.debug("Determining global node_modules path");

      // Ask npm where the global root is
      const { stdout } = await execa("npm", ["root", "-g"], {
        encoding: "utf8",
      });
      const root = stdout.trim();

      logger.debug("npm global root found", { root });

      if (root && (await exists(root))) {
        logger.debug("Global node_modules path resolved", { path: root });
        return root;
      }

      throw new Error(`Global node_modules path does not exist: ${root}`);
    } catch (e) {
      logger.error("Could not determine global node_modules path", {
        error: e,
      });
      return "";
    }
  }

  /**
   * 2. Load ONLY the plugins specified in the whitelist
   * @param pluginNames List of package names (e.g. ['my-plugin-alpha', '@scope/my-plugin-beta'])
   */
  public async load(pluginNames: string[]) {
    logger.info("Loading plugins", { count: pluginNames.length });

    logger.debug("Plugin loading configuration", { pluginNames });

    const globalRoot = await this.getGlobalNodeModulesPath();

    if (!globalRoot || !(await exists(globalRoot))) {
      logger.error("Global node_modules not found", { path: globalRoot });
      return;
    }

    for (const pluginName of pluginNames) {
      // Construct the absolute path to the specific package
      const pluginPath = path.join(globalRoot, pluginName);

      if (await exists(pluginPath)) {
        await this.loadSinglePlugin(pluginPath);
      } else {
        logger.warning("Plugin not found", {
          plugin: pluginName,
          searchPath: globalRoot,
          suggestion: `Run 'npm install -g ${pluginName}' to install`,
        });
      }
    }
  }

  /**
   * 3. Dynamically require the plugin
   */
  private async loadSinglePlugin(absolutePath: string) {
    try {
      logger.info("Attempting to load plugin", { path: absolutePath });

      // Dynamic require using the absolute path
      // Note: If using ESM (import), use await import(absolutePath)
      // For directory imports, we need to resolve to the main entry point
      const pluginEntryPoint = path.join(absolutePath, "dist/index.js");
      const importPath = (await exists(pluginEntryPoint))
        ? pluginEntryPoint
        : absolutePath;
      const rawModule = await import(importPath);

      const plugin = this.pluginValidator.validate(rawModule.default);

      const isAlreadyLoaded = this.pluginsMap.has(plugin.id);

      if (isAlreadyLoaded) {
        logger.warning("Plugin already loaded, skipping duplicate", {
          pluginId: plugin.id,
          path: absolutePath,
        });
        return;
      }

      this.pluginsMap.set(plugin.id, plugin);

      logger.info(`Plugin loaded`, {
        name: plugin.name,
        id: plugin.id,
        version: plugin.version,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error("Failed to load plugin", {
        path: absolutePath,
        error: errorMessage,
      });
    }
  }
}
