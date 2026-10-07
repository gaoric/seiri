import { expect, test } from "@playwright/test";

test("habit data summarizes progress, explores activity, and returns to the selected tracker view", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-07T12:00:00Z"));
  await page.addInitScript(() => {
    const habits = ["Read", "Move", "Water"].map((name, index) => ({ id: name, name, icon: null,
      logType: ["checkbox", "level", "number"][index], color: ["blue", "teal", "mint"][index], createdAt: "2026-09-07T00:00:00Z" }));
    const logs: Record<string, Record<string, boolean | number>> = {};
    for (let index = 0; index < 30; index++) {
      const date = new Date(2026, 8, 7 + index);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      logs[key] = { Read: index % 6 !== 0, Move: index % 5, Water: index % 4 };
    }
    localStorage.setItem("seiri.habits.v1", JSON.stringify({ state: { habits, logs }, version: 1 }));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  await page.getByRole("button", { name: "Wheel", exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem("seiri.habits.v1"));
  await page.getByRole("button", { name: "Data", exact: true }).click();
  const data = page.getByRole("region", { name: "Habit progress data" });
  await expect(data).toBeVisible();
  await expect(page.getByLabel("Monthly habit wheel")).toHaveCount(0);
  await expect(data.locator(".habit-data-stat").first()).toContainText("69%");
  await expect(data.locator(".habit-activity-day")).toHaveCount(30);
  await expect(data.getByLabel("2026-10-07 completeness: 100%")).toHaveCount(0);
  await data.getByRole("button", { name: "7 days", exact: true }).click();
  await expect(data.locator(".habit-data-stat").first()).toContainText("73%");
  await expect(data.getByLabel("Read consistency: 86%", { exact: true })).toBeVisible();
  await expect(data.getByLabel("Move consistency: 61%", { exact: true })).toBeVisible();
  await expect(data.getByLabel("Water consistency: 71%", { exact: true })).toBeVisible();
  await expect(data.getByLabel("Read current streak: 5 days", { exact: true })).toBeVisible();
  const activity = data.getByRole("button", { name: "2026-10-06: 100% consistency, 3 of 3 habits logged" });
  await activity.focus();
  await expect(data.locator(".habit-activity-detail")).toHaveText("Oct 6 · 100% · 3 of 3 habits logged");
  await data.getByRole("button", { name: "30 days", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("habits-data.png"), fullPage: true });
  await data.getByRole("button", { name: "90 days", exact: true }).click();
  const calendarBounds = await data.locator(".habit-activity-days").boundingBox();
  expect(calendarBounds!.x + calendarBounds!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Back to tracker", exact: true }).click();
  await expect(page.getByLabel("Monthly habit wheel")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("seiri.habits.v1"))).toBe(saved);
});

test("habit data gives a useful starting state without existing habits", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your story starts with a mark" })).toBeVisible();
  await page.getByRole("button", { name: "Back to tracker", exact: true }).click();
  await expect(page.getByRole("button", { name: "Add habit", exact: true })).toBeEnabled();
});

test("future days cannot be logged and handles and tooltips stay unobtrusive", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-07T12:00:00Z"));
  await page.addInitScript(() => {
    const habits = ["Read", "Move", "Water"].map((name, index) => ({ id: name, name, icon: null,
      logType: ["checkbox", "level", "number"][index], color: "blue", createdAt: "2026-01-04T00:00:00.000Z" }));
    localStorage.setItem("seiri.habits.v1", JSON.stringify({ state: { habits, logs: {
      "2026-10-07": { Water: 2.5 }, "2026-10-08": { Read: true, Move: 4, Water: 10 },
    } }, version: 1 }));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  const savedLogs = await page.evaluate(() => JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.logs);
  const handle = page.getByRole("button", { name: "Reorder Read", exact: true });
  for (const view of ["Weekly", "Monthly", "Wheel"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    await handle.evaluate(element => element.blur());
    await page.mouse.move(0, 0);
    await expect(handle).toHaveCSS("color", "rgba(255, 255, 255, 0)");
    await handle.hover();
    await expect(handle).toHaveCSS("color", "rgba(255, 255, 255, 0.65)");
    await page.getByRole("button", { name: "Edit Read", exact: true }).hover();
    await expect(handle).toHaveCSS("color", "rgba(255, 255, 255, 0.2)");
    await page.mouse.move(0, 0);
    await handle.focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(handle).toHaveCSS("color", "rgba(255, 255, 255, 0.65)");
    await expect(page.locator(".habit-edit-button[title], .habit-wheel-edit[title], .habit-day-label[title]")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add habit", exact: true })).not.toHaveAttribute("title");
    if (view !== "Wheel") {
      await expect(page.locator('.habit-log-cell[aria-disabled="true"] button, .habit-log-cell[aria-disabled="true"] input')).toHaveCount(0);
      for (const name of ["Read", "Move", "Water"]) {
        await expect(page.getByRole("gridcell", { name: `${name} on 2026-10-08: future day`, exact: true })).toBeEmpty();
        await expect(page.getByLabel(`${name} on 2026-10-07`, { exact: true })).toHaveCount(1);
      }
    } else {
      await expect(page.locator(".habit-wheel-cell title")).toHaveCount(0);
      for (const name of ["Read", "Move", "Water"]) {
        const cell = page.getByLabel(`${name} on 2026-10-08`, { exact: true });
        await expect(cell).toHaveAttribute("aria-disabled", "true");
        await expect(cell).toHaveAttribute("tabindex", "-1");
        await expect(cell.locator(".habit-wheel-space")).toHaveAttribute("fill", "#25262a");
        await expect(cell.locator(".habit-wheel-level-fill")).toHaveCount(0);
        await cell.click({ force: true });
        await cell.press("Enter");
        await cell.press("Space");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      }
      await page.getByLabel("Water on 2026-10-07", { exact: true }).hover();
      await expect(page.getByRole("tooltip")).toContainText("2.5");
      await expect(page.getByRole("button", { name: "Reorder Water", exact: true })).toHaveCSS("color", "rgba(255, 255, 255, 0.2)");
    }
  }
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.logs)).toEqual(savedLogs);
});

test("dedicated handles reorder habits across all views and preserve their logs", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem("habits-order-check")) return;
    const habits = ["Read", "Move", "Water"].map((name, index) => ({ id: name, name, icon: null,
      logType: ["checkbox", "level", "number"][index], color: ["blue", "teal", "mint"][index],
      createdAt: "2026-01-04T00:00:00.000Z" }));
    localStorage.setItem("seiri.habits.v1", JSON.stringify({ state: { habits,
      logs: { "2026-01-04": { Read: true, Move: 3, Water: 8 } } }, version: 1 }));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  let order = ["Read", "Move", "Water"];
  const handles = page.getByRole("button", { name: /^Reorder / });
  const expectOrder = () => expect.poll(() => handles.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("aria-label")))).toEqual(order.map((name) => `Reorder ${name}`));
  const labelFrom = (await page.getByRole("button", { name: "Edit Read", exact: true }).boundingBox())!;
  const labelTo = (await page.getByRole("button", { name: "Edit Water", exact: true }).boundingBox())!;
  await page.mouse.move(labelFrom.x + labelFrom.width / 2, labelFrom.y + labelFrom.height / 2);
  await page.mouse.down();
  await page.mouse.move(labelTo.x + labelTo.width / 2, labelTo.y + labelTo.height / 2, { steps: 10 });
  await page.mouse.up();
  await expectOrder();
  for (const view of ["Weekly", "Monthly", "Wheel"]) {
    await page.getByRole("button", { name: view, exact: true }).click();
    const start = (await handles.first().boundingBox())!;
    const end = (await handles.last().boundingBox())!;
    const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
    const to = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
    if (testInfo.project.name === "mobile") {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
      await page.waitForTimeout(250);
      for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
          { x: from.x + (to.x - from.x) * step / 8, y: from.y + (to.y - from.y) * step / 8 },
        ] });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await session.detach();
    } else {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 12 });
      await page.mouse.up();
    }
    order = [...order.slice(1), order[0]!];
    await expectOrder();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`habits-reordered-${view}.png`), fullPage: true });
  }
  await handles.first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".habit-wheel-label[data-dragging]")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".habit-wheel-label[data-drop-target]")).toHaveCount(1);
  await page.keyboard.press("Space");
  order = [order[1]!, order[0]!, order[2]!];
  await expectOrder();
  await handles.first().focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".habit-wheel-label[data-dragging]")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expectOrder();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("seiri.habits.v1")!).state);
  expect(saved.habits.map((habit: { name: string }) => habit.name)).toEqual(order);
  expect(saved.logs).toEqual({ "2026-01-04": { Read: true, Move: 3, Water: 8 } });
  // Reload without reseeding the fixture to check persisted order.
  await page.evaluate(() => sessionStorage.setItem("habits-order-check", "true"));
  await page.reload();
  await page.getByRole("tab", { name: "habits" }).click();
  await expectOrder();
  await page.getByRole("button", { name: "Edit Read", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Edit habit" }).getByLabel("Name", { exact: true })).toHaveValue("Read");
});

test("period dropdowns select bounded weeks and months, with tracking starting January 4", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Name", { exact: true }).fill("Read");
  await page.getByRole("dialog").getByRole("button", { name: "Add habit", exact: true }).click();
  const week = page.getByRole("combobox", { name: "Select week" });
  const currentWeek = await week.textContent();
  await week.click();
  await expect(page.getByRole("option").last()).toHaveText("Jan 4–10, 2026");
  await page.screenshot({ path: testInfo.outputPath("habits-week-picker.png"), fullPage: true });
  await page.getByRole("option").last().click();
  await expect(week).toHaveText(/Jan 4–10/);
  await expect(page.getByRole("button", { name: "Previous week" })).toBeDisabled();
  await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-label", "Read on 2026-01-04");
  await week.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Home");
  await expect(page.getByRole("option").first()).toHaveAttribute("data-highlighted", "");
  await page.keyboard.press("Enter");
  await expect(week).toHaveText(currentWeek!);
  await expect(page.getByRole("button", { name: "Next week" })).toBeDisabled();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  const month = page.getByRole("combobox", { name: "Select month" });
  const currentMonth = await month.textContent();
  await month.click();
  await expect(page.getByRole("option").last()).toHaveText("January 2026");
  await page.screenshot({ path: testInfo.outputPath("habits-month-picker.png"), fullPage: true });
  await page.getByRole("option").last().click();
  await expect(month).toHaveText(/January 2026/);
  await expect(page.getByRole("button", { name: "Previous month" })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toHaveCount(28);
  await expect(page.getByRole("checkbox").first()).toHaveAttribute("aria-label", "Read on 2026-01-04");
  await expect(page.getByLabel("2026-01-03 completeness: 0%")).toHaveCount(0);
  await expect(page.getByText("Daily progress", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Completeness · %", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("habits-first-month.png"), fullPage: true });
  await page.getByRole("button", { name: "Wheel", exact: true }).click();
  const unavailable = page.getByRole("checkbox", { name: "Read on 2026-01-03", exact: true });
  await expect(unavailable).toHaveAttribute("aria-disabled", "true");
  await expect(unavailable).toHaveAttribute("tabindex", "-1");
  await unavailable.click({ force: true });
  await expect(unavailable).toHaveAttribute("aria-checked", "false");
  await month.click();
  await page.getByRole("option").first().click();
  await expect(month).toHaveText(currentMonth!);
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
});

test("habit rows support editing, deletion, and weekly/monthly logging", async ({ page }, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-07T12:00:00Z"));
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "New habit" });
  await expect(editor.getByRole("button", { name: "Text: Write a short note" })).toHaveCount(0);
  await editor.getByLabel("Name", { exact: true }).fill("Read");
  await editor.getByRole("button", { name: "Reading", exact: true }).click();
  await editor.getByRole("button", { name: "Coral color" }).click();
  await editor.getByRole("button", { name: "Add habit", exact: true }).click();

  const habit = page.getByRole("button", { name: "Edit Read", exact: true });
  await expect(habit).toBeVisible();
  await expect(page.getByRole("button", { name: "Next week" })).toBeDisabled();
  await expect(page.getByRole("checkbox")).toHaveCount(4);
  const firstDay = page.getByRole("checkbox").first();
  const firstLabel = await firstDay.getAttribute("aria-label");
  await firstDay.click();
  await expect(firstDay).toBeChecked();
  await expect(habit).toHaveCSS("color", "rgb(233, 141, 145)");
  await expect(firstDay).toHaveCSS("background-color", "rgb(233, 141, 145)");
  await expect(firstDay.locator("svg")).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("columnheader", { name: "Completed" })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("habits-weekly.png"), fullPage: true });

  await habit.click();
  const edit = page.getByRole("dialog", { name: "Edit habit" });
  await edit.getByLabel("Name", { exact: true }).fill("Reading");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("checkbox", { name: firstLabel!.replace("Read on", "Reading on") })).toBeChecked();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  const monthHeader = page.getByRole("combobox", { name: "Select month" });
  const currentMonth = await monthHeader.textContent();
  const dayCount = await page.getByRole("checkbox").count();
  expect(dayCount).toBe(7);
  // The habit names remain visible while scrolling through a month.
  await page.locator(".habit-grid-scroll").evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect(page.getByRole("button", { name: "Edit Reading", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("habits-monthly.png"), fullPage: true });
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(monthHeader).not.toHaveText(currentMonth!);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(monthHeader).toHaveText(currentMonth!);
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();

  await page.getByRole("button", { name: "Edit Reading", exact: true }).click();
  await edit.getByRole("button", { name: "Delete habit", exact: true }).click();
  const confirmation = page.getByRole("alertdialog", { name: "Delete this habit?" });
  await expect(confirmation).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("habits-delete.png"), fullPage: true });
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(edit).toBeVisible();
  await edit.getByRole("button", { name: "Delete habit", exact: true }).click();
  await confirmation.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("Build a week one small mark at a time.")).toBeVisible();
});

test("wheel renders all 12 habits, supports mixed logging and hover values, and shares table data", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const colors = ["blue", "teal", "mint", "lime", "gold", "peach", "coral", "rose", "lavender", "violet", "sky", "stone"];
    const names = ["Read", "Exercise", "Water", "Journal", "Sleep", "Meditate", "Walk", "Stretch", "Practice", "Plan", "Create", "Connect"];
    const types = ["checkbox", "level", "number", "text"];
    const habits = names.map((name, index) => ({ id: `habit-${index}`, name, icon: null,
      logType: types[index % 4], color: colors[index], createdAt: "2026-01-01T00:00:00.000Z" }));
    const today = new Date();
    const key = (day: number) => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const logs: Record<string, Record<string, boolean | number | string>> = {};
    for (let day = 1; day <= today.getDate(); day++) {
      logs[key(day)] = {};
      habits.forEach((habit, index) => {
        if ((day * (index + 1) + index) % 5 !== 0) logs[key(day)]![habit.id] = habit.logType === "checkbox" ? true
          : habit.logType === "level" ? (day + index) % 4 + 1 : habit.logType === "number" ? day + index : "A calm morning";
      });
    }
    localStorage.setItem("seiri.habits.v1", JSON.stringify({ state: { habits, logs }, version: 1 }));
  });
  await page.goto("/");
  await page.getByRole("tab", { name: "habits" }).click();
  await expect(page.getByRole("button", { name: "Add habit", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add habit", exact: true })).toHaveAttribute("title", "12-habit limit reached");
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByRole("row")).toHaveCount(13);
  if ((page.viewportSize()?.width ?? 0) > 600) {
    const dimensions = await page.locator(".habit-grid-scroll").evaluate((element) => ({ width: element.clientWidth, scroll: element.scrollWidth }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 2);
  }
  await page.screenshot({ path: testInfo.outputPath("habits-12-monthly.png"), fullPage: true });
  await page.getByRole("button", { name: "Wheel", exact: true }).click();
  await expect(page.getByRole("button", { name: "Next month" })).toBeDisabled();
  await expect(page.getByLabel("Monthly habit wheel")).toBeVisible();
  await expect(page.getByLabel("Monthly habit wheel")).toHaveCSS("shape-rendering", "geometricprecision");
  await expect(page.locator(".habit-wheel-today-slice")).toHaveCount(1);
  await expect(page.locator(".habit-wheel-panel")).toHaveCSS("border-top-width", "0px");
  await page.getByRole("button", { name: "Reorder Read", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".habit-wheel-label[data-dragging]")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".habit-wheel-label[data-drop-target]")).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(page.getByRole("button", { name: /^Reorder / }).first()).toHaveAttribute("aria-label", "Reorder Exercise");
  await page.screenshot({ path: testInfo.outputPath("habits-12-wheel.png"), fullPage: true });
  const dateKey = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const check = page.getByRole("checkbox", { name: `Read on ${dateKey}`, exact: true });
  const before = await check.getAttribute("aria-checked");
  await check.hover();
  await expect(check.locator(".habit-wheel-cell-outline")).toHaveCSS("stroke-width", "1.5px");
  await expect(check.locator(".habit-wheel-cell-outline")).toHaveCSS("stroke-linejoin", "round");
  await expect(check.locator(".habit-wheel-cell-outline")).toHaveCSS("vector-effect", "non-scaling-stroke");
  await check.click();
  await expect(check).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");
  await check.dblclick();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  const level = page.getByRole("button", { name: `Exercise on ${dateKey}`, exact: true });
  const previousLevel = Number(await level.getAttribute("aria-valuenow"));
  await level.click();
  await expect(level).toHaveAttribute("aria-valuenow", String((previousLevel + 1) % 5));
  await level.hover();
  await expect(level.locator(".habit-wheel-cell-outline")).toHaveCSS("stroke-width", "1.5px");
  await level.evaluate((element) => element.focus());
  for (let step = 0; step < 5 && Number(await level.getAttribute("aria-valuenow")) !== 4; step++) {
    await level.press("Enter");
  }
  await expect(level.locator(".habit-wheel-level-fill")).toHaveCSS("stroke", "none");
  await level.press("Enter");
  await expect(level.locator(".habit-wheel-level-fill")).toHaveCount(0);
  for (let step = 1; step <= 4; step++) {
    await level.press("Enter");
    const radii = await level.evaluate((element) => {
      const read = (selector: string) => [...element.querySelector(selector)!.getAttribute("d")!.matchAll(/A ([\d.]+) /g)]
        .map((match) => Number(match[1]));
      return { cell: read(".habit-wheel-space"), filled: read(".habit-wheel-level-fill") };
    });
    expect(radii.filled[0]).toBeCloseTo(radii.cell[0]!);
    expect(radii.filled[1]).toBeCloseTo(radii.cell[0]! - (radii.cell[0]! - radii.cell[1]!) * step / 4);
  }
  const number = page.getByRole("button", { name: `Water on ${dateKey}`, exact: true });
  await number.click();
  await page.getByRole("dialog", { name: "Water", exact: true }).getByLabel("Amount").fill("2.5");
  await page.getByRole("button", { name: "Save entry" }).click();
  await number.hover();
  await expect(page.getByRole("tooltip")).toContainText("2.5");
  const text = page.getByRole("button", { name: `Journal on ${dateKey}`, exact: true });
  await text.click();
  await page.getByRole("dialog", { name: "Journal", exact: true }).getByLabel("Note").fill("A fresh start");
  await page.getByRole("button", { name: "Save entry" }).click();
  await text.hover();
  await expect(page.getByRole("tooltip")).toContainText("A fresh start");
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(page.locator(".habit-wheel-today-slice")).toHaveCount(0);
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page.locator(".habit-wheel-today-slice")).toHaveCount(1);
  await page.getByRole("button", { name: "Edit Read", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit habit" });
  await editor.getByRole("button", { name: "Lavender color" }).click();
  await editor.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Read", exact: true })).toHaveCSS("color", "rgb(183, 163, 232)");
  await expect(page.getByLabel(`Water on ${dateKey}`, { exact: true })).toHaveValue("2.5");
  await expect(page.getByLabel(`Journal on ${dateKey}`, { exact: true })).toHaveValue("A fresh start");
  const tableLevel = page.getByRole("button", { name: `Exercise on ${dateKey}`, exact: true });
  await expect(tableLevel.locator(".habit-level-fill")).toHaveCSS("border-radius", "50%");
  await tableLevel.click();
  await expect(tableLevel).toHaveAttribute("aria-valuenow", "0");
  await expect(tableLevel.locator(".habit-level-value")).toHaveCount(0);
  for (let step = 1; step <= 4; step++) {
    await tableLevel.click();
    await expect(tableLevel).toHaveAttribute("aria-valuenow", String(step));
    await expect(tableLevel.locator(".habit-level-value")).toHaveCSS("fill", "rgb(106, 212, 207)");
    if (step < 4) {
      const path = await tableLevel.locator("path").getAttribute("d");
      const endpoint = path!.match(/1 ([\d.]+) ([\d.]+) Z$/)!;
      expect(Number(endpoint[1])).toBeCloseTo([19, 10, 1][step - 1]!);
      expect(Number(endpoint[2])).toBeCloseTo([10, 19, 10][step - 1]!);
    } else await expect(tableLevel.locator("circle.habit-level-value")).toHaveCount(1);
  }
  await tableLevel.dblclick();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  await page.screenshot({ path: testInfo.outputPath("habits-monthly-levels.png"), fullPage: true });
});
