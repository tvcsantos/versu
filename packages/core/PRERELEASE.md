# Pre-release Version Support

VERSU supports generating pre-release versions for development and testing builds.

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `prereleaseMode` | Generate pre-release versions | `false` |
| `prereleaseId` | Pre-release identifier (alpha, beta, rc, dev) | `'alpha'` |
| `bumpUnchanged` | Bump modules with no changes | `false` |
| `addBuildMetadata` | Add short SHA to versions (+abc1234) | `false` |
| `timestampVersions` | Use timestamp-based IDs (YYYYMMDD.HHMM) | `false` |
| `appendSnapshot` | Add -SNAPSHOT suffix (Gradle only) | `false` |
| `pushChanges` | Commit and push changes | `true` |

## Examples

| Scenario | Options | Result |
|----------|---------|--------|
| **Basic pre-release** | `prereleaseMode: true`<br>`prereleaseId: 'alpha'` | `1.2.3` → `1.2.4-alpha.0` |
| **Beta releases** | `prereleaseMode: true`<br>`prereleaseId: 'beta'` | `1.2.3` → `1.3.0-beta.0` |
| **Release candidates** | `prereleaseMode: true`<br>`prereleaseId: 'rc'` | `1.2.3` → `2.0.0-rc.0` |
| **Timestamp versions** | `prereleaseMode: true`<br>`timestampVersions: true` | `1.2.3` → `1.2.4-alpha.20251208.1530` |
| **Build metadata** | `addBuildMetadata: true` | `1.2.3` → `1.2.3+abc1234` |
| **Complete CI build** | `prereleaseMode: true`<br>`timestampVersions: true`<br>`addBuildMetadata: true` | `1.2.3` → `1.2.4-alpha.20251208.1530+abc1234` |
| **Gradle snapshots** | `appendSnapshot: true` | `1.2.3` → `1.2.3-SNAPSHOT` |

## Version Behavior

| Mode | Change | Result |
|------|--------|--------|
| **Regular** | patch | `1.2.3` → `1.2.4` |
| | minor | `1.2.3` → `1.3.0` |
| | major | `1.2.3` → `2.0.0` |
| | none | no bump |
| **Pre-release** | patch | `1.2.3` → `1.2.4-alpha.0` |
| | minor | `1.2.3` → `1.3.0-alpha.0` |
| | major | `1.2.3` → `2.0.0-alpha.0` |
| | none | no bump (unless `bumpUnchanged: true`) |
| **Timestamp** | any | `1.2.3` → `1.2.4-alpha.20251208.1530` |
| **Build metadata** | none | `1.2.3` → `1.2.3+abc1234` |

## Common Workflows

| Workflow | Options | Use Case |
|----------|---------|----------|
| **Development builds** | `prereleaseMode: true`<br>`bumpUnchanged: true` | Every commit gets a version |
| **Feature testing** | `prereleaseMode: true`<br>`prereleaseId: 'alpha'` | Test feature branches |
| **Release candidates** | `prereleaseMode: true`<br>`prereleaseId: 'rc'` | Pre-release validation |
| **CI unique versions** | `timestampVersions: true`<br>`addBuildMetadata: true` | Unique per-build versions |
| **Validation only** | `dryRun: true`<br>`pushChanges: false` | Test without committing |
| **Manual review** | `pushChanges: false` | Review before committing |
