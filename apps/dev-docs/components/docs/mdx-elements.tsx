import { isValidElement, type ComponentPropsWithoutRef, type ReactElement, type ReactNode } from "react";

export const DOC_PROSE_PARAGRAPH_CLASS = "doc-prose-paragraph";

type ParagraphLikeProps = {
  children?: ReactNode;
  className?: string;
};

export function joinClassNames(...classNames: Array<string | undefined>) {
  const resolvedClassName = classNames.filter(Boolean).join(" ").trim();
  return resolvedClassName.length > 0 ? resolvedClassName : undefined;
}

export function hasParagraphClassName(className?: string) {
  return className?.split(/\s+/).includes(DOC_PROSE_PARAGRAPH_CLASS) ?? false;
}

export function MdxParagraph({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p {...props} className={joinClassNames(DOC_PROSE_PARAGRAPH_CLASS, className)} />;
}

export function isParagraphLikeElement(child: ReactNode): child is ReactElement<ParagraphLikeProps> {
  return isValidElement<ParagraphLikeProps>(child)
    && (child.type === "p" || child.type === MdxParagraph || hasParagraphClassName(child.props.className));
}
