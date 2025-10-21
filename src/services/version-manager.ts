import { SemVer } from 'semver';
import { ModuleRegistry } from './module-registry.js';
import { VersionUpdateStrategy } from "./version-update-strategy.js";
import { formatSemVer } from '../semver/index.js';

/**
 * Manages version updates for modules with staged commits and batch persistence.
 * 
 * @remarks
 * VersionManager is the central component for coordinating version updates across
 * multiple modules in a repository. It implements a two-phase update strategy:
 * staging updates in memory, then committing them all at once to build files.
 * 
 * **Core Responsibilities:**
 * - Stage version updates for multiple modules in memory
 * - Validate module existence before accepting updates
 * - Batch all updates and commit them atomically
 * - Delegate build system-specific operations to strategies
 * - Provide introspection into pending updates
 * 
 * **Design Pattern: Strategy Pattern**
 * The manager uses the Strategy pattern to separate generic version management
 * logic from build system-specific implementation details:
 * - **VersionManager**: Generic orchestration and staging logic
 * - **VersionUpdateStrategy**: Build system-specific write operations
 * - **ModuleRegistry**: Source of truth for module validation
 * 
 * This separation allows the same manager to work with different build systems
 * (Gradle, Maven, npm) by simply swapping the strategy implementation.
 * 
 * **Two-Phase Update Process:**
 * 
 * 1. **Staging Phase** (In-Memory):
 *    - Call `updateVersion()` for each module needing a version change
 *    - Updates are stored in memory, no files are modified yet
 *    - Can be inspected, modified, or discarded before commit
 *    - Fast and safe - no I/O operations or file locks
 * 
 * 2. **Commit Phase** (Persistent):
 *    - Call `commit()` to write all staged updates to build files
 *    - Single batch operation reduces I/O overhead
 *    - Atomic write ensures consistency
 *    - Delegates to build system-specific strategy
 * 
 * **Why Staged Updates:**
 * 
 * - **Performance**: Batch multiple updates into single file operation
 * - **Atomicity**: All modules updated together or none (on failure)
 * - **Validation**: Verify all updates before persisting
 * - **Flexibility**: Modify or discard updates before commit
 * - **Safety**: No partial updates if error occurs mid-process
 * 
 * **Version Format Handling:**
 * The manager accepts versions in two formats:
 * - **SemVer object**: From semantic versioning calculations
 * - **String**: Pre-formatted version strings
 * 
 * SemVer objects are automatically formatted to strings for storage.
 * 
 * **Lifecycle Pattern:**
 * ```typescript
 * // 1. Create manager with registry and strategy
 * const manager = new VersionManager(registry, strategy);
 * 
 * // 2. Stage version updates
 * manager.updateVersion(':core', '1.2.3');
 * manager.updateVersion(':api', '2.0.0');
 * 
 * // 3. Inspect pending updates (optional)
 * console.log(`${manager.getPendingUpdates().size} updates staged`);
 * 
 * // 4. Commit all updates
 * await manager.commit();
 * ```
 * 
 * **Error Handling:**
 * - `updateVersion()`: Throws if module doesn't exist in registry
 * - `commit()`: May throw if file operations fail (handled by strategy)
 * - Partial commits are avoided - either all updates succeed or none persist
 * 
 * **State Management:**
 * The manager maintains internal state through `pendingUpdates`:
 * - Populated by `updateVersion()` calls
 * - Cleared after successful `commit()`
 * - Can be manually cleared with `clearPendingUpdates()`
 * - Can be inspected with `getPendingUpdates()` and `hasPendingUpdates()`
 * 
 * @example
 * ```typescript
 * // Basic usage: stage and commit updates
 * const manager = new VersionManager(registry, strategy);
 * 
 * // Stage multiple version updates
 * manager.updateVersion(':core', '1.2.3');
 * manager.updateVersion(':api', '2.0.0');
 * manager.updateVersion(':utils', '0.5.1');
 * 
 * // Commit all updates at once
 * await manager.commit();
 * console.log('All versions updated');
 * ```
 * 
 * @example
 * ```typescript
 * // Using SemVer objects from version calculation
 * import { parse } from 'semver';
 * 
 * const manager = new VersionManager(registry, strategy);
 * 
 * // Stage updates with SemVer objects
 * const newVersion = parse('1.2.3')!;
 * manager.updateVersion(':core', newVersion);
 * 
 * // Commit updates
 * await manager.commit();
 * ```
 * 
 * @example
 * ```typescript
 * // Inspecting and validating before commit
 * const manager = new VersionManager(registry, strategy);
 * 
 * manager.updateVersion(':core', '1.2.3');
 * manager.updateVersion(':api', '2.0.0');
 * 
 * // Check pending updates
 * if (manager.hasPendingUpdates()) {
 *   const pending = manager.getPendingUpdates();
 *   console.log(`About to update ${pending.size} modules:`);
 *   
 *   for (const [id, version] of pending) {
 *     console.log(`  ${id} → ${version}`);
 *   }
 *   
 *   // Commit if validation passes
 *   await manager.commit();
 * }
 * ```
 * 
 * @see {@link ModuleRegistry} - Validates module existence
 * @see {@link VersionUpdateStrategy} - Performs build system-specific writes
 * @see {@link formatSemVer} - Formats SemVer objects to strings
 */
export class VersionManager {
  /**
   * In-memory store of pending version updates awaiting commit.
   * 
   * @remarks
   * This map stores staged version updates before they are persisted to build files.
   * 
   * **Map Structure:**
   * - **Key**: Module ID (e.g., `':'`, `':core'`, `':core:api'`)
   * - **Value**: New version string (e.g., `'1.2.3'`, `'2.0.0-beta.1'`)
   * 
   * **State Transitions:**
   * - Empty initially
   * - Populated by `updateVersion()` calls
   * - Read by `commit()` during persistence
   * - Cleared after successful `commit()`
   * - Can be manually cleared with `clearPendingUpdates()`
   * 
   * **Immutability:**
   * This field is readonly to prevent external code from replacing the Map instance.
   * However, the Map contents are mutable through the class's public API.
   * 
   * @private
   */
  private readonly pendingUpdates = new Map<string, string>();

  /**
   * Creates a new VersionManager instance.
   * 
   * @param hierarchyManager - Registry containing all discovered modules for validation
   * @param strategy - Build system-specific strategy for writing version updates
   * 
   * @remarks
   * The constructor establishes the two key dependencies for version management:
   * 
   * **Module Registry (hierarchyManager):**
   * - Used to validate that modules exist before staging updates
   * - Provides module metadata if needed during update process
   * - Ensures updates target valid, discovered modules
   * - Read-only access - registry is never modified
   * 
   * **Version Update Strategy:**
   * - Encapsulates build system-specific update logic
   * - Handles file I/O operations during commit
   * - Knows where and how to write versions for the build system
   * - Called only during `commit()`, not during staging
   * 
   * **Dependency Injection:**
   * Both dependencies are injected via constructor, enabling:
   * - Testability (can inject mocks)
   * - Flexibility (can use different strategies)
   * - Separation of concerns (manager doesn't create dependencies)
   * 
   * @example
   * ```typescript
   * // Create manager with detected modules and Gradle strategy
   * const registry = await detector.detect();
   * const strategy = factory.createVersionUpdateStrategy();
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Manager is ready to stage and commit updates
   * manager.updateVersion(':core', '1.2.3');
   * await manager.commit();
   * ```
   * 
   * @example
   * ```typescript
   * // Complete setup from factory
   * const factory = createModuleSystemFactory('gradle', '/path/to/repo');
   * const detector = factory.createDetector();
   * const registry = await detector.detect();
   * const strategy = factory.createVersionUpdateStrategy();
   * 
   * // Create manager with factory-created components
   * const manager = new VersionManager(registry, strategy);
   * ```
   */
  constructor(
    private readonly hierarchyManager: ModuleRegistry,
    private readonly strategy: VersionUpdateStrategy
  ) { }

  /**
   * Stages a version update for a module in memory without persisting to files.
   * 
   * @param moduleId - The unique identifier of the module to update (e.g., `':'`, `':core'`)
   * @param newVersion - The new version as a SemVer object or formatted string
   * 
   * @throws {Error} If the module ID does not exist in the registry.
   *   Error message format: `"Module {moduleId} not found"`
   * 
   * @remarks
   * This method stages a version update in memory for later batch commit. It does not
   * immediately modify any build files, allowing multiple updates to be staged and
   * committed together efficiently.
   * 
   * **Staging Process:**
   * 
   * 1. **Validation:**
   *    - Checks if module exists in the registry
   *    - Throws error if module not found
   *    - Prevents updates to non-existent modules
   * 
   * 2. **Format Conversion:**
   *    - SemVer objects are converted to strings via `formatSemVer()`
   *    - String versions are used as-is
   *    - Consistent string format for all stored versions
   * 
   * 3. **Storage:**
   *    - Update is stored in `pendingUpdates` map
   *    - Replaces any previous update for the same module
   *    - No file I/O operations performed
   * 
   * **Version Format:**
   * Versions can be provided in two formats:
   * 
   * - **SemVer Object**: From `semver` library
   *   ```typescript
   *   import { parse } from 'semver';
   *   const version = parse('1.2.3')!;
   *   manager.updateVersion(':core', version);
   *   ```
   * 
   * - **String**: Pre-formatted version string
   *   ```typescript
   *   manager.updateVersion(':core', '1.2.3');
   *   manager.updateVersion(':api', '2.0.0-beta.1');
   *   ```
   * 
   * **Update Behavior:**
   * - Multiple calls for the same module ID replace previous staged updates
   * - Last call wins if multiple updates staged for same module
   * - Updates remain staged until `commit()` or `clearPendingUpdates()` called
   * 
   * **Performance:**
   * - O(1) operation - simple map insertion
   * - No I/O operations - very fast
   * - Can stage thousands of updates quickly
   * 
   * **When to Use:**
   * - After calculating new versions from commits
   * - When preparing batch version updates
   * - Before verifying all updates are valid
   * - As part of automated version bumping workflow
   * 
   * @example
   * ```typescript
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates for multiple modules
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * manager.updateVersion(':utils', '0.5.1');
   * 
   * // Updates are staged but not yet persisted
   * console.log(`Staged ${manager.getPendingUpdates().size} updates`);
   * ```
   * 
   * @example
   * ```typescript
   * // Stage updates with SemVer objects
   * import { parse, inc } from 'semver';
   * 
   * const manager = new VersionManager(registry, strategy);
   * 
   * for (const id of registry.getModuleIds()) {
   *   const module = registry.getModule(id);
   *   const currentVersion = parse(module.version)!;
   *   const newVersion = inc(currentVersion, 'patch')!;
   *   
   *   manager.updateVersion(id, newVersion);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Replace staged update (last call wins)
   * const manager = new VersionManager(registry, strategy);
   * 
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':core', '1.2.4'); // Replaces previous
   * 
   * const pending = manager.getPendingUpdates();
   * console.log(pending.get(':core')); // "1.2.4"
   * ```
   * 
   * @example
   * ```typescript
   * // Error handling for non-existent modules
   * const manager = new VersionManager(registry, strategy);
   * 
   * try {
   *   manager.updateVersion(':nonexistent', '1.0.0');
   * } catch (error) {
   *   console.error(error.message); // "Module :nonexistent not found"
   * }
   * ```
   * 
   * @see {@link commit} - Persists staged updates to build files
   * @see {@link getPendingUpdates} - Retrieves all staged updates
   * @see {@link clearPendingUpdates} - Discards staged updates
   */
  updateVersion(moduleId: string, newVersion: SemVer | string): void {
    // Validate module exists in registry
    if (!this.hierarchyManager.hasModule(moduleId)) {
        throw new Error(`Module ${moduleId} not found`);
    }
    
    // Convert SemVer to string if needed, otherwise use string directly
    const versionString = typeof newVersion === 'string' ? newVersion : formatSemVer(newVersion);
    
    // Store update in pending updates map
    this.pendingUpdates.set(moduleId, versionString);
  }

  /**
   * Commits all pending version updates to build system files in a single batch operation.
   * 
   * @returns A promise that resolves when all updates have been successfully written
   * 
   * @throws {Error} If file write operations fail (specific errors depend on strategy implementation)
   * @throws {Error} If build files are not writable or missing
   * @throws {Error} If version format is invalid for the build system
   * 
   * @remarks
   * This method persists all staged version updates to the appropriate build system
   * files. It delegates the actual file operations to the {@link VersionUpdateStrategy},
   * which knows how to update versions for the specific build system.
   * 
   * **Commit Process:**
   * 
   * 1. **Pre-check:**
   *    - If no pending updates, return immediately (no-op)
   *    - Avoids unnecessary file operations
   * 
   * 2. **Batch Write:**
   *    - Pass all pending updates to strategy's `writeVersionUpdates()`
   *    - Strategy handles build system-specific write logic
   *    - Single operation updates all modules together
   * 
   * 3. **State Cleanup:**
   *    - Clear `pendingUpdates` map after successful write
   *    - Manager returns to empty state, ready for new updates
   * 
   * **Atomicity Guarantees:**
   * The commit is designed to be atomic at the build file level:
   * - Gradle: Single write to gradle.properties file
   * - Maven: (Future) Single write to each pom.xml with proper backup
   * - npm: (Future) Single write to each package.json
   * 
   * If the write operation fails, pending updates remain staged and can be:
   * - Retried by calling `commit()` again
   * - Inspected with `getPendingUpdates()`
   * - Discarded with `clearPendingUpdates()`
   * 
   * **Performance Benefits:**
   * Batch commit provides significant performance advantages:
   * - Single file open/write/close cycle
   * - Reduced I/O operations
   * - Less file system overhead
   * - Faster for repositories with many modules
   * 
   * **Build System Specifics:**
   * - **Gradle**: Updates gradle.properties with all version properties
   * - **Maven**: (Future) Updates version tags in pom.xml files
   * - **npm**: (Future) Updates version fields in package.json files
   * 
   * **Empty Commit:**
   * Calling `commit()` with no pending updates is safe and efficient:
   * - Returns immediately without any file operations
   * - No error thrown
   * - Can be called defensively without checking
   * 
   * **Error Recovery:**
   * If commit fails:
   * - Pending updates remain in memory
   * - No partial writes to build files (atomic operation)
   * - Can inspect error, fix issue, and retry
   * - Can clear pending updates if recovery not possible
   * 
   * @example
   * ```typescript
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage multiple updates
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Commit all at once
   * await manager.commit();
   * console.log('All versions written to build files');
   * 
   * // Manager is now empty, ready for new updates
   * console.log(manager.hasPendingUpdates()); // false
   * ```
   * 
   * @example
   * ```typescript
   * // Safe empty commit
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Commit with no pending updates (no-op)
   * await manager.commit(); // Returns immediately, no error
   * ```
   * 
   * @example
   * ```typescript
   * // Error handling and retry
   * const manager = new VersionManager(registry, strategy);
   * 
   * manager.updateVersion(':core', '1.2.3');
   * 
   * try {
   *   await manager.commit();
   * } catch (error) {
   *   console.error('Commit failed:', error.message);
   *   
   *   // Updates still staged, can retry
   *   console.log(`${manager.getPendingUpdates().size} updates still pending`);
   *   
   *   // Fix issue (e.g., file permissions) then retry
   *   await manager.commit();
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Complete workflow with validation
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Validate before commit
   * const pending = manager.getPendingUpdates();
   * console.log(`Ready to update ${pending.size} modules`);
   * 
   * for (const [id, version] of pending) {
   *   console.log(`  ${id} → ${version}`);
   * }
   * 
   * // User confirmation (in interactive scenarios)
   * const confirmed = await askUser('Proceed with updates?');
   * if (confirmed) {
   *   await manager.commit();
   *   console.log('Updates committed');
   * } else {
   *   manager.clearPendingUpdates();
   *   console.log('Updates discarded');
   * }
   * ```
   * 
   * @see {@link updateVersion} - Stages updates for commit
   * @see {@link VersionUpdateStrategy.writeVersionUpdates} - Performs actual file writes
   * @see {@link getPendingUpdates} - Inspects staged updates before commit
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
   * Retrieves a copy of all pending version updates that haven't been committed yet.
   * 
   * @returns A new Map containing all staged updates (module ID → version string)
   * 
   * @remarks
   * This method provides read-only access to pending updates for inspection,
   * validation, or logging purposes. It returns a copy of the internal map,
   * preventing external code from modifying the manager's state.
   * 
   * **Use Cases:**
   * - Validate staged updates before committing
   * - Display pending changes to users for confirmation
   * - Log version updates for audit purposes
   * - Debug update staging logic
   * - Generate update summaries or reports
   * 
   * **Copy Semantics:**
   * The returned Map is a shallow copy:
   * - Modifying the returned Map doesn't affect the manager's state
   * - Safe to iterate, filter, or transform without side effects
   * - New copy created on each call (not cached)
   * 
   * **Performance Note:**
   * Creates a new Map on each call. For frequently called code or large update sets,
   * consider caching the result:
   * ```typescript
   * const pending = manager.getPendingUpdates(); // Cache this
   * // Use 'pending' multiple times
   * ```
   * 
   * **Empty Updates:**
   * Returns an empty Map if no updates are staged:
   * ```typescript
   * const pending = manager.getPendingUpdates();
   * if (pending.size === 0) {
   *   console.log('No pending updates');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * const manager = new VersionManager(registry, strategy);
   * 
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Inspect pending updates
   * const pending = manager.getPendingUpdates();
   * console.log(`Pending updates: ${pending.size}`);
   * 
   * for (const [id, version] of pending) {
   *   console.log(`  ${id} → ${version}`);
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Validate updates before commit
   * const manager = new VersionManager(registry, strategy);
   * 
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * const pending = manager.getPendingUpdates();
   * 
   * // Check for specific modules
   * if (!pending.has(':core')) {
   *   throw new Error('Core module update missing');
   * }
   * 
   * // Validate version formats
   * for (const [id, version] of pending) {
   *   if (!version.match(/^\d+\.\d+\.\d+$/)) {
   *     throw new Error(`Invalid version format for ${id}: ${version}`);
   *   }
   * }
   * 
   * // Commit if validation passes
   * await manager.commit();
   * ```
   * 
   * @example
   * ```typescript
   * // Generate update summary
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates...
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Generate summary
   * const pending = manager.getPendingUpdates();
   * const summary = Array.from(pending)
   *   .map(([id, version]) => {
   *     const module = registry.getModule(id);
   *     return `${module.name}: ${module.version} → ${version}`;
   *   })
   *   .join('\n');
   * 
   * console.log('Version Update Summary:\n' + summary);
   * ```
   * 
   * @example
   * ```typescript
   * // Safe to modify returned Map (doesn't affect manager)
   * const manager = new VersionManager(registry, strategy);
   * manager.updateVersion(':core', '1.2.3');
   * 
   * const pending = manager.getPendingUpdates();
   * pending.set(':api', '2.0.0'); // Doesn't affect manager
   * pending.delete(':core');      // Doesn't affect manager
   * 
   * // Manager's state unchanged
   * console.log(manager.getPendingUpdates().size); // Still 1
   * console.log(manager.getPendingUpdates().has(':core')); // Still true
   * ```
   * 
   * @see {@link hasPendingUpdates} - Check if any updates are pending
   * @see {@link updateVersion} - Stage new updates
   * @see {@link commit} - Persist pending updates
   */
  getPendingUpdates(): Map<string, string> {
    return new Map(this.pendingUpdates);
  }

  /**
   * Checks whether there are any pending version updates awaiting commit.
   * 
   * @returns `true` if updates are staged, `false` if no pending updates
   * 
   * @remarks
   * This method provides a quick boolean check for pending updates, useful for:
   * - Conditional logic before commit operations
   * - Validation that updates were staged successfully
   * - Defensive programming to avoid unnecessary commits
   * - Status reporting in workflows
   * 
   * **Performance:**
   * - O(1) operation - checks map size
   * - Very fast, safe to call frequently
   * - No memory allocation or copying
   * 
   * **Common Patterns:**
   * ```typescript
   * // Conditional commit
   * if (manager.hasPendingUpdates()) {
   *   await manager.commit();
   * }
   * 
   * // Status check
   * const status = manager.hasPendingUpdates() ? 'ready' : 'empty';
   * 
   * // Validation after staging
   * manager.updateVersion(':core', '1.2.3');
   * assert(manager.hasPendingUpdates(), 'Update should be staged');
   * ```
   * 
   * **State Transitions:**
   * - Returns `false` initially (no updates staged)
   * - Returns `true` after `updateVersion()` calls
   * - Returns `false` after `commit()` completes successfully
   * - Returns `false` after `clearPendingUpdates()` called
   * 
   * @example
   * ```typescript
   * const manager = new VersionManager(registry, strategy);
   * 
   * console.log(manager.hasPendingUpdates()); // false
   * 
   * manager.updateVersion(':core', '1.2.3');
   * console.log(manager.hasPendingUpdates()); // true
   * 
   * await manager.commit();
   * console.log(manager.hasPendingUpdates()); // false
   * ```
   * 
   * @example
   * ```typescript
   * // Conditional commit to avoid no-op
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates based on some condition
   * if (shouldUpdateCore) {
   *   manager.updateVersion(':core', '1.2.3');
   * }
   * 
   * // Only commit if something was staged
   * if (manager.hasPendingUpdates()) {
   *   await manager.commit();
   *   console.log('Updates committed');
   * } else {
   *   console.log('No updates to commit');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Status reporting in workflow
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Calculate and stage updates
   * for (const id of moduleIds) {
   *   const newVersion = calculateVersion(id);
   *   if (newVersion) {
   *     manager.updateVersion(id, newVersion);
   *   }
   * }
   * 
   * // Report status
   * if (manager.hasPendingUpdates()) {
   *   const count = manager.getPendingUpdates().size;
   *   console.log(`${count} modules require version updates`);
   *   await manager.commit();
   * } else {
   *   console.log('No version changes required');
   * }
   * ```
   * 
   * @see {@link getPendingUpdates} - Get detailed pending update information
   * @see {@link commit} - Persist pending updates
   * @see {@link clearPendingUpdates} - Discard pending updates
   */
  hasPendingUpdates(): boolean {
    return this.pendingUpdates.size > 0;
  }

  /**
   * Clears all pending version updates without committing them to build files.
   * 
   * @remarks
   * This method discards all staged updates, returning the manager to an empty state.
   * Use with caution as this operation cannot be undone - all staged updates are lost.
   * 
   * **Use Cases:**
   * 
   * - **Error Recovery**: Discard updates after validation failure
   *   ```typescript
   *   if (!isValid(pending)) {
   *     manager.clearPendingUpdates();
   *   }
   *   ```
   * 
   * - **User Cancellation**: Discard updates when user cancels operation
   *   ```typescript
   *   if (!await confirmUpdates()) {
   *     manager.clearPendingUpdates();
   *   }
   *   ```
   * 
   * - **Retry Logic**: Clear failed updates before retry
   *   ```typescript
   *   catch (error) {
   *     manager.clearPendingUpdates();
   *     // Recalculate and stage new updates
   *   }
   *   ```
   * 
   * - **Testing**: Reset manager state between test cases
   *   ```typescript
   *   afterEach(() => {
   *     manager.clearPendingUpdates();
   *   });
   *   ```
   * 
   * **Effect:**
   * - Removes all entries from `pendingUpdates` map
   * - Manager returns to empty state
   * - `hasPendingUpdates()` returns `false`
   * - `getPendingUpdates()` returns empty Map
   * - No file operations performed
   * 
   * **Safety Considerations:**
   * - Operation is immediate and cannot be undone
   * - No confirmation prompt or warning
   * - Lost updates must be recalculated and re-staged
   * - Consider saving pending updates before clearing if recovery might be needed
   * 
   * **Performance:**
   * - O(1) operation - clears map in constant time
   * - No I/O operations
   * - Very fast regardless of number of staged updates
   * 
   * @example
   * ```typescript
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage some updates
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * console.log(manager.hasPendingUpdates()); // true
   * 
   * // Clear all pending updates
   * manager.clearPendingUpdates();
   * 
   * console.log(manager.hasPendingUpdates()); // false
   * console.log(manager.getPendingUpdates().size); // 0
   * ```
   * 
   * @example
   * ```typescript
   * // Validation with rollback
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Validate updates
   * const pending = manager.getPendingUpdates();
   * 
   * try {
   *   validateVersions(pending);
   *   await manager.commit();
   * } catch (error) {
   *   console.error('Validation failed:', error);
   *   manager.clearPendingUpdates();
   *   console.log('Updates discarded');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // User confirmation workflow
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Show pending updates to user
   * const pending = manager.getPendingUpdates();
   * console.log('Pending updates:');
   * for (const [id, version] of pending) {
   *   console.log(`  ${id} → ${version}`);
   * }
   * 
   * // Ask for confirmation
   * const confirmed = await askUser('Commit these updates?');
   * 
   * if (confirmed) {
   *   await manager.commit();
   *   console.log('Updates committed');
   * } else {
   *   manager.clearPendingUpdates();
   *   console.log('Updates cancelled');
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Save before clear (for potential recovery)
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates
   * manager.updateVersion(':core', '1.2.3');
   * 
   * // Save pending updates before clearing
   * const backup = manager.getPendingUpdates();
   * manager.clearPendingUpdates();
   * 
   * // Later: restore from backup if needed
   * for (const [id, version] of backup) {
   *   manager.updateVersion(id, version);
   * }
   * ```
   * 
   * @see {@link hasPendingUpdates} - Check if updates exist before clearing
   * @see {@link getPendingUpdates} - Retrieve updates before clearing
   * @see {@link updateVersion} - Re-stage updates after clearing
   */
  clearPendingUpdates(): void {
    this.pendingUpdates.clear();
  }
}
