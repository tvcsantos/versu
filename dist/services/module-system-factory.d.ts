import { ModuleDetector } from "./module-detector.js";
import { VersionUpdateStrategy } from "./version-update-strategy.js";
/**
 * Factory interface for creating module system components.
 * Each build system (Gradle, Maven, npm, etc.) should implement this interface.
 */
export interface ModuleSystemFactory {
    /**
     * Create a module detector for this build system.
     * @returns ModuleDetector instance
     */
    createDetector(): ModuleDetector;
    /**
     * Create a version update strategy for this build system.
     * @returns VersionUpdateStrategy instance
     */
    createVersionUpdateStrategy(): VersionUpdateStrategy;
}
//# sourceMappingURL=module-system-factory.d.ts.map