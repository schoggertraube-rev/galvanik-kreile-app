import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const EXPECTED_VERSION = "2.111.0";
const REPOSITORY_ROOT = path.resolve(fileURLToPath(new URL("../", import.meta.url)));

function readJson(filePath, label) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`${label} is missing or invalid: ${error.message}`);
  }
}

function localCliPath(root) {
  return path.join(root, "node_modules", "supabase", "dist", "supabase.js");
}

function readRuntimeVersion(root) {
  const executable = localCliPath(root);
  if (!existsSync(executable)) {
    throw new Error(`local Supabase CLI is missing at ${executable}`);
  }

  const result = spawnSync(process.execPath, [executable, "--version"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error?.message ?? result.stderr.trim() ?? `exit ${result.status}`;
    throw new Error(`local Supabase CLI could not be executed: ${detail}`);
  }

  const version = result.stdout.trim();
  if (!version) throw new Error("local Supabase CLI returned no version");
  return version;
}

function inspectPin(root) {
  const manifest = readJson(path.join(root, "package.json"), "package.json");
  const lock = readJson(path.join(root, "package-lock.json"), "package-lock.json");
  const manifestVersion = manifest.devDependencies?.supabase;
  const runtimeDependency = manifest.dependencies?.supabase;
  const lockRootVersion = lock.packages?.[""]?.devDependencies?.supabase;
  const lockPackageVersion = lock.packages?.["node_modules/supabase"]?.version;
  const runtimeVersion = readRuntimeVersion(root);

  if (runtimeDependency !== undefined) {
    throw new Error("supabase must be a devDependency, not a runtime dependency");
  }
  if (manifestVersion !== EXPECTED_VERSION) {
    throw new Error(`manifest version must be exactly ${EXPECTED_VERSION}, got ${manifestVersion ?? "missing"}`);
  }
  if (lockRootVersion !== EXPECTED_VERSION) {
    throw new Error(`lock root version must be exactly ${EXPECTED_VERSION}, got ${lockRootVersion ?? "missing"}`);
  }
  if (lockPackageVersion !== EXPECTED_VERSION) {
    throw new Error(`locked package version must be exactly ${EXPECTED_VERSION}, got ${lockPackageVersion ?? "missing"}`);
  }
  if (runtimeVersion !== EXPECTED_VERSION) {
    throw new Error(`runtime version must be exactly ${EXPECTED_VERSION}, got ${runtimeVersion}`);
  }

  return { manifestVersion, lockRootVersion, lockPackageVersion, runtimeVersion };
}

function writeRuntimeFixture(root, version) {
  const binDirectory = path.join(root, "node_modules", "supabase", "dist");
  mkdirSync(binDirectory, { recursive: true });
  const executable = localCliPath(root);
  writeFileSync(executable, `console.log(${JSON.stringify(version)});\n`, "utf8");
}

function writeContractFixture(root, version = EXPECTED_VERSION) {
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ devDependencies: { supabase: version } }),
    "utf8",
  );
  writeFileSync(
    path.join(root, "package-lock.json"),
    JSON.stringify({
      packages: {
        "": { devDependencies: { supabase: version } },
        "node_modules/supabase": { version },
      },
    }),
    "utf8",
  );
}

function expectFailure(label, operation, expectedText) {
  try {
    operation();
  } catch (error) {
    if (error.message.includes(expectedText)) return;
    throw new Error(`${label} failed for the wrong reason: ${error.message}`);
  }
  throw new Error(`${label} unexpectedly passed`);
}

function runSelftest() {
  const root = mkdtempSync(path.join(tmpdir(), "supabase-pin-selftest-"));
  try {
    writeContractFixture(root);
    writeRuntimeFixture(root, EXPECTED_VERSION);
    inspectPin(root);

    rmSync(localCliPath(root), { force: true });
    expectFailure("missing runtime", () => inspectPin(root), "local Supabase CLI is missing");

    writeRuntimeFixture(root, "2.110.0");
    expectFailure("runtime mismatch", () => inspectPin(root), "runtime version must be exactly");

    writeContractFixture(root, "^2.111.0");
    writeRuntimeFixture(root, EXPECTED_VERSION);
    expectFailure("manifest range", () => inspectPin(root), "manifest version must be exactly");

    writeContractFixture(root);
    const lock = readJson(path.join(root, "package-lock.json"), "selftest lock");
    lock.packages["node_modules/supabase"].version = "2.110.0";
    writeFileSync(path.join(root, "package-lock.json"), JSON.stringify(lock), "utf8");
    expectFailure("lock mismatch", () => inspectPin(root), "locked package version must be exactly");

    console.log("SUPABASE_VERSION_CHECK_SELFTEST=PASS cases=5");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

try {
  if (process.argv.includes("--selftest")) {
    runSelftest();
  } else {
    const result = inspectPin(REPOSITORY_ROOT);
    console.log(`SUPABASE_MANIFEST_VERSION=${result.manifestVersion}`);
    console.log(`SUPABASE_LOCK_ROOT_VERSION=${result.lockRootVersion}`);
    console.log(`SUPABASE_LOCK_PACKAGE_VERSION=${result.lockPackageVersion}`);
    console.log(`SUPABASE_RUNTIME_VERSION=${result.runtimeVersion}`);
    console.log("SUPABASE_CLI_PIN=PASS");
  }
} catch (error) {
  console.error(`SUPABASE_CLI_PIN=FAIL reason=${error.message}`);
  process.exitCode = 1;
}
