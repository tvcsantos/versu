<!-- markdownlint-disable MD041 -->

![versu](docs/assets/images/versu_4.png)

<!-- markdownlint-enable MD041 -->

# versu

_Compose the epic of your code, one release at a time._

**VERSU** is an intelligent versioning automation tool that eliminates manual version management in multi-module projects. By leveraging [Conventional Commits](https://conventionalcommits.org/), VERSU automatically analyzes your commit history, determines semantic version bumps, manages dependency cascades, and generates changelogs — all without developer intervention!

Whether you're working on a monorepo with dozens of interdependent modules or a simple single-module project, VERSU adapts to your workflow. Use it as a library in your custom tools, as a CLI in your terminal, or as a GitHub Action in your CI/CD pipeline. With its extensible plugin architecture, VERSU supports any build system or language ecosystem.

## Key Features

<!-- markdownlint-disable MD033 -->

✅ **Conventional Commits Parsing** - Automatically determines version bumps based on commit messages<br>
✅ **Multi-Module Support** - Each module can be versioned independently<br>
✅ **Dependency Cascade** - When a dependency changes, dependents are automatically bumped<br>
✅ **Changelog Generation** - Automatic per-module changelog generation from commit history<br>
✅ **Pre-release Support** - Generate alpha, beta, rc, or custom pre-release versions<br>
✅ **Multiple Interfaces** - Use as a library, CLI tool, or GitHub Action<br>
✅ **Plugin Architecture** - Extensible design for supporting any build system or ecosystem

<!-- markdownlint-enable MD033 -->

## Why VERSU?

### 🎯 The Problem

Managing versions in multi-module projects is painful:

- **Manual versioning is error-prone** - Developers forget to bump versions or choose the wrong increment
- **Dependencies are a nightmare** - When module A changes, which dependents need bumping? It's easy to miss cascading impacts
- **Inconsistent practices** - Different team members have different versioning philosophies
- **Changelog chaos** - Manually maintained changelogs become outdated or incomplete
- **CI/CD complexity** - Building robust versioning automation from scratch is time-consuming

### ✨ The Solution

VERSU automates the entire versioning lifecycle:

- **Zero manual decisions** - Your commit messages (`feat:`, `fix:`, `BREAKING CHANGE:`) dictate version bumps automatically
- **Smart dependency tracking** - When a module changes, VERSU automatically identifies and versions all dependents
- **Team consistency** - Everyone follows the same Conventional Commits standard, ensuring uniform versioning
- **Generated changelogs** - Beautiful, accurate changelogs generated per-module from commit history
- **Pre-release support** - Seamlessly generate alpha, beta, rc, or custom pre-release versions for testing
- **Ecosystem agnostic** - Works with Gradle, npm, Maven, or any ecosystem through custom plugins

### 🚀 Who Should Use VERSU?

- **Monorepo teams** managing multiple interdependent packages
- **Library maintainers** who want automated, semantic versioning
- **DevOps engineers** building robust CI/CD pipelines
- **Open source projects** seeking consistent release practices
- **Enterprise teams** needing audit trails and predictable versioning

## 📦 Packages

VERSU provides four packages for different use cases. For more details, see the individual package READMEs.

### [@versu/core](packages/core)

Core library with the `VersuRunner` API for programmatic version management. Framework-agnostic and extensible through plugins.

**Use when:** Building custom tools or integrations that need version management.

### [@versu/cli](packages/cli)

Command-line interface for interactive version management in local development and CI/CD pipelines.

**Use when:** You need CLI control or want to integrate with non-GitHub CI/CD systems.

### [@versu/action](packages/action)

GitHub Actions integration for automated versioning in workflow pipelines.

**Use when:** You want automated versioning in GitHub workflows.

### [@versu/plugin-gradle](packages/plugin-gradle)

Gradle adapter plugin that provides support for detecting and updating versions in Gradle projects (Groovy & Kotlin DSL).

**Use when:** Working with Gradle-based projects and need version management support.

## Commit Message Format

VERSU uses [Conventional Commits](https://conventionalcommits.org/) to automatically determine version bumps:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Examples (default configuration):**

- `feat(api): add new endpoint` → **minor** bump
- `fix(core): resolve memory leak` → **patch** bump
- `feat!: breaking API change` → **major** bump

> **Note:** Version bump rules are fully configurable via [configuration files](packages/core#configuration).

## Extending

To add support for new project types, see the [core package documentation](packages/core#creating-custom-adapters) for instructions on creating custom adapter plugins. Reference [@versu/plugin-gradle](packages/plugin-gradle) as an example implementation.

## Development

### Requirements

- [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) (Node version manager)
- Node.js (see [.nvmrc](.nvmrc))
- npm

### Setup

```bash
npm install    # Install dependencies
npm run build  # Build all packages
npm test       # Run tests
```

### Monorepo Structure

```text
packages/
├── core/                # Core library (@versu/core)
│   └── src/
│       ├── adapters/    # Core adapter interfaces and types
│       ├── services/    # Core services (versioning, git, changelog)
│       └── config/      # Configuration system
├── cli/                 # CLI tool (@versu/cli)
│   └── src/
├── action/              # GitHub Action (@versu/action)
│   └── src/
└── plugin-gradle/       # Gradle plugin (@versu/plugin-gradle)
    └── src/
```

Each package has its own README with detailed documentation. The monorepo uses npm workspaces for dependency management.

## License

MIT License - see [LICENSE](LICENSE) for details.
