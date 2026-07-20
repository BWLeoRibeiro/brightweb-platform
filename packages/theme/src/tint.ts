/** The two canonical tint recipes provided by the theme CSS. */
export type TintVariant = "soft" | "hero";

export type TintPillResult = {
  className: "tint-soft" | "tint-hero";
  style: Record<string, string>;
};

/**
 * Pairs a semantic custom property with the canonical tinted-pill recipes.
 * Pass the custom-property name without a var() wrapper.
 */
export function tintPill(token: string, variant: TintVariant = "soft"): TintPillResult {
  const style: Record<string, string> = { "--tint": `var(${token})` };

  if (variant === "soft") {
    style["--tint-strong"] = `var(${token}-strong)`;
    return { className: "tint-soft", style };
  }

  return { className: "tint-hero", style };
}
