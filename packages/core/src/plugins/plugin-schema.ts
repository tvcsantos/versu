import z from "zod";

/**
 * Always use .loose() to allow for additional properties in plugin contracts,
 * ensuring flexibility and forward compatibility with future extensions without
 * breaking existing plugins.
 */

const adapterCapabitilitiesSchema = z.object({
  supportsSnapshots: z.boolean(),
}).loose();

const adapterMetadataSchema = z.object({
  id: z.string(),
  capabilities: adapterCapabitilitiesSchema,
}).loose();

const adapterIdentifierSchema = z.object({
  metadata: adapterMetadataSchema,
  accept: z.function({
    input: [z.string()],
    output: z.promise(z.boolean()),
  }),
}).loose();

const versionSchema = z.object({
  major: z.number(),
  minor: z.number(),
  patch: z.number(),
  prerelease: z.array(z.union([z.string(), z.number()])),
  build: z.array(z.string()),
  raw: z.string(),
  version: z.string(),
}).loose();

const moduleSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
    type: z.enum(["module", "root"]),
    affectedModules: z.set(z.string()),
    version: versionSchema,
    declaredVersion: z.boolean(),
  })
  .loose();

const projectInformationSchema = z.object({
  moduleIds: z.array(z.string()),
  modules: z.map(z.string(), moduleSchema),
  rootModule: z.string(),
}).loose();

const moduleDetectorSchema = z.object({
  repoRoot: z.string(),
  detect: z.function({
    input: [],
    output: z.promise(projectInformationSchema),
  }),
}).loose();

const moduleRegistrySchema = z.object({
  getModuleIds: z.function({
    input: [],
    output: z.array(z.string()),
  }),
  getModule: z.function({
    input: [z.string()],
    output: moduleSchema,
  }),
  hasModule: z.function({
    input: [z.string()],
    output: z.boolean(),
  }),
  getModules: z.function({
    input: [],
    output: z.map(z.string(), moduleSchema),
  }),
}).loose();

const versionUpdateStrategySchema = z.object({
  writeVersionUpdates: z.function({
    input: [z.map(z.string(), z.string())],
    output: z.promise(z.void()),
  }),
}).loose();

const moduleSystemFactorySchema = z.object({
  createDetector: z.function({
    input: [z.string()],
    output: moduleDetectorSchema,
  }),
  createVersionUpdateStrategy: z.function({
    input: [moduleRegistrySchema],
    output: versionUpdateStrategySchema,
  }),
}).loose();

const adapterPluginContractSchema = z.object({
  id: z.string(),
  adapterIdentifier: z.function({
    input: [],
    output: adapterIdentifierSchema,
  }),
  moduleSystemFactory: z.function({
    input: [z.string()],
    output: moduleSystemFactorySchema,
  }),
}).loose();

export const pluginContractSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  author: z.string(),
  adapters: z.array(adapterPluginContractSchema),
}).loose();