import * as path from "path";
import { exists } from "../utils/file.js";
import { logger } from "../utils/logger.js";
import type { AdapterIdentifier } from "../services/adapter-identifier.js";
import type { ModuleSystemFactory } from "../services/module-system-factory.js";
import { ConfigurationValidator } from "../services/configuration-validator.js";
import { getNodeModulesPath } from "../utils/node.js";
import { getPluginPath } from "../utils/plugins.js";
import fg from "fast-glob";

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

export class PluginLoader {
  private readonly pluginsMap: Map<string, PluginContract> = new Map();

  private localNodeModulesPath?: string;
  private localNodeModulesPathInitialized = false;

  private globalNodeModulesPath?: string;
  private globalNodeModulesPathInitialized = false;

  constructor(
    private readonly pluginValidator: ConfigurationValidator<PluginContract>,
  ) {}

  get plugins(): PluginContract[] {
    return Array.from(this.pluginsMap.values());
  }

  private async initializeNodeModulesPaths() {
    if (!this.localNodeModulesPathInitialized) {
      this.localNodeModulesPath = await getNodeModulesPath(false);
      this.localNodeModulesPathInitialized = true;
    }
    if (!this.globalNodeModulesPathInitialized) {
      this.globalNodeModulesPath = await getNodeModulesPath(true);
      this.globalNodeModulesPathInitialized = true;
    }
  }

  private async getCandidateRoots(): Promise<string[]> {
    await this.initializeNodeModulesPaths();

    const candidateRoots = [
      this.localNodeModulesPath,
      this.globalNodeModulesPath,
    ].filter((root): root is string => !!root);

    if (candidateRoots.length === 0) {
      throw new Error("No node_modules paths available to search for plugins");
    }

    return candidateRoots;
  }

  private async findPluginsInNodeModules(
    nodeModulesPath: string,
  ): Promise<{ name: string; path: string }[]> {
    logger.debug("Searching for plugins in node_modules", { nodeModulesPath });

    const patterns = [
      `${nodeModulesPath}/versu-plugin-*/package.json`,
      `${nodeModulesPath}/@*/versu-plugin-*/package.json`,
      `${nodeModulesPath}/@versu/plugin-*/package.json`,
    ];
    const entries = await fg(patterns, { absolute: true });
    const plugins = entries
      .map((entry) => {
        const parts = entry.split(path.sep);
        const packageIndex =
          parts.findIndex((part) => part === "node_modules") + 1;
        if (packageIndex > 0 && packageIndex < parts.length) {
          return {
            name: parts.slice(packageIndex, parts.length - 1).join(path.sep),
            path: path.join(path.sep, ...parts.slice(0, parts.length - 1)),
          };
        }
      })
      .filter((plugin): plugin is { name: string; path: string } => !!plugin);
    return plugins;
  }

  private async detect(): Promise<void> {
    logger.info("Loading all plugins from node_modules");

    const candidateRoots = await this.getCandidateRoots();

    const loadedPluginIds = new Set<string>();
    const loadedPluginPaths = new Map<string, string>();

    for (const root of candidateRoots) {
      const plugins = await this.findPluginsInNodeModules(root);
      for (const plugin of plugins) {
        if (loadedPluginIds.has(plugin.name)) {
          logger.warning("Plugin already loaded, skipping duplicate", {
            pluginName: plugin.name,
            from: loadedPluginPaths.get(plugin.name),
          });
        } else {
          const loaded = await this.loadPluginFromPath(plugin.path);
          if (loaded) {
            loadedPluginIds.add(plugin.name);
            loadedPluginPaths.set(plugin.name, plugin.path);
          }
        }
      }
    }
  }

  /**
   * 2. Load ONLY the plugins specified in the whitelist
   * @param pluginNames List of package names (e.g. ['my-plugin-alpha', '@scope/my-plugin-beta'])
   */
  public async load(pluginNames: string[]): Promise<void> {
    if (pluginNames.length === 0) {
      logger.info(
        "No plugins specified for loading, defaulting to auto-detect",
      );
      return await this.detect();
    }

    logger.info("Loading plugins", { count: pluginNames.length });

    logger.debug("Plugin loading configuration", { pluginNames });

    const candidateRoots = await this.getCandidateRoots();

    for (const pluginName of pluginNames) {
      const pluginPath = await getPluginPath(candidateRoots, pluginName);
      if (pluginPath) {
        await this.loadPluginFromPath(pluginPath);
      } else {
        logger.error("Plugin could not be found", { pluginName });
      }
    }
  }

  /**
   * 3. Dynamically require the plugin
   */
  private async loadPluginFromPath(absolutePath: string): Promise<boolean> {
    try {
      logger.info("Attempting to load plugin");
      logger.debug("Loading plugin", { path: absolutePath });

      // Dynamic require using the absolute path
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
        return false;
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
    return true;
  }
}
