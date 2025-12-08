# @muverse/cli - Command-Line Interface

Command-line interface for μVERSE (Version Engine for Repo Semantic Evolution). This CLI provides all the power of μVERSE's semantic versioning engine through an easy-to-use command-line tool, perfect for local development and custom CI/CD systems.

## Installation

### Global Installation

```bash
npm install -g @muverse/cli
```

### Local Installation

```bash
npm install --save-dev @muverse/cli
```

### Using npx (no installation)

```bash
px @muverse/cli
```

## Usage

### Basic Usage

Navigate to your project root and run:

```bash
muverse
```

This will:
1. Detect your project type (Gradle, etc.)
2. Analyze commits since the last version
3. Calculate version bumps based on Conventional Commits
4. Update version files
5. Generate changelogs
6. Create git commits and tags
7. Push changes to remote

### Dry Run

Preview what would happen without making changes:

```bash
muverse --dry-run
```

### Specify Project Root

```bash
muverse /path/to/project
```

### Specify Adapter

If auto-detection fails or you want to be explicit:

```bash
muverse --adapter gradle
```

## Command Reference

### `muverse [REPOSITORYROOT]`

Calculate and apply semantic version changes.

**Arguments:**
- `REPOSITORYROOT` - Path to the repository root (default: `.`)

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--dry-run` | Run without writing or pushing changes | `false` |
| `--adapter <value>` | Language adapter (e.g., gradle). Auto-detected if not provided | - |
| `--push-tags` | Push tags to origin | `true` |
| `--no-push-tags` | Don't push tags to origin | - |
| `--prerelease-mode` | Generate pre-release versions instead of final versions | `false` |
| `--prerelease-id <value>` | Pre-release identifier (e.g., alpha, beta, rc) | `alpha` |
| `--bump-unchanged` | In prerelease mode, bump modules even when no changes are detected | `false` |
| `--add-build-metadata` | Add build metadata with short SHA to all versions | `false` |
| `--timestamp-versions` | Use timestamp-based prerelease identifiers (requires prerelease-mode) | `false` |
| `--append-snapshot` | Add -SNAPSHOT suffix to all versions if supported by adapter | `false` |
| `--push-changes` | Commit and push version changes and changelogs to remote | `true` |
| `--no-push-changes` | Don't commit and push changes | - |
| `--generate-changelog` | Generate or update changelog files for changed modules | `true` |
| `--no-generate-changelog` | Don't generate changelogs | - |

> 📖 **Detailed Pre-release Documentation**: See [@muverse/core PRERELEASE.md](../core/PRERELEASE.md) for comprehensive examples and use cases.

## Examples

### Release Version

Apply semantic versions based on commits:

```bash
muverse
```

### Pre-release Versions

Generate beta pre-release versions:

```bash
muverse --prerelease-mode --prerelease-id beta
```

### Timestamp Versions

Generate timestamp-based pre-release versions for CI builds:

```bash
muverse --prerelease-mode --prerelease-id alpha --timestamp-versions --add-build-metadata
```

This generates versions like: `1.2.3-alpha.20251208.1530+abc1234`

### Gradle SNAPSHOT Versions

Generate Gradle SNAPSHOT versions:

```bash
muverse --append-snapshot
```

### Development Workflow

Bump all modules (even unchanged) for development:

```bash
muverse --prerelease-mode --bump-unchanged
```

### Local Testing

Test without committing or pushing:

```bash
muverse --dry-run --no-push-changes --no-push-tags
```

### Manual Git Operations

Calculate versions without automatic git operations:

```bash
muverse --no-push-changes --no-push-tags
```

Then manually review, commit, and push.

## Configuration

μVERSE CLI uses the same configuration system as the core library. Configuration files are automatically detected in your repository root.

### Supported Configuration Files

1. `package.json` (in a `"muverse"` property)
2. `.muverserc` (JSON or YAML)
3. `.muverserc.json`
4. `.muverserc.yaml` / `.muverserc.yml`
5. `.muverserc.js` (JavaScript)
6. `muverse.config.js` (JavaScript)

### Configuration Example

`.muverserc.json`:
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

For more configuration examples, see the [core package documentation](../core).

## Gradle Project Support

The CLI supports Gradle projects with:

- **Multi-module projects** via `settings.gradle(.kts)`
- **Version management** through root `gradle.properties` file
- **Dependency detection** via custom Gradle init script
- **Both DSLs**: Groovy and Kotlin

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

Breaking changes trigger **major** version bumps:

1. Using `!` after the type: `feat!: remove deprecated API`
2. Using `BREAKING CHANGE:` in the footer:
   ```
   feat: update API
   
   BREAKING CHANGE: The old API is removed
   ```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Install μVERSE CLI
  run: npm install -g @muverse/cli

- name: Version modules
  run: muverse --adapter gradle
```

### GitLab CI

```yaml
version:
  script:
    - npm install -g @muverse/cli
    - muverse --adapter gradle
```

### Jenkins

```groovy
stage('Version') {
  steps {
    sh 'npm install -g @muverse/cli'
    sh 'muverse --adapter gradle'
  }
}
```

### Local Development

Add to your `package.json`:

```json
{
  "scripts": {
    "version": "muverse --dry-run",
    "version:release": "muverse"
  }
}
```

Then run:
```bash
npm run version        # Dry run
npm run version:release # Actual release
```

## Troubleshooting

### Command Not Found

If `muverse` is not found after global installation:

1. Check npm global bin path: `npm bin -g`
2. Ensure it's in your PATH
3. Try using npx: `npx @muverse/cli`

### Permission Denied on Push

If you get permission errors when pushing:

1. Ensure you have proper git credentials configured
2. Check if you have write access to the repository
3. Use `--no-push-changes --no-push-tags` to skip git operations

### No Version Bump Detected

If versions aren't bumping:

1. Check commit messages follow Conventional Commits format
2. Verify you have commits since the last version
3. Check configuration if certain commit types are ignored
4. Use `--dry-run` to see what μVERSE detects

### Adapter Not Detected

If auto-detection fails:

1. Verify your project has the expected build files
2. Explicitly specify the adapter: `--adapter gradle`
3. Check if your project structure is supported

## Development

### Building from Source

```bash
# From monorepo root
npm install
npm run build

# Or from CLI package
cd packages/cli
npm install
npm run build
```

### Running Locally

```bash
# After building
node dist/index.js --dry-run
```

### Publishing

```bash
npm publish --workspace packages/cli --access public
```

## Related Packages

- **[@muverse/core](../core)** - Core library for custom integrations
- **[@muverse/action](../action)** - GitHub Actions integration

## License

MIT License - see [LICENSE](../../LICENSE) for details.
