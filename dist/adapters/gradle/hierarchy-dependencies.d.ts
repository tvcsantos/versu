/**
 * Gradle-specific implementation for parsing project hierarchy dependencies
 * Uses the init-hierarchy-deps.gradle.kts script to extract dependency information
 */
import { RawProjectInformation } from '../hierarchy.js';
import { ProjectInformation } from '../core.js';
/**
 * Execute the gradle hierarchy command to get the JSON output
 */
export declare function getRawProjectInformation(projectRoot: string): Promise<RawProjectInformation>;
/**
 * Parse the hierarchy structure and extract dependency relationships
 */
export declare function getProjectInformation(projectInformation: RawProjectInformation): ProjectInformation;
//# sourceMappingURL=hierarchy-dependencies.d.ts.map