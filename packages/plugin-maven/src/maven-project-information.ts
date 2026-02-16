import { join, sep } from "path";
import fs from "fs/promises";
import { XMLParser } from "fast-xml-parser";
import {
  BaseModule,
  createInitialVersion,
  exists,
  logger,
  Module,
  parseSemVer,
  ProjectInformation,
  RawProjectInformation,
} from "@versu/core";
import { MAVEN_POM_FILE } from "./constants.js";

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

type PomDependency = { groupId?: string; artifactId?: string };
type PomParent = { groupId?: string; artifactId?: string; version?: string };

type ParsedPom = {
  groupId?: string;
  artifactId?: string;
  version?: string;
  parent?: PomParent;
  modules?: { module?: string | string[] };
  dependencies?: { dependency?: PomDependency | PomDependency[] };
};

type MavenModule = BaseModule & {
  pomPath: string;
  groupId: string;
  artifactId: string;
  parent?: PomParent;
};

type MavenProjectInformation = {
  [id: string]: MavenModule;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: true,
});

function normalizeText(value?: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value);
  return undefined;
}

function asArray<T>(value?: T | T[]): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizePath(pathValue: string): string {
  return pathValue.split(sep).join("/").replace(/\/+$/, "") || ".";
}

function moduleIdFromPath(relPath: string): string {
  const normalized = normalizePath(relPath);
  return normalized === "." ? ":" : `:${normalized.split("/").join(":")}`;
}

async function parsePom(pomPath: string): Promise<ParsedPom> {
  const xml = await fs.readFile(pomPath, "utf-8");
  const doc = parser.parse(xml);
  const project = doc.project ?? doc;

  return {
    groupId: normalizeText(project.groupId),
    artifactId: normalizeText(project.artifactId),
    version: normalizeText(project.version),
    parent: project.parent
      ? {
          groupId: normalizeText(project.parent.groupId),
          artifactId: normalizeText(project.parent.artifactId),
          version: normalizeText(project.parent.version),
        }
      : undefined,
    modules: project.modules,
    dependencies: project.dependencies,
  };
}

export async function getRawProjectInformation(
  projectRoot: string,
): Promise<RawProjectInformation> {
  const rootPom = join(projectRoot, MAVEN_POM_FILE);
  const rootExists = await exists(rootPom);

  if (!rootExists) {
    throw new Error(`Root pom.xml not found at ${rootPom}`);
  }

  const modules = new Map<string, MavenModule>();
  const hierarchyEdges = new Map<string, Set<string>>();
  const dependencyEdges = new Map<string, Set<string>>();
  const moduleDependencies = new Map<string, string[]>();

  async function loadModule(
    pomPath: string,
    relPath: string,
    parentId?: string,
  ): Promise<void> {
    const parsed = await parsePom(pomPath);

    const groupId = parsed.groupId ?? parsed.parent?.groupId;
    const artifactId = parsed.artifactId;

    if (!groupId || !artifactId) {
      throw new Error(`Invalid pom.xml (missing groupId/artifactId): ${pomPath}`);
    }

    const moduleId = moduleIdFromPath(relPath);
    const declaredVersion = parsed.version !== undefined;
    const version = parsed.version ?? parsed.parent?.version;

    const name = `${groupId}:${artifactId}`;

    const module: MavenModule = {
      name,
      path: normalizePath(relPath),
      type: relPath === "." ? "root" : "module",
      affectedModules: [],
      version,
      declaredVersion,
      groupId,
      artifactId,
      pomPath,
      parent: parsed.parent,
    };

    modules.set(moduleId, module);

    if (parentId) {
      const children = hierarchyEdges.get(parentId) ?? new Set<string>();
      children.add(moduleId);
      hierarchyEdges.set(parentId, children);
    }

    const dependencies = asArray(parsed.dependencies?.dependency)
      .map((dep) => {
        const depGroup = normalizeText(dep.groupId);
        const depArtifact = normalizeText(dep.artifactId);
        return depGroup && depArtifact ? `${depGroup}:${depArtifact}` : undefined;
      })
      .filter((coord): coord is string => Boolean(coord));

    moduleDependencies.set(moduleId, dependencies);

    const modulePaths = asArray(parsed.modules?.module)
      .map((value) => normalizeText(value))
      .filter((value): value is string => Boolean(value));

    for (const childPath of modulePaths) {
      const childRel = normalizePath(join(relPath, childPath));
      const childPom = join(projectRoot, childRel, MAVEN_POM_FILE);
      await loadModule(childPom, childRel, moduleId);
    }
  }

  await loadModule(rootPom, ".");

  const coordToModuleId = new Map<string, string>();
  for (const [moduleId, module] of modules) {
    coordToModuleId.set(`${module.groupId}:${module.artifactId}`, moduleId);
  }

  for (const [moduleId, deps] of moduleDependencies) {
    const direct = new Set<string>();
    for (const coord of deps) {
      const depId = coordToModuleId.get(coord);
      if (depId) direct.add(depId);
    }
    dependencyEdges.set(moduleId, direct);
  }

  function collectDescendants(moduleId: string, result: Set<string>): void {
    const children = hierarchyEdges.get(moduleId);
    if (!children) return;
    for (const child of children) {
      if (!result.has(child)) {
        result.add(child);
        collectDescendants(child, result);
      }
    }
  }

  const result: Mutable<MavenProjectInformation> = {};

  for (const [moduleId, module] of modules) {
    const affected = new Set<string>();
    collectDescendants(moduleId, affected);

    for (const [dependent, deps] of dependencyEdges) {
      if (deps.has(moduleId)) affected.add(dependent);
    }

    result[moduleId] = {
      ...module,
      affectedModules: Array.from(affected).sort(),
    };
  }

  logger.info("Maven project information generated", {
    moduleCount: Object.keys(result).length,
  });

  return result;
}

export function getProjectInformation(
  projectInformation: RawProjectInformation,
): ProjectInformation {
  const moduleIds = Object.keys(projectInformation);
  const modules = new Map<string, Module>();

  let rootModule: string | undefined;

  for (const [moduleId, rawModule] of Object.entries(projectInformation)) {
    if (rawModule.type === "root") {
      rootModule = moduleId;
    }

    const module: Module = {
      id: moduleId,
      name: rawModule.name,
      path: rawModule.path,
      type: rawModule.type,
      affectedModules: new Set(rawModule.affectedModules),
      version:
        rawModule.version === undefined
          ? createInitialVersion()
          : parseSemVer(rawModule.version),
      declaredVersion: rawModule.declaredVersion,
    };

    for (const [key, value] of Object.entries(rawModule)) {
      if (!(key in module)) {
        module[key] = value;
      }
    }

    modules.set(moduleId, module);
  }

  if (!rootModule) {
    throw new Error(
      "No root module found. Maven project must include a root pom.xml.",
    );
  }

  return {
    moduleIds,
    modules,
    rootModule,
  };
}
