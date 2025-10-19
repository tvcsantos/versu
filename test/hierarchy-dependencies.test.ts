import { describe, it, expect } from 'vitest';
import { 
  getProjectInformation, 
} from '../src/adapters/gradle/hierarchy-dependencies.js';
import { RawProjectInformation } from '../src/adapters/hierarchy.js';

describe('Hierarchy Dependencies Parser', () => {
  const sampleHierarchy: RawProjectInformation = {
    ":": {
      name: "root",
      path: ".",
      affectedModules: [":base", ":spring", ":spring:core", ":spring:servlet"],
      version: "1.0.0",
      type: "root",
      declaredVersion: true
    },
    ":base": {
      name: "base",
      path: "base",
      affectedModules: [],
      version: "1.1.0",
      type: "module",
      declaredVersion: true
    },
    ":spring": {
      name: "spring",
      path: "spring",
      affectedModules: [":spring:core", ":spring:servlet"],
      version: "2.0.0",
      type: "module",
      declaredVersion: true
    },
    ":spring:core": {
      name: "core",
      path: "spring/core",
      affectedModules: [],
      version: "2.1.0",
      type: "module",
      declaredVersion: true
    },
    ":spring:servlet": {
      name: "servlet",
      path: "spring/servlet",
      affectedModules: [],
      version: "2.2.0",
      type: "module",
      declaredVersion: true
    }
  };

  describe('getProjectInformation', () => {
    it('should parse hierarchy structure correctly', () => {
      const result = getProjectInformation(sampleHierarchy);
      
      expect(result.moduleIds).toHaveLength(5);
      expect(result.moduleIds).toContain(':');
      expect(result.moduleIds).toContain(':base');
      expect(result.moduleIds).toContain(':spring');
      expect(result.moduleIds).toContain(':spring:core');
      expect(result.moduleIds).toContain(':spring:servlet');
      expect(result.rootModule).toBe(':');

      // Verify modules contains correct paths
      expect(result.modules.get(':')?.path).toBe('.');
      expect(result.modules.get(':base')?.path).toBe('base');
      expect(result.modules.get(':spring:core')?.path).toBe('spring/core');
    });

    it('should build affected module relationships correctly', () => {
      const result = getProjectInformation(sampleHierarchy);
      
      // Verify that affected modules are properly stored in the modules
      // Root affects all submodules
      expect(result.modules.get(':')?.affectedModules.has(':base')).toBe(true);
      expect(result.modules.get(':')?.affectedModules.has(':spring')).toBe(true);
      expect(result.modules.get(':')?.affectedModules.has(':spring:core')).toBe(true);
      expect(result.modules.get(':')?.affectedModules.has(':spring:servlet')).toBe(true);

      // Spring affects its submodules
      expect(result.modules.get(':spring')?.affectedModules.has(':spring:core')).toBe(true);
      expect(result.modules.get(':spring')?.affectedModules.has(':spring:servlet')).toBe(true);

      // Leaf modules affect nothing
      expect(result.modules.get(':base')?.affectedModules.size).toBe(0);
      expect(result.modules.get(':spring:core')?.affectedModules.size).toBe(0);
      expect(result.modules.get(':spring:servlet')?.affectedModules.size).toBe(0);
    });

    it('should parse versions correctly from ProjectNode', () => {
      const result = getProjectInformation(sampleHierarchy);
      
      // Verify that versions are correctly parsed from the hierarchy
      expect(result.modules.get(':')?.version.version).toBe('1.0.0');
      expect(result.modules.get(':base')?.version.version).toBe('1.1.0');
      expect(result.modules.get(':spring')?.version.version).toBe('2.0.0');
      expect(result.modules.get(':spring:core')?.version.version).toBe('2.1.0');
      expect(result.modules.get(':spring:servlet')?.version.version).toBe('2.2.0');
    });

    it('should parse types correctly from ProjectNode', () => {
      const result = getProjectInformation(sampleHierarchy);
      
      // Verify that types are correctly parsed from the hierarchy
      expect(result.modules.get(':')?.type).toBe('root');
      expect(result.modules.get(':base')?.type).toBe('module');
      expect(result.modules.get(':spring')?.type).toBe('module');
      expect(result.modules.get(':spring:core')?.type).toBe('module');
      expect(result.modules.get(':spring:servlet')?.type).toBe('module');

      // Verify root module detection
      expect(result.rootModule).toBe(':');
    });

    it('should throw error when no root module is found', () => {
      const hierarchyWithoutRoot: RawProjectInformation = {
        ":base": {
          name: "base",
          path: "base",
          affectedModules: [],
          version: "1.1.0",
          type: "module",
          declaredVersion: true
        },
        ":spring": {
          name: "spring",
          path: "spring",
          affectedModules: [],
          version: "2.0.0",
          type: "module",
          declaredVersion: true
        }
      };

      expect(() => {
        getProjectInformation(hierarchyWithoutRoot);
      }).toThrow('No root module found in hierarchy. Every project hierarchy must contain exactly one module with type "root".');
    });
  });
});