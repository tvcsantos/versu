import { ModuleDetector } from "../module-detector.js";
import { ModuleRegistry } from '../module-registry.js';
import { 
  getRawProjectInformation,
  getProjectInformation 
} from './hierarchy-dependencies.js';

export class GradleModuleDetector implements ModuleDetector {
  constructor(readonly repoRoot: string) {}

  async detect(): Promise<ModuleRegistry> {
    const rawProjectInformation = await getRawProjectInformation(this.repoRoot);
    const projectInformation = getProjectInformation(rawProjectInformation);
    return new ModuleRegistry(projectInformation);
  }
}
