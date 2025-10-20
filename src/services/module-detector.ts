import { ModuleRegistry } from "./module-registry.js";

export interface ModuleDetector {
  readonly repoRoot: string;

  /**
   * Detect all modules in the repository and return a module manager
   */
  detect(): Promise<ModuleRegistry>;
}
