"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  applyResolvedTheme,
  BW_THEME_MEDIA_QUERY,
  BW_THEME_STORAGE_KEY,
  getSystemTheme,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  subscribeToSystemTheme,
  THEME_MODES,
  type ResolvedTheme,
  type ThemeMode,
} from "./theme-controller";

export type ThemeProviderProps = {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
};

export type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  themes: readonly ThemeMode[];
  isThemeProviderMounted: boolean;
};

const FALLBACK_CONTEXT: ThemeContextValue = {
  theme: "light",
  setTheme: () => undefined,
  resolvedTheme: "light",
  systemTheme: "light",
  themes: THEME_MODES,
  isThemeProviderMounted: false,
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function disableTransitionsTemporarily() {
  const style = document.createElement("style");
  style.appendChild(
    document.createTextNode(
      "*,*::before,*::after{transition:none!important;animation-duration:0s!important}",
    ),
  );
  document.head.appendChild(style);
  window.getComputedStyle(document.body);
  window.setTimeout(() => style.remove(), 1);
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  enableSystem = true,
  disableTransitionOnChange = false,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(defaultTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");
  const [isReady, setIsReady] = useState(false);
  const resolvedTheme = resolveTheme(theme, systemTheme, enableSystem);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia(BW_THEME_MEDIA_QUERY);
    setThemeState(readStoredTheme(window.localStorage, defaultTheme));
    setSystemTheme(getSystemTheme(mediaQuery));
    setIsReady(true);
  }, [defaultTheme]);

  useLayoutEffect(() => {
    if (!isReady) return;
    if (disableTransitionOnChange) disableTransitionsTemporarily();
    applyResolvedTheme(document.documentElement, resolvedTheme);
  }, [disableTransitionOnChange, isReady, resolvedTheme]);

  useEffect(() => {
    if (!enableSystem) return;
    return subscribeToSystemTheme(
      window.matchMedia(BW_THEME_MEDIA_QUERY),
      setSystemTheme,
    );
  }, [enableSystem]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== BW_THEME_STORAGE_KEY) return;
      setThemeState(readStoredTheme(window.localStorage, defaultTheme));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [defaultTheme]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeState(nextTheme);
    persistTheme(window.localStorage, nextTheme);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      resolvedTheme,
      systemTheme,
      themes: enableSystem ? THEME_MODES : ["light", "dark"],
      isThemeProviderMounted: true,
    }),
    [enableSystem, resolvedTheme, setTheme, systemTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK_CONTEXT;
}
