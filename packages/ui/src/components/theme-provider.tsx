"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: string) => void;
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
  themes: Theme[];
};

const STORAGE_KEY = "theme";
const THEME_VALUES: Theme[] = ["light", "dark", "system"];
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(defaultTheme: Theme): Theme {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

function applyResolvedTheme(resolvedTheme: "light" | "dark", disableTransitionOnChange: boolean) {
  const root = document.documentElement;
  let cleanup: (() => void) | null = null;

  if (disableTransitionOnChange) {
    const style = document.createElement("style");
    style.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important;animation-duration:0s!important}"));
    document.head.appendChild(style);
    cleanup = () => {
      window.getComputedStyle(document.body);
      window.setTimeout(() => style.remove(), 1);
    };
  }

  root.classList.remove("light", "dark");
  root.classList.add(resolvedTheme);
  root.dataset.theme = resolvedTheme;
  root.style.colorScheme = resolvedTheme;
  cleanup?.();
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const resolvedTheme = theme === "system" && enableSystem ? systemTheme : theme === "dark" ? "dark" : "light";

  useLayoutEffect(() => {
    applyResolvedTheme(resolvedTheme, disableTransitionOnChange);
  }, [disableTransitionOnChange, resolvedTheme]);

  useEffect(() => {
    setThemeState(readStoredTheme(defaultTheme));
    setSystemTheme(getSystemTheme());
  }, [defaultTheme]);

  useEffect(() => {
    if (!enableSystem) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => setSystemTheme(media.matches ? "dark" : "light");
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [enableSystem]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setThemeState(readStoredTheme(defaultTheme));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme]);

  const setTheme = useCallback((nextTheme: string) => {
    const normalizedTheme: Theme = nextTheme === "dark" || nextTheme === "light" || nextTheme === "system" ? nextTheme : defaultTheme;
    setThemeState(normalizedTheme);
    try {
      window.localStorage.setItem(STORAGE_KEY, normalizedTheme);
    } catch {
      // In-memory theme state remains usable when storage is unavailable.
    }
  }, [defaultTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    resolvedTheme,
    systemTheme,
    themes: enableSystem ? THEME_VALUES : ["light", "dark"],
  }), [enableSystem, resolvedTheme, setTheme, systemTheme, theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? {
    theme: "light",
    setTheme: () => undefined,
    resolvedTheme: "light",
    systemTheme: "light",
    themes: THEME_VALUES,
  };
}

export type { Theme, ThemeContextValue, ThemeProviderProps };
