import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("creates, edits, and persists a task", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "todo" })).toBeVisible();
  await page.keyboard.press("n");
  const title = page.getByLabel("Task title");
  await expect(title).toBeFocused();
  await title.fill("Ship the Bun build");
  await title.press("Enter");
  await expect(page.getByText("Ship the Bun build")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Ship the Bun build")).toBeVisible();
});

test("opens the description and archive view", async ({ page }) => {
  const row = page.getByRole("article").first();
  await row.focus();
  await row.press("Enter");
  await expect(page.getByLabel("Task description")).toBeVisible();
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByText("Archive a completed task")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Restore Archive a completed task/ }),
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
  const rows = page.getByRole("article");
  await expect(rows).toHaveCount(3);
  const firstRow = rows.nth(0);
  await firstRow.locator(".estimate-trigger").click();

  const amount = page.getByLabel("Estimate amount");
  await amount.fill("72");
  await amount.press("Enter");
  await expect(firstRow.locator(".estimate-trigger")).toContainText("7 days");

  await amount.fill("1");
  await amount.press("Enter");
  const increase = page.getByLabel("Increase estimate");
  await increase.dispatchEvent("pointerdown");
  await page.waitForTimeout(470);
  await increase.dispatchEvent("pointerup");
  expect(Number(await amount.inputValue())).toBeGreaterThan(2);
});

test("reorders tasks with the keyboard shortcut", async ({ page }) => {
  const rows = page.getByRole("article");
  await rows.nth(0).focus();
  await rows.nth(0).press("Shift+ArrowDown");
  await expect(rows.nth(1)).toContainText("Shape the first version");
});

test("uses Base UI selects, tooltip, and archive dialog", async ({ page }) => {
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
    name: "Delete Archive a completed task permanently",
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
      name: "Archive a completed task",
      exact: true,
    }),
  ).toBeHidden();
});

test("keeps blank tasks and sizes title and estimate controls to content", async ({
  page,
}) => {
  await expect(page.getByText("seiri", { exact: false })).toHaveCount(0);
  const activeTabBox = await page.getByRole("tab", { name: /Active/ })
    .boundingBox();
  const newTaskBox = await page.getByRole("button", { name: "New task" })
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

  await page.keyboard.press("n");
  const titleInput = page.getByLabel("Task title");
  await titleInput.blur();

  const blankTitle = page.locator(".title-button.is-empty", {
    hasText: "—",
  });
  await expect(blankTitle).toBeVisible();
  await page.reload();
  await expect(blankTitle).toBeVisible();

  const rows = page.getByRole("article");
  const shortEstimateWidth = await rows.nth(0).locator(".estimate-trigger")
    .evaluate((element) => element.getBoundingClientRect().width);
  const longEstimateWidth = await rows.nth(1).locator(".estimate-trigger")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(longEstimateWidth).toBeGreaterThan(shortEstimateWidth);

  const blankTitleWidth = await blankTitle.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const filledTitleWidth = await rows.nth(0).locator(".title-button")
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(filledTitleWidth).toBeGreaterThan(blankTitleWidth);
});

test("drags from the row surface while property controls stay isolated", async ({
  page,
}) => {
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
  await expect(rows.nth(1)).toContainText("Shape the first version");
});

test("expands cleanly and uses compact fixed-size description controls", async ({
  page,
}) => {
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
  await description.fill(
    Array.from({ length: 12 }, (_, index) => `Description line ${index + 1}`)
      .join("\n"),
  );
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
    "13px",
  );
  await expect(page.getByRole("button", { name: "Save" })).toHaveCSS(
    "font-size",
    "13px",
  );
});

test("limits overdue emphasis to the due text", async ({ page }) => {
  const overdueDue = page.getByRole("article").nth(2).locator(".due-trigger");
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
  const firstRow = page.getByRole("article").first();
  await firstRow.locator(".estimate-trigger").click();
  const estimatePopover = page.locator(".estimate-popover");
  const estimateTriggerBox = await firstRow.locator(".estimate-trigger")
    .boundingBox();
  const initialEstimateSize = await estimatePopover.boundingBox();
  expect(estimateTriggerBox).not.toBeNull();
  expect(initialEstimateSize).not.toBeNull();
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
  const clearEstimate = page.getByRole("button", { name: "Clear estimate" });
  await expect(clearEstimate).toHaveText("Clear");
  const estimateRangeBox = await estimatePopover.locator(".estimate-range")
    .boundingBox();
  const clearEstimateBox = await clearEstimate.boundingBox();
  expect(estimateRangeBox).not.toBeNull();
  expect(clearEstimateBox).not.toBeNull();
  expect(
    Math.abs(
      estimateRangeBox!.y +
        estimateRangeBox!.height / 2 -
        (clearEstimateBox!.y + clearEstimateBox!.height / 2),
    ),
  ).toBeLessThan(3);
  await clearEstimate.click();
  await expect(firstRow.locator(".estimate-trigger")).toHaveText("—");

  await firstRow.locator(".due-trigger").click();
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
