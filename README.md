![VERSE - Version Engine for Repo Semantic Evolution](docs/assets/images/verse.png)

# VERSE - Version Engine for Repo Semantic Evolution

**VERSE** orchestrates the multiverse of your monorepo, where each module exists as an independent universe with its own semantic evolution timeline. Like cosmic events rippling through space-time, changes in one module intelligently cascade through dependency relationships, ensuring your entire codebase multiverse remains harmoniously synchronized.

This powerful TypeScript GitHub Action harnesses Conventional Commits to automatically evolve semantic versions across your project multiverse, maintaining perfect dimensional stability while allowing each module universe to grow at its own pace.

## Key Features

✅ **Conventional Commits Parsing** - Automatically determines version bumps based on commit messages  
✅ **Multi-Module Support** - Each module can be versioned independently  
✅ **Dependency Cascade** - When a dependency changes, dependents are automatically bumped  
✅ **Gradle Adapter** - First-class support for Gradle (Groovy & Kotlin DSL)  
✅ **Extensible Architecture** - Easy to add adapters for other ecosystems  
✅ **Changelog Generation** - Automatic per-module changelog generation  
✅ **GitHub Integration** - Creates tags automatically  
✅ **Pre-release Support** - Generate alpha, beta, rc, or custom pre-release versions

## Usage

Add this action to your workflow:

```yaml
name: Release
on:
  push:
    branches: [ "main" ]

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: VERSE Semantic Evolution
        id: versioner
        uses: tvcsantos/verse@v1
        with:
          dry-run: false
          # adapter: gradle  # Optional - VERSE will auto-detect your project type
      - name: Print results
        run: |
          echo "Bumped: ${{ steps.versioner.outputs.bumped }}"
          echo "Changed: ${{ steps.versioner.outputs['changed-modules'] }}"
```

### Adapter Auto-Detection

VERSE automatically detects your project type based on the files present in your repository. You don't need to specify the `adapter` input in most cases:

- **Gradle Projects**: Detected by presence of `build.gradle`, `build.gradle.kts`, `settings.gradle`, or `settings.gradle.kts`
- **Future Adapters**: More project types will be supported in future releases

If auto-detection fails, VERSE will throw an error asking you to explicitly specify the `adapter` input:

```yaml
- name: VERSE Semantic Evolution
  uses: tvcsantos/verse@v1
  with:
    adapter: gradle  # Required if auto-detection fails
```

**Supported Adapters**: `gradle`

### Pre-release Versions

For development builds or pre-release versions:

```yaml
name: Development Build
on:
  push:
    branches: [ "develop" ]

jobs:
  prerelease-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create pre-release versions
        uses: tvcsantos/verse@v1
        with:
          adapter: gradle
          prerelease-mode: true
          prerelease-id: alpha
          bump-unchanged: true
```

### Timestamp-based Versions

For time-based unique versions (useful for CI/CD pipelines):

```yaml
name: CI Build
on:
  pull_request:
  push:
    branches: [ "feature/*", "develop" ]

jobs:
  ci-version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create timestamp versions
        uses: tvcsantos/verse@v1
        with:
          adapter: gradle
          prerelease-mode: true
          prerelease-id: alpha
          timestamp-versions: true
          bump-unchanged: true
          add-build-metadata: true
```

This generates versions like: `1.2.3-alpha.20251008.1530+abc1234` where:
- `alpha.20251008.1530` is the timestamp-based prerelease identifier (YYYYMMDD.HHMM format)
- `abc1234` is the short SHA build metadata

### Gradle SNAPSHOT Versions

For Gradle projects using the conventional `-SNAPSHOT` suffix:

```yaml
name: Development Build
on:
  push:
    branches: [ "develop" ]

jobs:
  gradle-snapshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Create Gradle SNAPSHOT versions
        uses: tvcsantos/verse@v1
        with:
          adapter: gradle
          append-snapshot: true
```

This applies `-SNAPSHOT` suffix to **all** module versions, generating versions like: `1.2.3-SNAPSHOT`, `2.1.0-SNAPSHOT`

## Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `dry-run` | Run without making changes | `false` |
| `adapter` | Language adapter to use (auto-detected if not provided) | `auto-detect` |
| `config-path` | Optional path to specific config file (auto-discovery used if not provided) | `` |
| `push-tags` | Push tags to remote | `true` |
| `prerelease-mode` | Generate pre-release versions | `false` |
| `prerelease-id` | Pre-release identifier | `alpha` |
| `bump-unchanged` | Bump modules with no changes in prerelease mode | `false` |
| `add-build-metadata` | Add build metadata with short SHA to all versions | `false` |
| `timestamp-versions` | Use timestamp-based prerelease identifiers (e.g., alpha.20251008.1530) | `false` |
| `append-snapshot` | Add -SNAPSHOT suffix to all versions if supported by adapter (e.g. `gradle`) | `false` |
| `push-changes` | Commit and push version changes and changelogs to remote | `true` |
| `generate-changelog` | Generate or update changelog files for changed modules | `true` |

> 📖 **Detailed Pre-release Documentation**: See [PRERELEASE.md](PRERELEASE.md) for comprehensive examples and use cases.

## Git Operations

The action automatically handles git operations as part of the versioning workflow:

### Automatic Commit and Push

By default (`push-changes: true`), the action will:
1. **Generate** version updates and changelogs
2. **Commit** all changed files with message: `"chore: update versions and changelogs"`  
3. **Push** changes to the remote repository
4. **Create and push** version tags (if `push-tags: true`)

### Disabling Git Operations

For workflows where you want to handle git operations manually:

```yaml
- name: Version modules (no git operations)
  uses: tvcsantos/verse@v1
  with:
    adapter: gradle
    push-changes: false    # Disable automatic commit/push
    push-tags: false       # Disable automatic tag pushing
```

This is useful when:
- **Running in forks** or environments without write permissions
- **Custom commit workflows** that require specific commit messages or signing
- **Multi-step pipelines** where versioning is separated from publishing
- **Testing and validation** before committing changes

### Git Configuration Requirements

For git operations to work, ensure your workflow has:

```yaml
steps:
  - uses: actions/checkout@v4
    with:
      fetch-depth: 0        # Full history for version calculation
      token: ${{ secrets.GITHUB_TOKEN }}  # Or personal access token
  - name: Configure Git
    run: |
      git config --global user.name "github-actions[bot]"
      git config --global user.email "github-actions[bot]@users.noreply.github.com"
```

## Action Outputs

| Output | Description |
|--------|-------------|
| `bumped` | Whether any module was bumped |
| `changed-modules` | JSON array of changed modules |
| `created-tags` | Comma-separated list of created tags |
| `changelog-paths` | Comma-separated changelog file paths |

## Configuration

VERSE uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for flexible configuration loading and [Zod](https://github.com/colinhacks/zod) for type-safe validation. It automatically searches for configuration in multiple formats and locations using standard naming conventions, validates the configuration against a schema, and provides detailed error messages if validation fails.

### Supported Configuration Files

VERSE will automatically search for configuration in the following order:

1. `package.json` (in a `"verse"` property)
2. `.verserc` (JSON or YAML)
3. `.verserc.json`
4. `.verserc.yaml` / `.verserc.yml`
5. `.verserc.js` (JavaScript)
6. `verse.config.js` (JavaScript)

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `defaultBump` | `string` | Default version bump type when conventional commit types don't match | `patch` |
| `commitTypes` | `object` | Maps conventional commit types to version bump types or `ignore` | See examples below |
| `dependencyRules` | `object` | How to bump dependents when dependencies change | See examples below |
| `nodejs` | `object` | Node.js-specific configuration options | `{}` |

### Configuration Examples

#### JSON Format (`.verserc.json`)
```json
{
  "defaultBump": "patch",
  "commitTypes": {
    "feat": "minor",
    "fix": "patch",
    "perf": "patch",
    "refactor": "patch",
    "docs": "ignore",
    "test": "ignore",
    "chore": "ignore"
  },
  "dependencyRules": {
    "onMajorOfDependency": "minor",
    "onMinorOfDependency": "patch",
    "onPatchOfDependency": "none"
  }
}
```

#### YAML Format (`.verserc.yaml`)
```yaml
defaultBump: patch

commitTypes:
  feat: minor
  fix: patch
  perf: patch
  refactor: patch
  docs: ignore
  test: ignore
  chore: ignore

dependencyRules:
  onMajorOfDependency: minor
  onMinorOfDependency: patch
  onPatchOfDependency: none
```

#### JavaScript Format (`verse.config.js`)
```javascript
module.exports = {
  defaultBump: 'patch',
  commitTypes: {
    feat: 'minor',
    fix: 'patch',
    // Dynamic configuration based on environment
    ...(process.env.NODE_ENV === 'production' ? {
      docs: 'patch'
    } : {
      docs: 'ignore'
    })
  },
  dependencyRules: {
    onMajorOfDependency: 'minor',
    onMinorOfDependency: 'patch',
    onPatchOfDependency: 'none'
  }
};
```

#### Package.json Format
```json
{
  "name": "my-project",
  "verse": {
    "defaultBump": "patch",
    "commitTypes": {
      "feat": "minor",
      "fix": "patch"
    }
  }
}
```

### Usage Examples

#### Using Auto-Discovery (Recommended)
```yaml
- name: VERSE Semantic Evolution
  uses: tvcsantos/verse@v1
  with:
    adapter: gradle
    # No config-path needed - VERSE will find your config automatically
```

#### Using Specific Config File
```yaml
- name: VERSE Semantic Evolution
  uses: tvcsantos/verse@v1
  with:
    adapter: gradle
    config-path: 'custom/path/to/verse.config.js'
```

### Configuration Validation

All configuration files are validated using [Zod](https://github.com/colinhacks/zod) schemas to ensure correctness and consistency. This provides:

- **Type Safety**: Configuration values are validated against their expected types
- **Clear Error Messages**: Invalid configurations produce detailed error messages
- **Runtime Validation**: Catches configuration errors before execution
- **Schema Enforcement**: Ensures only valid values are accepted

If validation fails, VERSE will provide a detailed error message indicating which configuration fields are invalid, making it easy to identify and fix issues.

### Legacy Configuration

If you specify a `config-path` in your GitHub Action, VERSE will try to load that specific file first. If not found, it will fall back to the automatic discovery described above.

## Gradle Project Structure

The Gradle adapter supports:

- **Multi-module projects** via `settings.gradle(.kts)`
- **Version source**: Root `gradle.properties` file only
- **Dependency detection**: Custom Gradle init script to analyze project dependencies
- **Both DSLs**: Groovy and Kotlin DSL

Example structure:
```
myproject/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties      # All module versions defined here
├── core/
│   └── build.gradle.kts
└── api/
    └── build.gradle.kts
```

Example `gradle.properties`:
```properties
# Root module version
version=1.0.0

# Submodule versions
core.version=2.1.0
api.version=1.5.0
```

### Version Management

VERSE manages all module versions through the **root** `gradle.properties` file:

- **All module versions** must be declared in the root `gradle.properties` file
- **Root module** version uses the `version` property
- **Submodule versions** use the pattern `{moduleName}.version` (e.g., `core.version`)
- **Version updates** are applied directly to the root `gradle.properties` file
- **Project dependencies** are detected using a Gradle custom init script

## Commit Message Format

Use [Conventional Commits](https://conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Examples:
- `feat(api): add new endpoint` → **minor** bump
- `fix(core): resolve memory leak` → **patch** bump  
- `feat!: breaking API change` → **major** bump

## Development

### Setup
```bash
npm install
npm run build
npm test
```

### Building
```bash
npm run package  # Creates dist/index.js for GitHub Actions
```

### Testing
```bash
npm test              # Run all tests
npm run test:coverage # Run with coverage
```

## Architecture

- **`src/adapters/`** - Language-specific adapters (Gradle, with extensible architecture for future adapters)
- **`src/services/`** - Core services (version bumping, module registry, changelog generation, git operations, configuration validation)
- **`src/factories/`** - Factory pattern implementations for adapter and module system creation
- **`src/semver/`** - Semantic version utilities
- **`src/git/`** - Git operations and commit parsing
- **`src/config/`** - Configuration loading, Zod schema definitions, and validation
- **`src/changelog/`** - Changelog generation
- **`src/utils/`** - Utility functions for versioning, commits, and file operations

## Extending

Add new language adapters by implementing the adapter interfaces:

```typescript
// Adapter identifier for auto-detection
class MyAdapterIdentifier implements AdapterIdentifier {
  readonly metadata: AdapterMetadata = {
    id: 'my-adapter',
    capabilities: { supportsSnapshots: false }
  };

  async accept(projectRoot: string): Promise<boolean> {
    // Check for adapter-specific files (e.g., build files)
    return await fileExists(path.join(projectRoot, 'my-build-file'));
  }
}

// Module detector for discovering project modules
class MyModuleDetector implements ModuleDetector {
  async detectModules(projectRoot: string): Promise<RawProjectInformation> {
    // Detect and return module information
  }
}

// Version update strategy for applying version changes
class MyVersionUpdateStrategy implements VersionUpdateStrategy {
  async applyVersionUpdates(
    changes: ProcessedModuleChange[],
    projectRoot: string
  ): Promise<void> {
    // Apply version changes to build files
  }
}
```

## License

MIT License - see [LICENSE](LICENSE) for details.