import assert from "node:assert/strict"
import test from "node:test"

import { cn } from "./utils.ts"

test("canonical typography utilities do not remove semantic foreground colors", () => {
  const typographyUtilities = [
    "text-heading-1",
    "text-heading-2",
    "text-heading-3",
    "text-heading-4",
    "text-title",
    "text-body-lg",
    "text-body",
    "text-meta",
    "text-label",
    "text-micro",
    "text-kpi",
    "text-kpi-lg",
    "text-data-sm",
  ]

  for (const typography of typographyUtilities) {
    const result = cn("text-destructive-foreground", typography).split(" ")

    assert.ok(result.includes(typography), `${typography} must remain a font-size utility`)
    assert.ok(
      result.includes("text-destructive-foreground"),
      `${typography} must not remove semantic foreground colors`,
    )
  }
})

test("canonical typography utilities preserve intentional consumer colors", () => {
  const result = cn("text-label text-muted-foreground", "text-body text-destructive").split(" ")

  assert.ok(result.includes("text-body"))
  assert.ok(result.includes("text-destructive"))
  assert.ok(!result.includes("text-label"))
  assert.ok(!result.includes("text-muted-foreground"))
})
