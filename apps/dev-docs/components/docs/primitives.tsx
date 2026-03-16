import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, GitBranchPlus, Link2, TerminalSquare } from "lucide-react";
import type { DocPageDefinition } from "../../lib/docs";

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
};

type SourceNoteProps = {
  title?: string;
  items: string[];
};

export function DocCardGrid({ items }: DocCardGridProps) {
  return (
    <div className="doc-card-grid">
      {items.map((item) => (
        <Link key={item.href} href={item.href} className="doc-link-card">
          <div>
            <p className="doc-link-card-title">{item.title}</p>
            <p className="doc-link-card-summary">{item.summary}</p>
          </div>
          <ArrowRight className="doc-link-card-icon" aria-hidden="true" />
        </Link>
      ))}
    </div>
  );
}

export function Callout({ title, tone = "note", children }: CalloutProps) {
  return (
    <aside className={`doc-callout ${tone}`}>
      {title ? <p className="doc-callout-title">{title}</p> : null}
      <div className="doc-callout-body">{children}</div>
    </aside>
  );
}

export function CommandBlock({ command, title, note }: CommandBlockProps) {
  return (
    <div className="doc-command-block">
      <div className="doc-command-topline">
        <span>
          <TerminalSquare className="doc-inline-icon" aria-hidden="true" />
          {title ?? "Command"}
        </span>
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
  return <p className={`doc-lead ${className ?? ""}`.trim()}>{children}</p>;
}
