/**
 * Updates or inserts a single property in a Java-style properties file.
 *
 * @param propertiesPath - Absolute or relative path to the properties file
 * @param key - Property key to update or insert (e.g., `'coreVersion'`, `'app.name'`)
 * @param value - Property value to set (e.g., `'1.2.3'`, `'my-app'`)
 *
 * @returns A promise that resolves when the property has been written to the file
 *
 * @throws {Error} If file write operations fail due to permissions or I/O errors
 *
 * @remarks
 * This is a convenience wrapper around {@link upsertProperties} for updating a
 * single property. It provides a simpler API when only one property needs to be
 * updated, avoiding the need to create a Map for single operations.
 *
 * **Behavior:**
 * - If the file exists and contains the key, the value is updated in place
 * - If the file exists but doesn't contain the key, the property is appended
 * - If the file doesn't exist, a new file is created with the property
 *
 * **Delegation:**
 * Internally creates a Map with a single entry and delegates to {@link upsertProperties},
 * which handles all the file I/O and property manipulation logic.
 *
 * **Use Cases:**
 * - Update single version property in gradle.properties
 * - Set configuration value in application.properties
 * - Update individual settings without affecting other properties
 * - Quick property changes during development or testing
 *
 * **When to Use:**
 * - Updating only one property
 * - Simple, one-off property updates
 * - Readability is important (clearer than Map for single property)
 *
 * **When NOT to Use:**
 * - Updating multiple properties (use {@link upsertProperties} for better performance)
 * - Batch operations (creates separate Map for each call)
 * - High-frequency updates (overhead of Map creation)
 *
 * @example
 * ```typescript
 * // Update version in gradle.properties
 * await upsertProperty('gradle.properties', 'coreVersion', '1.2.3');
 *
 * // Result in gradle.properties:
 * // coreVersion=1.2.3
 * ```
 *
 * @example
 * ```typescript
 * // Add new property to existing file
 * await upsertProperty('config.properties', 'app.timeout', '30000');
 *
 * // If file exists with:
 * // app.name=MyApp
 * // app.port=8080
 *
 * // After update:
 * // app.name=MyApp
 * // app.port=8080
 * // app.timeout=30000
 * ```
 *
 * @example
 * ```typescript
 * // Create new file with single property
 * await upsertProperty('new-config.properties', 'initialKey', 'initialValue');
 *
 * // Creates new-config.properties with:
 * // initialKey=initialValue
 * ```
 *
 * @example
 * ```typescript
 * // Update module version in VERSE workflow
 * import { join } from 'path';
 *
 * const propsPath = join(repoRoot, 'gradle.properties');
 * await upsertProperty(propsPath, 'coreVersion', '2.0.0');
 * console.log('Core version updated to 2.0.0');
 * ```
 *
 * @see {@link upsertProperties} - Batch update multiple properties efficiently
 */
export declare function upsertProperty(propertiesPath: string, key: string, value: string): Promise<void>;
/**
 * Updates or inserts multiple properties in a Java-style properties file in a single operation.
 *
 * @param propertiesPath - Absolute or relative path to the properties file
 * @param properties - Map of property keys to values to update or insert
 *
 * @returns A promise that resolves when all properties have been written to the file
 *
 * @throws {Error} If file read operations fail (permissions, I/O errors)
 * @throws {Error} If file write operations fail (disk full, permissions, I/O errors)
 *
 * @remarks
 * This function provides efficient batch updates to Java-style properties files,
 * commonly used by Gradle, Maven, Spring Boot, and other Java-based tools. It
 * handles both updating existing properties and adding new ones in a single file
 * operation.
 *
 * **Properties File Format:**
 * Java properties files use a simple key-value format:
 * ```properties
 * # Comments start with # or !
 * key=value
 * key: value (colon separator also supported)
 * key = value (spaces around separator allowed)
 * multiline.key=value1\
 *   value2
 * ```
 *
 * This function writes properties in the standard `key=value` format.
 *
 * **Operation Flow:**
 *
 * 1. **Empty Check:**
 *    - If properties Map is empty, return immediately (no-op)
 *    - Avoids unnecessary file operations
 *
 * 2. **Existence Check:**
 *    - Check if properties file exists
 *    - Determines whether to update existing file or create new one
 *
 * 3a. **File Exists - Update:**
 *    - Read current file content
 *    - For each property in the Map:
 *      * Search for existing property using regex
 *      * If found, replace the line with new value
 *      * If not found, append to end of file
 *    - Write updated content back to file
 *
 * 3b. **File Doesn't Exist - Create:**
 *    - Generate new properties content from Map
 *    - Write all properties as new file
 *    - Each property on separate line
 *
 * 4. **Write:**
 *    - Write final content to file (UTF-8 encoding)
 *    - Overwrites existing file completely
 *
 * **Update Behavior:**
 * - **Existing property**: Line is replaced in place (preserves file order)
 * - **New property**: Added at end of file
 * - **Comments and formatting**: Preserved (except for updated lines)
 * - **Blank lines**: Preserved in existing files
 * - **Property order**: Maintains original order, new properties appended
 *
 * **Regex Escaping:**
 * Property keys are escaped before regex matching to handle special characters
 * safely. This ensures keys like `app.server.port` or `my-key_123` work correctly
 * without being interpreted as regex patterns.
 *
 * **File Creation:**
 * When creating a new file:
 * - Properties written in Map iteration order (insertion order in JavaScript)
 * - Each property on its own line
 * - File ends with newline
 * - No comments or blank lines added
 *
 * **Performance Benefits:**
 * Batch updates are significantly more efficient than multiple individual updates:
 * - Single file read operation (vs. N reads)
 * - Single file write operation (vs. N writes)
 * - Single file existence check
 * - Reduced file system overhead
 *
 * **Atomicity:**
 * - File read and write are separate operations (not atomic)
 * - Concurrent modifications could result in data loss
 * - Consider file locking for concurrent environments
 * - In practice, VERSE runs sequentially so this isn't an issue
 *
 * **Empty Map Handling:**
 * Calling with an empty Map is safe and efficient:
 * - Returns immediately without file operations
 * - No error thrown
 * - Useful for conditional batch updates
 *
 * **Encoding:**
 * - Reads and writes files as UTF-8
 * - Standard for properties files in modern Java applications
 * - Gradle and Maven both use UTF-8 by default
 *
 * @example
 * ```typescript
 * // Update multiple module versions in gradle.properties
 * const versionUpdates = new Map([
 *   ['coreVersion', '1.2.3'],
 *   ['apiVersion', '2.0.0'],
 *   ['utilsVersion', '0.5.1']
 * ]);
 *
 * await upsertProperties('gradle.properties', versionUpdates);
 *
 * // Result in gradle.properties:
 * // coreVersion=1.2.3
 * // apiVersion=2.0.0
 * // utilsVersion=0.5.1
 * ```
 *
 * @example
 * ```typescript
 * // Update existing properties, add new ones
 * const updates = new Map([
 *   ['existingKey', 'updatedValue'],  // Updates existing
 *   ['newKey', 'newValue']             // Adds new
 * ]);
 *
 * await upsertProperties('config.properties', updates);
 *
 * // Before:
 * // existingKey=oldValue
 * // otherKey=otherValue
 *
 * // After:
 * // existingKey=updatedValue
 * // otherKey=otherValue
 * // newKey=newValue
 * ```
 *
 * @example
 * ```typescript
 * // Create new properties file
 * const properties = new Map([
 *   ['app.name', 'MyApplication'],
 *   ['app.version', '1.0.0'],
 *   ['app.port', '8080']
 * ]);
 *
 * await upsertProperties('application.properties', properties);
 *
 * // Creates application.properties:
 * // app.name=MyApplication
 * // app.version=1.0.0
 * // app.port=8080
 * ```
 *
 * @example
 * ```typescript
 * // VERSE usage - update module versions from VersionManager
 * import { join } from 'path';
 *
 * // Get pending version updates from VersionManager
 * const versionMap = manager.getPendingUpdates();
 * // versionMap: Map([':core', '1.2.3'], [':api', '2.0.0'])
 *
 * // Convert module IDs to property names
 * const propertyUpdates = new Map<string, string>();
 * for (const [moduleId, version] of versionMap) {
 *   const propName = moduleIdToVersionPropertyName(moduleId);
 *   propertyUpdates.set(propName, version);
 * }
 * // propertyUpdates: Map(['coreVersion', '1.2.3'], ['apiVersion', '2.0.0'])
 *
 * // Write all updates at once
 * const propsPath = join(repoRoot, 'gradle.properties');
 * await upsertProperties(propsPath, propertyUpdates);
 * ```
 *
 * @example
 * ```typescript
 * // Empty map (safe no-op)
 * await upsertProperties('config.properties', new Map());
 * // Returns immediately, no file operations
 * ```
 *
 * @example
 * ```typescript
 * // Properties with special characters in keys
 * const updates = new Map([
 *   ['my.dotted.key', 'value1'],
 *   ['my-dashed-key', 'value2'],
 *   ['my_underscored_key', 'value3'],
 *   ['my[bracketed]key', 'value4']
 * ]);
 *
 * await upsertProperties('config.properties', updates);
 * // All keys are properly escaped for regex matching
 * ```
 *
 * @example
 * ```typescript
 * // Error handling
 * try {
 *   await upsertProperties('/readonly/gradle.properties', versionMap);
 * } catch (error) {
 *   if (error.code === 'EACCES') {
 *     console.error('No write permission');
 *   } else if (error.code === 'ENOSPC') {
 *     console.error('Disk full');
 *   } else {
 *     console.error('Write failed:', error);
 *   }
 * }
 * ```
 *
 * @see {@link upsertProperty} - Convenience function for updating a single property
 * @see {@link exists} - Used to check if properties file exists
 */
export declare function upsertProperties(propertiesPath: string, properties: Map<string, string>): Promise<void>;
//# sourceMappingURL=properties.d.ts.map