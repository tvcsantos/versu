#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceFile = join(__dirname, '..', 'action.yml');
const targetFile = join(__dirname, '..', '..', '..', 'action.yml');

// Read the source file
const content = readFileSync(sourceFile, 'utf8');

// Replace the main path
const updatedContent = content.replace(
  /main:\s*['"]dist\/index\.js['"]/,
  "main: 'packages/action/dist/index.js'"
);

// Add generation notice at the top
const notice = '# THIS FILE IS AUTO-GENERATED - DO NOT EDIT MANUALLY\n# Source: packages/action/action.yml\n\n';
const finalContent = notice + updatedContent;

// Write to the root directory
writeFileSync(targetFile, finalContent, 'utf8');

console.log(`✓ Copied action.yml to root directory`);

console.log('✓ Copied action.yml to root with updated main path');
