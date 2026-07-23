import type { ScriptHTMLAttributes } from "react";
import { getThemeBootstrapScript, type ThemeMode } from "./theme-controller";

export type ThemeScriptProps = Pick<ScriptHTMLAttributes<HTMLScriptElement>, "nonce"> & {
  defaultTheme?: ThemeMode;
};

export function ThemeScript({ defaultTheme = "light", nonce }: ThemeScriptProps) {
  return (
    <script
      nonce={nonce}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript(defaultTheme) }}
    />
  );
}
