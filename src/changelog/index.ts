import { promises as fs } from 'fs';
import { join } from 'path';
import { ModuleChangeResult } from '../services/version-applier.js';
import { CommitInfo } from '../git/index.js';

export type ChangelogEntry = {
  readonly moduleResult: ModuleChangeResult;
  readonly version: string;
  readonly date: string;
  readonly changes: {
    readonly breaking: CommitInfo[];
    readonly features: CommitInfo[];
    readonly fixes: CommitInfo[];
    readonly other: CommitInfo[];
  };
};

export type ChangelogOptions = {
  readonly includeCommitHashes: boolean;
  readonly includeScopes: boolean;
  readonly groupByType: boolean;
};

/**
 * Generate changelog for a module
 */
export async function generateChangelog(
  moduleResult: ModuleChangeResult,
  commits: CommitInfo[],
  options: ChangelogOptions = {
    includeCommitHashes: false,
    includeScopes: true,
    groupByType: true,
  }
): Promise<string> {
  const entry: ChangelogEntry = {
    moduleResult,
    version: moduleResult.to,
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
    changes: {
      breaking: [],
      features: [],
      fixes: [],
      other: [],
    },
  };

  // Categorize commits
  for (const commit of commits) {
    if (commit.breaking) {
      entry.changes.breaking.push(commit);
    } else if (commit.type === 'feat') {
      entry.changes.features.push(commit);
    } else if (commit.type === 'fix') {
      entry.changes.fixes.push(commit);
    } else if (['perf', 'refactor', 'style'].includes(commit.type)) {
      entry.changes.other.push(commit);
    }
  }

  return formatChangelogEntry(entry, options);
}

/**
 * Format changelog entry as markdown
 */
function formatChangelogEntry(entry: ChangelogEntry, options: ChangelogOptions): string {
  const version = entry.version;
  let changelog = `## [${version}] - ${entry.date}\n\n`;

  // Breaking changes first
  if (entry.changes.breaking.length > 0) {
    changelog += '### 💥 BREAKING CHANGES\n\n';
    for (const commit of entry.changes.breaking) {
      changelog += formatCommitLine(commit, options) + '\n';
    }
    changelog += '\n';
  }

  // Features
  if (entry.changes.features.length > 0) {
    changelog += '### ✨ Features\n\n';
    for (const commit of entry.changes.features) {
      changelog += formatCommitLine(commit, options) + '\n';
    }
    changelog += '\n';
  }

  // Bug fixes
  if (entry.changes.fixes.length > 0) {
    changelog += '### 🐛 Bug Fixes\n\n';
    for (const commit of entry.changes.fixes) {
      changelog += formatCommitLine(commit, options) + '\n';
    }
    changelog += '\n';
  }

  // Other changes
  if (entry.changes.other.length > 0) {
    changelog += '### 🔧 Other Changes\n\n';
    for (const commit of entry.changes.other) {
      changelog += formatCommitLine(commit, options) + '\n';
    }
    changelog += '\n';
  }

  return changelog;
}

/**
 * Format a single commit line
 */
function formatCommitLine(commit: CommitInfo, options: ChangelogOptions): string {
  let line = '- ';

  // Add scope if available and enabled
  if (options.includeScopes && commit.scope) {
    line += `**${commit.scope}**: `;
  }

  // Add subject
  line += commit.subject;

  // Add hash if enabled
  if (options.includeCommitHashes) {
    line += ` (${commit.hash.substring(0, 7)})`;
  }

  return line;
}

/**
 * Update or create CHANGELOG.md file for a module
 */
export async function updateChangelogFile(
  moduleResult: ModuleChangeResult,
  changelogContent: string,
  repoRoot: string
): Promise<string> {
  const changelogPath = join(repoRoot, moduleResult.path, 'CHANGELOG.md');

  try {
    // Try to read existing changelog
    const existingContent = await fs.readFile(changelogPath, 'utf8');
    
    // Insert new content after the first heading
    const lines = existingContent.split('\n');
    let insertIndex = 0;
    
    // Find the first ## heading or the end of initial content
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) {
        insertIndex = i;
        break;
      }
      if (i === 0 && lines[i].startsWith('# ')) {
        // Skip the main heading
        continue;
      }
    }
    
    // Insert the new changelog entry
    const beforeInsert = lines.slice(0, insertIndex);
    const afterInsert = lines.slice(insertIndex);
    
    const updatedContent = [
      ...beforeInsert,
      changelogContent.trim(),
      '',
      ...afterInsert
    ].join('\n');
    
    await fs.writeFile(changelogPath, updatedContent, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      // Create new changelog file
      const moduleName = moduleResult.id === 'root' ? 'Root Module' : moduleResult.id;
      const newContent = `# Changelog - ${moduleName}\n\n${changelogContent}`;
      await fs.writeFile(changelogPath, newContent, 'utf8');
    } else {
      throw error;
    }
  }

  return changelogPath;
}

/**
 * Generate changelog for multiple modules
 */
export async function generateChangelogsForModules(
  moduleResults: ModuleChangeResult[],
  getCommitsForModule: (moduleId: string) => Promise<CommitInfo[]>,
  repoRoot: string,
  options?: ChangelogOptions
): Promise<string[]> {
  const changelogPaths: string[] = [];

  for (const moduleResult of moduleResults) {
    const commits = await getCommitsForModule(moduleResult.id);
    const changelogContent = await generateChangelog(
      moduleResult,
      commits,
      options
    );

    const changelogPath = await updateChangelogFile(
      moduleResult,
      changelogContent,
      repoRoot
    );

    changelogPaths.push(changelogPath);
  }

  return changelogPaths;
}

/**
 * Generate a root changelog that summarizes all module changes
 */
export async function generateRootChangelog(
  moduleResults: ModuleChangeResult[],
  repoRoot: string
): Promise<string> {
  const rootChangelogPath = join(repoRoot, 'CHANGELOG.md');
  const date = new Date().toISOString().split('T')[0];
  
  let content = `## ${date}\n\n`;
  
  if (moduleResults.length === 0) {
    content += 'No changes in this release.\n\n';
  } else {
    content += '### Module Updates\n\n';
    
    for (const moduleResult of moduleResults) {
      const fromVersion = moduleResult.from;
      const toVersion = moduleResult.to;
      const moduleName = moduleResult.id === 'root' ? 'Root' : moduleResult.id;
      
      content += `- **${moduleName}**: ${fromVersion} → ${toVersion}\n`;
    }
    content += '\n';
  }

  try {
    const existingContent = await fs.readFile(rootChangelogPath, 'utf8');
    const lines = existingContent.split('\n');
    
    // Find insertion point (after main heading)
    let insertIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('## ') && i > 0) {
        insertIndex = i;
        break;
      }
    }
    
    const beforeInsert = lines.slice(0, insertIndex);
    const afterInsert = lines.slice(insertIndex);
    
    const updatedContent = [
      ...beforeInsert,
      content.trim(),
      '',
      ...afterInsert
    ].join('\n');
    
    await fs.writeFile(rootChangelogPath, updatedContent, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      const newContent = `# Changelog\n\n${content}`;
      await fs.writeFile(rootChangelogPath, newContent, 'utf8');
    } else {
      throw error;
    }
  }

  return rootChangelogPath;
}
