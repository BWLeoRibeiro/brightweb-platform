import Link from "next/link";
import { isValidElement, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { MdxParagraph } from "./components/docs/mdx-elements";
import {
  Callout,
  CommandBlock,
  DependencyGraph,
  DocCardGrid,
  FactTable,
  InstallOrderExamples,
  Lead,
  SectionCardGrid,
  SourceNote,
} from "./components/docs/primitives";
import { CopyableCodeBlock, InlineCode } from "./components/docs/copyable-code";
import { getTableMetadataFromChildren } from "./components/docs/table-metadata";

type MdxComponent = (props: any) => ReactNode;
type MdxComponents = Record<string, MdxComponent>;

function flattenText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(flattenText).join("");
  }

  if (value && typeof value === "object" && "props" in value) {
    return flattenText((value as { props?: { children?: ReactNode } }).props?.children ?? "");
  }

  return "";
}

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
    p: MdxParagraph,
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
    table: (props: ComponentPropsWithoutRef<"table">) => {
      const metadata = getTableMetadataFromChildren(props.children);

      return (
        <div className="doc-table-wrap">
          <table
            {...props}
            className="doc-table"
            data-columns={String(metadata.columns)}
            data-variant={metadata.variant}
          />
        </div>
      );
    },
    thead: (props: ComponentPropsWithoutRef<"thead">) => <thead {...props} />,
    tbody: (props: ComponentPropsWithoutRef<"tbody">) => <tbody {...props} />,
    tr: (props: ComponentPropsWithoutRef<"tr">) => <tr {...props} />,
    th: (props: ComponentPropsWithoutRef<"th">) => <th {...props} />,
    td: (props: ComponentPropsWithoutRef<"td">) => <td {...props} />,
    pre: (props: ComponentPropsWithoutRef<"pre">) => {
      const child = props.children;

      if (isValidElement<{ children?: ReactNode; className?: string }>(child)) {
        const code = flattenText(child.props.children);
        return <CopyableCodeBlock code={code} language={child.props.className} />;
      }

      return <CopyableCodeBlock code={flattenText(child)} />;
    },
    code: (props: ComponentPropsWithoutRef<"code">) => <InlineCode {...props} />,
    Callout,
    CommandBlock,
    DependencyGraph,
    DocCardGrid,
    FactTable,
    InstallOrderExamples,
    Lead,
    SectionCardGrid,
    SourceNote,
    ...components,
  };
}
