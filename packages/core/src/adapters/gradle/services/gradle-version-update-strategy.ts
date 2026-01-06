import { join } from 'path';
import { VersionUpdateStrategy } from "../../../services/version-update-strategy.js";
import { upsertProperties } from '../../../utils/properties.js';
import { GRADLE_PROPERTIES_FILE } from '../constants.js';
import { ModuleRegistry } from '../../../services/module-registry.js';

/**
 * Gradle-specific implementation for version update operations.
 * Updates module versions by modifying gradle.properties file.
 */
export class GradleVersionUpdateStrategy implements VersionUpdateStrategy {
  /** Absolute path to the gradle.properties file. */
  private readonly versionFilePath: string;

  /**
   * Creates a new Gradle version update strategy.
   * @param repoRoot - Absolute path to the repository root directory
   */
  constructor(repoRoot: string, private readonly moduleRegistry: ModuleRegistry) {
    this.versionFilePath = join(repoRoot, GRADLE_PROPERTIES_FILE);
  }
  
  /**
   * Writes version updates for multiple modules to gradle.properties.
   * @param moduleVersions - Map of module IDs to new version strings
   * @throws {Error} If the file cannot be read or written
   */
  async writeVersionUpdates(moduleVersions: Map<string, string>): Promise<void> {
    // Convert module IDs to property names
    // Example: ':app' → 'app.version', ':' → 'version'
    const propertyUpdates = new Map<string, string>();
    
    for (const [moduleId, versionString] of moduleVersions) {
      const module = this.moduleRegistry.getModule(moduleId);
      const propertyName = module['versionProperty'] as string;
      propertyUpdates.set(propertyName, versionString);
    
    }
    
    // Write all properties to gradle.properties file in one atomic operation
    // This ensures consistency and prevents partial updates
    await upsertProperties(this.versionFilePath, propertyUpdates);
  }
}
