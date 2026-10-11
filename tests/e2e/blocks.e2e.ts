import { expect, test, type Locator, type Page } from "@playwright/test";

async function openBlocks(page: Page) {
  await page.goto("/");
  await page.getByRole("tab", { name: "blocks" }).click();
  await page.getByRole("button", { name: "Start planning" }).click();
}

async function createBlock(
  page: Page,
  category: "Event" | "Todo" | "Habit",
  name: string,
  start: string,
  end?: string,
  repeatDaily = false,
) {
  await page.getByRole("button", { name: "New block", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New block" });
  await dialog.getByRole("button", { name: category, exact: true }).click();
  await dialog.getByLabel("Block name").fill(name);
  await dialog.getByLabel("Block start").fill(start);
  await dialog.getByLabel("Block end").fill(end!);
  if (repeatDaily) await dialog.getByRole("checkbox", { name: "Repeat every day" }).check();
  await dialog.getByRole("button", { name: "Create block", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}

async function setBlockColor(page: Page, color: string) {
  await page.getByRole("button", { name: "Custom color", exact: true }).click();
  await page.getByLabel("Block color", { exact: true }).fill(color);
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
}

async function dragToTime(page: Page, handle: Locator, slot: Locator) {
  const source = await handle.boundingBox();
  const target = await slot.boundingBox();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  // Move through intermediate points so the pointer sensor activates before reaching the slot.
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 15,
  });
  // Dragging can scroll the workspace, so finish at the slot's current position.
  const finalTarget = await slot.boundingBox();
  await page.mouse.move(
    finalTarget!.x + finalTarget!.width / 2,
    finalTarget!.y + finalTarget!.height / 2,
  );
  await page.mouse.up();
}

test("overlaps exact-minute blocks, repeats events, and displays instant todos in both views", async ({
  page,
}) => {
  await openBlocks(page);
  await createBlock(page, "Event", "Focus", "08:07", "08:44");
  const event = page.getByRole("button", { name: "Edit Focus, 8:07am to 8:44am", exact: true });
  await event.click();
  await page.getByRole("checkbox", { name: "Repeat every day" }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(event.locator(".blocks-cycle-icon")).toBeVisible();
  await createBlock(page, "Todo", "Send", "08:11", "08:18");
  await createBlock(page, "Todo", "Checkpoint", "08:25", "08:25");
  await createBlock(page, "Habit", "Stretch", "08:15", "08:22");
  const send = page.getByRole("button", { name: "Edit Send, 8:11am to 8:18am", exact: true });
  const instant = page.getByRole("button", { name: "Edit Checkpoint, at 8:25am", exact: true });
  const habit = page.getByRole("button", { name: "Edit Stretch, 8:15am to 8:22am", exact: true });
  await expect(send).toBeVisible();
  await expect(instant).toBeVisible();
  await expect(habit).toBeVisible();
  await expect(instant.locator("..")).toHaveClass(/is-compact/);
  await expect(page.getByText("37m planned", { exact: true })).toBeVisible();
  const sendBox = await send.locator("..").boundingBox();
  const habitBox = await habit.locator("..").boundingBox();
  expect(sendBox!.x + sendBox!.width).toBeLessThanOrEqual(habitBox!.x);
  const detailsBox = await send.locator(".blocks-todo-details").boundingBox();
  expect(detailsBox!.y + detailsBox!.height).toBeLessThanOrEqual(sendBox!.y + sendBox!.height);
  await page.screenshot({
    path: `test-results/blocks-overlap-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Connected timeline", exact: true }).click();
  await expect(event).toBeVisible();
  await expect(send).toBeVisible();
  await expect(instant).toBeVisible();
  await expect(habit).toBeVisible();
  const instantIcon = await instant.locator(".blocks-connected-icon").boundingBox();
  expect(instantIcon!.height).toBe(instantIcon!.width);
  await expect(instant.locator("..").locator(".blocks-connected-times time")).toHaveText([
    "8:25am",
  ]);
  await page.getByRole("button", { name: "Complete Checkpoint", exact: true }).click();
  await expect(instant.locator("..")).toHaveClass(/is-done/);
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(event).toBeVisible();
  await expect(instant).toHaveCount(0);
  await event.click();
  await page.getByRole("checkbox", { name: "Repeat every day" }).uncheck();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(event.locator(".blocks-cycle-icon")).toHaveCount(0);
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(event).toHaveCount(0);
});

test("uses the themed color panel for hex entry, spectrum changes and screen sampling", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "EyeDropper", {
      configurable: true,
      value: class {
        async open() {
          return { sRGBHex: "#334455" };
        }
      },
    });
  });
  await openBlocks(page);
  await page.getByRole("button", { name: "New block", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "New block", exact: true });
  const categories = dialog.getByRole("group", { name: "Block category" });
  await expect(categories.getByRole("button", { name: "Routine", exact: true })).toHaveCount(0);
  await expect(categories.getByRole("button", { name: "Marker", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Lavender color", exact: true })).toHaveCount(0);
  await expect(dialog.locator('input[type="color"]')).toHaveCount(0);
  await page.getByLabel("Block name").fill("Color test");
  await page.getByRole("button", { name: "Custom color", exact: true }).click();
  const hex = page.getByLabel("Block color", { exact: true });
  await hex.fill("#zzzzzz");
  await expect(page.getByRole("button", { name: "Apply color", exact: true })).toBeDisabled();
  await hex.fill("#abc");
  await expect(page.getByRole("button", { name: "Apply color", exact: true })).toBeEnabled();
  const spectrum = page.getByRole("slider", { name: "Color saturation and brightness" });
  await spectrum.focus();
  await page.keyboard.press("ArrowRight");
  await expect(hex).not.toHaveValue("#abc");
  await page.getByRole("button", { name: "Pick color from screen", exact: true }).click();
  await expect(hex).toHaveValue("#334455");
  await page.screenshot({
    path: `test-results/block-color-panel-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply color", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Create block", exact: true })).toHaveCSS(
    "background-color",
    "rgb(230, 230, 230)",
  );
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  const block = page.getByRole("button", { name: "Edit Color test, 8am to 8:30am", exact: true });
  await expect(block.locator("..")).toHaveCSS("--block-color", "#334455");
  await block.click();
  await expect(page.getByRole("button", { name: "Save changes", exact: true })).toHaveCSS(
    "background-color",
    "rgb(230, 230, 230)",
  );
  await page.screenshot({
    path: `test-results/block-editor-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test.describe("connected timeline", () => {
  test.use({ timezoneId: "America/Toronto" });

  test("compresses gaps, follows the clock, logs shared items, and remembers the view", async ({
    page,
    isMobile,
  }) => {
    await page.clock.setFixedTime(new Date("2026-10-10T09:15:00-04:00"));
    await openBlocks(page);
    await createBlock(page, "Event", "Wake up", "08:00", "08:00");
    await createBlock(page, "Event", "Breakfast", "08:00", "08:30", true);
    await createBlock(page, "Todo", "Write the brief", "09:00", "09:30");
    await createBlock(page, "Habit", "Read", "09:30", "09:45");
    await createBlock(page, "Event", "Wind down", "21:00", "21:30", true);
    await page.getByRole("button", { name: "Connected timeline", exact: true }).click();
    const timeline = page.locator(".blocks-connected");
    const task = page.getByRole("button", { name: "Edit Write the brief, 9am to 9:30am" });
    const block = task.locator("..");
    const current = page.getByLabel("Current time 9:15am", { exact: true });
    await expect(current).toBeVisible();
    await expect(block).toHaveAttribute("data-elapsed", "0.5");
    const initialFill = await task.locator(".blocks-connected-icon > i").boundingBox();
    const initialTop = await current.evaluate((element) => parseFloat(element.style.top));
    const textBox = await task.locator(".blocks-connected-details").boundingBox();
    const iconBox = await task.locator(".blocks-connected-icon").boundingBox();
    expect(iconBox!.x + iconBox!.width).toBeLessThan(textBox!.x);
    const morning = page.getByRole("button", { name: "Edit Good Morning, at 8am" });
    const night = page.getByRole("button", { name: "Edit Good Night, at 12am" });
    await expect(morning).toBeVisible();
    await expect(night).toHaveCount(1);
    const firstLine = await timeline
      .locator('.blocks-connected-line[data-from="blocks-good-morning"]')
      .boundingBox();
    const morningIcon = await morning.locator(".blocks-connected-icon").boundingBox();
    expect(firstLine!.y).toBeGreaterThanOrEqual(morningIcon!.y + morningIcon!.height / 2);
    const lastLine = await timeline
      .locator('.blocks-connected-line[data-to="blocks-good-night"]')
      .boundingBox();
    const nightIcon = await night.locator(".blocks-connected-icon").boundingBox();
    expect(lastLine!.y + lastLine!.height).toBeLessThanOrEqual(
      nightIcon!.y + nightIcon!.height / 2,
    );
    const readIcon = await page
      .getByRole("button", { name: "Edit Read, 9:30am to 9:45am" })
      .locator(".blocks-connected-icon")
      .boundingBox();
    expect(readIcon!.height).toBe(readIcon!.width);
    await expect(task.locator(".blocks-connected-icon > i")).not.toHaveCSS("mask-image", "none");
    const gap = page.getByRole("button", { name: "Plan free time, 9:45am to 9pm" });
    expect((await gap.boundingBox())!.height).toBe(72);
    const readId = await page
      .getByRole("button", { name: "Edit Read, 9:30am to 9:45am" })
      .locator("..")
      .getAttribute("data-block-id");
    await expect(timeline.locator(`.blocks-connected-line[data-from="${readId}"]`)).toHaveClass(
      /is-dotted/,
    );
    const axisTimes = block.locator(".blocks-connected-times time");
    await expect(axisTimes).toHaveText(["9am", "9:30am"]);
    const timeBoxes = await axisTimes.evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return { right: box.right, center: box.y + box.height / 2 };
      }),
    );
    expect(timeBoxes[0]!.center).toBeCloseTo(iconBox!.y + 4);
    expect(timeBoxes[1]!.center).toBeCloseTo(iconBox!.y + iconBox!.height - 4);
    expect(timeBoxes[0]!.right).toBeLessThan(iconBox!.x);
    const currentTime = await current.locator("time").boundingBox();
    expect(currentTime!.x + currentTime!.width).toBeCloseTo(timeBoxes[0]!.right);

    await page.clock.setFixedTime(new Date("2026-10-10T09:20:00-04:00"));
    const advanced = page.getByLabel("Current time 9:20am", { exact: true });
    await expect(advanced).toBeVisible();
    expect(await advanced.evaluate((element) => parseFloat(element.style.top))).toBeGreaterThan(
      initialTop,
    );
    await expect(block).toHaveAttribute("data-elapsed", String(2 / 3));
    expect(
      (await task.locator(".blocks-connected-icon > i").boundingBox())!.height,
    ).toBeGreaterThan(initialFill!.height);
    await page.getByRole("button", { name: "Complete Write the brief", exact: true }).click();
    await expect(block).toHaveClass(/is-done/);
    await expect(block).toHaveAttribute("data-elapsed", String(2 / 3));
    const readLog = page.getByRole("checkbox", { name: "Read on 2026-10-10", exact: true });
    await readLog.click();
    await expect(readLog).toHaveCSS("background-color", "rgb(139, 188, 255)");
    await page.screenshot({
      path: `test-results/blocks-connected-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("tab", { name: "habits" }).click();
    await expect(
      page
        .getByRole("grid", { name: /^Habits for/ })
        .getByRole("checkbox", { name: "Read on 2026-10-10", exact: true }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Edit Read", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Edit habit", exact: true });
    const editorSize = await editor.evaluate((element) => ({
      height: element.clientHeight,
      contents: element.scrollHeight,
    }));
    expect(editorSize.contents).toBeLessThanOrEqual(editorSize.height);
    await expect(editor.getByLabel("Habit time estimate")).toHaveCount(0);
    await page.screenshot({
      path: `test-results/habit-editor-expanded-${test.info().project.name}.png`,
      fullPage: true,
    });
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("tab", { name: "blocks" }).click();
    await expect(timeline).toBeVisible();
    await page.reload();
    await page.getByRole("tab", { name: "blocks" }).click();
    await expect(
      page.getByRole("button", { name: "Connected timeline", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(timeline).toBeVisible();

    await gap.click();
    await expect(page.getByLabel("Block start")).toHaveValue("09:45");
    await expect(page.getByLabel("Block end")).toHaveValue("10:15");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Next day" }).click();
    await expect(page.locator(".blocks-connected-now")).toHaveCount(0);
    await expect(page.locator(".blocks-connected-block").first()).toHaveAttribute(
      "data-elapsed",
      "0",
    );
    if (!isMobile) {
      await dragToTime(
        page,
        page.getByRole("button", { name: "Edit Read", exact: true }).locator("strong"),
        page.getByRole("button", { name: "Plan free time, 8:30am to 9pm" }),
      );
      const read = page.getByRole("button", { name: "Edit Read, 8:30am to 8:45am" });
      await expect(read).toBeVisible();
      await dragToTime(
        page,
        read.locator("strong"),
        page.getByRole("button", { name: "Plan free time, 8:45am to 9pm" }),
      );
      await expect(page.getByRole("button", { name: "Edit Read, 8:45am to 9am" })).toBeVisible();
    }
    await page.getByRole("button", { name: "Grid timeline", exact: true }).click();
    await expect(page.locator(".blocks-timeline")).toBeVisible();
    const sizes = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      window: innerWidth,
    }));
    expect(sizes.document).toBeLessThanOrEqual(sizes.window);
  });
});

test("customizes every block category, keeps habit defaults, and colors greeting blocks", async ({
  page,
}) => {
  await openBlocks(page);
  await createBlock(page, "Event", "Breakfast", "08:00", "08:30");
  await createBlock(page, "Todo", "Write", "09:00", "09:15");
  await createBlock(page, "Habit", "Read", "10:00", "10:15");
  await createBlock(page, "Event", "Break", "10:30", "10:30");
  await page.getByRole("button", { name: "Edit Read", exact: true }).click();
  await page.getByRole("button", { name: "Teal color", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const blocks = [
    ["Edit Breakfast, 8am to 8:30am", "#8bbcff", "#eeab80"],
    ["Edit Write, 9am to 9:15am", "#8bbcff", "#88d8ab"],
    ["Edit Read, 10am to 10:15am", "#6ad4cf", "#b7a3e8"],
    ["Edit Break, at 10:30am", "#8bbcff", "#e6c575"],
  ];
  for (const [name, defaultColor, customColor] of blocks) {
    const block = page.getByRole("button", { name: name!, exact: true });
    await expect(block.locator("..")).toHaveCSS("--block-color", defaultColor!);
    await block.click();
    await setBlockColor(page, customColor!);
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(block.locator("..")).toHaveCSS("--block-color", customColor!);
  }
  const habitColor = await page.evaluate(
    () => JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.habits[0].color,
  );
  expect(habitColor).toBe("teal");
  await page.getByRole("button", { name: "Edit Write, 9am to 9:15am", exact: true }).click();
  await page.getByRole("button", { name: "Use default color", exact: true }).click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit Write, 9am to 9:15am" }).locator(".."),
  ).toHaveCSS("--block-color", "#8bbcff");
  await page.getByRole("button", { name: "Connected timeline", exact: true }).click();
  await page.getByRole("button", { name: "Edit Good Night, at 12am", exact: true }).click();
  await setBlockColor(page, "#de9dbf");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.locator(".blocks-hours-button").click();
  await page.getByLabel("Wake up", { exact: true }).fill("07:30");
  await page.getByLabel("Go to sleep", { exact: true }).fill("23:00");
  await page.getByRole("button", { name: "Save waking hours", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Good Morning, at 7:30am" })).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Edit Good Night, at 11pm" }).locator(".."),
  ).toHaveCSS("--block-color", "#de9dbf");
  await page.reload();
  await page.getByRole("tab", { name: "blocks" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Good Night, at 11pm" }).locator(".."),
  ).toHaveCSS("--block-color", "#de9dbf");
  await expect(
    page.getByRole("button", { name: "Edit Read, 10am to 10:15am" }).locator(".."),
  ).toHaveCSS("--block-color", "#b7a3e8");
});

test("places short blocks close together and blends adjacent colors along the time axis", async ({
  page,
}) => {
  await openBlocks(page);
  await createBlock(page, "Event", "First", "08:00", "08:15");
  await createBlock(page, "Event", "Second", "08:30", "08:45");
  const first = page.getByRole("button", { name: "Edit First, 8am to 8:15am" });
  await first.click();
  await setBlockColor(page, "#eeab80");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Connected timeline", exact: true }).click();
  const firstId = await first.locator("..").getAttribute("data-block-id");
  const connector = page.locator(`.blocks-connected-line[data-from="${firstId}"]`);
  await expect(connector).not.toHaveClass(/is-dotted/);
  await expect(connector).toHaveCSS("--line-from", "#eeab80");
  await expect(connector).toHaveCSS("--line-to", "#8bbcff");
  await expect(connector.locator("i")).toHaveCSS(
    "background-image",
    "linear-gradient(rgb(238, 171, 128), rgb(139, 188, 255))",
  );
  expect((await connector.boundingBox())!.height).toBe(24);
  const gap = page.getByRole("button", { name: "Plan free time, 8:15am to 8:30am" });
  expect((await gap.boundingBox())!.height).toBe(8);
  await expect(first.locator("..").locator(".blocks-connected-times time")).toHaveText([
    "8am",
    "8:15am",
  ]);
  await gap.click();
  await expect(page.getByLabel("Block start")).toHaveValue("08:15");
  await expect(page.getByLabel("Block end")).toHaveValue("08:30");
});

test("gives markers visual space without advancing the clock or changing block durations", async ({
  page,
  isMobile,
}) => {
  await openBlocks(page);
  await createBlock(page, "Event", "Breakfast", "08:00", "08:30");
  await createBlock(page, "Event", "Wake up", "08:00", "08:00");
  const marker = page.getByRole("button", { name: "Edit Wake up, at 8am" });
  const breakfast = page.getByRole("button", { name: "Edit Breakfast, 8am to 8:30am" });
  const markerBox = await marker.locator("..").boundingBox();
  const breakfastBox = await breakfast.locator("..").boundingBox();
  const ruledLine = await page
    .getByRole("button", { name: "Create block at 8am", exact: true })
    .boundingBox();
  expect(markerBox!.height).toBe(37);
  expect(breakfastBox!.y - markerBox!.y).toBe(40);
  expect(breakfastBox!.x + breakfastBox!.width).toBeCloseTo(ruledLine!.x + ruledLine!.width, 0);
  await expect(page.locator(".blocks-time-label").filter({ hasText: /^8am$/ })).toHaveCount(2);
  await expect(page.locator(".blocks-timeline .blocks-drag-handle")).toHaveCount(0);
  await expect(page.getByText("30m planned", { exact: true })).toBeVisible();

  await createBlock(page, "Event", "Pause", "08:15", "08:15");
  await expect(page.locator(".blocks-time-label").filter({ hasText: /^8:15am$/ })).toHaveCount(2);
  const firstSegment = page.getByRole("button", { name: "Edit Breakfast, 8am to 8:15am" });
  await expect(firstSegment).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit Breakfast, 8:15am to 8:30am" }),
  ).toBeVisible();
  await expect(page.getByText("30m planned", { exact: true })).toBeVisible();

  if (isMobile) {
    await marker.tap();
    await expect(page.getByLabel("Block start")).toHaveValue("08:00");
    await expect(page.getByLabel("Block end")).toHaveValue("08:00");
    return;
  }

  // Extra marker rows must not shift the time represented by a pointer selection.
  const start = await page
    .getByRole("button", { name: "Create block at 9am", exact: true })
    .boundingBox();
  const end = await page
    .getByRole("button", { name: "Create block at 9:45am", exact: true })
    .boundingBox();
  await page.mouse.move(start!.x + 100, start!.y + 3);
  await page.mouse.down();
  await page.mouse.move(end!.x + 100, end!.y + 3, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("Block start")).toHaveValue("09:00");
  await expect(page.getByLabel("Block end")).toHaveValue("10:00");
  await page.keyboard.press("Escape");

  await dragToTime(
    page,
    marker.locator("strong"),
    page.getByRole("button", { name: "Create block at 9am", exact: true }),
  );
  await expect(page.getByRole("button", { name: "Edit Wake up, at 9am" })).toBeVisible();
  await dragToTime(
    page,
    firstSegment.locator("strong"),
    page.getByRole("button", { name: "Create block at 9:15am", exact: true }),
  );
  const moved = page.getByRole("button", { name: "Edit Breakfast, 9:15am to 9:45am" });
  await expect(moved).toBeVisible();
  await expect(page.getByText("30m planned", { exact: true })).toBeVisible();
  await moved.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".blocks-scheduled.is-dragging")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".blocks-scheduled.is-dragging")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Block start")).toHaveValue("09:15");
  await expect(page.getByLabel("Block end")).toHaveValue("09:45");
});

test("plans today and tomorrow with shared todos, habits, repeating events and persistent waking hours", async ({
  page,
}) => {
  await openBlocks(page);
  await createBlock(page, "Event", "Breakfast", "08:00", "08:30");
  await page.getByRole("button", { name: "Edit Breakfast, 8am to 8:30am" }).click();
  await page.getByRole("checkbox", { name: "Repeat every day" }).check();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await createBlock(page, "Todo", "Write the brief", "09:00", "10:00");
  await createBlock(page, "Habit", "Read", "23:30", "00:00");
  await page.getByRole("tab", { name: "todo" }).click();
  await expect(page.getByText("Write the brief", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "habits" }).click();
  await expect(page.getByRole("button", { name: "Edit Read", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "blocks" }).click();
  await page.getByRole("button", { name: "Next day" }).click();
  await expect(page.getByRole("heading", { name: "Tomorrow" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Breakfast, 8am to 8:30am" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Write the brief, 9am to 10am" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Edit Breakfast, 8am to 8:30am" }).click();
  await page.getByLabel("Block start").fill("08:30");
  await page.getByLabel("Block end").fill("09:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Breakfast, 8:30am to 9am" })).toBeVisible();
  await page.reload();
  await page.getByRole("tab", { name: "blocks" }).click();
  await expect(page.getByRole("button", { name: "Start planning" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit Write the brief, 9am to 10am" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Edit Write the brief", exact: true }).click();
  await page.getByLabel("Block name").fill("Finish the brief");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Edit Finish the brief, 9am to 10am" }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/blocks-${test.info().project.name}.png`,
    fullPage: true,
  });
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    window: innerWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.window);
});

test("selects a timeline range, drags items to free time, and moves scheduled blocks", async ({
  page,
  isMobile,
}) => {
  test.skip(
    isMobile,
    "Pointer dragging is covered on desktop; mobile scheduling is covered via the time editor.",
  );
  await openBlocks(page);
  const start = await page
    .getByRole("button", { name: "Create block at 8am", exact: true })
    .boundingBox();
  const end = await page
    .getByRole("button", { name: "Create block at 8:45am", exact: true })
    .boundingBox();
  await page.mouse.move(start!.x + 100, start!.y + 3);
  await page.mouse.down();
  await page.mouse.move(end!.x + 100, end!.y + 3, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByLabel("Block start")).toHaveValue("08:00");
  await expect(page.getByLabel("Block end")).toHaveValue("09:00");
  await page.getByRole("button", { name: "Todo", exact: true }).click();
  await page.getByLabel("Block name").fill("Deep work");
  await page.getByLabel("Todo estimate", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  await page.getByRole("button", { name: "Next day" }).click();
  await dragToTime(
    page,
    page.getByRole("button", { name: "Edit Deep work", exact: true }).locator("strong"),
    page.getByRole("button", { name: "Create block at 9am", exact: true }),
  );
  await expect(page.getByRole("button", { name: "Edit Deep work, 9am to 10am" })).toBeVisible();
  await dragToTime(
    page,
    page.getByRole("button", { name: "Edit Deep work, 9am to 10am" }).locator("strong"),
    page.getByRole("button", { name: "Create block at 10am", exact: true }),
  );
  await expect(page.getByRole("button", { name: "Edit Deep work, 10am to 11am" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1h planned", { exact: true })).toBeVisible();
  const dragHandle = page.getByRole("button", { name: "Drag Deep work", exact: true });
  await dragHandle.focus();
  await page.keyboard.press("Space");
  await expect(page.locator(".blocks-todo-card.is-dragging")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".blocks-todo-card.is-dragging")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit Deep work", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Edit todo" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // Overlapping drops add another session; dropping outside the timeline does nothing.
  await dragToTime(
    page,
    page.getByRole("button", { name: "Drag Deep work", exact: true }),
    page.getByRole("button", { name: "Create block at 10:45am", exact: true }),
  );
  await expect(
    page.getByRole("button", { name: "Edit Deep work, 10:45am to 11:45am" }),
  ).toBeVisible();
  await expect(page.getByText("1h 45m planned", { exact: true })).toBeVisible();
  await dragToTime(
    page,
    page.getByRole("button", { name: "Drag Deep work", exact: true }),
    page.getByRole("heading", { name: "Tomorrow" }),
  );
  await expect(page.getByText("1h 45m planned", { exact: true })).toBeVisible();
});

test("schedules from a touch tap and preserves the source when removing its block", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "This exercises the touch path.");
  await openBlocks(page);
  await page.getByRole("button", { name: "Create block at 9am", exact: true }).tap();
  await page.getByRole("button", { name: "Habit", exact: true }).tap();
  await page.getByLabel("Block name").fill("Stretch");
  await page.getByLabel("Block end").fill("09:30");
  await page.getByRole("button", { name: "Create block", exact: true }).tap();
  await page.getByRole("button", { name: "Edit Stretch, 9am to 9:30am" }).tap();
  await page.getByRole("button", { name: "Remove from day", exact: true }).tap();
  await expect(page.getByRole("button", { name: "Edit Stretch, 9am to 9:30am" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit Stretch", exact: true })).toBeVisible();
});

test("shows the three-column design, logs progress across apps, and jumps to a date", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const date = await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const timestamp = now.toISOString();
    const tasks = {
      launch: {
        id: "launch",
        title: "Plan the launch",
        priority: 0,
        status: "in-progress",
        estimate: { amount: 30, unit: "minutes" },
        dueOn: date,
        description: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      brief: {
        id: "brief",
        title: "Write the brief",
        priority: 1,
        status: "not-started",
        estimate: null,
        dueOn: null,
        description: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      notes: {
        id: "notes",
        title: "Review notes",
        priority: 2,
        status: "on-hold",
        estimate: { amount: 45, unit: "minutes" },
        dueOn: date,
        description: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    };
    const habits = [
      {
        id: "read",
        name: "Read",
        icon: "book",
        color: "teal",
        logType: "checkbox",
        createdAt: timestamp,
      },
      {
        id: "energy",
        name: "Energy",
        icon: "zap",
        color: "violet",
        logType: "level",
        estimateMinutes: 30,
        createdAt: timestamp,
      },
      {
        id: "water",
        name: "Water",
        icon: "water",
        color: "blue",
        logType: "number",
        createdAt: timestamp,
      },
    ];
    const routines = [
      { id: "wake", title: "Wake up", category: "marker", icon: "sun", start: 480, end: 480 },
      {
        id: "breakfast",
        title: "Breakfast",
        category: "routine",
        icon: "utensils",
        start: 480,
        end: 510,
      },
      { id: "lunch", title: "Lunch", category: "routine", icon: "salad", start: 720, end: 750 },
    ];
    const blocks = [
      {
        id: "launch-block",
        category: "todo",
        sourceId: "launch",
        title: "Plan the launch",
        start: 540,
        end: 570,
      },
      {
        id: "brief-block",
        category: "todo",
        sourceId: "brief",
        title: "Write the brief",
        start: 645,
        end: 675,
      },
      {
        id: "read-block",
        category: "habit",
        sourceId: "read",
        title: "Read",
        start: 510,
        end: 525,
      },
      {
        id: "energy-block",
        category: "habit",
        sourceId: "energy",
        title: "Energy",
        start: 600,
        end: 630,
      },
      {
        id: "water-block",
        category: "habit",
        sourceId: "water",
        title: "Water",
        start: 690,
        end: 705,
      },
    ];
    localStorage.setItem(
      "seiri.tasks.v1",
      JSON.stringify({
        version: 2,
        state: { tasks, activeOrder: ["launch", "brief", "notes"], archiveOrder: [] },
      }),
    );
    localStorage.setItem(
      "seiri.habits.v1",
      JSON.stringify({ version: 1, state: { habits, logs: {} } }),
    );
    localStorage.setItem(
      "seiri.blocks.v1",
      JSON.stringify({
        version: 1,
        state: {
          wakingHours: { start: 480, end: 1440 },
          routines,
          days: { [date]: { blocks, omittedRoutineIds: [] } },
        },
      }),
    );
    return date;
  });
  await page.reload();
  await page.getByRole("tab", { name: "blocks" }).click();
  await expect(page.getByRole("button", { name: "Edit Wake up, at 8am" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Read", exact: true })).toContainText("0m");
  if (!isMobile) {
    const todo = await page.getByRole("region", { name: "Todos to schedule" }).boundingBox();
    const habit = await page.getByRole("region", { name: "Habits to schedule" }).boundingBox();
    const timeline = await page.locator(".blocks-timeline-panel").boundingBox();
    expect(todo!.x + todo!.width).toBeLessThan(timeline!.x);
    expect(habit!.x).toBeGreaterThan(timeline!.x + timeline!.width);
    expect(timeline!.width).toBeGreaterThanOrEqual(480);
    expect(timeline!.width).toBeLessThan(540);
    expect(todo!.width).toBeLessThan(280);
    expect(habit!.width).toBeLessThan(280);
    expect(
      Math.abs(timeline!.x + timeline!.width / 2 - page.viewportSize()!.width / 2),
    ).toBeLessThan(2);
    await expect(
      page.getByRole("button", { name: "Edit Plan the launch, 9am to 9:30am" }).locator("strong"),
    ).toHaveCSS("font-size", "15px");
  }
  await page.screenshot({
    path: `test-results/blocks-redesign-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("checkbox", { name: `Read on ${date}` }).click();
  await expect(page.getByRole("checkbox", { name: `Read on ${date}` })).toHaveCSS(
    "background-color",
    "rgb(106, 212, 207)",
  );
  const energyLog = page.getByRole("button", { name: `Energy on ${date}` });
  for (let level = 0; level < 3; level++) await energyLog.click();
  await expect(energyLog.locator(".habit-level-fill")).toHaveCount(1);
  await page.getByRole("spinbutton", { name: `Water on ${date}`, exact: true }).fill("8");
  await expect(
    page
      .getByRole("button", { name: "Edit Plan the launch, 9am to 9:30am" })
      .locator(".blocks-scheduled-icon .lucide-check"),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Complete Plan the launch" }).click();
  await page.getByRole("button", { name: "Kill Write the brief" }).click();
  await page.getByRole("tab", { name: "todo" }).click();
  await page.getByRole("tab", { name: /Archive/ }).click();
  await expect(page.getByText("Plan the launch", { exact: true })).toBeVisible();
  await expect(page.getByText("Write the brief", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "habits" }).click();
  await expect(page.getByRole("checkbox", { name: `Read on ${date}` })).toBeChecked();
  await expect(page.getByLabel(`Water on ${date}`)).toHaveValue("8");
  await page.getByRole("tab", { name: "blocks" }).click();
  const logs = await page.evaluate(
    () => JSON.parse(localStorage.getItem("seiri.habits.v1")!).state.logs,
  );
  expect(logs[date]).toMatchObject({ read: true, energy: 3, water: 8 });
  await page.getByRole("button", { name: "Choose day" }).click();
  const calendar = page.locator(".blocks-calendar");
  const calendarBox = await calendar.boundingBox();
  const gridBox = await calendar.locator(".rdp-month_grid").boundingBox();
  const captionBox = await calendar.locator(".rdp-caption_label").boundingBox();
  expect(
    Math.abs(gridBox!.x + gridBox!.width / 2 - (calendarBox!.x + calendarBox!.width / 2)),
  ).toBeLessThan(2);
  expect(captionBox!.x).toBeGreaterThan(gridBox!.x + 4);
  expect(captionBox!.x).toBeLessThan(gridBox!.x + 18);
  const toolbarBox = await page.locator(".blocks-toolbar").boundingBox();
  expect(toolbarBox!.height).toBeLessThan(isMobile ? 100 : 60);
  await page.screenshot({
    path: `test-results/blocks-calendar-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.locator(".blocks-calendar .rdp-day_button").filter({ hasText: /^15$/ }).click();
  await expect(page.locator(".blocks-day-display strong")).toHaveText("15");
  await expect(page.locator(".blocks-calendar")).toHaveCount(0);
  const sizes = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    window: innerWidth,
  }));
  expect(sizes.document).toBeLessThanOrEqual(sizes.window);
});

test("edits shared habit estimates and drags from the card body", async ({ page, isMobile }) => {
  await openBlocks(page);
  await createBlock(page, "Habit", "Stretch", "08:00", "08:15");
  await page.getByRole("button", { name: "Edit Stretch", exact: true }).click();
  await expect(page.getByLabel("Habit time estimate")).toHaveValue("15");
  await page.getByLabel("Habit time estimate").fill("45");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Edit Stretch", exact: true })).toContainText(
    "45m",
  );
  await page.getByRole("tab", { name: "habits" }).click();
  await page.getByRole("button", { name: "Edit Stretch", exact: true }).click();
  await expect(page.getByLabel("Habit time estimate")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("tab", { name: "blocks" }).click();
  await page.getByRole("button", { name: "Next day" }).click();
  const card = page.getByRole("button", { name: "Edit Stretch", exact: true });
  if (isMobile) {
    await card.tap();
    await expect(page.getByRole("dialog", { name: "Edit habit" })).toBeVisible();
  } else {
    await dragToTime(
      page,
      card.locator("strong"),
      page.getByRole("button", { name: "Create block at 9am", exact: true }),
    );
    await expect(page.getByRole("button", { name: "Edit Stretch, 9am to 9:45am" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await dragToTime(
      page,
      page.getByRole("button", { name: "Edit Stretch, 9am to 9:45am" }).locator("strong"),
      page.getByRole("button", { name: "Create block at 10am", exact: true }),
    );
    await expect(page.getByRole("button", { name: "Edit Stretch, 10am to 10:45am" })).toBeVisible();
  }
});

test("habits default to zero minutes and can gain or release time in Blocks", async ({
  page,
  isMobile,
}) => {
  await openBlocks(page);
  await createBlock(page, "Event", "Work", "08:00", "09:00");
  await page.getByRole("button", { name: "New block", exact: true }).click();
  await page.getByRole("button", { name: "Habit", exact: true }).click();
  await expect(page.getByLabel("Habit time estimate")).toHaveValue("0");
  await page.getByLabel("Block name").fill("Stretch");
  await page.getByLabel("Block start").fill("08:00");
  await expect(page.getByLabel("Block end")).toHaveValue("08:00");
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  const card = page.getByRole("button", { name: "Edit Stretch", exact: true });
  await expect(card).toContainText("0m");
  await expect(page.getByRole("button", { name: "Edit Stretch, at 8am" })).toBeVisible();
  await expect(page.locator(".blocks-summary")).toContainText("1h planned");
  await page.getByRole("button", { name: "Connected timeline", exact: true }).click();
  const point = page.getByRole("button", { name: "Edit Stretch, at 8am" });
  const icon = await point.locator(".blocks-connected-icon").boundingBox();
  expect(icon!.width).toBe(icon!.height);
  const checkbox = page.locator(".blocks-connected").getByRole("checkbox");
  await checkbox.click();
  await point.click();
  await page.getByLabel("Block start").fill("09:00");
  await page.getByLabel("Habit time estimate").fill("30");
  await expect(page.getByLabel("Block end")).toHaveValue("09:30");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(card).toContainText("30m");
  await expect(page.getByRole("button", { name: "Edit Stretch, 9am to 9:30am" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Stretch, 9am to 9:30am" }).click();
  await page.getByLabel("Habit time estimate").fill("0");
  await expect(page.getByLabel("Block end")).toHaveValue("09:00");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(checkbox).toBeChecked();
  await expect(card).toContainText("0m");
  await page.reload();
  await page.getByRole("tab", { name: "blocks" }).click();
  await expect(page.getByRole("button", { name: "Edit Stretch, at 9am" })).toBeVisible();
  await page.getByRole("button", { name: "Grid timeline", exact: true }).click();
  await page.getByRole("button", { name: "Next day", exact: true }).click();
  if (!isMobile) {
    await dragToTime(
      page,
      card.locator("strong"),
      page.getByRole("button", { name: "Create block at 8am", exact: true }),
    );
    await expect(page.getByRole("button", { name: "Edit Stretch, at 8am" })).toBeVisible();
  }
});

test("resets saved habit estimates once and keeps duration editing in Blocks", async ({ page }) => {
  await page.goto("/");
  const date = await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      "seiri.habits.v1",
      JSON.stringify({
        version: 1,
        state: {
          habits: [
            {
              id: "read",
              name: "Read",
              icon: "book",
              color: "teal",
              logType: "checkbox",
              estimateMinutes: 45,
              createdAt: now.toISOString(),
            },
          ],
          logs: { [date]: { read: true } },
        },
      }),
    );
    return date;
  });
  await page.reload();
  await page.getByRole("tab", { name: "blocks" }).click();
  await page.getByRole("button", { name: "Start planning" }).click();
  await expect(page.getByRole("button", { name: "Edit Read", exact: true })).toContainText("0m");
  await page.getByRole("button", { name: "Edit Read", exact: true }).click();
  await page.getByLabel("Habit time estimate").fill("30");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.getByRole("tab", { name: "habits" }).click();
  await expect(page.getByRole("checkbox", { name: `Read on ${date}`, exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Edit Read", exact: true }).click();
  await expect(page.getByLabel("Habit time estimate")).toHaveCount(0);
  await page.getByLabel("Name", { exact: true }).fill("Pages");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await page.reload();
  await page.getByRole("tab", { name: "blocks" }).click();
  await expect(page.getByRole("button", { name: "Edit Pages", exact: true })).toContainText("30m");
});
