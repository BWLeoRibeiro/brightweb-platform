import { evaluate } from "@mdx-js/mdx";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { DocNeighbors } from "../../../components/docs/primitives";
import { getDocNeighbors, getDocPage, getDocRedirect, getDocStaticParams } from "../../../lib/docs";
import { getDocModuleVersions } from "../../../lib/version";
import { useMDXComponents } from "../../../mdx-components";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

async function getPageData(props: PageProps) {
  const params = await props.params;
  const slug = params.slug ?? [];
  const href = slug.length === 0 ? "/docs" : `/docs/${slug.join("/")}`;
  const redirectTarget = getDocRedirect(href);

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  const page = getDocPage(slug);

  if (!page) {
    notFound();
  }

  return page;
}

export function generateStaticParams() {
  return getDocStaticParams();
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { doc } = await getPageData(props);

  return {
    title: doc.title,
    description: doc.summary,
  };
}

export default async function Page(props: PageProps) {
  const { doc, markdown } = await getPageData(props);
  const neighbors = getDocNeighbors(doc.href);
  const moduleVersions = await getDocModuleVersions(doc.href);
  const evaluated = await evaluate(markdown, {
    ...runtime,
    remarkPlugins: [remarkGfm],
  });

  const MDXContent = evaluated.default;
  const lastUpdated = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(doc.lastUpdated));

  return (
    <>
      <header className="doc-page-header">
        <h1 className="doc-prose-heading doc-prose-h1">{doc.title}</h1>
        <p className="doc-page-meta">
          <span className="doc-page-meta-pair">
            <span className="doc-page-meta-label">Last updated</span>
            <time dateTime={doc.lastUpdated}>{lastUpdated}</time>
          </span>
          {moduleVersions.map((entry) => (
            <span key={entry.packageName} className="doc-page-meta-pair">
              <span className="doc-page-meta-label">{entry.label}</span>
              <span>{entry.version}</span>
            </span>
          ))}
        </p>
      </header>

      <div className="docs-repo-doc-meta">
        <p className="docs-repo-doc-label">Source file</p>
        <code>{doc.filePath}</code>
      </div>

      <MDXContent components={useMDXComponents({})} />

      <DocNeighbors previous={neighbors.previous} next={neighbors.next} />
    </>
  );
}
