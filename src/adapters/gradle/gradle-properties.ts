/**
 * The Gradle module identifier for the root project.
 * 
 * @remarks
 * In Gradle, the root project is always identified by a single colon (`:`).
 * This is a special identifier that distinguishes the root from subprojects,
 * which have identifiers like `:app`, `:lib:core`, etc.
 */
const ROOT_MODULE_ID = ':';

/**
 * The property name for version configuration in gradle.properties.
 * 
 * @remarks
 * By convention, Gradle projects use `version` as the property name for
 * the root project's version in gradle.properties. Subprojects use
 * qualified names like `app.version`, `lib.core.version`, etc.
 */
const VERSION = 'version';

/**
 * The separator character used in Gradle module identifiers.
 * 
 * @remarks
 * Gradle uses colons (`:`) to separate module path components.
 * For example: `:app`, `:lib:core`, `:features:auth`
 */
const MODULE_SEPARATOR = ':';

/**
 * The separator character used in gradle.properties property names.
 * 
 * @remarks
 * Property names in gradle.properties use dots (`.`) as separators.
 * For example: `app.version`, `lib.core.version`, `features.auth.version`
 */
const DOT_SEPARATOR = '.';

/**
 * Regular expression to match and remove the `.version` suffix.
 * 
 * @remarks
 * This regex matches the literal string `.version` at the end of a
 * property name, allowing it to be removed during module ID conversion.
 */
const VERSION_REGEX = /\.version$/;

/**
 * Converts a gradle.properties version property name to a Gradle module ID.
 * 
 * @param propertyName - The version property name from gradle.properties
 * 
 * @returns The corresponding Gradle module ID
 * 
 * @remarks
 * This function implements the reverse mapping from property names to module IDs,
 * following Gradle's naming conventions. It handles the special case of the root
 * project and transforms dot-separated property names into colon-separated module paths.
 * 
 * **Transformation Rules:**
 * 
 * 1. **Root Project:**
 *    - Input: `"version"`
 *    - Output: `":"`
 *    - The root project uses the simple `version` property
 * 
 * 2. **Single-Level Subproject:**
 *    - Input: `"app.version"`
 *    - Output: `":app"`
 *    - Remove `.version` suffix, prepend `:`
 * 
 * 3. **Multi-Level Subproject:**
 *    - Input: `"lib.core.version"`
 *    - Output: `":lib:core"`
 *    - Remove `.version` suffix, replace `.` with `:`, prepend `:`
 * 
 * **Algorithm:**
 * 1. Check if property is `"version"` (root project)
 * 2. Remove `.version` suffix using regex
 * 3. Replace all dots with colons
 * 4. Prepend root module identifier `:`
 * 
 * This function is useful when reading version updates from gradle.properties
 * and needing to map them back to module identifiers for processing.
 * 
 * @example
 * ```typescript
 * // Root project
 * versionPropertyNameToModuleId('version');
 * // Returns: ':'
 * 
 * // Single-level subproject
 * versionPropertyNameToModuleId('app.version');
 * // Returns: ':app'
 * 
 * // Multi-level subproject
 * versionPropertyNameToModuleId('lib.core.version');
 * // Returns: ':lib:core'
 * 
 * versionPropertyNameToModuleId('features.auth.version');
 * // Returns: ':features:auth'
 * ```
 */
export function versionPropertyNameToModuleId(propertyName: string): string {
  // Handle root project special case
  if (propertyName === VERSION) {
    return ROOT_MODULE_ID;
  }
  
  // Remove '.version' suffix
  const nameWithoutSuffix = propertyName.replace(VERSION_REGEX, '');
  
  // Convert dot-separated to colon-separated module path: "x.y" -> ":x:y"
  return `${ROOT_MODULE_ID}${nameWithoutSuffix.replaceAll(DOT_SEPARATOR, MODULE_SEPARATOR)}`;
}

/**
 * Converts a Gradle module ID to a gradle.properties version property name.
 * 
 * @param moduleId - The Gradle module ID (e.g., `:`, `:app`, `:lib:core`)
 * 
 * @returns The corresponding property name for gradle.properties
 * 
 * @throws {Error} If the module ID is invalid or cannot be parsed
 * 
 * @remarks
 * This function implements the mapping from Gradle module identifiers to
 * property names used in gradle.properties files. It follows Gradle's
 * naming conventions for version properties.
 * 
 * **Transformation Rules:**
 * 
 * 1. **Root Project:**
 *    - Input: `":"`
 *    - Output: `"version"`
 *    - The root project uses the simple `version` property
 * 
 * 2. **Single-Level Subproject:**
 *    - Input: `":app"`
 *    - Output: `"app.version"`
 *    - Extract module name, append `.version`
 * 
 * 3. **Multi-Level Subproject:**
 *    - Input: `":lib:core"`
 *    - Output: `"core.version"`
 *    - Extract only the last component (module name), append `.version`
 * 
 * **Important Note:**
 * This implementation uses only the **last component** of the module path
 * for property naming. This means:
 * - `:lib:core` → `core.version` (not `lib.core.version`)
 * - `:features:auth` → `auth.version` (not `features.auth.version`)
 * 
 * This follows a simplified naming convention where each module's version
 * property is based solely on its name, not its full path.
 * 
 * **Algorithm:**
 * 1. Check if module ID is `:` (root project)
 * 2. Split module ID by `:` separator
 * 3. Extract the last component (module name)
 * 4. Validate that a name was extracted
 * 5. Return `{name}.version`
 * 
 * **Error Handling:**
 * Throws an error if:
 * - Module ID is malformed (no components after splitting)
 * - Last component is empty
 * 
 * @example
 * ```typescript
 * // Root project
 * moduleIdToVersionPropertyName(':');
 * // Returns: 'version'
 * 
 * // Single-level subproject
 * moduleIdToVersionPropertyName(':app');
 * // Returns: 'app.version'
 * 
 * // Multi-level subproject
 * moduleIdToVersionPropertyName(':lib:core');
 * // Returns: 'core.version'
 * 
 * moduleIdToVersionPropertyName(':features:auth');
 * // Returns: 'auth.version'
 * 
 * // Invalid module ID
 * try {
 *   moduleIdToVersionPropertyName('invalid');
 * } catch (error) {
 *   console.error(error.message); // "Invalid module ID: invalid"
 * }
 * ```
 */
export function moduleIdToVersionPropertyName(moduleId: string): string {
  // Handle root project special case
  if (moduleId === ROOT_MODULE_ID) {
    return VERSION;
  }

  // Split by module separator and get the last component (module name)
  const name = moduleId.split(MODULE_SEPARATOR).at(-1);
  
  // Validate that we got a valid module name
  if (!name) {
    throw new Error(`Invalid module ID: ${moduleId}`);
  }

  // Return property name: {name}.version
  return `${name}.${VERSION}`;
}
