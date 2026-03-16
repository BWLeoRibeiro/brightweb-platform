import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  Callout,
  CommandBlock,
  DependencyGraph,
  DocCardGrid,
  FactTable,
  InstallOrderExamples,
  Lead,
  SourceNote,
} from "./components/docs/primitives";

type MdxComponent = (props: any) => ReactNode;
type MdxComponents = Record<string, MdxComponent>;

function createHeading(level: "h1" | "h2" | "h3") {
  const Tag = level;

  return function Heading(props: ComponentPropsWithoutRef<typeof Tag>) {
    const className = level === "h1"
      ? "doc-prose-heading doc-prose-h1"
      : level === "h2"
        ? "doc-prose-heading doc-prose-h2"
        : "doc-prose-heading doc-prose-h3";
    return <Tag {...props} className={className} />;
  };
}

export function useMDXComponents(components: MdxComponents): MdxComponents {
  return {
    h1: createHeading("h1"),
    h2: createHeading("h2"),
    h3: createHeading("h3"),
    p: (props: ComponentPropsWithoutRef<"p">) => <p {...props} className="doc-prose-paragraph" />,
    ul: (props: ComponentPropsWithoutRef<"ul">) => <ul {...props} className="doc-prose-list" />,
    ol: (props: ComponentPropsWithoutRef<"ol">) => <ol {...props} className="doc-prose-list ordered" />,
    li: (props: ComponentPropsWithoutRef<"li">) => <li {...props} className="doc-prose-list-item" />,
    a: (props: ComponentPropsWithoutRef<"a">) => {
      const href = props.href ?? "";

      if (href.startsWith("/")) {
        return <Link href={href} className="doc-prose-link">{props.children}</Link>;
      }

      return <a {...props} className="doc-prose-link" />;
    },
    strong: (props: ComponentPropsWithoutRef<"strong">) => <strong {...props} className="doc-prose-strong" />,
    blockquote: (props: ComponentPropsWithoutRef<"blockquote">) => <blockquote {...props} className="doc-prose-quote" />,
    hr: (props: ComponentPropsWithoutRef<"hr">) => <hr {...props} className="doc-prose-rule" />,
    table: (props: ComponentPropsWithoutRef<"table">) => (
      <div className="doc-table-wrap">
        <table {...props} className="doc-table" />
      </div>
    ),
    thead: (props: ComponentPropsWithoutRef<"thead">) => <thead {...props} />,
    tbody: (props: ComponentPropsWithoutRef<"tbody">) => <tbody {...props} />,
    tr: (props: ComponentPropsWithoutRef<"tr">) => <tr {...props} />,
    th: (props: ComponentPropsWithoutRef<"th">) => <th {...props} />,
    td: (props: ComponentPropsWithoutRef<"td">) => <td {...props} />,
    pre: (props: ComponentPropsWithoutRef<"pre">) => <pre {...props} className="doc-code-block" />,
    code: (props: ComponentPropsWithoutRef<"code">) => <code {...props} className="doc-inline-code" />,
    Callout,
    CommandBlock,
    DependencyGraph,
    DocCardGrid,
    FactTable,
    InstallOrderExamples,
    Lead,
    SourceNote,
    ...components,
  };
}
