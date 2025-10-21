/**
 * Strategy interface for writing version updates to build system-specific files.
 * 
 * @remarks
 * VersionUpdateStrategy defines the contract for persisting module version updates
 * to build system configuration files. This abstraction allows VERSE to support
 * multiple build systems (Gradle, Maven, npm) through different strategy implementations
 * while maintaining a unified version management API.
 * 
 * **Core Responsibility:**
 * Translate generic version update requests into build system-specific file operations,
 * handling the unique file formats, locations, and conventions of each build system.
 * 
 * **Strategy Pattern:**
 * This interface is a key component of the Strategy pattern in VERSE's architecture:
 * - {@link VersionManager}: Context that uses the strategy
 * - {@link VersionUpdateStrategy}: Strategy interface (this)
 * - GradleVersionUpdateStrategy, MavenVersionUpdateStrategy, etc.: Concrete strategies
 * 
 * The pattern enables:
 * - Runtime selection of version update algorithm based on build system
 * - Easy addition of new build system support without modifying existing code
 * - Clean separation between version management logic and file I/O operations
 * - Testability through mock strategy implementations
 * 
 * **Build System Variations:**
 * Different build systems store versions in different ways:
 * 
 * - **Gradle**:
 *   - File: `gradle.properties`
 *   - Format: `moduleNameVersion=1.2.3`
 *   - Single file for all modules
 *   - Simple key-value format
 * 
 * - **Maven** (Future):
 *   - Files: Multiple `pom.xml` files
 *   - Format: `<version>1.2.3</version>` XML tags
 *   - One file per module
 *   - XML parsing and writing required
 * 
 * - **npm** (Future):
 *   - Files: Multiple `package.json` files
 *   - Format: `"version": "1.2.3"` JSON field
 *   - One file per module/workspace
 *   - JSON parsing and writing required
 * 
 * **Implementation Requirements:**
 * 
 * Concrete strategies must:
 * 1. Accept repository root path in constructor for file location
 * 2. Implement `writeVersionUpdates()` to persist all version changes
 * 3. Handle file I/O operations (read, modify, write)
 * 4. Ensure atomic writes to prevent partial updates
 * 5. Provide clear error messages for common failure scenarios
 * 6. Validate version formats if required by the build system
 * 
 * **Atomicity Considerations:**
 * Implementations should strive for atomic updates:
 * - Gradle: Single write to gradle.properties (naturally atomic)
 * - Maven: Backup pom.xml files before modification, restore on failure
 * - npm: Use temporary files, then atomic rename
 * 
 * If atomicity cannot be guaranteed, document the limitations clearly.
 * 
 * **Error Handling:**
 * Strategies should throw descriptive errors for:
 * - File not found (build file missing)
 * - Permission denied (read-only file system)
 * - Invalid format (malformed build file)
 * - I/O errors (disk full, network issues)
 * - Invalid version format (if validation required)
 * 
 * **Performance Characteristics:**
 * - Should handle batch updates efficiently (single file write when possible)
 * - Minimize file I/O operations
 * - Avoid multiple reads/writes to the same file
 * - Use buffered I/O for large files
 * 
 * **Thread Safety:**
 * Implementations are not required to be thread-safe. Version updates should be
 * performed sequentially, not concurrently. External synchronization required if
 * parallel updates are needed.
 * 
 * **Usage Context:**
 * Strategies are created by {@link ModuleSystemFactory} and used by {@link VersionManager}:
 * ```typescript
 * const factory = createModuleSystemFactory('gradle', repoRoot);
 * const strategy = factory.createVersionUpdateStrategy();
 * const manager = new VersionManager(registry, strategy);
 * 
 * manager.updateVersion(':core', '1.2.3');
 * await manager.commit(); // Calls strategy.writeVersionUpdates()
 * ```
 * 
 * **Testing Strategies:**
 * For testing, mock implementations can be created:
 * ```typescript
 * class MockVersionUpdateStrategy implements VersionUpdateStrategy {
 *   public writtenVersions: Map<string, string> | null = null;
 *   
 *   async writeVersionUpdates(moduleVersions: Map<string, string>): Promise<void> {
 *     this.writtenVersions = new Map(moduleVersions);
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Custom implementation for a hypothetical build system
 * class CustomVersionUpdateStrategy implements VersionUpdateStrategy {
 *   constructor(private readonly repoRoot: string) {}
 *   
 *   async writeVersionUpdates(moduleVersions: Map<string, string>): Promise<void> {
 *     // Read build file
 *     const buildFilePath = path.join(this.repoRoot, 'build.config');
 *     const content = await fs.readFile(buildFilePath, 'utf-8');
 *     
 *     // Update versions in content
 *     let updatedContent = content;
 *     for (const [moduleId, version] of moduleVersions) {
 *       const pattern = new RegExp(`${moduleId}: .*`, 'g');
 *       updatedContent = updatedContent.replace(pattern, `${moduleId}: ${version}`);
 *     }
 *     
 *     // Write updated content
 *     await fs.writeFile(buildFilePath, updatedContent, 'utf-8');
 *   }
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Using strategy through VersionManager
 * const factory = createModuleSystemFactory('gradle', '/path/to/project');
 * const strategy = factory.createVersionUpdateStrategy();
 * const registry = await detector.detect();
 * const manager = new VersionManager(registry, strategy);
 * 
 * // Stage updates
 * manager.updateVersion(':core', '1.2.3');
 * manager.updateVersion(':api', '2.0.0');
 * 
 * // Commit triggers strategy.writeVersionUpdates()
 * await manager.commit();
 * ```
 * 
 * @see {@link VersionManager} - Uses this strategy to persist version updates
 * @see {@link ModuleSystemFactory.createVersionUpdateStrategy} - Creates strategy instances
 * @see {@link GradleVersionUpdateStrategy} - Gradle implementation (adapters/gradle/)
 */
export interface VersionUpdateStrategy {
  /**
   * Writes version updates for multiple modules to build system configuration files.
   * 
   * @param moduleVersions - Map where:
   *   - **Key**: Module ID (e.g., `':'`, `':core'`, `':core:api'`)
   *   - **Value**: New version string (e.g., `'1.2.3'`, `'2.0.0-beta.1'`)
   * 
   * @returns A promise that resolves when all version updates have been successfully written
   * 
   * @throws {Error} If build configuration files cannot be found
   * @throws {Error} If files are not writable due to permissions
   * @throws {Error} If file format is invalid or corrupted
   * @throws {Error} If I/O operations fail (disk full, network issues)
   * @throws {Error} If version format is invalid for the build system
   * 
   * @remarks
   * This method is the core operation of the strategy, responsible for persisting
   * version updates to the appropriate build system files. It receives a batch of
   * updates and performs all necessary file operations to apply them.
   * 
   * **Operation Flow:**
   * 
   * 1. **Locate Files:**
   *    - Identify which build files need to be updated
   *    - Gradle: Single `gradle.properties` file
   *    - Maven: Multiple `pom.xml` files (one per module)
   *    - npm: Multiple `package.json` files (one per package)
   * 
   * 2. **Read Current Content:**
   *    - Load existing file content
   *    - Parse file format (properties, XML, JSON)
   *    - Handle missing files or invalid formats
   * 
   * 3. **Apply Updates:**
   *    - Update version values for specified modules
   *    - Preserve other file content unchanged
   *    - Maintain file format and structure
   * 
   * 4. **Write Updates:**
   *    - Write modified content back to files
   *    - Ensure atomic writes when possible
   *    - Handle write failures gracefully
   * 
   * 5. **Verification:**
   *    - Verify all updates were applied (optional)
   *    - Check file integrity after write (optional)
   * 
   * **Batch Processing:**
   * The method receives all updates at once, enabling efficient batch operations:
   * - Single read/write cycle for files containing multiple modules
   * - Reduced I/O operations
   * - Better performance for multi-module projects
   * - Easier atomicity guarantees
   * 
   * **Build System Specifics:**
   * 
   * **Gradle Implementation:**
   * ```typescript
   * // Updates gradle.properties file
   * // Before: coreVersion=1.0.0
   * // After:  coreVersion=1.2.3
   * 
   * async writeVersionUpdates(moduleVersions: Map<string, string>) {
   *   const propsPath = path.join(repoRoot, 'gradle.properties');
   *   // Read properties
   *   const props = await readProperties(propsPath);
   *   // Update version properties
   *   for (const [moduleId, version] of moduleVersions) {
   *     const propName = moduleIdToVersionPropertyName(moduleId);
   *     props[propName] = version;
   *   }
   *   // Write properties
   *   await writeProperties(propsPath, props);
   * }
   * ```
   * 
   * **Maven Implementation (Future):**
   * ```typescript
   * // Updates <version> tags in pom.xml files
   * async writeVersionUpdates(moduleVersions: Map<string, string>) {
   *   for (const [moduleId, version] of moduleVersions) {
   *     const pomPath = getModulePomPath(moduleId);
   *     const xml = await readXml(pomPath);
   *     xml.project.version = version;
   *     await writeXml(pomPath, xml);
   *   }
   * }
   * ```
   * 
   * **npm Implementation (Future):**
   * ```typescript
   * // Updates "version" fields in package.json files
   * async writeVersionUpdates(moduleVersions: Map<string, string>) {
   *   for (const [moduleId, version] of moduleVersions) {
   *     const pkgPath = getPackageJsonPath(moduleId);
   *     const pkg = await readJson(pkgPath);
   *     pkg.version = version;
   *     await writeJson(pkgPath, pkg);
   *   }
   * }
   * ```
   * 
   * **Error Scenarios:**
   * 
   * Common errors and their handling:
   * ```typescript
   * // File not found
   * throw new Error(`Build file not found: ${filePath}`);
   * 
   * // Permission denied
   * throw new Error(`Cannot write to ${filePath}: permission denied`);
   * 
   * // Invalid format
   * throw new Error(`Invalid ${buildSystem} file format: ${filePath}`);
   * 
   * // I/O error
   * throw new Error(`Failed to write ${filePath}: ${error.message}`);
   * ```
   * 
   * **Atomicity:**
   * Implementations should ensure that either all updates succeed or none persist:
   * - Use transactions if supported by file system
   * - Write to temporary file, then rename (atomic on POSIX)
   * - Keep backup before modification, restore on failure
   * - Document limitations if atomicity cannot be guaranteed
   * 
   * **Empty Map:**
   * If `moduleVersions` is empty, implementations may:
   * - Return immediately without file operations (recommended)
   * - Validate that build files exist (optional)
   * - Log a warning (optional)
   * 
   * **Idempotency:**
   * Multiple calls with the same version map should be idempotent:
   * - First call writes versions
   * - Subsequent calls overwrite with same values (no-op from user perspective)
   * - File content should be identical after multiple calls
   * 
   * @example
   * ```typescript
   * // Basic usage through VersionManager
   * const strategy = factory.createVersionUpdateStrategy();
   * const manager = new VersionManager(registry, strategy);
   * 
   * // Stage updates
   * manager.updateVersion(':core', '1.2.3');
   * manager.updateVersion(':api', '2.0.0');
   * 
   * // Commit calls writeVersionUpdates internally
   * await manager.commit();
   * // Strategy receives: Map([':core', '1.2.3'], [':api', '2.0.0'])
   * ```
   * 
   * @example
   * ```typescript
   * // Direct usage (uncommon, usually called by VersionManager)
   * const strategy = factory.createVersionUpdateStrategy();
   * 
   * const versionMap = new Map([
   *   [':core', '1.2.3'],
   *   [':api', '2.0.0'],
   *   [':utils', '0.5.1']
   * ]);
   * 
   * await strategy.writeVersionUpdates(versionMap);
   * console.log('Versions written to build files');
   * ```
   * 
   * @example
   * ```typescript
   * // Error handling
   * const strategy = factory.createVersionUpdateStrategy();
   * const versionMap = new Map([[':core', '1.2.3']]);
   * 
   * try {
   *   await strategy.writeVersionUpdates(versionMap);
   * } catch (error) {
   *   if (error.message.includes('not found')) {
   *     console.error('Build file missing - run build system init first');
   *   } else if (error.message.includes('permission')) {
   *     console.error('Cannot write - check file permissions');
   *   } else {
   *     console.error('Write failed:', error.message);
   *     // Consider retry logic or rollback
   *   }
   * }
   * ```
   * 
   * @example
   * ```typescript
   * // Testing with mock implementation
   * class TestVersionUpdateStrategy implements VersionUpdateStrategy {
   *   public writtenVersions: Map<string, string> | null = null;
   *   
   *   async writeVersionUpdates(moduleVersions: Map<string, string>): Promise<void> {
   *     // Store for verification in tests
   *     this.writtenVersions = new Map(moduleVersions);
   *   }
   * }
   * 
   * // In test
   * const strategy = new TestVersionUpdateStrategy();
   * const manager = new VersionManager(registry, strategy);
   * 
   * manager.updateVersion(':core', '1.2.3');
   * await manager.commit();
   * 
   * // Verify strategy was called correctly
   * assert.equal(strategy.writtenVersions.get(':core'), '1.2.3');
   * ```
   * 
   * @see {@link VersionManager.commit} - Calls this method to persist staged updates
   * @see {@link ModuleSystemFactory.createVersionUpdateStrategy} - Creates strategy instances
   */
  writeVersionUpdates(moduleVersions: Map<string, string>): Promise<void>;
}
