import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

async function enterDemoMode(page: Page) {
  await page.getByRole("button", { name: "Enter demo mode" }).click();
  await expect(page.getByText("Click any field to edit it inline"))
    .toBeVisible();
}

test("demo mode is guided, ephemeral, and preserves real tasks", async ({
  page,
}) => {
  await expect(page.getByRole("article")).toHaveCount(0);
  const demoToggle = page.getByRole("button", { name: "Enter demo mode" });
  await expect(demoToggle).toBeVisible();

  await demoToggle.click();
  await expect(page.getByRole("article")).toHaveCount(8);
  await expect(page.getByText("Click any field to edit it inline"))
    .toBeVisible();
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText("Permanent delete lives only in Archive"))
    .toBeVisible();

  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Enter demo mode" }))
    .toBeVisible();

  await page.keyboard.press("n");
  await page.getByLabel("Task title").fill("My real task");
  await page.getByLabel("Task title").press("Enter");
  await page.getByRole("button", { name: "Enter demo mode" }).click();
  await page.getByRole("button", { name: "Exit demo mode" }).click();
  await expect(page.getByText("My real task")).toBeVisible();
});

test("creates, edits, and persists a task", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "todo" })).toBeVisible();
  await page.keyboard.press("n");
  const title = page.getByLabel("Task title");
  await expect(title).toBeFocused();
  await title.fill("Ship the Bun build");
  await title.press("Enter");
  await expect(page.getByText("Ship the Bun build")).toBeVisible();
  await expect(page.getByRole("article").first()).toContainText(
    "Ship the Bun build",
  );
  await page.reload();
  await expect(page.getByText("Ship the Bun build")).toBeVisible();
});

test("keeps an untitled task after only its priority changes", async ({
  page,
}) => {
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const newRow = page.getByRole("article").first();
  const priority = newRow.getByRole("combobox", { name: "Priority" });
  await priority.click();
  await page.getByRole("option", { name: "0", exact: true }).click();
  await expect(priority).toContainText("0");

  await page.getByText("Stored on this device").click();
  await expect(newRow).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("article").first().getByRole("combobox", {
      name: "Priority",
    }),
  ).toContainText("0");
});

test("materializes and expands a new task through the light orb sequence", async ({
  page,
}) => {
  await enterDemoMode(page);
  const button = page.getByRole("button", { name: "New task", exact: true });
  const previousFirstRow = page.getByRole("article").first();
  const previousY = (await previousFirstRow.boundingBox())?.y;

  await button.click();

  const launcher = page.locator(".new-task-launcher");
  const materializingRow = page.locator(
    ".task-row-shell.is-materializing",
  );
  await expect(button).toBeDisabled();
  await expect(launcher).toHaveClass(/is-creating/);
  await expect(page.locator(".new-task-light-orb")).toHaveCount(1);
  await expect(page.locator(".new-task-button-loader")).toHaveCount(1);
  await expect(materializingRow).toHaveCSS("animation-name", "none");
  const hologram = page.locator(".new-task-hologram");
  await expect(hologram).toHaveCount(1);
  const hologramBox = await hologram.boundingBox();
  const formingCardBox = await materializingRow
    .locator(".task-card")
    .boundingBox();
  expect(hologramBox).not.toBeNull();
  expect(formingCardBox).not.toBeNull();
  expect(
    Math.abs(
      hologramBox!.y + hologramBox!.height -
        (formingCardBox!.y + formingCardBox!.height),
    ),
  ).toBeLessThan(1);

  await page.waitForTimeout(220);
  const buttonOpacity = await button.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).opacity),
  );
  const loaderOpacity = await page.locator(".new-task-button-loader")
    .evaluate((element) => Number.parseFloat(getComputedStyle(element).opacity));
  expect(buttonOpacity).toBeLessThan(0.1);
  expect(loaderOpacity).toBeLessThan(0.1);
  await page.waitForTimeout(200);
  const shiftedY = (await page.getByRole("article").nth(1).boundingBox())?.y;
  expect(previousY).toBeDefined();
  expect(shiftedY).toBeDefined();
  expect(shiftedY!).toBeGreaterThan(previousY! + 35);

  await expect(button).toBeEnabled({ timeout: 2_500 });
  await expect(launcher).not.toHaveClass(/is-creating/);
  await expect(page.locator(".new-task-light-orb")).toHaveCount(0);
  await expect(page.locator(".new-task-button-loader")).toHaveCount(0);
  await expect(page.locator(".new-task-hologram")).toHaveCount(0);
  await expect(
    page.getByRole("article").first().locator(".description-panel"),
  ).toBeVisible();
});

test("opens the description and archive view", async ({ page }) => {
  await enterDemoMode(page);
  const row = page.getByRole("article").first();
  await row.focus();
  await row.press("Enter");
  await expect(page.getByLabel("Task description")).toBeVisible();
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByText("Restore archived tasks whenever you need them"))
    .toBeVisible();
  await expect(
    page.getByRole("button", { name: /Restore Restore archived tasks/ }),
  ).toBeVisible();
});

test("reflows without horizontal overflow", async ({ page }) => {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
});

test("clamps estimates and supports press-and-hold stepping", async ({
  page,
}) => {
  await enterDemoMode(page);
  const rows = page.getByRole("article");
  await expect(rows).toHaveCount(8);
  const firstRow = rows.nth(0);
  await firstRow.locator(".estimate-trigger").click();

  const amount = page.getByLabel("Estimate amount");
  await amount.fill("72");
  await amount.press("Enter");
  await expect(firstRow.locator(".estimate-trigger")).toContainText("60 minutes");

  await amount.fill("1");
  await amount.press("Enter");
  await expect(firstRow.locator(".estimate-trigger")).toContainText("1 minute");
  const increase = page.getByLabel("Increase estimate");
  await increase.dispatchEvent("pointerdown");
  await page.waitForTimeout(470);
  await increase.dispatchEvent("pointerup");
  expect(Number(await amount.inputValue())).toBeGreaterThan(2);
});

test("reorders tasks with the keyboard shortcut", async ({ page }) => {
  await enterDemoMode(page);
  const rows = page.getByRole("article");
  await rows.nth(0).focus();
  await rows.nth(0).press("Shift+ArrowDown");
  await expect(rows.nth(1)).toContainText("Click any field to edit it inline");
});

test("powers off a killed task through the VHS collapse", async ({
  page,
}) => {
  await enterDemoMode(page);
  const rows = page.getByRole("article");
  const firstRow = rows.first();
  const cardBox = await firstRow.boundingBox();
  await firstRow.focus();
  await firstRow.press("Shift+Delete");
  await expect(firstRow.locator(".status-trigger")).toContainText("Kill");

  const killingRow = page.locator(".task-life-cycle.is-killing");
  const hologram = killingRow.locator(".task-transition-hologram");
  const flash = killingRow.locator(".task-vhs-flash");
  await expect(killingRow).toHaveCount(1);
  await expect(hologram).toHaveCount(1);
  await expect(flash).toHaveCount(1);
  await expect(rows).toHaveCount(8);

  expect(cardBox).not.toBeNull();
  await expect.poll(
    async () => {
      const box = await flash.boundingBox();
      return Boolean(
        box &&
          box.width > cardBox!.width * 0.98 &&
          box.height < cardBox!.height * 0.75,
      );
    },
    { intervals: [16], timeout: 2_000 },
  ).toBe(true);
  await expect(rows).toHaveCount(8);
  await expect(hologram).toHaveCSS("opacity", "0");

  await expect.poll(
    async () => {
      const box = await flash.boundingBox();
      return Boolean(box && box.width < cardBox!.width * 0.9);
    },
    { intervals: [16], timeout: 1_000 },
  ).toBe(true);

  await expect(rows).toHaveCount(7);
  await expect(page.locator(".task-complete-light-orb")).toHaveCount(0);
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByText("Click any field to edit it inline")).toBeVisible();
});

test("absorbs a completed task into Archive as a circular light orb", async ({
  page,
}) => {
  await enterDemoMode(page);
  const rows = page.getByRole("article");
  const firstRow = rows.first();
  await firstRow.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Done", exact: true }).click();
  await expect(firstRow.locator(".status-trigger")).toContainText("Done");

  const completingRow = page.locator(".task-life-cycle.is-completing");
  await expect(completingRow).toHaveCount(1);
  await expect(
    completingRow.locator(".task-transition-hologram"),
  ).toHaveCount(1);
  await expect(completingRow.locator(".task-vhs-flash")).toHaveCount(1);
  await expect(rows).toHaveCount(8);

  const orb = page.locator(".task-complete-light-orb");
  await expect(orb).toHaveCount(1, { timeout: 2_000 });
  await expect(
    completingRow.locator(".task-transition-hologram"),
  ).toHaveCount(0);
  await expect(orb).toHaveCSS("border-radius", "50%");
  await expect(orb).toHaveCSS("clip-path", "none");
  const orbStart = await orb.boundingBox();
  await page.waitForTimeout(360);
  const orbInFlight = await orb.boundingBox();
  expect(orbStart).not.toBeNull();
  expect(orbInFlight).not.toBeNull();
  expect(
    Math.hypot(
      orbInFlight!.x - orbStart!.x,
      orbInFlight!.y - orbStart!.y,
    ),
  ).toBeGreaterThan(8);

  await expect(orb).toHaveCount(0, { timeout: 1_600 });
  await expect(page.locator(".archive-twinkle")).toHaveCount(1);
  await expect(rows).toHaveCount(7);
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByText("Click any field to edit it inline")).toBeVisible();
});

test("uses Base UI selects, tooltip, and archive dialog", async ({ page }) => {
  await enterDemoMode(page);
  const firstRow = page.getByRole("article").first();
  const priority = firstRow.getByRole("combobox", { name: "Priority" });
  await priority.click();
  const priorityPopup = page.locator('[data-slot="select-content"]');
  const priorityTriggerBox = await priority.boundingBox();
  const priorityPopupBox = await priorityPopup.boundingBox();
  expect(priorityTriggerBox).not.toBeNull();
  expect(priorityPopupBox).not.toBeNull();
  expect(priorityPopupBox!.y).toBeGreaterThanOrEqual(
    priorityTriggerBox!.y + priorityTriggerBox!.height,
  );
  if ((page.viewportSize()?.width ?? 0) > 680) {
    expect(Math.abs(priorityPopupBox!.x - priorityTriggerBox!.x)).toBeLessThan(2);
  }
  await page.getByRole("option", { name: "2", exact: true }).click();
  await expect(priority).toContainText("2");
  await expect(priority).toHaveCSS("color", "rgb(255, 255, 255)");

  const status = firstRow.getByRole("combobox", { name: "Status" });
  await expect(status.locator("svg")).toHaveCSS("display", "none");
  await status.click();
  const statusOption = page.getByRole("option", { name: "In progress" });
  await expect(statusOption).toHaveClass(/status-in-progress/);
  await expect(statusOption).toHaveCSS("border-radius", "999px");
  const statusOptionBox = await statusOption.boundingBox();
  const statusIndicatorBox = await statusOption
    .locator('[data-slot="select-item-indicator"]')
    .boundingBox();
  expect(statusOptionBox).not.toBeNull();
  expect(statusIndicatorBox).not.toBeNull();
  expect(statusIndicatorBox!.x + statusIndicatorBox!.width).toBeLessThanOrEqual(
    statusOptionBox!.x,
  );
  await page.keyboard.press("Escape");

  const shortcutHelp = page.getByRole("button", {
    name: "Keyboard shortcuts",
    exact: true,
  });
  if (await shortcutHelp.isVisible()) {
    await shortcutHelp.hover();
    await expect(page.getByText("Shift + ↑ / ↓ · reorder")).toBeVisible();
  }

  await page.getByRole("tab", { name: /Archive/ }).click();
  const deleteButton = page.getByRole("button", {
    name: "Delete Restore archived tasks whenever you need them permanently",
  });
  await deleteButton.click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();

  await deleteButton.click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByRole("alertdialog")).toBeHidden();
  await expect(
    page.getByRole("button", {
      name: "Restore archived tasks whenever you need them",
      exact: true,
    }),
  ).toBeHidden();
});

test("cancels abandoned drafts and keeps confirmed blank tasks", async ({
  page,
}) => {
  await expect(page.getByText("seiri", { exact: false })).toHaveCount(0);
  await enterDemoMode(page);
  const activeTabBox = await page.getByRole("tab", { name: /Active/ })
    .boundingBox();
  const newTaskBox = await page.getByRole("button", {
    name: "New task",
    exact: true,
  })
    .boundingBox();
  expect(activeTabBox).not.toBeNull();
  expect(newTaskBox).not.toBeNull();
  expect(Math.abs(activeTabBox!.y - newTaskBox!.y)).toBeLessThan(4);
  expect(newTaskBox!.height).toBeLessThan(activeTabBox!.height);

  const statusFits = await page.getByRole("article").nth(1)
    .locator(".status-trigger")
    .evaluate((element) => ({
      fits: element.scrollWidth <= element.clientWidth,
      text: element.textContent,
    }));
  expect(statusFits.fits).toBe(true);
  expect(statusFits.text).toContain("Not started");
  const firstRow = page.getByRole("article").first();
  await expect(firstRow.locator(".priority-trigger")).toHaveCSS(
    "font-size",
    "12px",
  );
  await expect(firstRow.locator(".priority-trigger")).toHaveCSS(
    "font-weight",
    "480",
  );
  await expect(firstRow.locator(".title-button")).toHaveCSS(
    "font-size",
    "14px",
  );
  await expect(firstRow.locator(".title-button")).toHaveCSS(
    "font-weight",
    "480",
  );
  await expect(firstRow.locator(".status-trigger")).toHaveCSS(
    "font-size",
    "12px",
  );
  await expect(page.getByRole("button", {
    name: "New task",
    exact: true,
  })).toHaveCSS(
    "font-weight",
    "480",
  );
  if ((page.viewportSize()?.width ?? 0) > 680) {
    const alignedColumns = [
      ["status", ".status-trigger"],
      ["estimate", ".estimate-trigger"],
      ["due", ".due-trigger"],
    ] as const;
    for (const [name, selector] of alignedColumns) {
      const headerBox = await page
        .getByRole("button", { name: `Sort by ${name} ascending` })
        .boundingBox();
      const fieldBox = await firstRow.locator(selector).boundingBox();
      expect(headerBox).not.toBeNull();
      expect(fieldBox).not.toBeNull();
      expect(Math.abs(headerBox!.x - fieldBox!.x)).toBeLessThan(10);
    }
  }

  const demoRows = page.getByRole("article");
  const shortEstimateWidth = await demoRows.nth(6).locator(".estimate-trigger")
    .evaluate((element) => element.getBoundingClientRect().width);
  const longEstimateWidth = await demoRows.nth(0).locator(".estimate-trigger")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(longEstimateWidth).toBeGreaterThan(shortEstimateWidth);

  await page.getByRole("button", { name: "Exit demo mode" }).click();
  await expect(page.getByRole("article")).toHaveCount(0);

  await page.keyboard.press("n");
  const titleInput = page.getByLabel("Task title");
  await expect(titleInput).toBeVisible();
  await page.getByRole("heading", { name: "todo" }).click();

  await expect(page.locator(".task-life-cycle.is-canceling")).toHaveCount(1);
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByLabel("Task title")).toHaveCount(0);
  await expect(page.getByRole("button", {
    name: "New task",
    exact: true,
  })).toHaveCSS(
    "opacity",
    "1",
  );

  await page.keyboard.press("n");
  await page.getByLabel("Task title").press("Enter");

  const blankTitle = page.locator(".title-button.is-empty", {
    hasText: "—",
  });
  await expect(blankTitle).toBeVisible();
  await page.reload();
  await expect(blankTitle).toBeVisible();

  await page.keyboard.press("n");
  await page.getByLabel("Task title").fill("A much longer task title");
  await page.getByLabel("Task title").press("Enter");

  const blankTitleWidth = await blankTitle.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const filledTitleWidth = await page.getByRole("article")
    .filter({ hasText: "A much longer task title" })
    .locator(".title-button")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(filledTitleWidth).toBeGreaterThan(blankTitleWidth);
});

test("drags from the row surface while property controls stay isolated", async ({
  page,
}) => {
  await enterDemoMode(page);
  const rows = page.getByRole("article");
  const firstRow = rows.nth(0);
  const secondRow = rows.nth(1);
  await expect(firstRow).toHaveCSS("cursor", "grab");
  const dragHandle = firstRow.getByRole("button", { name: /Reorder/ });
  await dragHandle.hover();
  await expect(dragHandle).toHaveCSS("cursor", "grabbing");

  const titleBox = await firstRow.locator(".title-button").boundingBox();
  expect(titleBox).not.toBeNull();
  await page.mouse.move(titleBox!.x + 4, titleBox!.y + 4);
  await page.mouse.down();
  await page.mouse.move(titleBox!.x + 30, titleBox!.y + 20);
  await expect(page.locator(".task-drag-preview")).toHaveCount(0);
  await page.mouse.up();

  const firstBox = await firstRow.boundingBox();
  const secondBox = await secondRow.boundingBox();
  expect(firstBox).not.toBeNull();
  expect(secondBox).not.toBeNull();
  await page.mouse.move(firstBox!.x + 2, firstBox!.y + firstBox!.height - 3);
  await page.mouse.down();
  await page.mouse.move(
    secondBox!.x + secondBox!.width / 2,
    secondBox!.y + secondBox!.height / 2,
    { steps: 8 },
  );

  await expect(page.locator(".task-drag-preview")).toBeVisible();
  const previewBox = await page.locator(".task-drag-preview").boundingBox();
  expect(previewBox).not.toBeNull();
  expect(previewBox!.width).toBeGreaterThan(firstBox!.width);
  await expect(firstRow).toHaveCSS("opacity", "0");
  expect(
    await secondRow.evaluate((element) => getComputedStyle(element).transform),
  ).not.toBe("none");
  expect(
    await page.evaluate(() =>
      document.body.classList.contains("is-dragging-task"),
    ),
  ).toBe(true);

  await page.mouse.up();
  await expect(rows.nth(1)).toContainText("Click any field to edit it inline");
});

test("expands cleanly and uses compact fixed-size description controls", async ({
  page,
}) => {
  await page.keyboard.press("n");
  await page.getByLabel("Task title").fill("Expandable task");
  await page.getByLabel("Task title").press("Enter");
  const row = page.getByRole("article").first();
  const main = row.locator(".task-main");
  const before = await main.boundingBox();
  expect(before).not.toBeNull();

  await row.click({ position: { x: 2, y: 2 } });
  const description = page.getByLabel("Task description");
  await expect(description).toBeVisible();
  const after = await main.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.y).toBe(before!.y);
  expect(after!.height).toBe(before!.height);
  await expect(description).toHaveCSS("resize", "none");
  const defaultHeight = await description.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  const longDescription = Array.from(
    { length: 12 },
    (_, index) => `Description line ${index + 1}`,
  ).join("\n");
  await description.fill(longDescription);
  const expandedSize = await description.evaluate((element) => ({
    height: element.getBoundingClientRect().height,
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
  }));
  expect(expandedSize.height).toBeGreaterThan(defaultHeight);
  expect(expandedSize.scrollHeight).toBeLessThanOrEqual(
    expandedSize.clientHeight,
  );

  await expect(page.getByRole("button", { name: "Cancel" })).toHaveCSS(
    "font-size",
    "12px",
  );
  await expect(page.getByRole("button", { name: "Save" })).toHaveCSS(
    "font-size",
    "12px",
  );
  await page.getByRole("heading", { name: "todo" }).click();
  await expect(description).toBeHidden();
  await page.reload();
  await page.getByRole("article").first().click({ position: { x: 2, y: 2 } });
  await expect(page.getByLabel("Task description")).toHaveValue(
    longDescription,
  );
});

test("limits overdue emphasis to the due text", async ({ page }) => {
  await enterDemoMode(page);
  const overdueDue = page.getByRole("article")
    .filter({ hasText: "Hover this due date" })
    .locator(".due-trigger");
  const highlight =
    (page.viewportSize()?.width ?? 0) <= 680
      ? overdueDue.locator(".due-exact")
      : overdueDue.locator(".due-relative");
  const triggerBox = await overdueDue.boundingBox();
  const highlightBox = await highlight.boundingBox();

  expect(triggerBox).not.toBeNull();
  expect(highlightBox).not.toBeNull();
  expect(highlightBox!.width).toBeLessThan(triggerBox!.width);
  await expect(overdueDue).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await expect(highlight).toHaveCSS("color", "rgb(255, 128, 117)");
});

test("uses text clear actions in estimate and due popovers", async ({
  page,
}) => {
  await enterDemoMode(page);
  const firstRow = page.getByRole("article").first();
  await firstRow.locator(".estimate-trigger").click();
  const estimatePopover = page.locator(".estimate-popover");
  const estimateTriggerBox = await firstRow.locator(".estimate-trigger")
    .boundingBox();
  const initialEstimateSize = await estimatePopover.boundingBox();
  expect(estimateTriggerBox).not.toBeNull();
  expect(initialEstimateSize).not.toBeNull();
  expect(initialEstimateSize!.width).toBeLessThan(200);
  expect(initialEstimateSize!.y).toBeGreaterThanOrEqual(
    estimateTriggerBox!.y + estimateTriggerBox!.height,
  );
  if ((page.viewportSize()?.width ?? 0) > 680) {
    expect(
      Math.abs(initialEstimateSize!.x - estimateTriggerBox!.x),
    ).toBeLessThan(2);
  }
  await expect(
    estimatePopover.getByText("Estimate", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByLabel("Estimate amount")).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await page.getByLabel("Estimate amount").fill("60");
  const changedEstimateSize = await estimatePopover.boundingBox();
  expect(changedEstimateSize?.width).toBe(initialEstimateSize!.width);
  expect(changedEstimateSize?.height).toBe(initialEstimateSize!.height);
  const arrowBox = await estimatePopover.locator(".stepper-buttons")
    .boundingBox();
  const amountBox = await page.getByLabel("Estimate amount").boundingBox();
  const unitBox = await estimatePopover.locator(".estimate-unit-trigger")
    .boundingBox();
  expect(arrowBox).not.toBeNull();
  expect(amountBox).not.toBeNull();
  expect(unitBox).not.toBeNull();
  expect(amountBox!.width).toBeLessThanOrEqual(40);
  expect(unitBox!.width).toBeLessThanOrEqual(56);
  await expect(
    estimatePopover.locator(".estimate-unit-trigger svg"),
  ).toHaveCSS("display", "none");
  expect(amountBox!.x - (arrowBox!.x + arrowBox!.width)).toBeLessThanOrEqual(2);
  expect(unitBox!.x - (amountBox!.x + amountBox!.width)).toBeLessThanOrEqual(2);
  const clearEstimate = page.getByRole("button", { name: "Clear estimate" });
  await expect(clearEstimate).toHaveText("Clear");
  const estimateRangeBox = await estimatePopover.locator(".estimate-range")
    .boundingBox();
  const clearEstimateBox = await clearEstimate.boundingBox();
  expect(estimateRangeBox).not.toBeNull();
  expect(clearEstimateBox).not.toBeNull();
  expect(
    Math.abs(
      clearEstimateBox!.x +
        clearEstimateBox!.width -
        (unitBox!.x + unitBox!.width),
    ),
  ).toBeLessThan(3);
  expect(
    Math.abs(
      estimateRangeBox!.y +
        estimateRangeBox!.height / 2 -
        (clearEstimateBox!.y + clearEstimateBox!.height / 2),
    ),
  ).toBeLessThan(3);
  await clearEstimate.click();
  await expect(firstRow.locator(".estimate-trigger")).toHaveText("—");

  const dueTrigger = firstRow.locator(".due-trigger");
  const relativeDueBox = await dueTrigger.boundingBox();
  await dueTrigger.hover();
  const exactDueBox = await dueTrigger.boundingBox();
  expect(relativeDueBox).not.toBeNull();
  expect(exactDueBox).not.toBeNull();
  if ((page.viewportSize()?.width ?? 0) > 680) {
    expect(exactDueBox!.width).toBeGreaterThan(relativeDueBox!.width);
  }
  const dueFits = await dueTrigger.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(dueFits.scrollWidth).toBeLessThanOrEqual(dueFits.clientWidth);
  await dueTrigger.click();
  const calendarPopover = page.locator(".calendar-popover");
  const dueTriggerBox = await firstRow.locator(".due-trigger").boundingBox();
  const calendarBox = await calendarPopover.boundingBox();
  expect(dueTriggerBox).not.toBeNull();
  expect(calendarBox).not.toBeNull();
  expect(calendarBox!.y).toBeGreaterThanOrEqual(
    dueTriggerBox!.y + dueTriggerBox!.height,
  );
  if ((page.viewportSize()?.width ?? 0) > 680) {
    expect(Math.abs(calendarBox!.x - dueTriggerBox!.x)).toBeLessThan(2);
  }
  await expect(
    calendarPopover.getByText("Due date", { exact: true }),
  ).toHaveCount(0);
  const selectedDay = calendarPopover.locator(
    ".rdp-selected .rdp-day_button",
  );
  await expect(selectedDay).toHaveCSS(
    "color",
    "rgba(255, 255, 255, 0.92)",
  );
  const selectedDayBox = await selectedDay.boundingBox();
  const regularDayBox = await calendarPopover
    .locator(".rdp-day:not(.rdp-selected) .rdp-day_button")
    .first()
    .boundingBox();
  expect(selectedDayBox).not.toBeNull();
  expect(regularDayBox).not.toBeNull();
  expect(Math.abs(selectedDayBox!.width - regularDayBox!.width)).toBeLessThan(1);
  expect(Math.abs(selectedDayBox!.height - regularDayBox!.height)).toBeLessThan(
    1,
  );
  const clearDue = page.getByRole("button", { name: "Clear due date" });
  await expect(clearDue).toHaveText("Clear");
  const calendarNoteBox = await calendarPopover.locator(".calendar-note")
    .boundingBox();
  const clearDueBox = await clearDue.boundingBox();
  expect(calendarNoteBox).not.toBeNull();
  expect(clearDueBox).not.toBeNull();
  expect(
    Math.abs(
      calendarNoteBox!.y +
        calendarNoteBox!.height / 2 -
        (clearDueBox!.y + clearDueBox!.height / 2),
    ),
  ).toBeLessThan(3);
  await clearDue.click();
  await expect(firstRow.locator(".due-trigger")).toHaveText("—");
});
