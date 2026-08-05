import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import test from "node:test";

import { BreadcrumbLink } from "../packages/ui/src/components/breadcrumb.tsx";
import { PhoneInput } from "../packages/ui/src/components/phone-input.tsx";
import { cn as appShellCn } from "../packages/app-shell/src/lib/utils.ts";
import { cn as uiCn } from "../packages/ui/src/lib/utils.ts";
import { getInitials, getPaginationWindow, getRoleLabel, resolveRoleToken } from "../packages/ui/src/lib/patterns.ts";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const patternExports = {
  action: ["ActionButton", "actionClassName"],
  "empty-state": ["EmptyState"],
  "initials-avatar": ["InitialsAvatar"],
  "kpi-breakdown-bar": ["KpiBreakdownBar"],
  "role-badge": ["RoleBadge", "DEFAULT_ROLE_TOKEN_MAP"],
  "section-heading": ["SectionHeading"],
  "stat-tile": ["StatTile", "StatValue"],
  "status-pill": ["StatusPill", "STATUS_PILL_BASE_CLASS", "STATUS_PILL_SIZE_CLASSES"],
  "surface-card": ["SurfaceCard"],
  "table-pagination": ["TablePagination"],
} as const;

test("every Tier-2 pattern has a package subpath and root export", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "packages/ui/package.json"), "utf8"));
  const rootSource = await readFile(path.join(repoRoot, "packages/ui/src/index.ts"), "utf8");

  for (const subpath of Object.keys(patternExports)) {
    assert.equal(packageJson.exports[`./${subpath}`], `./src/components/${subpath}.tsx`);
    assert.match(rootSource, new RegExp(`components/${subpath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  }
});

test("Checkbox exposes the native selection-control contract", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "packages/ui/package.json"), "utf8"));
  const rootSource = await readFile(path.join(repoRoot, "packages/ui/src/index.ts"), "utf8");
  const checkboxSource = await readFile(path.join(repoRoot, "packages/ui/src/components/checkbox.tsx"), "utf8");

  assert.equal(packageJson.exports["./checkbox"], "./src/components/checkbox.tsx");
  assert.match(rootSource, /components\/checkbox/);
  assert.match(checkboxSource, /<input type="checkbox" \{\.\.\.props\} \/>/);
});

test("PhoneInput forwards the native telephone accessible-name contract", () => {
  const html = renderToStaticMarkup(
    h("label", { htmlFor: "customer-phone" },
      "Phone",
      h(PhoneInput, {
        id: "customer-phone",
        name: "phone",
        autoComplete: "tel",
        "aria-describedby": "phone-help",
        value: "",
        onChange: () => {},
      }),
    ),
  );

  assert.match(html, /<label for="customer-phone">Phone/);
  assert.match(html, /<input id="customer-phone" autoComplete="tel" aria-describedby="phone-help [^"]+"[^>]*type="tel"/);
  assert.match(html, /<input type="hidden" name="phone" value=""/);
});

test("PhoneInput keeps the country calling code outside the editable field", () => {
  const html = renderToStaticMarkup(
    h(PhoneInput, {
      defaultCountry: "es",
      value: "+34912345678",
      onChange: () => {},
    }),
  );

  assert.match(html, /<span[^>]*class="[^"]*select-none[^"]*"[^>]*>\+34<\/span>/);
  assert.match(html, /aria-label="Choose country code, current Spain \+34"/);
  assert.match(html, /<input[^>]*value="912 345 678"/);
  assert.doesNotMatch(html, /<input[^>]*value="\+34/);
});

test("PhoneInput emits and submits E.164 while only the subscriber number is editable", async () => {
  const changes: string[] = [];
  let renderer: ReturnType<typeof create>;

  await act(async () => {
    renderer = create(h(PhoneInput, {
      defaultCountry: "es",
      name: "phone",
      value: "+34912345678",
      onChange: (phone) => changes.push(phone),
    }), {
      createNodeMock: (element) => element.type === "input" ? {
        addEventListener: () => {},
        removeEventListener: () => {},
        setSelectionRange: () => {},
      } : null,
    });
  });

  const editableInput = renderer!.root.find((node) => node.type === "input" && node.props.type === "tel");
  const hiddenInput = renderer!.root.find((node) => node.type === "input" && node.props.type === "hidden");
  assert.equal(editableInput.props.name, undefined);
  assert.equal(hiddenInput.props.name, "phone");
  assert.equal(hiddenInput.props.value, "+34912345678");

  await act(async () => {
    editableInput.props.onChange({
      preventDefault: () => {},
      nativeEvent: { data: "9", inputType: "insertText" },
      target: { selectionStart: 11, value: "912 345 679" },
    });
  });
  assert.equal(changes.at(-1), "+34912345679");

  await act(async () => {
    editableInput.props.onChange({
      preventDefault: () => {},
      nativeEvent: { data: null, inputType: "deleteContentBackward" },
      target: { selectionStart: 0, value: "" },
    });
  });
  assert.equal(changes.at(-1), "");

  await act(async () => renderer!.unmount());
});

test("PhoneInput country picker exposes a listbox and complete keyboard contract", async () => {
  const source = await readFile(path.join(repoRoot, "packages/ui/src/components/phone-input.tsx"), "utf8");

  assert.match(source, /aria-haspopup="listbox"/);
  assert.match(source, /role="combobox"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /role="option"/);
  assert.match(source, /aria-selected=/);
  for (const key of ["Escape", "ArrowDown", "ArrowUp", "Enter"]) {
    assert.match(source, new RegExp(`event\\.key === "${key}"`));
  }
  assert.match(source, /aria-activedescendant=/);
  assert.match(source, /triggerRef\.current\?\.focus\(\)/);
});

for (const [subpath, symbols] of Object.entries(patternExports)) {
  test(`${subpath} exposes its documented Tier-2 API`, async () => {
    const source = await readFile(path.join(repoRoot, `packages/ui/src/components/${subpath}.tsx`), "utf8");
    for (const symbol of symbols) {
      assert.match(source, new RegExp(`export (?:const|function) ${symbol}\\b`));
    }
  });
}

test("Tier-2 pure helpers clamp pagination and derive neutral labels", () => {
  assert.deepEqual(getPaginationWindow(1, 8), [1, 2, "end-ellipsis", 8]);
  assert.deepEqual(getPaginationWindow(5, 8), [1, "start-ellipsis", 4, 5, 6, "end-ellipsis", 8]);
  assert.equal(getInitials("Ada Lovelace"), "AL");
  assert.equal(getInitials(null, "person@example.test"), "P");
  assert.equal(getRoleLabel("project_owner"), "Project Owner");
  assert.equal(resolveRoleToken("admin", { admin: "--role-admin" }), "--role-admin");
  assert.equal(resolveRoleToken("custom", {}), "--semantic-neutral");
});

test("composite typography roles survive explicit size composition", () => {
  for (const cn of [appShellCn, uiCn]) {
    assert.equal(cn("text-body", "text-[length:var(--text-ui-action)]"), "text-body text-[length:var(--text-ui-action)]");
    assert.equal(cn("text-kpi", "text-[length:var(--text-heading-1)]"), "text-kpi text-[length:var(--text-heading-1)]");
    assert.equal(cn("text-data", "text-[length:var(--text-meta)]"), "text-data text-[length:var(--text-meta)]");
  }
});

test("canonical typography roles survive explicit text colors", () => {
  const roles = [
    "text-heading-1", "text-heading-2", "text-heading-3", "text-heading-4",
    "text-title", "text-body-lg", "text-body", "text-meta", "text-label",
    "text-micro", "text-kpi", "text-kpi-lg", "text-data-sm",
  ];
  for (const cn of [appShellCn, uiCn]) {
    for (const role of roles) {
      assert.equal(cn(role, "text-[color:var(--muted-foreground)]"), `${role} text-[color:var(--muted-foreground)]`);
      assert.equal(cn("text-[color:var(--muted-foreground)]", role), `text-[color:var(--muted-foreground)] ${role}`);
    }
    assert.equal(cn("text-meta", "text-label"), "text-label");
  }
});

test("ActionButton shares the canonical brand Button variant", async () => {
  const source = await readFile(path.join(repoRoot, "packages/ui/src/components/action.tsx"), "utf8");
  assert.match(source, /buttonVariants\(\{\s*variant:\s*"brand"/);
  assert.doesNotMatch(source, /bg-\[color:var\(--brand-accent\)\]/);
});

test("BreadcrumbLink uses the direct Slot dependency and preserves composition", async () => {
  const packageJson = JSON.parse(await readFile(path.join(repoRoot, "packages/ui/package.json"), "utf8"));
  const source = await readFile(path.join(repoRoot, "packages/ui/src/components/breadcrumb.tsx"), "utf8");
  const ref = () => {};
  const slottedElement = BreadcrumbLink({
    asChild: true,
    ref,
    children: h("a", { href: "/projects" }, "Projects"),
  });
  const html = renderToStaticMarkup(
    h(BreadcrumbLink, { asChild: true, className: "custom-link" }, h("a", { href: "/projects" }, "Projects")),
  );

  assert.match(source, /import \{ Slot \} from "@radix-ui\/react-slot"/);
  assert.doesNotMatch(source, /Slot\.Root/);
  assert.equal(packageJson.dependencies["radix-ui"], undefined);
  assert.equal(packageJson.dependencies["@radix-ui/react-slot"], "^1.3.1");
  assert.equal(slottedElement.props.ref, ref);
  assert.match(html, /^<a\b[^>]*>Projects<\/a>$/);
  assert.match(html, /href="\/projects"/);
  assert.match(html, /data-slot="breadcrumb-link"/);
  assert.match(html, /class="[^"]*custom-link[^"]*"/);
  assert.doesNotMatch(html, /<a\b[^>]*><a\b/);
});
