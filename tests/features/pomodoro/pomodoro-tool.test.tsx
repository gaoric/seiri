import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { App } from "@/app/App";

describe("pomodoro timer", () => {
  test("starts and pauses from an icon-only control", () => {
    render(<App />);
    const todoTab = screen.getByRole("tab", { name: "todo" });
    const pomoTab = screen.getByRole("tab", { name: "pomo" });
    expect(todoTab).toHaveAttribute("data-active", "");
    fireEvent.click(pomoTab);
    expect(pomoTab).toHaveAttribute("data-active", "");

    expect(screen.getByText("25:00")).toBeVisible();
    expect(screen.getByText("Focus")).toBeVisible();
    expect(screen.getByRole("button", { name: "Skip focus" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset current timer" }))
      .toBeVisible();
    expect(screen.getByRole("button", { name: "Reset Pomodoro session" }))
      .toBeVisible();
    expect(document.querySelectorAll(".pomodoro-focus-dots > span"))
      .toHaveLength(4);
    expect(document.querySelectorAll(".pomodoro-focus-dots .is-active"))
      .toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    expect(screen.getByRole("button", { name: "Pause timer" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Skip focus" }))
      .toBeVisible();
    expect(document.querySelectorAll(".pomodoro-focus-dots .is-active"))
      .toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Pause timer" }));
    expect(screen.getByRole("button", { name: "Skip focus" })).toBeVisible();
    expect(document.querySelectorAll(".pomodoro-focus-dots .is-active"))
      .toHaveLength(1);
  });

  test("skips through short breaks to the fourth-cycle long break", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));

    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));
    expect(screen.getByText("Short break")).toBeVisible();
    expect(screen.getByText("05:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Skip short break" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip short break" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip short break" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));

    expect(screen.getByText("Long break")).toBeVisible();
    expect(screen.getByText("15:00")).toBeVisible();
    expect(document.querySelectorAll(".pomodoro-focus-dots .is-active"))
      .toHaveLength(4);
  });

  test("resets only the current session and pauses it", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));
    fireEvent.click(screen.getByRole("button", { name: "Reset current timer" }));

    expect(screen.getByText("Short break")).toBeVisible();
    expect(screen.getByText("05:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("progressbar", { name: "Short break progress" }))
      .toHaveAttribute("aria-valuenow", "0");
  });

  test("resets the full session to the first focus round", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reset Pomodoro session" }),
    );

    expect(screen.getByText("Focus")).toBeVisible();
    expect(screen.getByText("25:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll(".pomodoro-focus-dots .is-active"))
      .toHaveLength(0);
  });

  test("seeks to the clicked point on the timer ring", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    const ring = screen.getByRole("progressbar", { name: "Focus progress" });
    Object.defineProperty(ring, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 200,
        width: 200,
        height: 200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
      }),
    });

    fireEvent.click(ring, { clientX: 100, clientY: 200 });

    expect(screen.getByText("12:30")).toBeVisible();
    expect(ring).toHaveAttribute("aria-valuenow", "50");
  });

  test("adjusts timer settings within their supported ranges", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    const settingsButton = screen.getByRole("button", {
      name: "Pomodoro settings",
    });
    const soundButton = screen.getByRole("button", {
      name: /Mute sounds|Enable sounds/,
    });
    expect(settingsButton.nextElementSibling).toBe(soundButton);
    await act(async () => {
      fireEvent.click(settingsButton);
      await Promise.resolve();
    });

    expect(screen.getByRole("dialog", { name: "Pomodoro settings" }))
      .toBeVisible();
    expect(document.querySelector(".pomodoro-settings-overlay"))
      .toBeVisible();
    expect(screen.getByRole("heading", { name: "Timer" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Alarm" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Themes" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Shortcuts" })).toBeVisible();

    const focus = screen.getByLabelText("Focus duration in minutes");
    const shortBreak = screen.getByLabelText("Short break duration in minutes");
    const longBreak = screen.getByLabelText("Long break duration in minutes");
    const rounds = screen.getByLabelText("Focus rounds");
    const alarm = screen.getByRole("radiogroup", { name: "Alarm sound" });
    const alarmOptions = within(alarm).getAllByRole("radio");
    const themes = screen.getByRole("radiogroup", { name: "Timer color" });
    const alarmVolume = screen.getByRole("slider", { name: "Alarm volume" });
    expect(focus).toHaveAttribute("type", "range");
    expect(focus).toHaveAttribute("min", "5");
    expect(focus).toHaveAttribute("max", "90");
    expect(shortBreak).toHaveAttribute("type", "range");
    expect(shortBreak).toHaveAttribute("min", "1");
    expect(shortBreak).toHaveAttribute("max", "30");
    expect(longBreak).toHaveAttribute("type", "range");
    expect(longBreak).toHaveAttribute("min", "1");
    expect(longBreak).toHaveAttribute("max", "60");
    expect(rounds).toHaveAttribute("type", "range");
    expect(rounds).toHaveAttribute("min", "1");
    expect(rounds).toHaveAttribute("max", "8");
    expect(alarmVolume).toHaveAttribute("min", "0");
    expect(alarmVolume).toHaveAttribute("max", "100");
    expect(alarmOptions.map((option) => option.textContent)).toEqual([
      "Flute",
      "Bells",
      "Birds",
      "Marimba",
      "Ring",
    ]);
    expect(alarmOptions[0]).toHaveAttribute("aria-checked", "true");
    expect(within(themes).getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("button", {
      name: "Set play / pause shortcut",
    })).toHaveTextContent("Space");

    fireEvent.change(focus, { target: { value: "40" } });
    fireEvent.change(rounds, { target: { value: "6" } });
    fireEvent.click(within(alarm).getByRole("radio", { name: "Marimba" }));
    fireEvent.change(alarmVolume, { target: { value: "45" } });
    fireEvent.click(within(themes).getByRole("radio", { name: "Sage" }));
    expect(screen.getByText("40:00")).toBeVisible();
    expect(within(alarm).getByRole("radio", { name: "Marimba" }))
      .toHaveAttribute("aria-checked", "true");
    expect(alarmVolume).toHaveValue("45");
    expect(within(themes).getByRole("radio", { name: "Sage" }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Pomodoro timer"))
      .toHaveStyle("--pomodoro-accent: #a8d5ba");
    expect(document.querySelectorAll(".pomodoro-focus-dots > span"))
      .toHaveLength(6);
  });

  test("supports timer keyboard shortcuts only from the Pomodoro tab", () => {
    render(<App />);

    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    expect(screen.getByRole("button", { name: "Pause timer" }))
      .toHaveAttribute("aria-pressed", "true");

    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(document.body, { key: "s", code: "KeyS" });
    expect(screen.getByText("Short break")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.keyDown(document.body, { key: "r", code: "KeyR" });
    expect(screen.getByText("05:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");

    fireEvent.keyDown(document.body, {
      key: "R",
      code: "KeyR",
      shiftKey: true,
    });
    expect(screen.getByText("Focus")).toBeVisible();
    expect(screen.getByText("25:00")).toBeVisible();
  });

  test("customizes timer keyboard shortcuts from settings", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Pomodoro settings" }),
      );
      await Promise.resolve();
    });

    const playShortcut = screen.getByRole("button", {
      name: "Set play / pause shortcut",
    });
    fireEvent.click(playShortcut);
    expect(playShortcut).toHaveTextContent("Press key…");
    fireEvent.keyDown(playShortcut, { key: "p", code: "KeyP" });
    expect(playShortcut).toHaveTextContent("P");
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    const settingsButton = screen.getByRole("button", {
      name: "Pomodoro settings",
    });

    fireEvent.keyDown(document.body, { key: " ", code: "Space" });
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");

    settingsButton.focus();
    fireEvent.keyDown(settingsButton, { key: "p", code: "KeyP" });
    expect(screen.getByRole("button", { name: "Pause timer" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pause timer" }))
      .toHaveAttribute("aria-keyshortcuts", "P");
  });

  test("auto-start continues into a skipped session when enabled", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Pomodoro settings" }),
      );
      await Promise.resolve();
    });
    const autoStart = screen.getByRole("switch", {
      name: "Auto-start sessions",
    });
    expect(autoStart).toHaveAttribute("aria-checked", "false");
    fireEvent.click(autoStart);
    expect(autoStart).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));

    fireEvent.click(screen.getByRole("button", { name: "Start timer" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));

    expect(screen.getByText("Short break")).toBeVisible();
    expect(screen.getByRole("button", { name: "Pause timer" }))
      .toHaveAttribute("aria-pressed", "true");
  });

  test("restores all Pomodoro preferences when the app reopens", async () => {
    const firstVisit = render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pomodoro settings" }));
      await Promise.resolve();
    });

    fireEvent.change(screen.getByLabelText("Focus duration in minutes"), {
      target: { value: "40" },
    });
    fireEvent.change(screen.getByLabelText("Short break duration in minutes"), {
      target: { value: "8" },
    });
    fireEvent.change(screen.getByLabelText("Long break duration in minutes"), {
      target: { value: "20" },
    });
    fireEvent.change(screen.getByLabelText("Focus rounds"), {
      target: { value: "6" },
    });
    fireEvent.click(screen.getByRole("switch", { name: "Auto-start sessions" }));
    fireEvent.click(screen.getByRole("radio", { name: "Ring" }));
    fireEvent.change(screen.getByLabelText("Alarm volume"), {
      target: { value: "0" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Teal" }));
    const playShortcut = screen.getByRole("button", {
      name: "Set play / pause shortcut",
    });
    fireEvent.click(playShortcut);
    fireEvent.keyDown(playShortcut, { key: "p", code: "KeyP" });
    fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip focus" }));
    firstVisit.unmount();

    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    expect(screen.getByText("40:00")).toBeVisible();
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-keyshortcuts", "P");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Pomodoro settings" }));
      await Promise.resolve();
    });
    expect(screen.getByLabelText("Focus duration in minutes")).toHaveValue("40");
    expect(screen.getByLabelText("Short break duration in minutes"))
      .toHaveValue("8");
    expect(screen.getByLabelText("Long break duration in minutes"))
      .toHaveValue("20");
    expect(screen.getByLabelText("Focus rounds")).toHaveValue("6");
    expect(screen.getByRole("switch", { name: "Auto-start sessions" }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Ring" }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByLabelText("Alarm volume")).toHaveValue("0");
    expect(screen.getByRole("radio", { name: "Teal" }))
      .toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Set play / pause shortcut" }))
      .toHaveTextContent("P");
  });

  test.each([
    "invalid json",
    JSON.stringify({
      settings: { focusMinutes: -1, rounds: 0 },
      alarmSound: "missing",
      alarmVolume: 999,
      timerColor: "invalid",
      shortcuts: { toggle: null },
    }),
  ])("uses safe defaults for invalid saved settings: %s", (stored) => {
    localStorage.setItem("seiri.pomodoro.settings", stored);
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "pomo" }));
    expect(screen.getByText("25:00")).toBeVisible();
    expect(document.querySelectorAll(".pomodoro-focus-dots > span"))
      .toHaveLength(4);
    expect(screen.getByRole("button", { name: "Start timer" }))
      .toHaveAttribute("aria-keyshortcuts", "Space");
  });
});
