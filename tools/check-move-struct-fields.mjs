#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_MAX_FIELDS = 32;
const DEFAULT_ROOTS = [
  "sources",
  "packages/oracle/sources",
  "packages/stork-sui/sources",
  "packages/supra-sui/sources",
  "packages/launch-test-coins/sources",
  "packages/usdt-test-coin/sources",
];

function usage() {
  console.error(
    "Usage: node tools/check-move-struct-fields.mjs [--max N] [file-or-dir ...]"
  );
}

function parseArgs(argv) {
  const roots = [];
  let maxFields = DEFAULT_MAX_FIELDS;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--max") {
      const value = argv[i + 1];
      if (value === undefined || !/^[1-9][0-9]*$/.test(value)) {
        usage();
        process.exit(2);
      }
      maxFields = Number(value);
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      roots.push(arg);
    }
  }

  return { maxFields, roots: roots.length > 0 ? roots : DEFAULT_ROOTS };
}

function moveFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return root.endsWith(".move") ? [root] : [];

  const files = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if ([".git", "build", "node_modules", "target"].includes(entry.name)) {
        continue;
      }
      files.push(...moveFiles(child));
    } else if (child.endsWith(".move")) {
      files.push(child);
    }
  }
  return files;
}

function stripComments(source) {
  return source
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function topLevelFieldNames(body) {
  const fields = [];
  let token = "";
  let angle = 0;
  let brace = 0;
  let paren = 0;
  let bracket = 0;

  for (let i = 0; i <= body.length; i += 1) {
    const char = body[i] ?? ",";

    if (char === "<") angle += 1;
    else if (char === ">" && angle > 0) angle -= 1;
    else if (char === "{") brace += 1;
    else if (char === "}" && brace > 0) brace -= 1;
    else if (char === "(") paren += 1;
    else if (char === ")" && paren > 0) paren -= 1;
    else if (char === "[") bracket += 1;
    else if (char === "]" && bracket > 0) bracket -= 1;

    const topLevelSeparator =
      (char === "," || char === "\n") &&
      angle === 0 &&
      brace === 0 &&
      paren === 0 &&
      bracket === 0;

    if (topLevelSeparator) {
      const match = token.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:/);
      if (match) fields.push(match[1]);
      token = "";
    } else {
      token += char;
    }
  }

  return fields;
}

function structsInFile(file) {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  const structs = [];
  const structRegex = /\b(public\s+)?struct\s+([A-Za-z_][A-Za-z0-9_]*)\b[^{;]*\{/g;

  let match;
  while ((match = structRegex.exec(source)) !== null) {
    const openIndex = structRegex.lastIndex - 1;
    const closeIndex = findMatchingBrace(source, openIndex);
    if (closeIndex === -1) continue;

    const body = source.slice(openIndex + 1, closeIndex);
    const fields = topLevelFieldNames(body);
    structs.push({ file, name: match[2], fields });
    structRegex.lastIndex = closeIndex + 1;
  }

  return structs;
}

const { maxFields, roots } = parseArgs(process.argv.slice(2));
const structs = roots
  .flatMap((root) => moveFiles(root))
  .flatMap((file) => structsInFile(file));
const offenders = structs.filter(({ fields }) => fields.length > maxFields);

if (offenders.length > 0) {
  console.error(`Move structs exceed ${maxFields} fields:`);
  for (const { file, name, fields } of offenders) {
    console.error(`${fields.length}\t${file}\t${name}\t${fields.join(",")}`);
  }
  process.exit(1);
}

console.log(`OK: checked ${structs.length} Move structs; max fields <= ${maxFields}`);
