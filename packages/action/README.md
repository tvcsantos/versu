# @muverse/action - GitHub Action

GitHub Actions wrapper for μVERSE (Version Engine for Repo Semantic Evolution). This action provides seamless integration with GitHub workflows for automatic semantic versioning across your monorepo projects.

## Features

✅ **Automatic Version Bumping** - Based on Conventional Commits  
✅ **Multi-Module Support** - Independent versioning for each module  
✅ **Dependency Cascade** - Auto-bump dependents when dependencies change  
✅ **Changelog Generation** - Automatic per-module changelogs  
✅ **Git Integration** - Automatic commits, tags, and pushes  
✅ **Pre-release Support** - Alpha, beta, rc, and custom pre-release versions  
✅ **Adapter Auto-Detection** - Automatically detects project type (Gradle, etc.)  
✅ **Flexible Configuration** - Via action inputs or configuration files

## Usage

### Basic Usage

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
      - name: μVERSE Semantic Evolution
        id: versioner
        uses: tvcsantos/muverse@v1
        with:
          dry-run: false
          # adapter: gradle  # Optional - μVERSE will auto-detect your project type
      - name: Print results
        run: |
          echo "Bumped: ${{ steps.versioner.outputs.bumped }}"
          echo "Changed: ${{ steps.versioner.outputs['changed-modules'] }}"
```

### Adapter Auto-Detection

μVERSE automatically detects your project type based on the files present in your repository. You don't need to specify the `adapter` input in most cases:

- **Gradle Projects**: Detected by presence of `build.gradle`, `build.gradle.kts`, `settings.gradle`, or `settings.gradle.kts`
- **Future Adapters**: More project types will be supported in future releases

If auto-detection fails, μVERSE will throw an error asking you to explicitly specify the `adapter` input:

```yaml
- name: μVERSE Semantic Evolution
  uses: tvcsantos/muverse@v1
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
        uses: tvcsantos/muverse@v1
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
        uses: tvcsantos/muverse@v1
        with:
          adapter: gradle
          prerelease-mode: true
          prerelease-id: alpha
          timestamp-versions: true
          bump-unchanged: true
          add-build-metadata: true
```

This generates versions like: `1.2.3-alpha.20251208.1530+abc1234` where:
- `alpha.20251208.1530` is the timestamp-based prerelease identifier (YYYYMMDD.HHMM format)
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
        uses: tvcsantos/muverse@v1
        with:
          adapter: gradle
          append-snapshot: true
```

This applies `-SNAPSHOT` suffix to **all** module versions, generating versions like: `1.2.3-SNAPSHOT`, `2.1.0-SNAPSHOT`

## Action Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `dry-run` | Run without writing or pushing | `false` |
| `adapter` | Language adapter (auto-detected if not provided) | `` |
| `push-tags` | Push tags to origin | `true` |
| `prerelease-mode` | Generate pre-release versions | `false` |
| `prerelease-id` | Pre-release identifier | `alpha` |
| `bump-unchanged` | Bump modules with no changes in prerelease mode | `false` |
| `add-build-metadata` | Add build metadata with short SHA to all versions | `false` |
| `timestamp-versions` | Use timestamp-based prerelease identifiers (e.g., alpha.20251208.1530) | `false` |
| `append-snapshot` | Add -SNAPSHOT suffix to all versions if supported by adapter (e.g. `gradle`) | `false` |
| `push-changes` | Commit and push version changes and changelogs to remote | `true` |
| `generate-changelog` | Generate or update changelog files for changed modules | `true` |

> 📖 **Detailed Pre-release Documentation**: See [PRERELEASE.md](../core/PRERELEASE.md) for comprehensive examples and use cases.

## Action Outputs

| Output | Description |
|--------|-------------|
| `bumped` | Whether any module was bumped |
| `changed-modules` | JSON array of changed modules |
| `created-tags` | Comma-separated list of created tags |
| `changelog-paths` | Comma-separated changelog file paths |

### Using Outputs

```yaml
- name: μVERSE Semantic Evolution
  id: versioner
  uses: tvcsantos/muverse@v1
  
- name: Check if bumped
  if: steps.versioner.outputs.bumped == 'true'
  run: echo "Versions were updated!"
  
- name: Process changed modules
  run: echo '${{ steps.versioner.outputs.changed-modules }}' | jq .
  
- name: List created tags
  run: echo "Tags: ${{ steps.versioner.outputs.created-tags }}"
```

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
  uses: tvcsantos/muverse@v1
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

## Configuration

μVERSE uses [cosmiconfig](https://github.com/davidtheclark/cosmiconfig) for flexible configuration loading and [Zod](https://github.com/colinhacks/zod) for type-safe validation. Configuration files are automatically detected in your repository root.

### Supported Configuration Files

μVERSE will automatically search for configuration in the following order:

1. `package.json` (in a `"muverse"` property)
2. `.muverserc` (JSON or YAML)
3. `.muverserc.json`
4. `.muverserc.yaml` / `.muverserc.yml`
5. `.muverserc.js` (JavaScript)
6. `muverse.config.js` (JavaScript)

### Configuration Options

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| `defaultBump` | `string` | Default version bump type when conventional commit types don't match | `patch` |
| `commitTypes` | `object` | Maps conventional commit types to version bump types or `ignore` | See examples below |
| `dependencyRules` | `object` | How to bump dependents when dependencies change | See examples below |

### Configuration Examples

#### JSON Format (`.muverserc.json`)
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

#### YAML Format (`.muverserc.yaml`)
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

#### JavaScript Format (`muverse.config.js`)
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
  "muverse": {
    "defaultBump": "patch",
    "commitTypes": {
      "feat": "minor",
      "fix": "patch"
    }
  }
}
```

### Configuration Validation

All configuration files are validated using [Zod](https://github.com/colinhacks/zod) schemas to ensure correctness and consistency. If validation fails, μVERSE will provide a detailed error message indicating which configuration fields are invalid.

## Gradle Project Support

The Gradle adapter supports:

- **Multi-module projects** via `settings.gradle(.kts)`
- **Version source**: Root `gradle.properties` file only
- **Dependency detection**: Custom Gradle init script to analyze project dependencies
- **Both DSLs**: Groovy and Kotlin DSL

### Example Project Structure

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

### Example `gradle.properties`

```properties
# Root module version
version=1.0.0

# Submodule versions
core.version=2.1.0
api.version=1.5.0
```

### Version Management

μVERSE manages all module versions through the **root** `gradle.properties` file:

- **All module versions** must be declared in the root `gradle.properties` file
- **Root module** version uses the `version` property
- **Submodule versions** use the pattern `{moduleName}.version` (e.g., `core.version`)
- **Version updates** are applied directly to the root `gradle.properties` file
- **Project dependencies** are detected using a Gradle custom init script

## Commit Message Format

μVERSE uses [Conventional Commits](https://conventionalcommits.org/) to determine version bumps:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples:**
- `feat(api): add new endpoint` → **minor** bump
- `fix(core): resolve memory leak` → **patch** bump  
- `feat!: breaking API change` → **major** bump

### Breaking Changes

Breaking changes can be indicated in two ways:
1. Using `!` after the type: `feat!: remove deprecated API`
2. Using `BREAKING CHANGE:` in the footer:
   ```
   feat: update API
   
   BREAKING CHANGE: The old API is removed
   ```

Both trigger a **major** version bump.

## Complete Workflow Example

Here's a comprehensive workflow that handles different branches:

```yaml
name: Version Management

on:
  push:
    branches:
      - main
      - develop
      - 'feature/**'

jobs:
  version:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}
          
      - name: Configure Git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
      
      # Production releases
      - name: Release version
        if: github.ref == 'refs/heads/main'
        id: release
        uses: tvcsantos/muverse@v1
        with:
          adapter: gradle
          push-changes: true
          push-tags: true
      
      # Development pre-releases
      - name: Pre-release version
        if: github.ref == 'refs/heads/develop'
        id: prerelease
        uses: tvcsantos/muverse@v1
        with:
          adapter: gradle
          prerelease-mode: true
          prerelease-id: beta
          bump-unchanged: true
          push-changes: true
          push-tags: false
      
      # Feature branch CI versions
      - name: CI version
        if: startsWith(github.ref, 'refs/heads/feature/')
        id: ci
        uses: tvcsantos/muverse@v1
        with:
          adapter: gradle
          prerelease-mode: true
          prerelease-id: alpha
          timestamp-versions: true
          add-build-metadata: true
          bump-unchanged: true
          push-changes: false
          push-tags: false
      
      - name: Report results
        run: |
          echo "Branch: ${{ github.ref }}"
          if [ "${{ github.ref }}" == "refs/heads/main" ]; then
            echo "Changed modules: ${{ steps.release.outputs.changed-modules }}"
            echo "Created tags: ${{ steps.release.outputs.created-tags }}"
          elif [ "${{ github.ref }}" == "refs/heads/develop" ]; then
            echo "Changed modules: ${{ steps.prerelease.outputs.changed-modules }}"
          else
            echo "Changed modules: ${{ steps.ci.outputs.changed-modules }}"
          fi
```

## Troubleshooting

### Permission Denied on Push

If you get permission errors when pushing:

1. Ensure `fetch-depth: 0` is set in checkout
2. Use a token with write permissions:
   ```yaml
   - uses: actions/checkout@v4
     with:
       token: ${{ secrets.PAT_TOKEN }}  # Personal access token
   ```

### No Version Bump Detected

If versions aren't bumping:

1. Check commit messages follow Conventional Commits format
2. Verify commits are in the repository (use `fetch-depth: 0`)
3. Check configuration if certain commit types should be ignored

### Adapter Not Detected

If auto-detection fails:

1. Verify your project has the expected build files
2. Explicitly specify the adapter:
   ```yaml
   with:
     adapter: gradle
   ```

## Related Packages

- **[@muverse/core](../core)** - Core library for custom integrations
- **[@muverse/cli](../cli)** - CLI tool for local development

## License

MIT License - see [LICENSE](../../LICENSE) for details.
