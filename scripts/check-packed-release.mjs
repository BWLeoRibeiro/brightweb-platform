import { spawn } from "node:child_process";
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

async function main() {
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

    const outputRoot = path.join(tempRoot, "consumer");
    await fs.mkdir(outputRoot, { recursive: true });
    await run("npm", [
      "exec",
      "--yes",
      `--registry=${registryUrl}`,
      `--package=create-bw-app@${versions["create-bw-app"]}`,
      "--",
      "create-bw-app",
      "--name", "packed-candidate",
      "--template", "platform",
      "--modules", "admin,crm,marketing,projects",
      "--package-manager", "pnpm",
      "--output-dir", outputRoot,
      "--no-install",
      "--yes",
    ], { env: registryEnv });

    const appRoot = path.join(outputRoot, "packed-candidate");
    const generatedManifest = JSON.parse(await fs.readFile(path.join(appRoot, "package.json"), "utf8"));
    if (generatedManifest.scripts?.build !== "next build --webpack") {
      throw new Error(`Packed create-bw-app generated an unexpected build script: ${generatedManifest.scripts?.build}`);
    }
    await fs.writeFile(path.join(appRoot, ".npmrc"), `registry=${registryUrl}\n`);
    const pnpm11 = ["--yes", "pnpm@11", "--"];
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

    console.log(`Packed release ${versions["create-bw-app"]} installed and built from an isolated local registry with pnpm 11.`);
  } finally {
    registryProcess?.kill("SIGTERM");
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
