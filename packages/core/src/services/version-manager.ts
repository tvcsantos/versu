import { ModuleRegistry } from "./module-registry.js";
import { VersionUpdateStrategy } from "./version-update-strategy.js";
import { formatSemVer, Version } from "../semver/index.js";

/**
 * Manages version updates for modules with staged commits and batch persistence.
 *
 * @remarks
 * Implements a two-phase update strategy:
 * 1. Stage updates in memory via `updateVersion()`
 * 2. Persist all updates via `commit()`
 *
 * Uses {@link VersionUpdateStrategy} for build system-specific operations.
 * Validates modules against {@link ModuleRegistry}.
 */
export class VersionManager {
  /** Pending version updates awaiting commit (module ID → version string). */
  private readonly pendingUpdates = new Map<string, string>();

  /**
   * Creates a new VersionManager.
   *
   * @param moduleRegistry - Module registry for validation
   * @param strategy - Build system-specific strategy for writing updates
   */
  constructor(
    private readonly moduleRegistry: ModuleRegistry,
    private readonly strategy: VersionUpdateStrategy,
  ) {}

  /**
   * Stages a version update for a module without persisting to files.
   *
   * @param moduleId - Module identifier (e.g., `':'`, `':core'`)
   * @param newVersion - New version as SemVer object or string
   * @throws {Error} If module ID doesn't exist in registry
   */
  updateVersion(moduleId: string, newVersion: Version | string): void {
    // Validate module exists in registry
    if (!this.moduleRegistry.hasModule(moduleId)) {
      throw new Error(`Module ${moduleId} not found`);
    }

    // Convert SemVer to string if needed, otherwise use string directly
    const versionString =
      typeof newVersion === "string" ? newVersion : formatSemVer(newVersion);

    // Store update in pending updates map
    this.pendingUpdates.set(moduleId, versionString);
  }

  /**
   * Commits all pending version updates to build files in a single batch operation.
   *
   * @returns Promise that resolves when all updates are written
   * @throws {Error} If file operations fail (specific errors depend on strategy)
   */
  async commit(): Promise<void> {
    // Early return if nothing to commit
    if (this.pendingUpdates.size === 0) {
      return; // Nothing to commit
    }

    // Write all version updates using build system-specific strategy
    await this.strategy.writeVersionUpdates(this.pendingUpdates);

    // Clear the pending updates after successful commit
    this.pendingUpdates.clear();
  }

  /**
   * Returns a copy of all pending updates that haven't been committed.
   *
   * @returns Map of module ID to version string
   */
  getPendingUpdates(): Map<string, string> {
    return new Map(this.pendingUpdates);
  }

  /**
   * Checks whether there are any pending updates awaiting commit.
   *
   * @returns `true` if updates are staged, `false` otherwise
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0;
  }

  /**
   * Clears all pending updates without committing them.
   *
   * @remarks
   * Use with caution - this operation cannot be undone.
   */
  clearPendingUpdates(): void {
    this.pendingUpdates.clear();
  }

  /**
   * Gets the number of pending updates in the queue.
   *
   * @returns The count of pending updates that have not been processed yet.
   */
  getPendingUpdatesCount(): number {
    return this.pendingUpdates.size;
  }
}
