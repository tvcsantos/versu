import { promises as fs } from 'fs';

/**
 * Checks whether a file or directory exists at the specified path.
 * 
 * @param path - Absolute or relative path to the file or directory to check
 * 
 * @returns A promise that resolves to:
 *   - `true` if the path exists and is accessible
 *   - `false` if the path does not exist or is not accessible
 * 
 * @remarks
 * This utility function provides a safe, promise-based way to check file or
 * directory existence without throwing errors. It abstracts the Node.js
 * `fs.access()` API into a simple boolean check.
 * 
 * **Implementation:**
 * Uses `fs.access()` which checks if the Node.js process can access the path
 * with default permissions. If access succeeds, the path exists; if it throws,
 * the path doesn't exist or isn't accessible.
 * 
 * **What It Checks:**
 * - File existence (regular files)
 * - Directory existence
 * - Symbolic link existence (follows links by default)
 * - Read accessibility (implicit in access check)
 * 
 * **What It Doesn't Check:**
 * - File type (file vs directory vs symlink)
 * - File permissions (read, write, execute)
 * - File size or other metadata
 * - Whether path is absolute or relative
 * 
 * **Accessibility vs Existence:**
 * This function returns `false` for both:
 * - Path does not exist
 * - Path exists but is not accessible (permissions)
 * 
 * In most cases, these are equivalent for practical purposes. If you need to
 * distinguish between "doesn't exist" and "no permission", use `fs.access()`
 * directly and catch specific error codes.
 * 
 * **Race Condition Warning:**
 * Like all TOCTOU (Time-of-Check-Time-of-Use) operations, there's a potential
 * race condition between checking existence and performing file operations:
 * 
 * ```typescript
 * // ❌ Race condition - file could be deleted between check and read
 * if (await exists(path)) {
 *   const content = await fs.readFile(path); // May fail
 * }
 * 
 * // ✅ Better - handle errors directly
 * try {
 *   const content = await fs.readFile(path);
 * } catch (error) {
 *   if (error.code === 'ENOENT') {
 *     // File doesn't exist
 *   }
 * }
 * ```
 * 
 * **When to Use:**
 * - Conditional logic before file operations
 * - Validation that required files/directories exist
 * - Pre-flight checks in initialization code
 * - User-facing existence checks (e.g., "file not found" messages)
 * 
 * **When NOT to Use:**
 * - Before reading/writing files (just try the operation and handle errors)
 * - In tight loops (consider caching or batching checks)
 * - When you need detailed error information (use direct fs operations)
 * 
 * **Performance:**
 * - Async operation - requires await
 * - Fast for local file systems
 * - May be slower on network file systems
 * - Consider caching results if checking same path multiple times
 * 
 * **Path Types:**
 * Accepts both absolute and relative paths:
 * - Absolute: `/home/user/file.txt`, `C:\Users\file.txt`
 * - Relative: `./file.txt`, `../config/settings.json`, `data/file.txt`
 * 
 * Relative paths are resolved from `process.cwd()`.
 * 
 * @example
 * ```typescript
 * // Check if build file exists before running Gradle
 * const hasBuildFile = await exists('build.gradle');
 * 
 * if (hasBuildFile) {
 *   console.log('Gradle project detected');
 *   await exec('gradle', ['build']);
 * } else {
 *   console.log('No build.gradle found');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Check multiple files
 * const files = ['build.gradle', 'build.gradle.kts', 'settings.gradle'];
 * const checks = await Promise.all(files.map(f => exists(f)));
 * 
 * const existingFiles = files.filter((_, i) => checks[i]);
 * console.log('Found files:', existingFiles);
 * ```
 * 
 * @example
 * ```typescript
 * // Check directory existence
 * const hasNodeModules = await exists('node_modules');
 * 
 * if (!hasNodeModules) {
 *   console.log('Dependencies not installed');
 *   await exec('npm', ['install']);
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Validate required configuration files
 * const requiredFiles = [
 *   'gradle.properties',
 *   'settings.gradle',
 *   'build.gradle'
 * ];
 * 
 * for (const file of requiredFiles) {
 *   if (!await exists(file)) {
 *     throw new Error(`Required file missing: ${file}`);
 *   }
 * }
 * 
 * console.log('All required files present');
 * ```
 * 
 * @example
 * ```typescript
 * // Conditional file operations
 * import { join } from 'path';
 * 
 * const configPath = join(repoRoot, 'verse.config.js');
 * 
 * if (await exists(configPath)) {
 *   // Load custom configuration
 *   const config = await import(configPath);
 *   console.log('Using custom configuration');
 * } else {
 *   // Use default configuration
 *   console.log('Using default configuration');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Check before delete (though fs.unlink handles missing files gracefully)
 * const tempFile = '/tmp/verse-temp.json';
 * 
 * if (await exists(tempFile)) {
 *   await fs.unlink(tempFile);
 *   console.log('Temp file deleted');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Better alternative - handle errors directly without pre-check
 * import { constants } from 'fs';
 * 
 * // Instead of exists(), use fs.access() with specific permission checks
 * try {
 *   await fs.access(path, constants.R_OK); // Check read permission
 *   console.log('File exists and is readable');
 * } catch (error) {
 *   if (error.code === 'ENOENT') {
 *     console.log('File does not exist');
 *   } else if (error.code === 'EACCES') {
 *     console.log('File exists but no read permission');
 *   } else {
 *     console.log('Unknown error:', error);
 *   }
 * }
 * ```
 * 
 * @see {@link https://nodejs.org/api/fs.html#fspromisesaccesspath-mode | fs.promises.access} - Underlying Node.js API
 */
export async function exists(path: string): Promise<boolean> {
  try {
    // Attempt to access the path
    // If access succeeds, the path exists and is accessible
    await fs.access(path);
    return true;
  } catch {
    // If access fails (any error), consider path as non-existent
    // This includes ENOENT (doesn't exist) and EACCES (no permission)
    return false;
  }
}
