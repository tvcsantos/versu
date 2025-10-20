import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CommitAnalyzer } from '../src/services/commit-analyzer.js';
import * as gitIndex from '../src/git/index.js';
import { parseSemVer } from '../src/semver/index.js';
import { ModuleRegistry } from '../src/services/module-registry.js';
import { CommitInfo } from '../src/git/index.js';
import { Module, ProjectInformation } from '../src/adapters/project-information.js';

// Mock the git module
vi.mock('../src/git/index.js', () => ({
  getCommitsSinceLastTag: vi.fn(),
}));

describe('CommitAnalyzer - Child Module Exclusion', () => {
  let moduleRegistry: ModuleRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('child module path exclusion', () => {
    it('should pass child module paths to git exclusion for parent modules', async () => {
      // Setup hierarchy with parent and child modules
      const modules = new Map<string, Module>([
        [':core', {
          id: ':core',
          name: 'core',
          path: './core',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':core:api', {
          id: ':core:api',
          name: 'api',
          path: './core/api',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':core:impl', {
          id: ':core:impl',
          name: 'impl',
          path: './core/impl',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
      ]);

      const hierarchyResult: ProjectInformation = {
        moduleIds: [':core', ':core:api', ':core:impl'],
        modules,
        rootModule: ':',
      };

      moduleRegistry = new ModuleRegistry(hierarchyResult);

      // Mock commits - git will handle exclusion natively
      const coreCommits: CommitInfo[] = [
        { hash: 'ghi789', type: 'feat', subject: 'add core feature', breaking: false },
      ];
      const apiCommits: CommitInfo[] = [
        { hash: 'abc123', type: 'feat', subject: 'add api feature', breaking: false },
      ];
      const implCommits: CommitInfo[] = [
        { hash: 'def456', type: 'fix', subject: 'fix impl bug', breaking: false },
      ];

      // Mock getCommitsSinceLastTag to return different commits based on excludePaths
      vi.mocked(gitIndex.getCommitsSinceLastTag).mockImplementation(
        async (modulePath, moduleName, moduleType, options, excludePaths = []) => {
          if (modulePath === './core') {
            // Core should have called with exclusions for api and impl
            expect(excludePaths).toContain('./core/api');
            expect(excludePaths).toContain('./core/impl');
            return coreCommits;
          } else if (modulePath === './core/api') {
            // API has no child modules
            expect(excludePaths).toEqual([]);
            return apiCommits;
          } else if (modulePath === './core/impl') {
            // Impl has no child modules
            expect(excludePaths).toEqual([]);
            return implCommits;
          }
          return [];
        }
      );

      // Analyze commits
      const commitAnalyzer = new CommitAnalyzer(moduleRegistry, '/repo');
      const result = await commitAnalyzer.analyzeCommitsSinceLastRelease();

      // Verify each module got the correct commits
      expect(result.get(':core')).toEqual(coreCommits);
      expect(result.get(':core:api')).toEqual(apiCommits);
      expect(result.get(':core:impl')).toEqual(implCommits);
    });

    it('should handle multi-level nested modules correctly', async () => {
      const modules = new Map<string, Module>([
        [':services', {
          id: ':services',
          name: 'services',
          path: './services',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':services:api', {
          id: ':services:api',
          name: 'api',
          path: './services/api',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':services:api:v1', {
          id: ':services:api:v1',
          name: 'v1',
          path: './services/api/v1',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
      ]);

      const hierarchyResult: ProjectInformation = {
        moduleIds: [':services', ':services:api', ':services:api:v1'],
        modules,
        rootModule: ':',
      };

      moduleRegistry = new ModuleRegistry(hierarchyResult);

      vi.mocked(gitIndex.getCommitsSinceLastTag).mockImplementation(
        async (modulePath, moduleName, moduleType, options, excludePaths = []) => {
          if (modulePath === './services') {
            // Services should exclude both api and api/v1
            expect(excludePaths).toContain('./services/api');
            expect(excludePaths).toContain('./services/api/v1');
            return [{ hash: 'svc123', type: 'feat', subject: 'service update', breaking: false }];
          } else if (modulePath === './services/api') {
            // API should exclude only v1
            expect(excludePaths).toContain('./services/api/v1');
            expect(excludePaths).not.toContain('./services/api');
            return [{ hash: 'api456', type: 'fix', subject: 'api fix', breaking: false }];
          } else if (modulePath === './services/api/v1') {
            // V1 has no children
            expect(excludePaths).toEqual([]);
            return [{ hash: 'v1789', type: 'feat', subject: 'v1 feature', breaking: false }];
          }
          return [];
        }
      );

      const commitAnalyzer = new CommitAnalyzer(moduleRegistry, '/repo');
      await commitAnalyzer.analyzeCommitsSinceLastRelease();

      // Verify the mock was called with correct exclusions (assertions are in mock implementation)
      expect(vi.mocked(gitIndex.getCommitsSinceLastTag)).toHaveBeenCalledTimes(3);
    });

    it('should handle root module correctly by excluding all submodules', async () => {
      const modules = new Map<string, Module>([
        [':', {
          id: ':',
          name: 'root',
          path: '.',
          type: 'root',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':core', {
          id: ':core',
          name: 'core',
          path: './core',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':utils', {
          id: ':utils',
          name: 'utils',
          path: './utils',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
      ]);

      const hierarchyResult: ProjectInformation = {
        moduleIds: [':', ':core', ':utils'],
        modules,
        rootModule: ':',
      };

      moduleRegistry = new ModuleRegistry(hierarchyResult);

      const rootCommits: CommitInfo[] = [
        { hash: 'root123', type: 'feat', subject: 'update root build file', breaking: false },
      ];

      vi.mocked(gitIndex.getCommitsSinceLastTag).mockImplementation(
        async (modulePath, moduleName, moduleType, options, excludePaths = []) => {
          if (modulePath === '.') {
            // Root should exclude all submodules
            expect(excludePaths).toContain('./core');
            expect(excludePaths).toContain('./utils');
            expect(excludePaths.length).toBe(2);
            return rootCommits;
          }
          return [];
        }
      );

      const commitAnalyzer = new CommitAnalyzer(moduleRegistry, '/repo');
      const result = await commitAnalyzer.analyzeCommitsSinceLastRelease();

      // Root should have its commits with all submodules excluded
      expect(result.get(':')).toEqual(rootCommits);
    });

    it('should handle modules with no child modules (no exclusions)', async () => {
      const modules = new Map<string, Module>([
        [':utils', {
          id: ':utils',
          name: 'utils',
          path: './utils',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
        [':services', {
          id: ':services',
          name: 'services',
          path: './services',
          type: 'module',
          affectedModules: new Set(),
          version: parseSemVer('1.0.0'),
          declaredVersion: true,
        }],
      ]);

      const hierarchyResult: ProjectInformation = {
        moduleIds: [':utils', ':services'],
        modules,
        rootModule: ':',
      };

      moduleRegistry = new ModuleRegistry(hierarchyResult);

      const utilsCommits: CommitInfo[] = [
        { hash: 'utils123', type: 'feat', subject: 'add util', breaking: false },
      ];
      const servicesCommits: CommitInfo[] = [
        { hash: 'svc456', type: 'fix', subject: 'fix service', breaking: false },
      ];

      vi.mocked(gitIndex.getCommitsSinceLastTag).mockImplementation(
        async (modulePath, moduleName, moduleType, options, excludePaths = []) => {
          // Neither module has child modules, so excludePaths should be empty
          expect(excludePaths).toEqual([]);
          
          if (modulePath === './utils') {
            return utilsCommits;
          } else if (modulePath === './services') {
            return servicesCommits;
          }
          return [];
        }
      );

      const commitAnalyzer = new CommitAnalyzer(moduleRegistry, '/repo');
      const result = await commitAnalyzer.analyzeCommitsSinceLastRelease();

      // Both modules should get their commits without any filtering
      expect(result.get(':utils')).toEqual(utilsCommits);
      expect(result.get(':services')).toEqual(servicesCommits);
    });
  });
});
