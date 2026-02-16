<!-- markdownlint-disable MD041 -->

![versu](../../docs/assets/images/versu_4.png)

<!-- markdownlint-enable MD041 -->

# @versu/plugin-maven - Maven Adapter Plugin

Maven adapter plugin for VERSU. Provides support for detecting and updating versions in Maven multi-module projects.

## Installation

```bash
npm install @versu/core @versu/plugin-maven
```

## Usage

```typescript
import { VersuRunner } from '@versu/core';
import mavenPlugin from '@versu/plugin-maven';

const runner = new VersuRunner({
  repoRoot: '/path/to/repository',
  plugins: [mavenPlugin],
  adapter: 'maven', // Optional - auto-detected
});

const result = await runner.run();
```

## Auto-Detection

The plugin automatically activates when `pom.xml` is present in the repository root.

## Notes

- Module IDs follow Gradle-style notation (e.g., `:` for root, `:core`, `:lib:utils`).
- The plugin updates:
  - `<project><version>` when the module declares its own version.
  - `<project><parent><version>` when the parent module version changes.
