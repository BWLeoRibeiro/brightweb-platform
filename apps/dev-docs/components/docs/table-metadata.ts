import { Children, isValidElement, type ReactNode } from "react";

type TableMetadata = {
  columns: number;
  variant: string;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/`/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function flattenNodeText(value: ReactNode): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(flattenNodeText).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(value)) {
    return flattenNodeText(value.props.children ?? "");
  }

  return "";
}

function getNodeChildren(node: ReactNode) {
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return [];
  }

  return Children.toArray(node.props.children);
}

function getVariantFromHeaders(headers: string[]) {
  const signature = headers.map(slugify).join("|");

  switch (signature) {
    case "template|choose-it-when|what-you-get-on-day-1|services-required-to-fully-validate-the-starter":
      return "template-choice";
    case "key|scope|required-for|purpose|where-the-real-value-comes-from":
      return "service-keys";
    case "key|scope|what-it-controls|where-it-comes-from-initially":
      return "generated-config";
    case "key|scope|what-it-controls|notes":
      return "module-flags";
    case "route|what-you-should-see|what-a-non-green-state-usually-means":
      return "validation-routes";
    case "starter-surface|treat-it-as|better-long-term-direction":
      return "surface-replacements";
    default:
      return "generic";
  }
}

export function getTableMetadata(headers: string[]): TableMetadata {
  return {
    columns: headers.length,
    variant: getVariantFromHeaders(headers),
  };
}

export function getTableMetadataFromChildren(children: ReactNode): TableMetadata {
  const rootChildren = Children.toArray(children);
  const thead = rootChildren.find((child) => isValidElement(child) && child.type === "thead");
  const headerRow = getNodeChildren(thead).find((child) => isValidElement(child) && child.type === "tr");
  const headers = getNodeChildren(headerRow)
    .filter((child) => isValidElement(child) && (child.type === "th" || child.type === "td"))
    .map((child) => flattenNodeText(child).trim())
    .filter(Boolean);

  return getTableMetadata(headers);
}
