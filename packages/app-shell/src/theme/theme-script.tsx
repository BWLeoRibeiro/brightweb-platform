import Script from "next/script";
import type { ScriptHTMLAttributes } from "react";
import { getThemeBootstrapScript, type ThemeMode } from "./theme-controller";

export type ThemeScriptProps = Pick<ScriptHTMLAttributes<HTMLScriptElement>, "nonce"> & {
  defaultTheme?: ThemeMode;
};

export function ThemeScript({ defaultTheme = "system", nonce }: ThemeScriptProps) {
  return (
    <Script
      id="brightweb-theme"
      strategy="beforeInteractive"
      nonce={nonce}
    >
      {getThemeBootstrapScript(defaultTheme)}
    </Script>
  );
}
