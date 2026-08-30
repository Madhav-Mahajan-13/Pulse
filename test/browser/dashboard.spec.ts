import { expect, test } from "@playwright/test";

test("renders live route metrics without external assets or browser errors", async ({
  page,
  request,
}) => {
  const browserErrors: string[] = [];
  const externalRequests: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("request", (browserRequest) => {
    const url = new URL(browserRequest.url());
    if (url.origin !== "http://127.0.0.1:3100") externalRequests.push(url.href);
  });

  await request.get("/fast");
  await request.get("/slow/123");
  await request.get("/error");
  await page.goto("/nodepulse");

  await expect(
    page.getByRole("heading", { name: "NodePulse APM" }),
  ).toBeVisible();
  for (const route of ["/fast", "/slow/:id", "/error"]) {
    const row = page.getByRole("row").filter({ hasText: route });
    await expect(row.getByText("GET", { exact: true })).toBeVisible();
    await expect(row.getByText(route, { exact: true })).toBeVisible();
  }
  await expect(
    page.getByRole("img", { name: "Recent request trend" }).first(),
  ).toBeVisible({ timeout: 10_000 });
  const rpmHeading = page
    .locator(".column-help")
    .filter({ hasText: "Avg RPM" });
  await rpmHeading.hover();
  await expect(
    page.getByRole("tooltip", {
      name: "Average matched requests per minute across the selected rolling window.",
    }),
  ).toBeVisible();
  await expect(page.locator("#status")).toHaveAttribute("data-state", "ok");

  expect(browserErrors).toEqual([]);
  expect(externalRequests).toEqual([]);
});

test("remains usable at a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/nodepulse");

  await expect(
    page.getByRole("heading", { name: "NodePulse APM" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.locator("main")).toHaveCSS("width", "358px");
});

test("shows an explicit route warm-up state instead of zero metrics", async ({
  page,
}) => {
  await page.route("**/nodepulse/metrics.json?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        schemaVersion: 2,
        generatedAtMs: Date.now(),
        aggregationState: "warming_up",
        windowSeconds: 60,
        effectiveWindowSeconds: 0,
        bucketSizeSeconds: 60,
        routes: [
          {
            routeKey: "GET /warming",
            aggregationState: "warming_up",
            requestCount: null,
          },
        ],
        unmatched: {
          routeKey: "unmatched",
          aggregationState: "warming_up",
          requestCount: null,
        },
      }),
    });
  });

  await page.goto("/nodepulse");

  const row = page.getByRole("row").filter({ hasText: "/warming" });
  await expect(row).toContainText("Warming up");
  await expect(row).not.toContainText("0 ms");
});
