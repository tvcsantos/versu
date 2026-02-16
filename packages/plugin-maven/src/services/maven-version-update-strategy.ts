import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import { ModuleRegistry, VersionUpdateStrategy } from "@versu/core";
import { MAVEN_POM_FILE } from "../constants.js";
import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import * as xpath from "xpath";

type ParentInfo = { groupId?: string; artifactId?: string; version?: string };

type PomUpdate = {
  projectVersion?: string;
  parentVersion?: string;
};

export class MavenVersionUpdateStrategy implements VersionUpdateStrategy {
  constructor(
    private readonly repoRoot: string,
    private readonly moduleRegistry: ModuleRegistry,
  ) {}

  async writeVersionUpdates(
    moduleVersions: Map<string, string>,
  ): Promise<void> {
    const updatedCoords = new Map<string, string>();

    for (const [moduleId, newVersion] of moduleVersions) {
      const module = this.moduleRegistry.getModule(moduleId);
      const groupId = module["groupId"] as string | undefined;
      const artifactId = module["artifactId"] as string | undefined;
      if (groupId && artifactId) {
        updatedCoords.set(`${groupId}:${artifactId}`, newVersion);
      }
    }

    for (const module of this.moduleRegistry.getModules().values()) {
      const pomPath =
        (module["pomPath"] as string | undefined) ||
        join(this.repoRoot, module.path, MAVEN_POM_FILE);

      const moduleNewVersion = moduleVersions.get(module.id);
      const parent = module["parent"] as ParentInfo | undefined;

      const updates: PomUpdate = {};

      if (moduleNewVersion && module.declaredVersion) {
        updates.projectVersion = moduleNewVersion;
      }

      const parentCoord =
        parent?.groupId && parent?.artifactId
          ? `${parent.groupId}:${parent.artifactId}`
          : undefined;

      if (parentCoord && updatedCoords.has(parentCoord)) {
        updates.parentVersion = updatedCoords.get(parentCoord);
      }

      if (updates.projectVersion || updates.parentVersion) {
        await this.updatePom(pomPath, updates);
      }
    }
  }

  private async updatePom(pomPath: string, updates: PomUpdate): Promise<void> {
    const xml = await readFile(pomPath, "utf8");
    const doc = new DOMParser().parseFromString(xml, "text/xml");

    // Maven POMs use a namespace. We define it so XPath can find the tags.
    const select = xpath.useNamespaces({
      m: "http://maven.apache.org/POM/4.0.0",
    });

    // This XPath specifically targets the project version, NOT dependency versions
    const versionNodeResult = select("/m:project/m:version/text()", doc);
    const versionNode = Array.isArray(versionNodeResult)
      ? (versionNodeResult[0] as Node)
      : null;

    if (versionNode && updates.projectVersion) {
      versionNode.textContent = updates.projectVersion;
    }

    const parentVersionNodeResult = select(
      "/m:project/m:parent/m:version/text()",
      doc,
    );
    const parentVersionNode = Array.isArray(parentVersionNodeResult)
      ? (parentVersionNodeResult[0] as Node)
      : null;

    if (parentVersionNode && updates.parentVersion) {
      parentVersionNode.textContent = updates.parentVersion;
    }

    // Serialize back to string
    const updatedXml = new XMLSerializer().serializeToString(doc);
    await writeFile(pomPath, updatedXml, "utf8");
  }
}
