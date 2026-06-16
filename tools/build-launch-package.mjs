#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SKIPPED_DIRS = new Set([".git", "build", "node_modules", "target"]);
const PROVIDER_SOURCE_MODULES = new Map([
  ["pyth", "pyth_source"],
  ["switchboard", "switchboard_source"],
  ["stork", "stork_source"],
  ["stork-rest", "stork_source"],
  ["supra-push", "supra_source"],
  ["supra-pull", "supra_pull_source"],
  ["supra-pull-rest", "supra_pull_source"],
]);
const PROVIDER_SOURCE_MODULE_NAMES = new Set(PROVIDER_SOURCE_MODULES.values());
const AMM_PROVIDER_SOURCE_MODULES = new Map([
  ["flowx", "amm_flowx"],
]);
const AMM_PROVIDER_SOURCE_MODULE_NAMES = new Set(AMM_PROVIDER_SOURCE_MODULES.values());

function usage() {
  console.error(
    [
      "Usage: node tools/build-launch-package.mjs --config <file> --out <dir> [--root <dir>] [--force]",
      "       [--local-dependency <Name>=<path>]...",
      "",
      "Builds a publishable BrownFi Sui package variant from an explicit launch config.",
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = { root: process.cwd(), force: false, localDependencies: {} };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--root") {
      args.root = argv[++i];
    } else if (arg === "--force") {
      args.force = true;
    } else if (arg === "--local-dependency") {
      const value = argv[++i];
      const match = value?.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.+)$/);
      if (!match) {
        throw new Error("--local-dependency must use NAME=PATH");
      }
      args.localDependencies[match[1]] = match[2];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.config || !args.out) {
    usage();
    process.exit(2);
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function assertStringArray(config, key) {
  const value = config[key] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`Launch config field '${key}' must be an array of non-empty strings`);
  }
  return value;
}

function assertRelativePackagePath(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    path.isAbsolute(value) ||
    value.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`${label} must be a non-empty package-relative path`);
  }
  return value;
}

function assertCopyPaths(config) {
  const value = config.copyPaths ?? [];
  if (!Array.isArray(value)) {
    throw new Error("Launch config field 'copyPaths' must be an array");
  }
  return value.map((item, index) => {
    if (typeof item === "string") {
      const target = assertRelativePackagePath(item, `Launch config copyPaths[${index}]`);
      return { source: item, target };
    }
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(
        `Launch config copyPaths[${index}] must be a non-empty string or an object`
      );
    }
    if (typeof item.source !== "string" || item.source.length === 0) {
      throw new Error(`Launch config copyPaths[${index}].source must be a non-empty string`);
    }
    return {
      source: item.source,
      target: assertRelativePackagePath(
        item.target,
        `Launch config copyPaths[${index}].target`
      )
    };
  });
}

function assertManifestOverrides(config) {
  const value = config.manifestOverrides ?? [];
  if (!Array.isArray(value)) {
    throw new Error("Launch config field 'manifestOverrides' must be an array");
  }
  return value.map((item, index) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Launch config manifestOverrides[${index}] must be an object`);
    }
    if (typeof item.path !== "string" || item.path.length === 0) {
      throw new Error(`Launch config manifestOverrides[${index}].path must be a non-empty string`);
    }
    if (typeof item.manifest !== "string" || item.manifest.length === 0) {
      throw new Error(`Launch config manifestOverrides[${index}].manifest must be a non-empty string`);
    }
    const removeAddresses = item.removeAddresses ?? [];
    if (
      !Array.isArray(removeAddresses) ||
      removeAddresses.some((address) => typeof address !== "string" || address.length === 0)
    ) {
      throw new Error(
        `Launch config manifestOverrides[${index}].removeAddresses must be an array of non-empty strings`
      );
    }
    const localDependencies = item.localDependencies ?? {};
    if (localDependencies === null || typeof localDependencies !== "object" || Array.isArray(localDependencies)) {
      throw new Error(`Launch config manifestOverrides[${index}].localDependencies must be an object`);
    }
    for (const [name, dependencyPath] of Object.entries(localDependencies)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`Launch config manifestOverrides[${index}].localDependencies key is invalid: ${name}`);
      }
      if (typeof dependencyPath !== "string" || dependencyPath.length === 0) {
        throw new Error(
          `Launch config manifestOverrides[${index}].localDependencies.${name} must be a non-empty string`
        );
      }
    }
    return {
      path: item.path,
      manifest: item.manifest,
      removeAddresses,
      localDependencies,
    };
  });
}

function assertLocalDependencies(config) {
  const value = config.localDependencies ?? {};
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Launch config field 'localDependencies' must be an object");
  }
  const localDependencies = {};
  for (const [name, dependencyPath] of Object.entries(value)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Launch config localDependencies key is invalid: ${name}`);
    }
    if (typeof dependencyPath !== "string" || dependencyPath.length === 0) {
      throw new Error(`Launch config localDependencies.${name} must be a non-empty string`);
    }
    localDependencies[name] = dependencyPath;
  }
  return localDependencies;
}

function assertProviderSourceSelection(providerIds, sources) {
  const sourceSet = new Set(sources);
  const selectedSourceModules = new Set();
  for (const providerId of providerIds) {
    const sourceModule = PROVIDER_SOURCE_MODULES.get(providerId);
    if (sourceModule === undefined) {
      throw new Error(`Launch config provider ID is not recognized: ${providerId}`);
    }
    selectedSourceModules.add(sourceModule);
    if (!sourceSet.has(sourceModule)) {
      throw new Error(
        `Launch config provider ${providerId} requires selected source module ${sourceModule}`
      );
    }
  }
  for (const source of sourceSet) {
    if (PROVIDER_SOURCE_MODULE_NAMES.has(source) && !selectedSourceModules.has(source)) {
      throw new Error(`Launch config source module ${source} requires matching provider ID`);
    }
  }
}

function assertAmmProviderSourceSelection(ammProviderIds, sources) {
  const sourceSet = new Set(sources);
  const selectedSourceModules = new Set();
  for (const providerId of ammProviderIds) {
    const sourceModule = AMM_PROVIDER_SOURCE_MODULES.get(providerId);
    if (sourceModule === undefined) {
      throw new Error(`Launch config AMM provider ID is not recognized: ${providerId}`);
    }
    selectedSourceModules.add(sourceModule);
    if (!sourceSet.has(sourceModule)) {
      throw new Error(
        `Launch config AMM provider ${providerId} requires selected source module ${sourceModule}`
      );
    }
  }
  for (const source of sourceSet) {
    if (AMM_PROVIDER_SOURCE_MODULE_NAMES.has(source) && !selectedSourceModules.has(source)) {
      throw new Error(`Launch config AMM source module ${source} requires matching AMM provider ID`);
    }
  }
}

function loadConfig(configPath) {
  const config = readJson(configPath);
  const sources = assertStringArray(config, "sources");
  if (sources.length === 0) {
    throw new Error("Launch config must select at least one source module");
  }
  const providerIds = assertStringArray(config, "providerIds");
  if (providerIds.length > 0) {
    assertProviderSourceSelection(providerIds, sources);
  }
  const ammProviderIds = assertStringArray(config, "ammProviderIds");
  if (
    ammProviderIds.length > 0 ||
    sources.some((source) => AMM_PROVIDER_SOURCE_MODULE_NAMES.has(source))
  ) {
    assertAmmProviderSourceSelection(ammProviderIds, sources);
  }

  const localDependencies = assertLocalDependencies(config);
  return {
    name: typeof config.name === "string" ? config.name : path.basename(configPath, ".json"),
    providerIds,
    ammProviderIds,
    sources,
    copyPaths: assertCopyPaths(config),
    removeDependencies: assertStringArray(config, "removeDependencies"),
    removeAddresses: assertStringArray(config, "removeAddresses"),
    manifestOverrides: assertManifestOverrides(config),
    localDependencies,
  };
}

function copyRecursive(src, dst) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (entry.isDirectory() && SKIPPED_DIRS.has(entry.name)) continue;
      copyRecursive(path.join(src, entry.name), path.join(dst, entry.name));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function sectionName(line) {
  const match = line.trim().match(/^\[([^\]]+)]$/);
  return match ? match[1] : null;
}

function removeDependencySections(manifest, dependencyNames) {
  if (dependencyNames.length === 0) return manifest;

  const dependencySet = new Set(dependencyNames);
  const lines = manifest.split("\n");
  const kept = [];
  let skippingSection = false;

  for (const line of lines) {
    const section = sectionName(line);
    if (section !== null) {
      skippingSection = section.startsWith("dependencies.") && dependencySet.has(section.slice("dependencies.".length));
    }

    if (skippingSection) continue;

    const inlineDependency = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (inlineDependency && dependencySet.has(inlineDependency[2])) continue;

    kept.push(line);
  }

  return kept.join("\n").replace(/\n{3,}/g, "\n\n");
}

function removeAddressLines(manifest, addressNames) {
  if (addressNames.length === 0) return manifest;

  const addressSet = new Set(addressNames);
  return manifest
    .split("\n")
    .filter((line) => {
      const match = line.match(/^(\s*)([A-Za-z_][A-Za-z0-9_]*)\s*=/);
      return !match || !addressSet.has(match[2]);
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function patchManifest(manifest, config) {
  let patched = removeDependencySections(manifest, config.removeDependencies);
  patched = removeAddressLines(patched, config.removeAddresses);
  return patched.endsWith("\n") ? patched : `${patched}\n`;
}

function tomlString(value) {
  return JSON.stringify(value);
}

function insertDependencySection(manifest, dependencyName, dependencyBody) {
  const block = `[dependencies.${dependencyName}]\n${dependencyBody}\n`;
  const addressesIndex = manifest.search(/^\[addresses\]/m);
  if (addressesIndex === -1) {
    return manifest.endsWith("\n") ? `${manifest}\n${block}` : `${manifest}\n\n${block}`;
  }

  const prefix = manifest.slice(0, addressesIndex).replace(/\s*$/, "\n\n");
  const suffix = manifest.slice(addressesIndex);
  return `${prefix}${block}\n${suffix}`;
}

function overrideLocalDependencies(manifest, localDependencies) {
  const entries = Object.entries(localDependencies ?? {});
  if (entries.length === 0) return manifest;

  let patched = manifest;
  for (const [dependencyName, dependencyPath] of entries) {
    patched = removeDependencySections(patched, [dependencyName]);
    patched = insertDependencySection(
      patched,
      dependencyName,
      `local = ${tomlString(dependencyPath)}`
    );
  }

  return patched;
}

function assertOutputReady(out, force) {
  if (!fs.existsSync(out)) return;
  if (!force) {
    throw new Error(`Output directory already exists: ${out}`);
  }
  fs.rmSync(out, { recursive: true, force: true });
}

function applyManifestOverride(outDir, override) {
  const packageDir = path.join(outDir, override.path);
  const sourceManifest = path.join(packageDir, override.manifest);
  const targetManifest = path.join(packageDir, "Move.toml");
  if (!fs.existsSync(sourceManifest)) {
    throw new Error(
      `Configured manifest override does not exist: ${path.join(override.path, override.manifest)}`
    );
  }
  const patched = overrideLocalDependencies(
    removeAddressLines(fs.readFileSync(sourceManifest, "utf8"), override.removeAddresses),
    override.localDependencies
  );
  fs.writeFileSync(targetManifest, patched.endsWith("\n") ? patched : `${patched}\n`);
  return path.join(override.path, "Move.toml");
}

export function buildLaunchPackage({
  root = process.cwd(),
  config,
  out,
  force = false,
  localDependencies = {},
}) {
  if (!config) throw new Error("Missing launch config path");
  if (!out) throw new Error("Missing output directory");

  const rootDir = path.resolve(root);
  const configPath = path.resolve(rootDir, config);
  const outDir = path.resolve(out);
  const launchConfig = loadConfig(configPath);

  assertOutputReady(outDir, force);
  fs.mkdirSync(outDir, { recursive: true });

  const manifestPath = path.join(rootDir, "Move.toml");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Move.toml not found at package root: ${rootDir}`);
  }

  fs.writeFileSync(
    path.join(outDir, "Move.toml"),
    overrideLocalDependencies(
      patchManifest(fs.readFileSync(manifestPath, "utf8"), launchConfig),
      { ...launchConfig.localDependencies, ...localDependencies }
    )
  );

  for (const moduleName of launchConfig.sources) {
    const source = path.join(rootDir, "sources", `${moduleName}.move`);
    if (!fs.existsSync(source)) {
      throw new Error(`Selected source module does not exist: ${moduleName}`);
    }
    copyRecursive(source, path.join(outDir, "sources", `${moduleName}.move`));
  }

  for (const copyPath of launchConfig.copyPaths) {
    const source = path.isAbsolute(copyPath.source)
      ? copyPath.source
      : path.join(rootDir, copyPath.source);
    if (!fs.existsSync(source)) {
      throw new Error(`Configured copy path does not exist: ${copyPath.source}`);
    }
    copyRecursive(source, path.join(outDir, copyPath.target));
  }

  const manifestOverrides = launchConfig.manifestOverrides.map((override) =>
    applyManifestOverride(outDir, override)
  );

  return {
    name: launchConfig.name,
    out: outDir,
    providerIds: [...launchConfig.providerIds].sort(),
    ammProviderIds: [...launchConfig.ammProviderIds].sort(),
    sources: [...launchConfig.sources].sort(),
    copyPaths: launchConfig.copyPaths.map((item) => item.target).sort(),
    removedDependencies: [...launchConfig.removeDependencies].sort(),
    removedAddresses: [...launchConfig.removeAddresses].sort(),
    overriddenDependencies: Object.keys({
      ...launchConfig.localDependencies,
      ...localDependencies,
    }).sort(),
    manifestOverrides,
  };
}

function main() {
  const result = buildLaunchPackage(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
