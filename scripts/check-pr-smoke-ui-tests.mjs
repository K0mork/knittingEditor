import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Remove comments and literals so a commented-out/diagnostic test cannot satisfy the list.
export function swiftTestMethods(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"""[\s\S]*?"""|"(?:\\.|[^"\\])*"/g, ' ');
  const tests = new Set();
  for (const match of code.matchAll(/\bclass\s+(\w+)\s*:\s*XCTestCase\s*\{/g)) {
    let depth = 1;
    let end = match.index + match[0].length;
    const start = end;
    while (end < code.length && depth > 0) {
      if (code[end] === '{') depth++;
      if (code[end] === '}') depth--;
      end++;
    }
    if (depth !== 0) throw new Error(`Cannot parse test class ${match[1]}`);
    for (const method of code.slice(start, end - 1).matchAll(/\bfunc\s+(test\w+)\s*\(\s*\)/g)) {
      tests.add(`${match[1]}/${method[1]}`);
    }
  }
  return tests;
}

export function validateSmokeList(text, methods) {
  const entries = text.split(/\r?\n/)
    .filter((line) => line.trim() && !line.trimStart().startsWith('#'));
  if (entries.length === 0) throw new Error('Empty PR smoke UI test list');
  const seen = new Set();
  for (const entry of entries) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*\/test[A-Za-z0-9_]+$/.test(entry)) {
      throw new Error(`Invalid PR smoke UI test: ${entry}`);
    }
    if (seen.has(entry)) throw new Error(`Duplicate PR smoke UI test: ${entry}`);
    if (!methods.has(entry)) throw new Error(`Unknown PR smoke UI test: ${entry}`);
    seen.add(entry);
  }
  return entries;
}

export function checkPrSmokeUiTests(root = fileURLToPath(new URL('../', import.meta.url))) {
  const methods = new Set();
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith('.swift')) {
        for (const method of swiftTestMethods(readFileSync(path, 'utf8'))) methods.add(method);
      }
    }
  }
  visit(join(root, 'ios/UITests/KnittingEditorUITests'));
  return validateSmokeList(readFileSync(join(root, 'ios/UITests/pr-smoke-ui-tests.txt'), 'utf8'), methods);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    console.log(`PR smoke UI test list: ${checkPrSmokeUiTests().length} existing tests`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
