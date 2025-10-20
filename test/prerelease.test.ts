import { describe, it, expect } from 'vitest';
import { bumpToPrerelease, parseSemVer, addBuildMetadata, generateTimestampPrereleaseId, BumpType } from '../src/semver/index.js';

describe('Pre-release Version Management', () => {
  describe('bumpToPrerelease', () => {
    it('should convert regular version to patch prerelease when no changes', () => {
      const version = parseSemVer('1.2.3');
      const result = bumpToPrerelease(version, 'none', 'alpha');
      expect(result.version).toBe('1.2.4-alpha.0');
    });

    it('should increment existing prerelease version when no changes', () => {
      const version = parseSemVer('1.2.3-alpha.0');
      const result = bumpToPrerelease(version, 'none', 'alpha');
      expect(result.version).toBe('1.2.3-alpha.1');
    });

    it('should create patch prerelease version', () => {
      const version = parseSemVer('1.2.3');
      const result = bumpToPrerelease(version, 'patch', 'alpha');
      expect(result.version).toBe('1.2.4-alpha.0');
    });

    it('should create minor prerelease version', () => {
      const version = parseSemVer('1.2.3');
      const result = bumpToPrerelease(version, 'minor', 'beta');
      expect(result.version).toBe('1.3.0-beta.0');
    });

    it('should create major prerelease version', () => {
      const version = parseSemVer('1.2.3');
      const result = bumpToPrerelease(version, 'major', 'rc');
      expect(result.version).toBe('2.0.0-rc.0');
    });

    it('should handle custom prerelease identifiers', () => {
      const version = parseSemVer('1.0.0');
      const result = bumpToPrerelease(version, 'patch', 'dev');
      expect(result.version).toBe('1.0.1-dev.0');
    });

    it('should handle alpha identifier', () => {
      const version = parseSemVer('2.1.0');
      const result = bumpToPrerelease(version, 'minor', 'alpha');
      expect(result.version).toBe('2.2.0-alpha.0');
    });

    it('should throw error for invalid bump type', () => {
      const version = parseSemVer('1.0.0');
      expect(() => {
        bumpToPrerelease(version, 'invalid' as BumpType, 'alpha');
      }).toThrow('Invalid bump type for prerelease: invalid');
    });
  });

  describe('Edge cases', () => {
    it('should handle zero version', () => {
      const version = parseSemVer('0.0.0');
      const result = bumpToPrerelease(version, 'patch', 'alpha');
      expect(result.version).toBe('0.0.1-alpha.0');
    });

    it('should handle version with existing different prerelease', () => {
      const version = parseSemVer('1.0.0-alpha.5');
      const result = bumpToPrerelease(version, 'none', 'beta');
      expect(result.version).toBe('1.0.0-beta.0');
    });

    it('should handle large version numbers', () => {
      const version = parseSemVer('10.25.99');
      const result = bumpToPrerelease(version, 'major', 'alpha');
      expect(result.version).toBe('11.0.0-alpha.0');
    });
  });
});

describe('Build Metadata Support', () => {
  describe('addBuildMetadata with string output', () => {
    it('should add build metadata to regular version', () => {
      const version = parseSemVer('1.2.3');
      const result = addBuildMetadata(version, 'abc123').raw;
      expect(result).toBe('1.2.3+abc123');
    });

    it('should add build metadata to prerelease version', () => {
      const version = parseSemVer('1.2.3-alpha.0');
      const result = addBuildMetadata(version, 'def456').raw;
      expect(result).toBe('1.2.3-alpha.0+def456');
    });

    it('should handle short SHA format', () => {
      const version = parseSemVer('2.1.0');
      const result = addBuildMetadata(version, '7a8b9c2').raw;
      expect(result).toBe('2.1.0+7a8b9c2');
    });

    it('should work with alpha prerelease', () => {
      const version = parseSemVer('3.0.0-alpha.1');
      const result = addBuildMetadata(version, 'build123').raw;
      expect(result).toBe('3.0.0-alpha.1+build123');
    });

    it('should handle zero version', () => {
      const version = parseSemVer('0.0.0');
      const result = addBuildMetadata(version, 'init').raw;
      expect(result).toBe('0.0.0+init');
    });
  });
});

describe('Timestamp-based Prerelease IDs', () => {
  describe('generateTimestampPrereleaseId', () => {
    it('should generate timestamp with base ID', () => {
      const testDate = new Date('2025-10-08T15:30:45Z');
      const result = generateTimestampPrereleaseId('alpha', testDate);
      expect(result).toBe('alpha.20251008.1530');
    });

    it('should handle different base IDs', () => {
      const testDate = new Date('2025-12-25T09:15:30Z');
      const result = generateTimestampPrereleaseId('beta', testDate);
      expect(result).toBe('beta.20251225.0915');
    });

    it('should handle alpha base ID', () => {
      const testDate = new Date('2025-01-01T00:00:00Z');
      const result = generateTimestampPrereleaseId('alpha', testDate);
      expect(result).toBe('alpha.20250101.0000');
    });

    it('should pad single digits correctly', () => {
      const testDate = new Date('2025-03-05T07:08:00Z');
      const result = generateTimestampPrereleaseId('rc', testDate);
      expect(result).toBe('rc.20250305.0708');
    });

    it('should handle end of year', () => {
      const testDate = new Date('2025-12-31T23:59:00Z');
      const result = generateTimestampPrereleaseId('dev', testDate);
      expect(result).toBe('dev.20251231.2359');
    });

    it('should use current time when no timestamp provided', () => {
      const before = Date.now();
      const result = generateTimestampPrereleaseId('alpha');
      const after = Date.now();
      
      // Just check that it has the right format
      expect(result).toMatch(/^alpha\.\d{8}\.\d{4}$/);
      
      // Extract and validate the timestamp is reasonable
      const parts = result.split('.');
      const dateStr = parts[1]; // YYYYMMDD
      const timeStr = parts[2]; // HHMM
      
      const year = parseInt(dateStr.substring(0, 4));
      const month = parseInt(dateStr.substring(4, 6));
      const day = parseInt(dateStr.substring(6, 8));
      const hour = parseInt(timeStr.substring(0, 2));
      const minute = parseInt(timeStr.substring(2, 4));
      
      expect(year).toBeGreaterThanOrEqual(2025);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
      expect(day).toBeGreaterThanOrEqual(1);
      expect(day).toBeLessThanOrEqual(31);
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
      expect(minute).toBeGreaterThanOrEqual(0);
      expect(minute).toBeLessThanOrEqual(59);
    });
  });
});

describe('Gradle Snapshot Support', () => {
  // Note: These tests focus on the applyGradleSnapshot utility function.
  // Integration tests for the full Gradle snapshot feature would require
  // a more complex setup with actual Gradle projects and module detection.
  
  describe('applyGradleSnapshot logic', () => {
    // We'll test the logic by creating a simple function that mimics the behavior
    function applyGradleSnapshot(version: string): string {
      if (version.endsWith('-SNAPSHOT')) {
        return version;
      }
      return `${version}-SNAPSHOT`;
    }

    it('should add SNAPSHOT suffix to regular version', () => {
      const result = applyGradleSnapshot('1.2.3');
      expect(result).toBe('1.2.3-SNAPSHOT');
    });

    it('should not add SNAPSHOT if already present', () => {
      const result = applyGradleSnapshot('1.2.3-SNAPSHOT');
      expect(result).toBe('1.2.3-SNAPSHOT');
    });

    it('should work with prerelease versions', () => {
      const result = applyGradleSnapshot('1.2.3-alpha.0');
      expect(result).toBe('1.2.3-alpha.0-SNAPSHOT');
    });

    it('should work with build metadata versions', () => {
      const result = applyGradleSnapshot('1.2.3+abc1234');
      expect(result).toBe('1.2.3+abc1234-SNAPSHOT');
    });

    it('should work with complex versions', () => {
      const result = applyGradleSnapshot('1.2.3-alpha.20251008.1530+abc1234');
      expect(result).toBe('1.2.3-alpha.20251008.1530+abc1234-SNAPSHOT');
    });

    it('should handle zero version', () => {
      const result = applyGradleSnapshot('0.0.1');
      expect(result).toBe('0.0.1-SNAPSHOT');
    });
  });
});