import * as core from '@actions/core';
import { VersuRunner, RunnerOptions, initLogger } from '@versu/core';
import { ActionsLogger } from './logger.js';
import { parseBooleanInput } from './utils/actions.js';
import { VERSION, PACKAGE_NAME } from './version.js';

/**
 * Main entry point for VERSU GitHub Action
 */
export async function run(): Promise<void> {
  try {
    initLogger(new ActionsLogger());
    
    core.info(`${PACKAGE_NAME} v${VERSION}`);
    
    // Get repository root (GitHub Actions sets GITHUB_WORKSPACE)
    const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
    
    // Get inputs
    const dryRun = parseBooleanInput(core.getInput('dry-run'));
    const adapter = core.getInput('adapter') || undefined;
    const pushTags = parseBooleanInput(core.getInput('push-tags'));
    const prereleaseMode = parseBooleanInput(core.getInput('prerelease-mode'));
    const prereleaseId = core.getInput('prerelease-id') || 'alpha';
    const bumpUnchanged = parseBooleanInput(core.getInput('bump-unchanged'));
    const addBuildMetadata = parseBooleanInput(core.getInput('add-build-metadata'));
    const timestampVersions = parseBooleanInput(core.getInput('timestamp-versions'));
    const appendSnapshot = parseBooleanInput(core.getInput('append-snapshot'));
    const pushChanges = parseBooleanInput(core.getInput('push-changes'));
    const generateChangelog = parseBooleanInput(core.getInput('generate-changelog') || 'false');

    // Create runner options
    const options: RunnerOptions = {
      repoRoot,
      adapter,
      dryRun,
      pushTags,
      prereleaseMode,
      prereleaseId,
      bumpUnchanged,
      addBuildMetadata,
      timestampVersions,
      appendSnapshot,
      pushChanges,
      generateChangelog,
    };
    // Run VERSU engine
    const runner = new VersuRunner(options);
    const result = await runner.run();

    // Set outputs
    core.setOutput('bumped', result.bumped.toString());
    core.setOutput('discovered-modules', JSON.stringify(result.discoveredModules));
    core.setOutput('changed-modules', JSON.stringify(result.changedModules));
    core.setOutput('created-tags', result.createdTags.join(','));
    core.setOutput('changelog-paths', result.changelogPaths.join(','));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`❌ Action failed: ${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }
  }
}
