import { getExecOutput, exec } from '@actions/exec';
import * as conventionalCommitsParser from 'conventional-commits-parser';
import * as core from '@actions/core';

export type GitTag = {
  readonly name: string;
  readonly hash: string;
  readonly module?: string;
  readonly version?: string;
};

export type GitOptions = {
  readonly cwd?: string;
};

export type CommitInfo = {
  readonly hash: string;
  readonly type: string;
  readonly scope?: string;
  readonly subject: string;
  readonly body?: string;
  readonly breaking: boolean;
  readonly module?: string;
};

/**
 * Get commits since the last tag for a specific module
 * @param modulePath Path to the module from repository root
 * @param moduleName Name of the module
 * @param moduleType Type of module (root or module)
 * @param options Git options including cwd
 * @param excludePaths Paths to exclude from the commit search (e.g., child modules)
 */
export async function getCommitsSinceLastTag(
  modulePath: string,
  moduleName: string,
  moduleType: 'root' | 'module',
  options: GitOptions = {},
  excludePaths: string[] = []
): Promise<CommitInfo[]> {
  const cwd = options.cwd || process.cwd();
  
  try {
    // Find the last tag for this module
    const lastTag = await getLastTagForModule(moduleName, moduleType, { cwd });
    
    // Get commits since that tag
    const range = lastTag ? `${lastTag}..HEAD` : '';
    return getCommitsInRange(range, modulePath, { cwd }, excludePaths);
  } catch (error) {
    // If no tags found, get all commits
    return getCommitsInRange('', modulePath, { cwd }, excludePaths);
  }
}

/**
 * Get commits in a specific range, optionally filtered by path
 * @param range Git range (e.g., 'tag..HEAD' or empty for all commits)
 * @param pathFilter Path to include in the search
 * @param options Git options including cwd
 * @param excludePaths Paths to exclude from the search (uses git pathspec exclusion)
 */
export async function getCommitsInRange(
  range: string,
  pathFilter?: string,
  options: GitOptions = {},
  excludePaths: string[] = []
): Promise<CommitInfo[]> {
  const cwd = options.cwd || process.cwd();
  
  try {
    const args = ['log', '--format=%H%n%s%n%b%n---COMMIT-END---'];
    
    // Only add range if it's not empty
    if (range.trim()) {
      args.push(range);
    }
    
    // Add path filter if provided and not root
    if (pathFilter && pathFilter !== '.') {
      args.push('--', pathFilter);
    } else if (excludePaths.length > 0) {
      // For root path, we still need to add the pathspec separator
      args.push('--');
    }

    for (const excludePath of excludePaths) {
      if (excludePath && excludePath !== '.') {
        args.push(`:(exclude)${excludePath}`);
      }
    }
    
    const { stdout } = await getExecOutput('git', args, {
      cwd,
      silent: true
    });
    
    return parseGitLog(stdout);
  } catch (error) {
    core.warning(`Warning: Failed to get git commits: ${error}`);
    return [];
  }
}

/**
 * Parse git log output into CommitInfo objects
 */
function parseGitLog(output: string): CommitInfo[] {
  if (!output.trim()) {
    return [];
  }
  
  const commits: CommitInfo[] = [];
  const commitBlocks = output.split('---COMMIT-END---').filter(block => block.trim());
  
  for (const block of commitBlocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;
    
    const hash = lines[0];
    const subject = lines[1];
    const body = lines.slice(2).join('\n').trim();
    
    try {
      const parsed = conventionalCommitsParser.sync(subject + '\n\n' + body);
      
      commits.push({
        hash,
        type: parsed.type || 'unknown',
        scope: parsed.scope || undefined,
        subject: parsed.subject || subject,
        body: body || undefined,
        breaking: parsed.notes?.some(note => note.title === 'BREAKING CHANGE') || false,
      });
    } catch (error) {
      // If parsing fails, treat as unknown commit type
      commits.push({
        hash,
        type: 'unknown',
        subject,
        body: body || undefined,
        breaking: false,
      });
    }
  }
  
  return commits;
}

/**
 * Get the last tag for a specific module
 */
export async function getLastTagForModule(
  moduleName: string,
  moduleType: 'root' | 'module',
  options: GitOptions = {}
): Promise<string | null> {
  const cwd = options.cwd || process.cwd();
  
  try {
    // Try to find module-specific tags first (e.g., module@1.0.0)
    const moduleTagPattern = getModuleTagPattern(moduleName);
    
    // Only search for module-specific tags if it's not root
    if (moduleType !== 'root') {
      const { stdout } = await getExecOutput('git', ['tag', '-l', moduleTagPattern, '--sort=-version:refname'], {
        cwd,
        silent: true
      });
      
      if (stdout.trim()) {
        return stdout.trim().split('\n')[0];
      }
    }
    
    // Fallback to general tags
    try {
      const { stdout: fallbackOutput } = await getExecOutput('git', ['describe', '--tags', '--abbrev=0', 'HEAD'], {
        cwd,
        silent: true
      });
      
      return fallbackOutput.trim();
    } catch {
      // If no tags at all, return null
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Get all tags in the repository
 */
export async function getAllTags(options: GitOptions = {}): Promise<GitTag[]> {
  const cwd = options.cwd || process.cwd();
  
  try {
    const { stdout } = await getExecOutput('git', ['tag', '-l', '--format=%(refname:short) %(objectname)'], {
      cwd,
      silent: true
    });
    
    return stdout
      .trim()
      .split('\n')
      .filter((line: string) => line.trim())
      .map((line: string) => {
        const [name, hash] = line.split(' ');
        const { module, version } = parseTagName(name);
        
        return {
          name,
          hash,
          module,
          version,
        };
      });
  } catch (error) {
    return [];
  }
}

/**
 * Create a git tag
 */
export async function createTag(
  tagName: string,
  message: string,
  options: GitOptions = {}
): Promise<void> {
  const cwd = options.cwd || process.cwd();
  
  try {
    await exec('git', ['tag', '-a', tagName, '-m', message], {
      cwd
    });
  } catch (error) {
    throw new Error(`Failed to create tag ${tagName}: ${error}`);
  }
}

/**
 * Push tags to remote
 */
export async function pushTags(options: GitOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  
  try {
    await exec('git', ['push', '--tags'], { cwd });
  } catch (error) {
    throw new Error(`Failed to push tags: ${error}`);
  }
}

/**
 * Get module name from path for tag naming
 */
function getModuleTagPattern(moduleName: string): string {
  return `${moduleName}@*`;
}

/**
 * Parse a tag name to extract module and version
 */
function parseTagName(tagName: string): { module?: string; version?: string } {
  const match = tagName.match(/^(.+)@(.+)$/);
  
  if (match) {
    return {
      module: match[1],
      version: match[2],
    };
  }
  
  // Check if it's just a version
  const versionMatch = tagName.match(/^v?(\d+\.\d+\.\d+.*)$/);
  if (versionMatch) {
    return {
      version: versionMatch[1],
    };
  }
  
  return {};
}

/**
 * Check if the working directory is clean
 */
export async function isWorkingDirectoryClean(options: GitOptions = {}): Promise<boolean> {
  const cwd = options.cwd || process.cwd();
  
  try {
    const { stdout } = await getExecOutput('git', ['status', '--porcelain'], {
      cwd,
      silent: true
    });
    
    return stdout.trim() === '';
  } catch (error) {
    return false;
  }
}

/**
 * Get the current branch name
 */
export async function getCurrentBranch(options: GitOptions = {}): Promise<string> {
  const cwd = options.cwd || process.cwd();
  
  try {
    const { stdout } = await getExecOutput('git', ['branch', '--show-current'], {
      cwd,
      silent: true
    });
    
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error}`);
  }
}

/**
 * Get the current commit short SHA
 */
export async function getCurrentCommitShortSha(options: GitOptions = {}): Promise<string> {
  const cwd = options.cwd || process.cwd();
  
  try {
    const { stdout } = await getExecOutput('git', ['rev-parse', '--short', 'HEAD'], {
      cwd,
      silent: true
    });
    
    return stdout.trim();
  } catch (error) {
    throw new Error(`Failed to get current commit SHA: ${error}`);
  }
}

/**
 * Add all changed files to git staging area
 */
export async function addChangedFiles(options: GitOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  
  try {
    await exec('git', ['add', '.'], { cwd });
  } catch (error) {
    throw new Error(`Failed to add changed files: ${error}`);
  }
}

/**
 * Commit changes with a message
 */
export async function commitChanges(message: string, options: GitOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  
  try {
    await exec('git', ['commit', '-m', message], { cwd });
  } catch (error) {
    throw new Error(`Failed to commit changes: ${error}`);
  }
}

/**
 * Push commits to remote
 */
export async function pushCommits(options: GitOptions = {}): Promise<void> {
  const cwd = options.cwd || process.cwd();
  
  try {
    await exec('git', ['push'], { cwd });
  } catch (error) {
    throw new Error(`Failed to push commits: ${error}`);
  }
}

/**
 * Check if there are changes to commit (staged or unstaged)
 */
export async function hasChangesToCommit(options: GitOptions = {}): Promise<boolean> {
  const cwd = options.cwd || process.cwd();
  
  try {
    const { stdout } = await getExecOutput('git', ['status', '--porcelain'], {
      cwd,
      silent: true
    });
    
    return stdout.trim().length > 0;
  } catch (error) {
    throw new Error(`Failed to check git status: ${error}`);
  }
}
