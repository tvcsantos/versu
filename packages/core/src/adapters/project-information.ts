import { SemVer } from "semver";

/**
 * Represents a module within a project, containing metadata, version, and dependency information.
 */
export type Module = {
  /** Unique identifier for the module within the project (e.g., ':', ':app', ':lib:core'). */
  readonly id: string;

  /** Human-readable name of the module. */
  readonly name: string;

  /** Relative path from the repository root to this module's directory. */
  readonly path: string;

  /** Type of the module: 'root' for top-level project or 'module' for subprojects. */
  readonly type: "module" | "root";

  /** Set of module IDs that are affected when this module changes. */
  readonly affectedModules: Set<string>;

  /** Current semantic version of the module. */
  readonly version: SemVer;

  /** Whether the version is explicitly declared in build configuration (vs inherited). */
  readonly declaredVersion: boolean;
} & Record<string, unknown>;

/**
 * Structured representation of project information after processing.
 * Provides efficient access to module information through arrays and maps.
 */
export type ProjectInformation = {
  /** Array of all module identifiers in the project. */
  readonly moduleIds: string[];

  /** Map of module IDs to their complete module information (O(1) lookup). */
  readonly modules: ReadonlyMap<string, Module>;

  /** The module ID of the root project (typically ':' for Gradle). */
  readonly rootModule: string;
};

/**
 * Raw module data as extracted from the build system before processing.
 * Similar to Module but with arrays instead of Sets and optional string version.
 */
export type RawModule = {
  /** Human-readable name of the module. */
  readonly name: string;

  /** Relative path from repository root to the module directory. */
  readonly path: string;

  /** Array of module IDs affected when this module changes. */
  readonly affectedModules: string[];

  /** Version string if the module has a version (optional). */
  readonly version?: string;

  /** Type of the module in the project hierarchy. */
  readonly type: "module" | "root";

  /** Whether the version is explicitly declared in build configuration. */
  readonly declaredVersion: boolean;
};

/**
 * Raw project structure information as extracted from the build system.
 * Maps module IDs to their raw module data.
 */
export type RawProjectInformation = {
  readonly [id: string]: RawModule;
};
