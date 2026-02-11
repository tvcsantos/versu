import { Args, Command, Flags } from "@oclif/core";
import { VersuRunner, RunnerOptions, initLogger } from "@versu/core";
import { OclifLogger } from "./logger.js";

export default class Version extends Command {
  static override description = "Calculate and apply semantic version changes";

  static override examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --adapter gradle",
    "<%= config.bin %> <%= command.id %> --dry-run",
    "<%= config.bin %> <%= command.id %> --prerelease-mode --prerelease-id alpha",
  ];

  static args = {
    repositoryRoot: Args.directory({
      required: false,
      description: "Path to the repository root",
      default: ".",
    }),
  };

  static override flags = {
    version: Flags.version({char: 'v'}),
    "dry-run": Flags.boolean({
      description: "Run without writing or pushing changes",
      default: false,
    }),
    adapter: Flags.string({
      description:
        "Language adapter (e.g., gradle). Auto-detected if not provided",
      required: false,
    }),
    "push-tags": Flags.boolean({
      description: "Push tags to origin",
      default: true,
      allowNo: true, 
    }),
    "prerelease-mode": Flags.boolean({
      description: "Generate pre-release versions instead of final versions",
      default: false,
    }),
    "prerelease-id": Flags.string({
      description: "Pre-release identifier (e.g., alpha, beta, rc)",
      default: "alpha",
    }),
    "bump-unchanged": Flags.boolean({
      description:
        "In prerelease mode, bump modules even when no changes are detected",
      default: false,
    }),
    "add-build-metadata": Flags.boolean({
      description: "Add build metadata with short SHA to all versions",
      default: false,
    }),
    "timestamp-versions": Flags.boolean({
      description:
        "Use timestamp-based prerelease identifiers (requires prerelease-mode)",
      default: false,
    }),
    "append-snapshot": Flags.boolean({
      description:
        "Add -SNAPSHOT suffix to all versions if supported by adapter",
      default: false,
    }),
    "push-changes": Flags.boolean({
      description: "Commit and push version changes and changelogs to remote",
      default: true,
      allowNo: true,
    }),
    "generate-changelog": Flags.boolean({
      description: "Generate or update changelog files for changed modules",
      default: true,
      allowNo: true,
    }),
    "output-file": Flags.string({
      description: "Path to the output file for project information",
      default: "project-information.json",
    }),
  };

  async run(): Promise<void> {
    const { flags, args } = await this.parse(Version);

    initLogger(new OclifLogger(this));

    try {
      const options: RunnerOptions = {
        repoRoot: args.repositoryRoot,
        adapter: flags.adapter,
        dryRun: flags["dry-run"],
        pushTags: flags["push-tags"],
        prereleaseMode: flags["prerelease-mode"],
        prereleaseId: flags["prerelease-id"],
        bumpUnchanged: flags["bump-unchanged"],
        addBuildMetadata: flags["add-build-metadata"],
        timestampVersions: flags["timestamp-versions"],
        appendSnapshot: flags["append-snapshot"],
        pushChanges: flags["push-changes"],
        generateChangelog: flags["generate-changelog"],
        outputFile: flags["output-file"],
      };

      const runner = new VersuRunner(options);
      await runner.run();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.error(`❌ Command failed: ${errorMessage}`);
    }
  }
}
