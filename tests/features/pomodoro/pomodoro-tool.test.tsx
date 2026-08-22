import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

    expect(screen.getByRole("dialog", { name: "Timer settings" }))
      .toBeVisible();
    expect(document.querySelector(".pomodoro-settings-overlay"))
      .toBeVisible();

    const focus = screen.getByLabelText("Focus duration in minutes");
    const shortBreak = screen.getByLabelText("Short break duration in minutes");
    const longBreak = screen.getByLabelText("Long break duration in minutes");
    const rounds = screen.getByLabelText("Focus rounds");
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

    fireEvent.change(focus, { target: { value: "40" } });
    fireEvent.change(rounds, { target: { value: "6" } });
    expect(screen.getByText("40:00")).toBeVisible();
    expect(document.querySelectorAll(".pomodoro-focus-dots > span"))
      .toHaveLength(6);
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
});
