#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJsonPath = join(__dirname, '../package.json');
const versionFilePath = join(__dirname, '../src/version.ts');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;
const packageName = packageJson.name;

const content = `// This file is auto-generated. Do not edit manually.
export const VERSION = "${version}";
export const PACKAGE_NAME = "${packageName}";
`;

writeFileSync(versionFilePath, content, 'utf-8');
console.log(`✓ Generated version.ts with version ${version} and package ${packageName}`);
