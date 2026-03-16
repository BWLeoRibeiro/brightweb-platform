import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type DocPageDefinition = {
  href: string;
  title: string;
  summary: string;
  filePath: string;
  slug: string[];
  sectionKey: string;
  visibleInNav: boolean;
  lastUpdated: string;
};

const docRedirects: Record<string, string> = {
  "/docs/foundations/create-an-app": "/docs/foundations/installation",
  "/docs/foundations/create-an-app-templates": "/docs/foundations",
  "/docs/foundations/create-an-app-workspace-mode": "/docs/foundations/installation",
  "/docs/foundations/platform-base": "/docs/modules/platform-base",
};

export type DocSectionDefinition = {
  key: string;
  title: string;
  eyebrow: string;
  href: string;
  summary: string;
  page: DocPageDefinition | null;
  links: DocPageDefinition[];
};

type SectionMeta = {
  title: string;
  eyebrow: string;
};

const MARKDOWN_EXTENSIONS = [".md", ".mdx"];

function resolveRepoDocsRoot() {
  const candidates = [path.resolve(process.cwd(), "../../docs"), path.resolve(process.cwd(), "docs")];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function resolveWorkspaceRoot() {
  const candidates = [path.resolve(process.cwd(), "../.."), process.cwd()];
  return candidates.find((candidate) => existsSync(path.join(candidate, "package.json"))) ?? candidates[0];
}

export const repoDocsRoot = resolveRepoDocsRoot();
const workspaceRoot = resolveWorkspaceRoot();

const sectionMetaByKey: Record<string, SectionMeta> = {
  root: { title: "Docs Index", eyebrow: "Overview" },
  foundations: { title: "Getting Started", eyebrow: "Platform basics" },
  modules: { title: "Modules", eyebrow: "Shared modules" },
  recipes: { title: "Recipes", eyebrow: "How-to" },
};

const sectionOrder = ["root", "foundations", "modules", "recipes"];

const docOrderByHref: Record<string, number> = {
  "/docs": 0,
  "/docs/foundations": 10,
  "/docs/foundations/installation": 20,
  "/docs/foundations/create-an-app-templates": 30,
  "/docs/foundations/project-structure": 40,
  "/docs/modules": 50,
  "/docs/modules/using-modules": 55,
  "/docs/modules/platform-base": 60,
  "/docs/modules/crm": 70,
  "/docs/modules/projects": 80,
  "/docs/recipes": 90,
};

function startCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSectionMeta(sectionKey: string): SectionMeta {
  return sectionMetaByKey[sectionKey] ?? {
    title: startCase(sectionKey),
    eyebrow: "Docs",
  };
}

function extractTitleAndSummary(markdown: string, fallbackName: string) {
  const lines = markdown.split(/\r?\n/);
  const titleLine = lines.find((line) => line.startsWith("# "));
  const title = titleLine ? titleLine.replace(/^#\s+/, "").trim() : startCase(fallbackName);

  const contentLines = titleLine ? lines.slice(lines.indexOf(titleLine) + 1) : lines;
  const paragraph: string[] = [];
  let insideCodeBlock = false;

  for (const rawLine of contentLines) {
    const line = rawLine.trim();

    if (line.startsWith("```")) {
      insideCodeBlock = !insideCodeBlock;
      continue;
    }

    if (insideCodeBlock) {
      continue;
    }

    if (!line) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    if (
      line.startsWith("#") ||
      line.startsWith("- ") ||
      line.startsWith("* ") ||
      /^\d+\.\s/.test(line) ||
      line.startsWith("|") ||
      line.startsWith(">") ||
      line.startsWith("```")
    ) {
      if (paragraph.length > 0) {
        break;
      }
      continue;
    }

    paragraph.push(line);
  }

  return {
    title,
    summary: paragraph.join(" ") || `Reference note from \`${fallbackName}\`.`,
  };
}

function compareDocs(left: DocPageDefinition, right: DocPageDefinition) {
  const leftOrder = docOrderByHref[left.href] ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = docOrderByHref[right.href] ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.href.localeCompare(right.href);
}

function toDocHref(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  const fileName = segments[segments.length - 1];
  const isReadme = /^README\.(md|mdx)$/i.test(fileName);

  if (isReadme) {
    segments.pop();
  } else {
    segments[segments.length - 1] = fileName.replace(/\.(md|mdx)$/i, "");
  }

  return {
    slug: segments,
    href: segments.length === 0 ? "/docs" : `/docs/${segments.join("/")}`,
  };
}

function getSectionKey(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return "root";
  }

  return segments[0];
}

function isVisibleInNav(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/");
  return normalized !== "README.md" && normalized !== "foundations/create-an-app-templates.md";
}

function collectDocFiles(currentDirectory: string, bucket: string[] = []) {
  for (const entry of readdirSync(currentDirectory)) {
    if (entry.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(currentDirectory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      if (entry === "internal" && currentDirectory === repoDocsRoot) {
        continue;
      }

      collectDocFiles(absolutePath, bucket);
      continue;
    }

    if (MARKDOWN_EXTENSIONS.includes(path.extname(entry).toLowerCase())) {
      bucket.push(absolutePath);
    }
  }

  return bucket;
}

function getAllDocs(): DocPageDefinition[] {
  return collectDocFiles(repoDocsRoot)
    .map((absolutePath) => {
      const relativePath = path.relative(repoDocsRoot, absolutePath);
      const markdown = readFileSync(absolutePath, "utf8");
      const stats = statSync(absolutePath);
      const { href, slug } = toDocHref(relativePath);
      const { title, summary } = extractTitleAndSummary(markdown, relativePath);

      return {
        href,
        title,
        summary,
        filePath: `docs/${relativePath.replace(/\\/g, "/")}`,
        slug,
        sectionKey: getSectionKey(relativePath),
        visibleInNav: isVisibleInNav(relativePath),
        lastUpdated: stats.mtime.toISOString(),
      };
    })
    .sort(compareDocs);
}

export const allDocLinks = getAllDocs();

const navigableDocLinks = allDocLinks.filter((doc) => doc.visibleInNav);

export const docsSections: DocSectionDefinition[] = sectionOrder
  .filter((sectionKey) => sectionKey !== "root")
  .map((sectionKey) => {
    const href = `/docs/${sectionKey}`;
    const sectionPage = allDocLinks.find((doc) => doc.href === href) ?? null;
    const childLinks = navigableDocLinks
      .filter((doc) => doc.sectionKey === sectionKey && doc.href !== href)
      .sort(compareDocs);

    if (!sectionPage && childLinks.length === 0) {
      return null;
    }

    return {
      key: sectionKey,
      ...getSectionMeta(sectionKey),
      href,
      summary: sectionPage?.summary ?? childLinks[0]?.summary ?? "",
      page: sectionPage,
      links: childLinks,
    };
  })
  .filter((section): section is DocSectionDefinition => section !== null);

function readBrightwebVersion() {
  const packageJsonPath = path.join(workspaceRoot, "packages/create-bw-app/package.json");

  if (!existsSync(packageJsonPath)) {
    return "0.0.0";
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
  return packageJson.version ?? "0.0.0";
}

export const brightwebVersion = readBrightwebVersion();

export function getDocByHref(href: string) {
  return allDocLinks.find((entry) => entry.href === href) ?? null;
}

export function getDocSectionByHref(href: string) {
  return docsSections.find((section) => section.href === href) ?? null;
}

export function getDocRedirect(href: string) {
  return docRedirects[href] ?? null;
}

export function getDocNeighbors(href: string) {
  const index = navigableDocLinks.findIndex((entry) => entry.href === href);
  if (index === -1) {
    return { previous: null, next: null };
  }

  return {
    previous: index > 0 ? navigableDocLinks[index - 1] : null,
    next: index < navigableDocLinks.length - 1 ? navigableDocLinks[index + 1] : null,
  };
}

function resolveDocFilePath(slug: string[]) {
  const basePath = path.join(repoDocsRoot, ...slug);
  const candidates = [
    ...MARKDOWN_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...MARKDOWN_EXTENSIONS.map((extension) => path.join(basePath, `README${extension}`)),
  ];

  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function toRelativeDocsPath(absolutePath: string) {
  return path.relative(repoDocsRoot, absolutePath).replace(/\\/g, "/");
}

function toDocsHrefFromRelativePath(relativePath: string) {
  return toDocHref(relativePath).href;
}

function rewriteMarkdownLinks(markdown: string, currentRelativePath: string) {
  const currentDirectory = path.dirname(currentRelativePath);

  return markdown.replace(/\(([^)\s]+\.mdx?(?:#[^)]+)?)\)/g, (match, originalHref) => {
    if (
      originalHref.startsWith("http://") ||
      originalHref.startsWith("https://") ||
      originalHref.startsWith("mailto:") ||
      originalHref.startsWith("#") ||
      originalHref.startsWith("/")
    ) {
      return match;
    }

    const [fileHref, hashFragment] = originalHref.split("#");
    const absoluteTarget = path.resolve(repoDocsRoot, currentDirectory, fileHref);

    if (!existsSync(absoluteTarget)) {
      return match;
    }

    const relativeTarget = toRelativeDocsPath(absoluteTarget);
    const href = toDocsHrefFromRelativePath(relativeTarget);
    const hash = hashFragment ? `#${hashFragment}` : "";

    return `(${href}${hash})`;
  });
}

function stripLeadingTitle(markdown: string) {
  return markdown.replace(/^#\s+.+?(?:\r?\n){1,2}/, "");
}

export function getDocPage(slug: string[]) {
  const absolutePath = resolveDocFilePath(slug);

  if (!absolutePath) {
    return null;
  }

  const relativePath = toRelativeDocsPath(absolutePath);
  const href = toDocsHrefFromRelativePath(relativePath);
  const doc = getDocByHref(href);

  if (!doc) {
    return null;
  }

  const markdown = rewriteMarkdownLinks(readFileSync(absolutePath, "utf8"), relativePath);

  return {
    doc,
    markdown: stripLeadingTitle(markdown),
  };
}

export function getDocStaticParams() {
  return allDocLinks.map((doc) => ({
    slug: doc.slug,
  }));
}
