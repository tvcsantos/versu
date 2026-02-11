<!-- markdownlint-disable-next-line MD041 -->
![VERSU - Version Engine for Repo Semantic Evolution](docs/assets/images/versu_2.png)

# VERSU - Version Engine for Repo Semantic Evolution

*Orchestrating your monorepo multiverse.*

A semantic versioning engine for monorepos that uses Conventional Commits to automatically version modules independently while cascading changes through dependencies.

## Key Features

<!-- markdownlint-disable MD033 -->
✅ **Conventional Commits Parsing** - Automatically determines version bumps based on commit messages<br>
✅ **Multi-Module Support** - Each module can be versioned independently<br>
✅ **Dependency Cascade** - When a dependency changes, dependents are automatically bumped<br>
✅ **Gradle Adapter** - First-class support for Gradle (Groovy & Kotlin DSL)<br>
✅ **Extensible Architecture** - Easy to add adapters for other ecosystems<br>
✅ **Changelog Generation** - Automatic per-module changelog generation (to be added)<br>
✅ **Pre-release Support** - Generate alpha, beta, rc, or custom pre-release versions<br>
✅ **Multiple Interfaces** - Use as a library, CLI tool, or GitHub Action
<!-- markdownlint-enable MD033 -->

## 📦 Packages

VERSU provides three packages for different use cases. For more details, see the individual package READMEs.

### [@versu/core](packages/core)

Core library with the `VersuRunner` API for programmatic version management. Framework-agnostic with adapters for different project types (Gradle, extensible).

**Use when:** Building custom tools or integrations that need version management.

### [@versu/cli](packages/cli)

Command-line interface for interactive version management in local development and CI/CD pipelines.

**Use when:** You need CLI control or want to integrate with non-GitHub CI/CD systems.

### [@versu/action](packages/action)

GitHub Actions integration for automated versioning in workflow pipelines.

**Use when:** You want automated versioning in GitHub workflows.

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

To add support for new project types, see the [core package documentation](packages/core#creating-custom-adapters) for instructions on implementing custom adapters.

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
│       ├── adapters/    # Project type adapters (Gradle, etc.)
│       ├── services/    # Core services (versioning, git, changelog)
│       └── config/      # Configuration system
├── cli/                 # CLI tool (@versu/cli)
│   └── src/
└── action/              # GitHub Action (@versu/action)
    └── src/
```

Each package has its own README with detailed documentation. The monorepo uses npm workspaces for dependency management.

## License

MIT License - see [LICENSE](LICENSE) for details.
