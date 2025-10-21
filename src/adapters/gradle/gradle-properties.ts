const ROOT_MODULE_ID = ':';
const VERSION = 'version';
const MODULE_SEPARATOR = ':';
const DOT_SEPARATOR = '.';
const VERSION_REGEX = /\.version$/;

/**
 * Convert version property name to module path
 * Examples:
 * - version -> ":" (root)
 * - x.version -> ":x"
 * - x.y.version -> ":x:y"
 * @param propertyName The version property name
 * @returns The module ID
 */
export function versionPropertyNameToModuleId(propertyName: string): string {
  if (propertyName === VERSION) {
    return ROOT_MODULE_ID;
  }
  
  // Remove '.version' suffix
  const nameWithoutSuffix = propertyName.replace(VERSION_REGEX, '');
  
  // Convert dot-separated to module path: "x.y" -> ":x:y"
  return `${ROOT_MODULE_ID}${nameWithoutSuffix.replaceAll(DOT_SEPARATOR, MODULE_SEPARATOR)}`;
}

/**
 * Convert module path to version property name
 * Examples:
 * - ":" -> "version"
 * - ":x" -> "x.version"
 * - ":x:y" -> "x.y.version"
 * @param moduleId The module ID
 * @returns The version property name
 */
export function moduleIdToVersionPropertyName(moduleId: string): string {
  if (moduleId === ROOT_MODULE_ID) {
    return VERSION;
  }

  const name = moduleId.split(MODULE_SEPARATOR).at(-1);
  if (!name) {
    throw new Error(`Invalid module ID: ${moduleId}`);
  }

  return `${name}.${VERSION}`;
}
