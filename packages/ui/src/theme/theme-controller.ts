export const BW_THEME_STORAGE_KEY = "bw-theme";
export const BW_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";
export const THEME_MODES = ["light", "dark", "system"] as const;

export type ThemeMode = (typeof THEME_MODES)[number];
export type Theme = ThemeMode;
export type ResolvedTheme = Exclude<ThemeMode, "system">;

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;
type ThemeMediaQuery = Pick<MediaQueryList, "matches" | "addEventListener" | "removeEventListener">;

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && THEME_MODES.includes(value as ThemeMode);
}

export function resolveTheme(mode: ThemeMode, systemTheme: ResolvedTheme, enableSystem = true): ResolvedTheme {
  if (mode === "system") return enableSystem ? systemTheme : "light";
  return mode;
}

export function readStoredTheme(
  storage: Pick<ThemeStorage, "getItem"> | null | undefined,
  defaultTheme: ThemeMode = "system",
): ThemeMode {
  if (!storage) return defaultTheme;
  try {
    const storedTheme = storage.getItem(BW_THEME_STORAGE_KEY);
    return isThemeMode(storedTheme) ? storedTheme : defaultTheme;
  } catch {
    return defaultTheme;
  }
}

export function persistTheme(
  storage: Pick<ThemeStorage, "setItem"> | null | undefined,
  theme: ThemeMode,
) {
  if (!storage) return;
  try {
    storage.setItem(BW_THEME_STORAGE_KEY, theme);
  } catch {
    // Theme changes remain usable in memory when storage is unavailable.
  }
}

export function getSystemTheme(mediaQuery: Pick<ThemeMediaQuery, "matches">): ResolvedTheme {
  return mediaQuery.matches ? "dark" : "light";
}

export function subscribeToSystemTheme(
  mediaQuery: ThemeMediaQuery,
  onChange: (theme: ResolvedTheme) => void,
) {
  const handleChange = () => onChange(getSystemTheme(mediaQuery));
  handleChange();
  mediaQuery.addEventListener("change", handleChange);
  return () => mediaQuery.removeEventListener("change", handleChange);
}

export function applyResolvedTheme(root: HTMLElement, theme: ResolvedTheme) {
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function getThemeBootstrapScript(defaultTheme: ThemeMode = "system") {
  const safeDefaultTheme = isThemeMode(defaultTheme) ? defaultTheme : "system";
  return `!function(){var r=document.documentElement,m="${safeDefaultTheme}";try{var s=localStorage.getItem("${BW_THEME_STORAGE_KEY}");m=s==="light"||s==="dark"||s==="system"?s:m}catch(e){}var t=m==="system"?(matchMedia("${BW_THEME_MEDIA_QUERY}").matches?"dark":"light"):m;r.classList.remove("light","dark");r.classList.add(t);r.setAttribute("data-theme",t);r.style.colorScheme=t}();`;
}
