import { describe, it, expect } from 'vitest';
import { ConfigurationValidator } from '../src/services/configuration-validator.js';
import { Config } from '../src/config/index.js';

describe('ConfigurationValidator', () => {
  const validator = new ConfigurationValidator();

  it('should validate a valid configuration', () => {
    const config: Config = {
      defaultBump: 'patch',
      commitTypes: {
        feat: 'minor',
        fix: 'patch',
        docs: 'ignore',
      },
      dependencyRules: {
        onMajorOfDependency: 'major',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
    };

    expect(() => validator.validate(config)).not.toThrow();
  });

  it('should reject invalid defaultBump', () => {
    const config = {
      defaultBump: 'invalid',
      commitTypes: {},
      dependencyRules: {
        onMajorOfDependency: 'major',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
    } as any;

    expect(() => validator.validate(config)).toThrow(/Configuration validation failed/);
  });

  it('should reject invalid commit type bump value', () => {
    const config = {
      defaultBump: 'patch',
      commitTypes: {
        feat: 'invalid',
      },
      dependencyRules: {
        onMajorOfDependency: 'major',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
    } as any;

    expect(() => validator.validate(config)).toThrow(/Configuration validation failed/);
  });

  it('should reject invalid dependency rules', () => {
    const config = {
      defaultBump: 'patch',
      commitTypes: {},
      dependencyRules: {
        onMajorOfDependency: 'invalid',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
    } as any;

    expect(() => validator.validate(config)).toThrow(/Configuration validation failed/);
  });

  it('should accept ignore in commitTypes but not in dependencyRules', () => {
    const validConfig: Config = {
      defaultBump: 'patch',
      commitTypes: {
        docs: 'ignore',
        feat: 'minor',
      },
      dependencyRules: {
        onMajorOfDependency: 'major',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
    };

    expect(() => validator.validate(validConfig)).not.toThrow();

    const invalidConfig = {
      defaultBump: 'patch',
      commitTypes: {},
      dependencyRules: {
        onMajorOfDependency: 'ignore',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
    } as any;

    expect(() => validator.validate(invalidConfig)).toThrow(/Configuration validation failed/);
  });

  it('should validate optional nodejs config', () => {
    const config: Config = {
      defaultBump: 'patch',
      commitTypes: {
        feat: 'minor',
      },
      dependencyRules: {
        onMajorOfDependency: 'major',
        onMinorOfDependency: 'minor',
        onPatchOfDependency: 'patch',
      },
      nodejs: {
        versionSource: ['package.json'],
        updatePackageLock: true,
      },
    };

    expect(() => validator.validate(config)).not.toThrow();
  });
});
