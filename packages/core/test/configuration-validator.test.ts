import { describe, it, expect } from "vitest";
import { ConfigurationValidator } from "../src/services/configuration-validator.js";
import { Config, configSchema } from "../src/config/index.js";

describe("ConfigurationValidator", () => {
  const validator = new ConfigurationValidator<Config>(configSchema);

  it("should validate a valid configuration", () => {
    const config: Config = {
      plugins: [],
      versionRules: {
        defaultBump: "patch",
        commitTypeBumps: {
          feat: "minor",
          fix: "patch",
          docs: "ignore",
        },
        dependencyBumps: {
          major: "major",
          minor: "minor",
          patch: "patch",
        },
      },
    };

    expect(() => validator.validate(config)).not.toThrow();
  });

  it("should reject invalid defaultBump", () => {
    const config = {
      versionRules: {
        defaultBump: "invalid",
        commitTypeBumps: {},
        dependencyBumps: {
          major: "major",
          minor: "minor",
          patch: "patch",
        },
      },
    } as any;

    expect(() => validator.validate(config)).toThrow(
      /Configuration validation failed/,
    );
  });

  it("should reject invalid commit type bump value", () => {
    const config = {
      versionRules: {
        defaultBump: "patch",
        commitTypeBumps: {
          feat: "invalid",
        },
        dependencyBumps: {
          major: "major",
          minor: "minor",
          patch: "patch",
        },
      },
    } as any;

    expect(() => validator.validate(config)).toThrow(
      /Configuration validation failed/,
    );
  });

  it("should reject invalid dependency rules", () => {
    const config = {
      versionRules: {
        defaultBump: "patch",
        commitTypeBumps: {},
        dependencyBumps: {
          major: "invalid",
          minor: "minor",
          patch: "patch",
        },
      },
    } as any;

    expect(() => validator.validate(config)).toThrow(
      /Configuration validation failed/,
    );
  });

  it("should accept ignore in commitTypes but not in dependencyRules", () => {
    const validConfig: Config = {
      plugins: [],
      versionRules: {
        defaultBump: "patch",
        commitTypeBumps: {
          docs: "ignore",
          feat: "minor",
        },
        dependencyBumps: {
          major: "major",
          minor: "minor",
          patch: "patch",
        },
      },
    };

    expect(() => validator.validate(validConfig)).not.toThrow();

    const invalidConfig = {
      versionRules: {
        defaultBump: "patch",
        commitTypeBumps: {},
        dependencyBumps: {
          major: "ignore",
          minor: "minor",
          patch: "patch",
        },
      },
    } as any;

    expect(() => validator.validate(invalidConfig)).toThrow(
      /Configuration validation failed/,
    );
  });

  it("should validate optional nodejs config", () => {
    const config: Config = {
      plugins: [],
      versionRules: {
        defaultBump: "patch",
        commitTypeBumps: {
          feat: "minor",
        },
        dependencyBumps: {
          major: "major",
          minor: "minor",
          patch: "patch",
        },
      },
    };

    expect(() => validator.validate(config)).not.toThrow();
  });
});
