import { Module, ProjectInformation } from "../adapters/project-information.js";
/**
 * Concrete class for managing hierarchy data.
 * Handles hierarchy operations independent of any build system.
 */
export declare class ModuleRegistry {
    private readonly projectInformation;
    constructor(projectInformation: ProjectInformation);
    /**
     * Get all module IDs in the project
     */
    getModuleIds(): string[];
    /**
     * Get module information by ID (includes current version)
     */
    getModule(moduleId: string): Module;
    hasModule(moduleId: string): boolean;
    /**
     * Get all modules as a map (each ProjectInfo includes current version)
     */
    getModules(): ReadonlyMap<string, Module>;
}
//# sourceMappingURL=module-registry.d.ts.map