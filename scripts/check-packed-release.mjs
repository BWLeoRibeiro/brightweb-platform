import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
const publicPackageNames = [
  "@brightweblabs/app-shell",
  "@brightweblabs/core-auth",
  "@brightweblabs/infra",
  "@brightweblabs/module-admin",
  "@brightweblabs/module-crm",
  "@brightweblabs/module-marketing",
  "@brightweblabs/module-orgs",
  "@brightweblabs/module-projects",
  "@brightweblabs/theme",
  "@brightweblabs/ui",
  "create-bw-app",
];

function packageDirectory(root, packageName) {
  return path.join(root, "packages", packageName.replace("@brightweblabs/", ""));
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      stdio: options.quiet ? [options.input ? "pipe" : "ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => { stdout += chunk; });
    child.stderr?.on("data", (chunk) => { stderr += chunk; });
    if (options.input) child.stdin?.end(options.input);
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} ${args.join(" ")} failed (${code}).\n${stdout}${stderr}`));
    });
  });
}

async function availablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new Error("Could not allocate registry port.")));
    });
  });
}

async function waitForRegistry(registryUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${registryUrl}/-/ping`);
      if (response.ok) return;
    } catch {
      // Registry is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Local package registry did not become ready.");
}

async function registerRegistryUser(registryUrl, npmUserConfig) {
  const username = "brightweb-ci";
  const response = await fetch(`${registryUrl}/-/user/org.couchdb.user:${username}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      _id: `org.couchdb.user:${username}`,
      name: username,
      password: "brightweb-ci-password",
      email: "ci@brightweb.local",
      type: "user",
      roles: [],
    }),
  });
  const body = await response.json();
  if (!response.ok || !body.token) {
    throw new Error(`Could not create local registry user (${response.status}): ${JSON.stringify(body)}`);
  }
  const registryHost = registryUrl.replace(/^https?:/, "");
  await fs.writeFile(
    npmUserConfig,
    `registry=${registryUrl}\n${registryHost}/:_authToken=${body.token}\n`,
  );
}

async function copyCandidate(source, target) {
  const ignored = new Set([".git", ".next", "node_modules"]);
  await fs.cp(source, target, {
    recursive: true,
    filter: (candidate) => candidate === source || !ignored.has(path.basename(candidate)),
  });
}

async function assertCandidateEdges(candidateRoot, versions) {
  for (const packageName of publicPackageNames) {
    const manifest = JSON.parse(await fs.readFile(
      path.join(packageDirectory(candidateRoot, packageName), "package.json"),
      "utf8",
    ));
    if (manifest.version !== versions[packageName]) {
      throw new Error(`${packageName} version ${manifest.version} does not match the candidate release ${versions[packageName]}.`);
    }
  }
}

async function assertPackedEdges(tarballs, versions) {
  for (const tarball of tarballs) {
    const result = await run("tar", ["-xOf", tarball, "package/package.json"], { quiet: true });
    const manifest = JSON.parse(result.stdout);
    for (const dependencyGroup of [manifest.dependencies, manifest.optionalDependencies, manifest.peerDependencies]) {
      for (const [dependencyName, requested] of Object.entries(dependencyGroup ?? {})) {
        if (!(dependencyName in versions)) continue;
        if (String(requested).startsWith("workspace:")) {
          throw new Error(`${manifest.name} packs an unresolved workspace edge to ${dependencyName}: ${requested}`);
        }
        if (!String(requested).includes(versions[dependencyName])) {
          throw new Error(`${manifest.name} requests ${dependencyName}@${requested}, outside candidate ${versions[dependencyName]}.`);
        }
      }
    }
  }
}

async function assertInstalledVersions(appRoot, versions) {
  const manifest = JSON.parse(await fs.readFile(path.join(appRoot, "package.json"), "utf8"));
  for (const name of Object.keys(manifest.dependencies ?? {}).filter(name => name.startsWith("@brightweblabs/"))) {
    const installed = JSON.parse(await fs.readFile(path.join(appRoot, "node_modules", name, "package.json"), "utf8"));
    if (installed.version !== versions[name]) throw new Error(`${name}: installed ${installed.version}, expected ${versions[name]}`);
  }
}

async function migrationSnapshot(directory) {
  return Object.fromEntries(await Promise.all((await fs.readdir(directory)).sort().map(async name => [name, await fs.readFile(path.join(directory, name), "utf8")])));
}

async function verifyHistoricalUpgrade({ tempRoot, registryUrl, registryEnv, versions, layout, cliRoot }) {
  const root = path.join(tempRoot, `historical-${layout}`);
  await fs.mkdir(root);
  const fixtureRoot = path.join(repoRoot, "tests/fixtures/published-upgrade");
  const archive = path.join(fixtureRoot, "create-bw-app-0.27.1.tgz");
  const provenance = JSON.parse(await fs.readFile(path.join(fixtureRoot, "provenance.json"), "utf8"));
  if (createHash("sha256").update(await fs.readFile(archive)).digest("hex") !== provenance.fixtureSha256) throw new Error("Historical consumer archive differs from recorded provenance");
  await run("tar", ["-xzf", archive, "-C", root], { quiet: true });
  const appRoot = path.join(root, "historical-client");
  const manifestPath = path.join(appRoot, "package.json");
  const historical = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  await run("npx", ["--yes", "pnpm@11", "install", "--frozen-lockfile", "--ignore-scripts"], {
    cwd: appRoot, quiet: true, env: { npm_config_registry: "https://registry.npmjs.org/" },
  });
  await assertInstalledVersions(appRoot, historical.dependencies);
  let migrationsDir = path.join(appRoot, "supabase/migrations");
  if (layout === "parent") {
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ private: true }));
    await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - historical-client\n");
    await fs.rename(path.join(appRoot, "supabase"), path.join(root, "supabase"));
    migrationsDir = path.join(root, "supabase/migrations");
  }
  const before = await migrationSnapshot(migrationsDir);
  const ownedPath = "app/(shell)/account/perfil/page.tsx";
  const skippedPath = "app/(shell)/account/projetos/loading.tsx";
  const customization = await fs.readFile(path.join(appRoot, ownedPath), "utf8");
  // Release-pinned overrides establish the old installed baseline; remove that
  // pin before exercising the real updater's candidate dependency resolution.
  delete historical.pnpm;
  const knownReleasePackages = [
    ...Object.entries(historical.dependencies).filter(([name]) => name.startsWith("@brightweblabs/")),
    ["create-bw-app", historical.devDependencies["create-bw-app"]],
    ...Object.entries(versions),
  ].map(([name, version]) => `${name}@${version}`);
  // The isolated registry has only candidate versions and publishes them now.
  // Exempt these exact previously verified/candidate packages from pnpm's age
  // recheck; keep age policy active for all other third-party dependencies.
  await fs.writeFile(path.join(appRoot, "pnpm-workspace.yaml"), JSON.stringify({
    allowBuilds: { sharp: false },
    minimumReleaseAgeExclude: [...new Set(knownReleasePackages)],
  }));
  historical.devDependencies["create-bw-app"] = versions["create-bw-app"];
  await fs.writeFile(manifestPath, `${JSON.stringify(historical, null, 2)}\n`);
  await fs.writeFile(path.join(appRoot, ".npmrc"), `registry=${registryUrl}\n`);
  const invoke = (args) => run(path.join(cliRoot, "node_modules/.bin/bw"), args, {
    cwd: appRoot,
    env: { ...registryEnv, PATH: `${path.join(cliRoot, "node_modules/.bin")}${path.delimiter}${process.env.PATH}` },
    quiet: true,
  });
  await invoke(["upgrade", "--refresh-starters", "--install", "--package-manager", "pnpm"]);
  await assertInstalledVersions(appRoot, versions);
  const after = await migrationSnapshot(migrationsDir);
  for (const [name, content] of Object.entries(before)) {
    if (after[name] !== content) throw new Error(`${layout}: historical migration changed: ${name}`);
  }
  if (Object.keys(after).length <= Object.keys(before).length) throw new Error(`${layout}: prior release upgrade did not exercise a migration append`);
  if (await fs.readFile(path.join(appRoot, ownedPath), "utf8") !== customization) throw new Error(`${layout}: owned customization changed`);
  if (await fs.stat(path.join(appRoot, skippedPath)).catch(() => null)) throw new Error(`${layout}: skipped scaffold was recreated`);
  const upgradedManifest = JSON.parse(await fs.readFile(path.join(appRoot, ".brightweb/app-manifest.json"), "utf8"));
  if (upgradedManifest.scaffoldFiles[ownedPath]?.intent !== "owned" || upgradedManifest.scaffoldFiles[skippedPath]?.intent !== "skipped") throw new Error(`${layout}: upgrade discarded customization ownership intent`);
  await invoke(["doctor"]);
  const second = await invoke(["upgrade", "--refresh-starters", "--install", "--package-manager", "pnpm"]);
  if (!second.stdout.includes("Applied 0 managed changes, removed 0 obsolete managed files, and added 0 new migrations.")) throw new Error(`${layout}: second upgrade was not a no-op:\n${second.stdout}`);
  if (JSON.stringify(await migrationSnapshot(migrationsDir)) !== JSON.stringify(after)) throw new Error(`${layout}: retry changed migration history`);
  await run("npx", ["--yes", "pnpm@11", "lint"], { cwd: appRoot, env: registryEnv, quiet: true });
  await run("npx", ["--yes", "pnpm@11", "build"], { cwd: appRoot, env: registryEnv, quiet: true });
  console.log(`Historical published 0.27.1 ${layout} migration layout: old install, candidate upgrade, customization preservation, doctor, second no-op, lint and build passed (${Object.keys(after).length - Object.keys(before).length} new migrations).`);
}

async function main() {
  const args = process.argv.slice(2);
  const driverIndex = args.indexOf("--consumer-driver");
  const driver = driverIndex < 0 ? null : args[driverIndex + 1];
  const flags = args.filter((_, index) => driverIndex < 0 || (index !== driverIndex && index !== driverIndex + 1));
  if (flags.some(arg => !["--historical-only", "--external-only"].includes(arg))
    || (driverIndex >= 0 && (!driver || !path.isAbsolute(driver)))
    || (args.includes("--external-only") && !driver)) {
    throw new Error("Usage: check-packed-release.mjs [--historical-only | --external-only] [--consumer-driver /absolute/driver.mjs]");
  }
  const externalOnly = flags.includes("--external-only");
  const historicalOnly = flags.includes("--historical-only");
  console.log(`Packed verification scope: ${externalOnly ? "external consumer driver only; built-in checks omitted" : historicalOnly ? "historical upgrades only; fresh consumer checks omitted" : "fresh consumers and historical upgrades"}.`);
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bw-packed-release-"));
  const candidateRoot = path.join(tempRoot, "candidate");
  const tarballRoot = path.join(tempRoot, "tarballs");
  const registryStorage = path.join(tempRoot, "registry-storage");
  const registryConfig = path.join(tempRoot, "verdaccio.yaml");
  const npmUserConfig = path.join(tempRoot, "npmrc");
  let registryProcess;

  try {
    await copyCandidate(repoRoot, candidateRoot);
    await fs.mkdir(tarballRoot, { recursive: true });
    await run(path.join(repoRoot, "node_modules", ".bin", "changeset"), ["version"], { cwd: candidateRoot });
    await run(process.execPath, ["scripts/sync-compatibility-set.mjs"], { cwd: candidateRoot });
    await run("pnpm", ["install", "--no-frozen-lockfile", "--ignore-scripts"], { cwd: candidateRoot });

    const release = JSON.parse(await fs.readFile(path.join(candidateRoot, "brightweb-release.json"), "utf8"));
    const versions = { ...release.packages };
    versions["create-bw-app"] = JSON.parse(await fs.readFile(
      path.join(candidateRoot, "packages", "create-bw-app", "package.json"),
      "utf8",
    )).version;
    await assertCandidateEdges(candidateRoot, versions);

    const tarballs = [];
    for (const packageName of publicPackageNames) {
      const result = await run("pnpm", ["pack", "--pack-destination", tarballRoot], {
        cwd: packageDirectory(candidateRoot, packageName),
        quiet: true,
      });
      const tarballName = result.stdout.trim().split("\n").at(-1);
      if (!tarballName) throw new Error(`pnpm pack did not report a tarball for ${packageName}.`);
      tarballs.push(path.isAbsolute(tarballName) ? tarballName : path.join(tarballRoot, path.basename(tarballName)));
    }
    await assertPackedEdges(tarballs, versions);

    const port = await availablePort();
    const registryUrl = `http://127.0.0.1:${port}`;
    await fs.writeFile(registryConfig, [
      `storage: ${registryStorage}`,
      "auth:",
      "  htpasswd:",
      `    file: ${path.join(tempRoot, "htpasswd")}`,
      "    max_users: 1000",
      "uplinks:",
      "  npmjs:",
      "    url: https://registry.npmjs.org/",
      "packages:",
      "  '@brightweblabs/*':",
      "    access: $all",
      "    publish: $authenticated",
      "  'create-bw-app':",
      "    access: $all",
      "    publish: $authenticated",
      "  '**':",
      "    access: $all",
      "    proxy: npmjs",
      "log: { type: stdout, format: pretty, level: warn }",
      "",
    ].join("\n"));
    registryProcess = spawn(
      path.join(repoRoot, "node_modules", ".bin", "verdaccio"),
      ["--config", registryConfig, "--listen", `127.0.0.1:${port}`],
      { stdio: "ignore" },
    );
    await waitForRegistry(registryUrl);

    const registryEnv = {
      npm_config_registry: registryUrl,
      npm_config_userconfig: npmUserConfig,
      npm_config_cache: path.join(tempRoot, "npm-cache"),
    };
    await registerRegistryUser(registryUrl, npmUserConfig);

    for (const tarball of tarballs) {
      await run("npm", ["publish", tarball, "--registry", registryUrl, "--ignore-scripts"], { quiet: true, env: registryEnv });
    }

    for (const fixture of (historicalOnly || externalOnly ? [] : [
      { name: "packed-candidate", template: "platform", modules: "admin,crm,marketing,projects" },
      { name: "packed-core", template: "platform", modules: "" },
      { name: "packed-site", template: "site", modules: "" },
    ])) {
      const outputRoot = path.join(tempRoot, "consumer");
      await fs.mkdir(outputRoot, { recursive: true });
      await run("npm", [
        "exec",
        "--yes",
        `--registry=${registryUrl}`,
        `--package=create-bw-app@${versions["create-bw-app"]}`,
        "--",
        "create-bw-app",
        "--name", fixture.name,
        "--template", fixture.template,
        "--modules", fixture.modules,
        "--package-manager", "pnpm",
        "--output-dir", outputRoot,
        "--no-install",
        "--yes",
      ], { env: registryEnv });

      const appRoot = path.join(outputRoot, fixture.name);
      const generatedManifest = JSON.parse(await fs.readFile(path.join(appRoot, "package.json"), "utf8"));
      const expectedBuild = fixture.template === "site" ? "next build" : "next build --webpack";
      if (generatedManifest.scripts?.build !== expectedBuild) {
        throw new Error(`Packed create-bw-app generated an unexpected build script: ${generatedManifest.scripts?.build}`);
      }
      await fs.writeFile(path.join(appRoot, ".npmrc"), `registry=${registryUrl}\n`);
      const pnpm11 = ["--yes", "pnpm@11"];
      await run("npx", [...pnpm11, "install"], { cwd: appRoot, env: { npm_config_registry: registryUrl } });
      await run("npx", [...pnpm11, "lint"], { cwd: appRoot, env: { npm_config_registry: registryUrl } });
      const buildResult = await run("npx", [...pnpm11, "build"], {
        cwd: appRoot,
        env: { npm_config_registry: registryUrl },
        quiet: true,
      });
      const buildOutput = `${buildResult.stdout}\n${buildResult.stderr}`;
      if (buildOutput.includes("Unsupported metadata")) {
        throw new Error(`Packed scaffold build emitted an unsupported metadata warning.\n${buildOutput}`);
      }

      console.log(`${fixture.name}: independently installed, typechecked, and built.`);
    }

    // A separate installed CLI avoids npm exec selecting the old consumer's bw
    // executable from its local node_modules/.bin during the first upgrade.
    const cliRoot = path.join(tempRoot, "candidate-cli");
    await run("npm", ["install", "--prefix", cliRoot, "--ignore-scripts", "--no-audit", "--no-fund", `create-bw-app@${versions["create-bw-app"]}`, "pnpm@11.25.0"], { env: registryEnv, quiet: true });
    for (const layout of (externalOnly ? [] : ["local", "parent"])) {
      await verifyHistoricalUpgrade({ tempRoot, registryUrl, registryEnv, versions, layout, cliRoot });
    }

    if (driver) {
      // The driver owns disposable consumer scenarios. It receives the same
      // packed bytes and live loopback registry as the canonical checks.
      const sessionPath = path.join(tempRoot, "consumer-session.json");
      const packedArtifacts = await Promise.all(tarballs.map(async file => ({ path: file, sha256: createHash("sha256").update(await fs.readFile(file)).digest("hex") })));
      await fs.writeFile(sessionPath, JSON.stringify({ contractVersion: 1, registryUrl, versions, cliRoot, packedArtifacts, installEnv: registryEnv }, null, 2));
      await run(process.execPath, [driver, "--session", sessionPath], { env: registryEnv });
    }
    console.log(`${externalOnly ? "External consumer driver" : historicalOnly ? "Historical upgrade cohorts" : "Full packed release matrix"} for ${versions["create-bw-app"]} passed from an isolated local registry with pnpm 11.`);
  } finally {
    registryProcess?.kill("SIGTERM");
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
