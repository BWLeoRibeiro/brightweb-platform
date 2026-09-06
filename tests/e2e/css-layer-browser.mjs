import assert from "node:assert/strict";

// Self-contained, read-only DOM measurement; also callable with CUA tab.evaluate.
export function cssLayerSnapshot() {
  const measure = (element) => {
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return { size: parseFloat(style.fontSize), weight: parseFloat(style.fontWeight),
      marginTop: parseFloat(style.marginTop), padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(parseFloat),
      display: style.display, columns: style.gridTemplateColumns, x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  };
  const scroller = document.querySelector(".social-calendar-scroll");
  return {
    authCard: measure(document.querySelector(".auth-vessel__content")),
    authPage: measure(document.querySelector(".auth-layout__form-side")),
    authHeading: measure(document.querySelector(".auth-vessel h1")),
    hero: measure(document.querySelector(".social-workspace header h2")),
    calendar: measure(document.querySelector(".social-calendar")),
    weekdays: [...document.querySelectorAll(".social-weekday")].map(measure),
    days: [...document.querySelectorAll(".social-day")].map(measure),
    events: [...document.querySelectorAll(".social-event")].map(measure),
    eventTitles: [...document.querySelectorAll(".social-event strong")].map(measure),
    scroll: scroller ? { clientWidth: scroller.clientWidth, scrollWidth: scroller.scrollWidth, left: scroller.scrollLeft } : null,
    viewport: innerWidth, pageWidth: document.documentElement.scrollWidth,
  };
}

export function assertCssLayerSnapshot(snapshot, kind) {
  if (kind === "auth") {
    assert.ok(snapshot.authCard?.padding.every(value => value >= 24), "auth card retains its internal padding");
    assert.ok(snapshot.authPage?.padding.every(value => value >= 16), "auth page retains its outer padding");
    assert.ok(snapshot.authHeading?.size >= 24 && snapshot.authHeading.weight >= 600, "auth heading retains display size and weight");
  } else if (kind === "editorial") {
    assert.ok(snapshot.hero?.size >= 32 && snapshot.hero.weight >= 600, "editorial heading retains display size and weight");
    assert.ok(snapshot.hero.marginTop >= 12, "editorial heading retains spacing above title");
  } else {
    assert.equal(snapshot.calendar?.display, "grid", "calendar is rendered as a grid");
    assert.equal(snapshot.weekdays.length, 7, "calendar renders seven weekday columns");
    assert.ok(snapshot.weekdays.every(day => day.padding.every(value => value > 0)), "weekday labels retain padding");
    assert.ok(snapshot.days.length >= 28 && snapshot.days.every(day => day.padding.every(value => value > 0)), "calendar days retain padding");
    assert.ok(snapshot.events.length > 0 && snapshot.events.every(event => event.padding.every(value => value > 0) && event.marginTop > 0), "calendar publications retain padding and top spacing");
    assert.ok(snapshot.eventTitles.length === snapshot.events.length && snapshot.eventTitles.every(title => title.weight >= 600), "calendar publication titles retain semibold weight");
    const days = snapshot.weekdays;
    assert.ok(days.every(day => Math.abs(day.y - days[0].y) <= 1), "weekdays share one row");
    assert.ok(days.every(day => Math.abs(day.width - days[0].width) <= 1), "weekday columns have equal widths");
    assert.ok(days.slice(1).every((day, index) => Math.abs(day.x - days[index].x - days[index].width) <= 1), "seven columns occupy adjacent positions");
    assert.ok(Math.abs(days.reduce((sum, day) => sum + day.width, 0) - snapshot.calendar.width) <= 2, "columns fill calendar width");
  }
  assert.ok(snapshot.pageWidth <= snapshot.viewport + 1, "page does not overflow viewport horizontally");
}

export async function runCssLayerBrowser({ appUrl, cookies }) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const verify = async (kind) => {
      await page.locator(kind === "auth" ? ".auth-vessel h1" : kind === "editorial" ? ".social-workspace header h2" : ".social-calendar").waitFor();
      await page.evaluate(() => document.fonts.ready);
      assertCssLayerSnapshot(await page.evaluate(cssLayerSnapshot), kind);
    };
    for (const route of ["/login", "/forgot-password"]) {
      await page.goto(`${appUrl}${route}`);
      await verify("auth");
      await page.reload();
      await verify("auth");
    }
    await page.goto(`${appUrl}/login`);
    await page.locator('a[href="/forgot-password"]').click();
    await page.waitForURL(`${appUrl}/forgot-password`);
    await verify("auth");
    await page.locator('a[href="/login"]').click();
    await page.waitForURL(`${appUrl}/login`);
    await verify("auth");
    await context.addCookies(cookies.map(cookie => ({ ...cookie, url: appUrl })));
    for (const [query, kind] of [["", "calendar"], ["#plano", "editorial"]]) {
      await page.goto(`${appUrl}/marketing/social-media${query}`);
      await verify(kind);
      await page.reload();
      await verify(kind);
    }
    await page.goto(`${appUrl}/dashboard`);
    const marketingToggle = page.getByRole("button", { name: "Marketing", exact: true });
    if (await marketingToggle.getAttribute("aria-expanded") === "false") await marketingToggle.click();
    await page.locator('a[href="/marketing/social-media"]').first().click();
    // Next can preserve the selected editorial section when revisiting the route.
    await page.getByRole("group", { name: "Secções de Social Media" }).getByRole("button", { name: "Calendário", exact: true }).click();
    await verify("calendar");
    await page.getByRole("group", { name: "Secções de Social Media" }).getByRole("button", { name: "Editorial", exact: true }).click();
    await verify("editorial");
    await page.getByRole("group", { name: "Secções de Social Media" }).getByRole("button", { name: "Calendário", exact: true }).click();
    await verify("calendar");
    await page.setViewportSize({ width: 390, height: 844 });
    await verify("calendar");
    const before = await page.evaluate(cssLayerSnapshot);
    assert.ok(before.scroll.scrollWidth > before.scroll.clientWidth, "mobile calendar has internal horizontal overflow");
    await page.locator(".social-calendar-scroll").evaluate(element => { element.scrollLeft = element.scrollWidth; });
    assert.ok((await page.evaluate(cssLayerSnapshot)).scroll.left > 0, "mobile calendar scrolls to later weekdays");
    await context.clearCookies();
    await page.goto(`${appUrl}/login`);
    await verify("auth");
    console.log("[smoke] CSS rendered regression passed: auth/editorial/calendar direct loads, refresh, navigation and mobile");
  } finally {
    await browser.close();
  }
}
