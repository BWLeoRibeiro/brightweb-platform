"use client";

import { Braces, Check, Copy, TerminalSquare } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useState } from "react";

type CopyButtonProps = {
  value: string;
  label: string;
  className?: string;
};

type CopyableCodeBlockProps = {
  code: string;
  language?: string;
};

async function copyText(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  if (typeof document === "undefined") {
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function getLanguageLabel(language?: string) {
  const normalized = language?.replace(/^language-/, "").replace(/^lang-/, "").trim().toLowerCase();

  if (!normalized) {
    return { label: "Code", Icon: Braces };
  }

  if (["bash", "shell", "sh", "zsh", "terminal", "console"].includes(normalized)) {
    return { label: "Terminal", Icon: TerminalSquare };
  }

  return {
    label: normalized.toUpperCase(),
    Icon: Braces,
  };
}

export function CopyButton({ value, label, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  return (
    <button
      type="button"
      className={`doc-copy-button ${className ?? ""}`.trim()}
      onClick={async () => {
        await copyText(value);
        setCopied(true);
      }}
      aria-label={copied ? `${label} copied` : label}
      title={copied ? "Copied" : label}
    >
      {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
      <span className="doc-copy-button-text">{copied ? "Copied" : "Copy"}</span>
    </button>
  );
}

export function CopyableCodeBlock({ code, language }: CopyableCodeBlockProps) {
  const { label, Icon } = getLanguageLabel(language);

  return (
    <div className="doc-code-shell">
      <div className="doc-code-header">
        <div className="doc-code-header-label">
          <Icon size={16} aria-hidden="true" />
          <span>{label}</span>
        </div>
        <CopyButton value={code} label="Copy code block" className="doc-copy-button-block" />
      </div>
      <pre className="doc-code-block">
        <code className={language ?? undefined}>{code}</code>
      </pre>
    </div>
  );
}

export function InlineCode(props: ComponentPropsWithoutRef<"code">) {
  return <code {...props} className="doc-inline-code" />;
}
