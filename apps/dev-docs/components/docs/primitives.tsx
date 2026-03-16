import Link from "next/link";
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { ArrowRight, GitBranchPlus, Link2, TerminalSquare } from "lucide-react";
import { docsSections, type DocPageDefinition } from "../../lib/docs";
import { CopyButton } from "./copyable-code";

type ClassNameProps = {
  className?: string;
};

type CalloutProps = {
  title?: string;
  tone?: "note" | "warn" | "success";
  children: ReactNode;
};

type CommandBlockProps = {
  command: string;
  title?: string;
  note?: string;
};

type FactTableProps = {
  columns: string[];
  rows: string[][];
};

type DependencyGraphProps = {
  items: { label: string; note: string }[];
};

type InstallOrderExamplesProps = {
  examples: { label: string; steps: string[]; note?: string }[];
};

type DocCardGridProps = {
  items: DocPageDefinition[];
  showSummary?: boolean;
};

type SectionCardGridProps = {
  section: string;
};

type SourceNoteProps = {
  title?: string;
  items: string[];
};

const INLINE_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "br",
  "code",
  "em",
  "i",
  "kbd",
  "mark",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
]);

type ParagraphLikeProps = ClassNameProps & {
  children?: ReactNode;
};

function isParagraphLikeElement(child: ReactNode): child is ReactElement<ParagraphLikeProps> {
  return isValidElement<ParagraphLikeProps>(child)
    && (child.type === "p" || (child.props.className ?? "").includes("doc-prose-paragraph"));
}

function hasBlockLevelContent(children: ReactNode[]) {
  return children.some((child) => {
    if (!isValidElement<ClassNameProps>(child)) {
      return false;
    }

    if ((child.props.className ?? "").includes("doc-prose-paragraph")) {
      return true;
    }

    return typeof child.type === "string" && !INLINE_TAGS.has(child.type);
  });
}

function normalizeCalloutChild(child: ReactNode): ReactNode {
  if (!isParagraphLikeElement(child)) {
    return child;
  }

  const children = Children.toArray(child.props.children).filter((nestedChild) => {
    return typeof nestedChild !== "string" || nestedChild.trim().length > 0;
  });
  const normalizedChildren = children.map(normalizeCalloutChild);

  if (normalizedChildren.length === 1 && isParagraphLikeElement(normalizedChildren[0])) {
    const nestedParagraph = normalizedChildren[0];
    const mergedClassName = [child.props.className, nestedParagraph.props.className].filter(Boolean).join(" ");

    return normalizeCalloutChild(cloneElement(nestedParagraph, {
      className: mergedClassName || undefined,
    }));
  }

  if (hasBlockLevelContent(normalizedChildren)) {
    return (
      <div key={child.key ?? undefined} className={child.props.className}>
        {normalizedChildren}
      </div>
    );
  }

  return cloneElement(child, {
    children: normalizedChildren,
  });
}

function normalizeCalloutChildren(children: ReactNode) {
  return Children.toArray(children).map(normalizeCalloutChild);
}

export function DocCardGrid({ items, showSummary = true }: DocCardGridProps) {
  return (
    <div className="doc-card-grid">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="doc-link-card">
          <div>
            <p className="doc-link-card-title">{item.title}</p>
            {showSummary ? <p className="doc-link-card-summary">{item.summary}</p> : null}
          </div>
          <ArrowRight className="doc-link-card-icon" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export function SectionCardGrid({ section }: SectionCardGridProps) {
  const sectionDefinition = docsSections.find((entry) => entry.key === section || entry.href === section) ?? null;

  if (!sectionDefinition || sectionDefinition.links.length === 0) {
    return null;
  }

  return <DocCardGrid items={sectionDefinition.links} showSummary={false} />;
}

export function Callout({ title, tone = "note", children }: CalloutProps) {
  return (
    <aside className={`doc-callout ${tone}`}>
      {title ? <p className="doc-callout-title">{title}</p> : null}
      <div className="doc-callout-body">{normalizeCalloutChildren(children)}</div>
    </aside>
  );
}

export function CommandBlock({ command, title, note }: CommandBlockProps) {
  return (
    <div className="doc-command-block">
      <div className="doc-command-topline">
        <span className="doc-command-topline-label">
          <TerminalSquare className="doc-inline-icon" aria-hidden="true" />
          {title ?? "Command"}
        </span>
        <CopyButton value={command} label="Copy command" className="doc-copy-button-block" />
      </div>
      <pre>
        <code>{command}</code>
      </pre>
      {note ? <p className="doc-command-note">{note}</p> : null}
    </div>
  );
}

export function FactTable({ columns, rows }: FactTableProps) {
  return (
    <div className="doc-table-wrap">
      <table className="doc-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0]}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td key={`${cellIndex}-${cell}`}>
                  <span dangerouslySetInnerHTML={{ __html: cell.replace(/`([^`]+)`/g, "<code>$1</code>") }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function DependencyGraph({ items }: DependencyGraphProps) {
  return (
    <div className="dependency-graph" role="img" aria-label="Module dependency graph from Core through Projects">
      {items.map((item, index) => (
        <div key={item.label} className="dependency-step">
          <div className="dependency-card">
            <p className="dependency-label">{item.label}</p>
            <p>{item.note}</p>
          </div>
          {index < items.length - 1 ? <div className="dependency-arrow" aria-hidden="true"><GitBranchPlus /></div> : null}
        </div>
      ))}
    </div>
  );
}

export function InstallOrderExamples({ examples }: InstallOrderExamplesProps) {
  return (
    <div className="install-order-grid">
      {examples.map((example) => (
        <article key={example.label} className="install-order-card">
          <p className="install-order-label">{example.label}</p>
          <ol>
            {example.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {example.note ? <p className="install-order-note">{example.note}</p> : null}
        </article>
      ))}
    </div>
  );
}

export function SourceNote({ title = "Repo sources behind this page", items }: SourceNoteProps) {
  return (
    <div className="source-note">
      <p className="source-note-title">
        <Link2 className="doc-inline-icon" aria-hidden="true" />
        {title}
      </p>
      <ul>
        {items.map((item) => (
          <li key={item}>
            <code>{item}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DocNeighbors({
  previous,
  next,
}: {
  previous: DocPageDefinition | null;
  next: DocPageDefinition | null;
}) {
  if (!previous && !next) return null;

  return (
    <div className="doc-neighbors">
      {previous ? (
        <Link href={previous.href} className="doc-neighbor-card">
          <span className="doc-neighbor-eyebrow">Previous</span>
          <strong>{previous.title}</strong>
          <small>{previous.summary}</small>
        </Link>
      ) : <span />}

      {next ? (
        <Link href={next.href} className="doc-neighbor-card align-right">
          <span className="doc-neighbor-eyebrow">Next</span>
          <strong>{next.title}</strong>
          <small>{next.summary}</small>
        </Link>
      ) : <span />}
    </div>
  );
}

export function Lead({ children, className }: { children: ReactNode } & ClassNameProps) {
  const resolvedClassName = `doc-lead ${className ?? ""}`.trim();
  const childNodes = Children.toArray(children).filter((child) => {
    return typeof child !== "string" || child.trim().length > 0;
  });

  if (childNodes.length === 1 && isValidElement<{ className?: string }>(childNodes[0])) {
    const child = childNodes[0];
    const childClassName = child.props.className ?? "";
    const isParagraph = child.type === "p" || childClassName.includes("doc-prose-paragraph");

    if (isParagraph) {
      return cloneElement(child, {
        className: `${resolvedClassName} ${childClassName}`.trim(),
      });
    }
  }

  return <div className={resolvedClassName}>{children}</div>;
}
