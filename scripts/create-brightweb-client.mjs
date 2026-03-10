import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const starterAppDir = path.join(repoRoot, "apps", "starter-site");
const appsDir = path.join(repoRoot, "apps");

const MODULE_KEYS = ["crm", "projects", "admin"];

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleizeSlug(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parseYesNo(value, defaultValue) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["y", "yes", "true", "1"].includes(normalized)) return true;
  if (["n", "no", "false", "0"].includes(normalized)) return false;
  return defaultValue;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function copyStarterApp(targetDir) {
  await fs.cp(starterAppDir, targetDir, {
    recursive: true,
    errorOnExist: true,
    filter(source) {
      const relative = path.relative(starterAppDir, source);
      if (!relative) return true;
      const segments = relative.split(path.sep);
      return !segments.includes("node_modules") && !segments.includes(".next");
    },
  });
}

function createEnvLocal({
  slug,
  companyName,
  productName,
  tagline,
  contactEmail,
  supportEmail,
  primaryHex,
  modules,
}) {
  return [
    "NEXT_PUBLIC_APP_URL=http://localhost:3000",
    "NEXT_PUBLIC_SUPABASE_URL=",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY=",
    "SUPABASE_SERVICE_ROLE_KEY=",
    "RESEND_API_KEY=",
    "",
    `NEXT_PUBLIC_CLIENT_COMPANY_NAME=${companyName}`,
    `NEXT_PUBLIC_CLIENT_PRODUCT_NAME=${productName}`,
    `NEXT_PUBLIC_CLIENT_SLUG=${slug}`,
    `NEXT_PUBLIC_CLIENT_TAGLINE=${tagline}`,
    `NEXT_PUBLIC_CLIENT_CONTACT_EMAIL=${contactEmail}`,
    `NEXT_PUBLIC_CLIENT_SUPPORT_EMAIL=${supportEmail}`,
    `NEXT_PUBLIC_CLIENT_PRIMARY_HEX=${primaryHex}`,
    "",
    `NEXT_PUBLIC_ENABLE_CRM=${String(modules.crm)}`,
    `NEXT_PUBLIC_ENABLE_PROJECTS=${String(modules.projects)}`,
    `NEXT_PUBLIC_ENABLE_ADMIN=${String(modules.admin)}`,
    "",
  ].join("\n");
}

async function updatePackageManifest(targetDir, slug) {
  const packageJsonPath = path.join(targetDir, "package.json");
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  packageJson.name = slug;
  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function updateReadme(targetDir, values) {
  const readmePath = path.join(targetDir, "README.md");
  const content = [
    `# ${values.companyName}`,
    "",
    `Client app scaffolded from Brightweb Platform for \`${values.slug}\`.`,
    "",
    "## Local setup",
    "",
    "1. Review `.env.local` and fill in service credentials.",
    "2. Run `pnpm install` at the workspace root.",
    `3. Run \`pnpm --filter ${values.slug} dev\`.`,
    "",
    "## Enabled modules",
    "",
    ...MODULE_KEYS.map((key) => `- ${key}: ${values.modules[key] ? "enabled" : "disabled"}`),
    "",
  ].join("\n");
  await fs.writeFile(readmePath, content);
}

async function main() {
  const rl = readline.createInterface({ input, output });

  try {
    output.write("\nBrightweb client installer\n\n");

    const slugInput = await rl.question("App slug (example: acme-portal): ");
    const slug = slugify(slugInput || "");
    if (!slug) {
      throw new Error("A valid app slug is required.");
    }

    const targetDir = path.join(appsDir, slug);
    if (await pathExists(targetDir)) {
      throw new Error(`Target app already exists: ${targetDir}`);
    }

    const defaultCompanyName = titleizeSlug(slug);
    const companyName = (await rl.question(`Company name [${defaultCompanyName}]: `)).trim() || defaultCompanyName;
    const productName = (await rl.question("Product name [Operations Platform]: ")).trim() || "Operations Platform";
    const tagline =
      (await rl.question("Tagline [A configurable Brightweb starter app for new client instances.]: ")).trim()
      || "A configurable Brightweb starter app for new client instances.";
    const contactEmail = (await rl.question("Contact email [hello@example.com]: ")).trim() || "hello@example.com";
    const supportEmail = (await rl.question("Support email [support@example.com]: ")).trim() || "support@example.com";
    const primaryHex = (await rl.question("Primary brand hex [#1f7a45]: ")).trim() || "#1f7a45";

    const modules = {
      crm: parseYesNo(await rl.question("Enable CRM? [Y/n]: "), true),
      projects: parseYesNo(await rl.question("Enable Projects? [Y/n]: "), true),
      admin: parseYesNo(await rl.question("Enable Admin? [Y/n]: "), true),
    };

    await copyStarterApp(targetDir);
    await updatePackageManifest(targetDir, slug);
    await updateReadme(targetDir, {
      slug,
      companyName,
      modules,
    });

    const envLocalPath = path.join(targetDir, ".env.local");
    await fs.writeFile(
      envLocalPath,
      createEnvLocal({
        slug,
        companyName,
        productName,
        tagline,
        contactEmail,
        supportEmail,
        primaryHex,
        modules,
      }),
    );

    output.write(`\nCreated app at apps/${slug}\n`);
    output.write(`Next step: pnpm --filter ${slug} dev\n\n`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(`\nInstaller failed: ${error.message}`);
  process.exitCode = 1;
});
