import { join } from "path";

const RUNNER_ACTIONS_PATH = '/home/runner/_work/_actions'

function getGitHubActionRepository(): string {
  const repo = process.env.GITHUB_ACTION_REPOSITORY
  if (!repo) throw new Error("GITHUB_ACTION_REPOSITORY environment variable is not set");
  return repo;
}

function getGitHubActionRef(): string {
  return process.env.GITHUB_ACTION_REF || 'main'
}

const GITHUB_ACTION_REPOSITORY = getGitHubActionRepository()
const GITHUB_ACTION_REF = getGitHubActionRef()

const ACTION_FILE_PATH = join(
  RUNNER_ACTIONS_PATH,
  GITHUB_ACTION_REPOSITORY,
  GITHUB_ACTION_REF
)

export function getGitHubActionPath(relativePath: string): string {
  return join(ACTION_FILE_PATH, relativePath);
}

/**
 * Parse boolean input
 */
export function parseBooleanInput(input: string): boolean {
  return input.toLowerCase() === 'true';
}