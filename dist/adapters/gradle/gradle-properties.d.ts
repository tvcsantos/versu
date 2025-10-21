/**
 * Convert version property name to module path
 * Examples:
 * - version -> ":" (root)
 * - x.version -> ":x"
 * - x.y.version -> ":x:y"
 * @param propertyName The version property name
 * @returns The module ID
 */
export declare function versionPropertyNameToModuleId(propertyName: string): string;
/**
 * Convert module path to version property name
 * Examples:
 * - ":" -> "version"
 * - ":x" -> "x.version"
 * - ":x:y" -> "x.y.version"
 * @param moduleId The module ID
 * @returns The version property name
 */
export declare function moduleIdToVersionPropertyName(moduleId: string): string;
//# sourceMappingURL=gradle-properties.d.ts.map