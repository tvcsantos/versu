import { PluginContract } from "../../core/dist/plugins/plugin-loader";
import { GradleAdapterIdentifier } from "./services/gradle-adapter-identifier";
import { GradleModuleSystemFactory } from "./services/gradle-module-system-factory";
import { AUTHORS, VERSION } from "./utils/version";

const gradlePlugin: PluginContract = {
  id: "gradle",
  name: "Gradle",
  description:
    "Adapter plugin for Gradle build system. Provides support for detecting and updating versions in Gradle projects.",
  version: VERSION,
  author: AUTHORS,
  adapters: [
    {
      id: "gradle",
      adapterIdentifier: () => new GradleAdapterIdentifier(),
      moduleSystemFactory: (repoRoot: string) =>
        new GradleModuleSystemFactory(repoRoot),
    },
  ],
};

export default gradlePlugin;
