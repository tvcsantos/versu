import * as core from '@actions/core';
import { VerseRunner, RunnerOptions } from './services/verse-runner.js';
import { parseBooleanInput } from './utils/actions.js';

/**
 * Main entry point for VERSE GitHub Action
 */
export async function run(): Promise<void> {
  try {
    // Get repository root (GitHub Actions sets GITHUB_WORKSPACE)
    const repoRoot = process.env.GITHUB_WORKSPACE || process.cwd();
    
    // Get inputs
    const dryRun = parseBooleanInput(core.getInput('dry-run'));
    const adapter = core.getInput('adapter') || undefined;
    const configPath = core.getInput('config-path') || undefined;
    const pushTags = parseBooleanInput(core.getInput('push-tags'));
    const prereleaseMode = parseBooleanInput(core.getInput('prerelease-mode'));
    const prereleaseId = core.getInput('prerelease-id') || 'alpha';
    const bumpUnchanged = parseBooleanInput(core.getInput('bump-unchanged'));
    const addBuildMetadata = parseBooleanInput(core.getInput('add-build-metadata'));
    const timestampVersions = parseBooleanInput(core.getInput('timestamp-versions'));
    const appendSnapshot = parseBooleanInput(core.getInput('append-snapshot'));
    const pushChanges = parseBooleanInput(core.getInput('push-changes'));
    const generateChangelog = parseBooleanInput(core.getInput('generate-changelog') || 'false');

    // Print cool ASCII art
    core.info('');
    core.info('██╗   ██╗███████╗██████╗ ███████╗███████╗');
    core.info('██║   ██║██╔════╝██╔══██╗██╔════╝██╔════╝');
    core.info('██║   ██║█████╗  ██████╔╝███████╗█████╗  ');
    core.info('╚██╗ ██╔╝██╔══╝  ██╔══██╗╚════██║██╔══╝  ');
    core.info(' ╚████╔╝ ███████╗██║  ██║███████║███████╗');
    core.info('  ╚═══╝  ╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝');
    core.info('');
    core.info('🌌 Version Engine for Repo Semantic Evolution');
    core.info('   Orchestrating your monorepo multiverse...');
    core.info('');
    core.info('🚀 Starting VERSE engine...');
    core.info(`Repository: ${repoRoot}`);
    core.info(`Adapter: ${adapter || '(auto-detect)'}`);
    core.info(`Config: ${configPath}`);
    core.info(`Dry run: ${dryRun}`);
    core.info(`Prerelease mode: ${prereleaseMode}`);
    if (prereleaseMode) {
      core.info(`Prerelease ID: ${prereleaseId}`);
      core.info(`Bump unchanged modules: ${bumpUnchanged}`);
    }
    core.info(`Add build metadata: ${addBuildMetadata}`);
    core.info(`Timestamp versions: ${timestampVersions}`);
    core.info(`Append snapshot: ${appendSnapshot}`);
    core.info(`Push changes: ${pushChanges}`);
    core.info(`Generate changelog: ${generateChangelog}`);

    // Create runner options
    const options: RunnerOptions = {
      repoRoot,
      adapter,
      configPath,
      dryRun,
      pushTags,
      prereleaseMode,
      prereleaseId,
      bumpUnchanged,
      addBuildMetadata,
      timestampVersions,
      appendSnapshot,
      pushChanges,
      generateChangelog
    };

    // Run VERSE engine
    const runner = new VerseRunner(options);
    const result = await runner.run();

    // Set outputs
    core.setOutput('bumped', result.bumped.toString());
    core.setOutput('discovered-modules', JSON.stringify(result.discoveredModules));
    core.setOutput('changed-modules', JSON.stringify(result.changedModules));
    core.setOutput('created-tags', result.createdTags.join(','));
    core.setOutput('changelog-paths', result.changelogPaths.join(','));

    // Log results
    if (result.bumped) {
      core.info(`✅ Successfully updated ${result.changedModules.length} modules`);
      for (const module of result.changedModules) {
        core.info(`  ${module.id}: ${module.from} → ${module.to} (${module.bumpType})`);
      }
      
      if (result.createdTags.length > 0) {
        core.info(`🏷️  Created ${result.createdTags.length} tags: ${result.createdTags.join(', ')}`);
      }
      
      if (result.changelogPaths.length > 0) {
        core.info(`📚 Generated ${result.changelogPaths.length} changelog files`);
      }
    } else {
      core.info('✨ No version changes needed');
    }

    core.info('');
    core.info('🎯 VERSE action completed successfully!');
    core.info('   Your multiverse has evolved semantically ✨');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`❌ Action failed: ${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      core.debug(`Stack trace: ${error.stack}`);
    }
  }
}
