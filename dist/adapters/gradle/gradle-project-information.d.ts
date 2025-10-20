import { ProjectInformation, RawProjectInformation } from '../project-information.js';
/**
 * Execute the gradle hierarchy command to get the JSON output
 */
export declare function getRawProjectInformation(projectRoot: string): Promise<RawProjectInformation>;
/**
 * Parse the hierarchy structure and extract dependency relationships
 */
export declare function getProjectInformation(projectInformation: RawProjectInformation): ProjectInformation;
//# sourceMappingURL=gradle-project-information.d.ts.map