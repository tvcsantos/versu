<!-- markdownlint-disable MD041 -->

![versu](../../docs/assets/images/versu_4.png)

<!-- markdownlint-enable MD041 -->

# @versu/plugin-gradle - Gradle Adapter Plugin

Gradle adapter plugin for VERSU. Provides first-class support for versioning Gradle projects (Groovy & Kotlin DSL) in monorepo environments with automatic dependency detection and cascading version updates.

## Installation

### With Core Library

```bash
npm install @versu/core @versu/plugin-gradle
```

### With CLI

```bash
npm install -g @versu/cli @versu/plugin-gradle
```

### With GitHub Action

The plugin is automatically included with the GitHub Action. No separate installation needed.

## Features

<!-- markdownlint-disable MD033 -->
✅ **Multi-Module Support** - Automatic detection of Gradle multi-module projects<br>
✅ **Dual DSL Support** - Works with both Groovy and Kotlin DSL<br>
✅ **Centralized Versioning** - All versions managed through root `gradle.properties`<br>
✅ **Dependency Detection** - Automatic project dependency analysis<br>
✅ **SNAPSHOT Support** - Optional `-SNAPSHOT` suffix for development builds<br>
✅ **Auto-Detection** - Automatically detected when Gradle files are present
<!-- markdownlint-enable MD033 -->

## Usage

### With @versu/core

```typescript
import { VersuRunner } from '@versu/core';
import gradlePlugin from '@versu/plugin-gradle';

const runner = new VersuRunner({
  repoRoot: '/path/to/repository',
  plugins: [gradlePlugin],
  adapter: 'gradle', // Optional - auto-detected
});

const result = await runner.run();
```

### With @versu/cli

The plugin is automatically loaded when installed globally:

```bash
npm install -g @versu/plugin-gradle
versu --adapter gradle
```

### With @versu/action

```yaml
- name: Install Gradle plugin
  run: npm install -g @versu/plugin-gradle

- name: Version modules
  uses: versuhq/versu@v0
  with:
    adapter: gradle
```

## Project Structure

The Gradle adapter expects a specific project structure:

### Required Files

- `settings.gradle` or `settings.gradle.kts` - Defines multi-module structure
- `gradle.properties` (root) - Contains all module versions

### Version Management

All module versions must be declared in the **root** `gradle.properties` file:

```properties
# Root module version
version=1.0.0

# Submodule versions
core.version=2.1.0
api.version=1.5.0
utils.version=3.0.0
```

### Version Property Naming

- **Root module**: Use `version` property
- **Submodules**: Use `{moduleName}.version` pattern
  - Module name is derived from `settings.gradle(.kts)` configuration
  - For module `:core`, use property `core.version`
  - For module `:lib:utils`, use property `lib-utils.version` (`:` replaced with `-`)

### Example Project

```text
myproject/
├── settings.gradle.kts
├── build.gradle.kts
├── gradle.properties          # All versions here
├── core/
│   └── build.gradle.kts
├── api/
│   └── build.gradle.kts
└── lib/
    └── utils/
        └── build.gradle.kts
```

**settings.gradle.kts:**

```kotlin
rootProject.name = "myproject"

include(":core")
include(":api")
include(":lib:utils")
```

**gradle.properties:**

```properties
version=1.0.0
core.version=2.1.0
api.version=1.5.0
lib-utils.version=3.0.0
```

## Dependency Detection

The plugin automatically detects project dependencies using a custom Gradle init script. Dependencies are analyzed to determine version cascading when modules are updated.

### Supported Dependency Types

- `implementation`
- `api`
- `compileOnly`
- `runtimeOnly`
- And other standard Gradle dependency configurations

### Example

If `api` depends on `core`, and `core` gets a version bump, VERSU will automatically cascade the change to `api` based on your dependency rules configuration.

## Configuration

The Gradle plugin respects all VERSU configuration options. See the [core package documentation](../core#configuration) for details.

### Gradle-Specific Options

When using the `appendSnapshot` option, the plugin adds `-SNAPSHOT` suffix to all versions:

```typescript
const runner = new VersuRunner({
  repoRoot: '/path/to/repository',
  adapter: 'gradle',
  appendSnapshot: true, // Generates versions like 1.2.3-SNAPSHOT
});
```

## Auto-Detection

The plugin automatically activates when any of these files are present in the repository root:

- `build.gradle`
- `build.gradle.kts`
- `settings.gradle`
- `settings.gradle.kts`

## Plugin Architecture

The plugin implements the VERSU plugin contract:

```typescript
interface PluginContract {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string | string[];
  adapters: AdapterPluginContract[];
}
```

### Components

1. **GradleAdapterIdentifier** - Detects Gradle projects
2. **GradleModuleDetector** - Discovers modules and dependencies
3. **GradleVersionUpdateStrategy** - Updates versions in `gradle.properties`
4. **GradleModuleSystemFactory** - Orchestrates the components

## Limitations

- **Version Source**: Only `gradle.properties` is supported for version management
- **Module Location**: All modules must be declared in `settings.gradle(.kts)`
- **Version Format**: Versions must follow semantic versioning (e.g., `1.2.3`)

## Development

### Building

```bash
# From monorepo root
npm run build

# Or from plugin package
cd packages/plugin-gradle
npm run build
```

### Testing

```bash
# From monorepo root
npm test

# Or from plugin package
cd packages/plugin-gradle
npm test
npm run test:coverage
```

### Publishing

```bash
npm publish --workspace packages/plugin-gradle --access public
```

## Related Packages

- **[@versu/core](../core)** - Core library for programmatic usage
- **[@versu/cli](../cli)** - Command-line interface
- **[@versu/action](../action)** - GitHub Actions integration

## Requirements

- **Node.js**: >= 20
- **Gradle**: >= 6.0 (tested with Gradle 6.x - 8.x)
- **Java**: Required for running Gradle

## License

MIT License - see [LICENSE](../../LICENSE) for details.
