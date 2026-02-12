# @versu/core - Core Library

The core business logic powering VERSU. This package is completely framework-agnostic and can be integrated into any TypeScript/JavaScript project, CI/CD system, or custom tooling.

## Installation

```bash
npm install @versu/core
```

## Quick Start

```typescript
import { VersuRunner } from '@versu/core';

const runner = new VersuRunner({
  repoRoot: '/path/to/repository',
  adapter: 'gradle', // Optional - auto-detected if not specified
  dryRun: false,
  pushTags: true,
  pushChanges: true,
  generateChangelog: true
});

const result = await runner.run();

console.log(`Bumped: ${result.bumped}`);
console.log(`Changed modules:`, result.changedModules);
console.log(`Created tags:`, result.createdTags);
```

For detailed pre-release configuration and examples, see [PRERELEASE.md](./PRERELEASE.md).

## VersuRunner API

### Options

```typescript
interface RunnerOptions {
  repoRoot: string;                    // Path to repository root
  adapter?: string;                    // Language adapter (auto-detected if not specified)
  dryRun?: boolean;                    // Preview changes without writing (default: false)
  pushTags?: boolean;                  // Push version tags (default: true)
  prereleaseMode?: boolean;            // Generate pre-release versions (default: false)
  prereleaseId?: string;               // Pre-release identifier: alpha, beta, rc, etc. (default: 'alpha')
  bumpUnchanged?: boolean;             // Bump modules with no changes in prerelease mode (default: false)
  addBuildMetadata?: boolean;          // Add build metadata with short SHA (default: false)
  timestampVersions?: boolean;         // Use timestamp-based prerelease IDs (default: false)
  appendSnapshot?: boolean;            // Add -SNAPSHOT suffix (Gradle only) (default: false)
  pushChanges?: boolean;               // Commit and push version changes (default: true)
  generateChangelog?: boolean;         // Generate changelogs (default: true)
}
```

### Result

```typescript
interface RunnerResult {
  bumped: boolean;                     // Whether any version was updated
  changedModules: Array<{
    name: string;                      // Module name
    from: string;                      // Previous version
    to: string;                        // New version
  }>;
  createdTags: string[];              // Git tags that were created
  changelogPaths: string[];           // Generated changelog file paths
}
```

## Configuration

VERSU core uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for configuration loading and [Zod](https://github.com/colinhacks/zod) for validation.

### Supported Configuration Files

1. `package.json` (in a `"versu"` property)
2. `.versurc.json`
3. `.versurc.yaml` / `.versurc.yml`
4. `.versurc.js` or `versu.config.js` (JavaScript)

### Configuration Example

```json
{
  "defaultBump": "patch",
  "commitTypes": {
    "feat": "minor",
    "fix": "patch",
    "perf": "patch",
    "docs": "ignore"
  },
  "dependencyRules": {
    "onMajorOfDependency": "minor",
    "onMinorOfDependency": "patch",
    "onPatchOfDependency": "none"
  }
}
```

## Adapters

### Gradle Adapter

Built-in support for Gradle projects (Groovy & Kotlin DSL).

**Features:**

- Multi-module project detection
- Version management through root `gradle.properties`
- Dependency detection
- Both Groovy and Kotlin DSL support

**Version Format:**

```properties
# Root module
version=1.0.0

# Submodules
core.version=2.1.0
api.version=1.5.0
```

### Creating Custom Adapters

To add support for new project types, implement a language adapter following the pattern in `src/adapters/gradle/`:

```typescript
import { 
  AdapterIdentifier,
  ModuleDetector,
  VersionUpdateStrategy,
  ModuleSystemFactory,
  AdapterMetadata,
  RawProjectInformation,
  ProcessedModuleChange
} from '@versu/core';

// 1. Adapter identifier for auto-detection
class MyAdapterIdentifier implements AdapterIdentifier {
  readonly metadata: AdapterMetadata = {
    id: 'my-adapter',
    capabilities: { supportsSnapshots: false }
  };

  async accept(projectRoot: string): Promise<boolean> {
    // Check for adapter-specific files
    return await fileExists(path.join(projectRoot, 'my-build-file'));
  }
}

// 2. Module detector for discovering project structure
class MyModuleDetector implements ModuleDetector {
  async detectModules(projectRoot: string): Promise<RawProjectInformation> {
    // Discover and return modules and dependencies
    return {
      modules: [
        { name: 'root', path: projectRoot, version: '1.0.0' },
        { name: 'module-a', path: join(projectRoot, 'module-a'), version: '2.0.0' }
      ],
      dependencies: [
        { from: 'module-a', to: 'root' }
      ]
    };
  }
}

// 3. Version update strategy for applying changes
class MyVersionUpdateStrategy implements VersionUpdateStrategy {
  async applyVersionUpdates(
    changes: ProcessedModuleChange[],
    projectRoot: string
  ): Promise<void> {
    // Apply version changes to build files
    for (const change of changes) {
      // Update version in your project's format
    }
  }
}

// 4. Module system factory to tie it all together
class MyModuleSystemFactory implements ModuleSystemFactory {
  createDetector(): ModuleDetector {
    return new MyModuleDetector();
  }
  
  createVersionUpdateStrategy(): VersionUpdateStrategy {
    return new MyVersionUpdateStrategy();
  }
}
```

Then register your adapter:

1. Add to `src/factories/module-system-factory.ts` in the `createModuleSystemFactory` function
2. Add to `src/services/adapter-identifier-registry.ts` in the registry initialization

## Development

### Building

```bash
# From monorepo root
npm run build

# Or from core package
cd packages/core
npm run build
```

### Testing

```bash
# From monorepo root
npm test

# Or from core package
cd packages/core
npm test
npm run test:coverage
```

### Publishing

```bash
npm publish --workspace packages/core --access public
```

## Related Packages

- **[@versu/cli](../cli)** - Command-line interface
- **[@versu/action](../action)** - GitHub Actions integration

## Requirements

- **Node.js**: >= 20
- **TypeScript**: >= 5.0 (if using TypeScript)

## License

MIT License - see [LICENSE](../../LICENSE) for details.
