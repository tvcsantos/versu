import { Module, ProjectInformation } from "../adapters/project-information.js";

/**
 * Concrete class for managing hierarchy data.
 * Handles hierarchy operations independent of any build system.
 */
export class ModuleRegistry {
  constructor(private readonly projectInformation: ProjectInformation) {}

  /**
   * Get all module IDs in the project
   */
  getModuleIds(): string[] {
    return this.projectInformation.moduleIds;
  }

  /**
   * Get module information by ID (includes current version)
   */
  getModule(moduleId: string): Module {
    const projectInfo = this.projectInformation.modules.get(moduleId);
    if (!projectInfo) {
      throw new Error(`Module ${moduleId} not found`);
    }
    return projectInfo;
  }

  hasModule(moduleId: string): boolean {
    return this.projectInformation.modules.has(moduleId);
  }

  /**
   * Get all modules as a map (each ProjectInfo includes current version)
   */
  getModules(): ReadonlyMap<string, Module> {
    return this.projectInformation.modules;
  }
}
