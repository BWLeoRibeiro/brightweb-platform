import assert from "node:assert/strict";
import test from "node:test";
import { createElement, isValidElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClientPortalFrame } from "../src/components/client-portal-frame.tsx";

// Render the frame's own text without loading Next's image/link runtime or
// unrelated account-menu hooks into the Node test environment.
function visibleSpans(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(visibleSpans);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  if (node.type === "span") return [node];
  return visibleSpans(node.props.children);
}

for (const companyName of ["MQ Consulting", "BeGreen", "BrightWeb"]) {
  test(`client portal renders ${companyName} as its visible company title`, () => {
    const logo = { src: "/brand/logo.svg", width: 64, height: 64 };
    const frame = ClientPortalFrame({
      brand: {
        href: "/account",
        ariaLabel: `${companyName} portal`,
        alt: companyName,
        collapsedLogo: logo,
        lightLogo: logo,
        darkLogo: logo,
      },
      pathname: "/account",
      displayName: "Client",
      user: { email: "client@example.com" },
      userInitials: "CL",
      onSignOut: async () => {},
      children: "Portal content",
    });
    const html = visibleSpans(frame).map((span) => renderToStaticMarkup(createElement("div", null, span))).join("");
    assert.ok(html.includes(`>${companyName}</span>`), "company name must be visible text, not only the logo alt");
    if (companyName !== "BrightWeb") assert.ok(!html.includes(">BrightWeb</span>"));
  });
}
