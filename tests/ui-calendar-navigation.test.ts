import assert from "node:assert/strict"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import test from "node:test"

import { Calendar } from "../packages/ui/src/components/calendar.tsx"

const today = new Date(2026, 7, 5)
const defaultMonth = new Date(2026, 7, 1)

test("dropdown calendars allow navigation beyond the current year by default", () => {
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      captionLayout: "dropdown",
      defaultMonth,
      today,
    })
  )

  assert.match(html, /<option value="2027"/)
  assert.match(html, /<option value="2051"/)
  assert.doesNotMatch(html, /<option value="2052"/)
})

test("dropdown calendars preserve a consumer-provided end month", () => {
  const html = renderToStaticMarkup(
    createElement(Calendar, {
      captionLayout: "dropdown",
      defaultMonth,
      endMonth: new Date(2030, 11, 31),
      today,
    })
  )

  assert.match(html, /<option value="2030"/)
  assert.doesNotMatch(html, /<option value="2031"/)
  assert.doesNotMatch(html, /<option value="2051"/)
})
