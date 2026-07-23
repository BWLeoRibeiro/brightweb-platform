import assert from "node:assert/strict";
import vm from "node:vm";
import test from "node:test";
import {
  BW_THEME_MEDIA_QUERY,
  BW_THEME_STORAGE_KEY,
  getThemeBootstrapScript,
  persistTheme,
  readStoredTheme,
  resolveTheme,
  subscribeToSystemTheme,
} from "../packages/app-shell/src/theme/theme-controller.ts";

test("theme modes resolve light, dark, and system consistently", () => {
  assert.equal(resolveTheme("light", "dark"), "light");
  assert.equal(resolveTheme("dark", "light"), "dark");
  assert.equal(resolveTheme("system", "light"), "light");
  assert.equal(resolveTheme("system", "dark"), "dark");
  assert.equal(resolveTheme("system", "dark", false), "light");
});

test("theme persistence uses the BrightWeb namespaced key and rejects invalid values", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };

  assert.equal(readStoredTheme(storage, "system"), "system");
  persistTheme(storage, "dark");
  assert.equal(values.get(BW_THEME_STORAGE_KEY), "dark");
  assert.equal(readStoredTheme(storage), "dark");
  values.set(BW_THEME_STORAGE_KEY, "sepia");
  assert.equal(readStoredTheme(storage, "light"), "light");
});

test("system theme subscription publishes the initial value, tracks changes, and cleans up", () => {
  let listener: (() => void) | undefined;
  const mediaQuery = {
    matches: false,
    addEventListener: (event: string, nextListener: () => void) => {
      assert.equal(event, "change");
      listener = nextListener;
    },
    removeEventListener: (event: string, nextListener: () => void) => {
      assert.equal(event, "change");
      assert.equal(nextListener, listener);
      listener = undefined;
    },
  };
  const observed: string[] = [];

  const unsubscribe = subscribeToSystemTheme(mediaQuery, (theme) => observed.push(theme));
  mediaQuery.matches = true;
  listener?.();
  unsubscribe();

  assert.deepEqual(observed, ["light", "dark"]);
  assert.equal(listener, undefined);
});

test("bootstrap script stamps class, data-theme, and color-scheme before hydration", () => {
  const classes = new Set<string>(["marketing"]);
  const attributes = new Map<string, string>();
  const root = {
    classList: {
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      add: (name: string) => classes.add(name),
    },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    style: {} as Record<string, string>,
  };
  const script = getThemeBootstrapScript("light");

  assert.match(script, new RegExp(BW_THEME_STORAGE_KEY));
  assert.match(script, new RegExp(BW_THEME_MEDIA_QUERY.replace(/[()]/g, "\\$&")));
  vm.runInNewContext(script, {
    document: { documentElement: root },
    localStorage: { getItem: () => "system" },
    matchMedia: () => ({ matches: true }),
  });

  assert.deepEqual([...classes].sort(), ["dark", "marketing"]);
  assert.equal(attributes.get("data-theme"), "dark");
  assert.equal(root.style.colorScheme, "dark");
});

test("bootstrap script honors a dark default when storage is unavailable", () => {
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  const root = {
    classList: {
      remove: (...names: string[]) => names.forEach((name) => classes.delete(name)),
      add: (name: string) => classes.add(name),
    },
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    style: {} as Record<string, string>,
  };

  vm.runInNewContext(getThemeBootstrapScript("dark"), {
    document: { documentElement: root },
    localStorage: { getItem: () => { throw new Error("storage blocked"); } },
  });

  assert.deepEqual([...classes], ["dark"]);
  assert.equal(attributes.get("data-theme"), "dark");
  assert.equal(root.style.colorScheme, "dark");
});
