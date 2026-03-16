import { evaluate } from "@mdx-js/mdx";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { DocNeighbors, SourceNote } from "../../../components/docs/primitives";
import { getDocNeighbors, getDocPage, getDocStaticParams } from "../../../lib/docs";
import { useMDXComponents } from "../../../mdx-components";

type PageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

async function getPageData(props: PageProps) {
  const params = await props.params;
  const page = getDocPage(params.slug ?? []);

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
  const evaluated = await evaluate(markdown, {
    ...runtime,
    remarkPlugins: [remarkGfm],
  });

  const MDXContent = evaluated.default;

  return (
    <>
      <div className="docs-repo-doc-meta">
        <p className="docs-repo-doc-label">Source file</p>
        <code>{doc.filePath}</code>
      </div>

      <MDXContent components={useMDXComponents({})} />

      <SourceNote
        title="Repo source"
        items={[
          doc.filePath,
          "This page is rendered directly from the root docs folder. Edit the markdown there, not inside the app.",
        ]}
      />

      <DocNeighbors previous={neighbors.previous} next={neighbors.next} />
    </>
  );
}
