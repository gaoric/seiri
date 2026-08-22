export type PomodoroSession = {
  kind: "focus" | "short-break" | "long-break";
  label: string;
  durationSeconds: number;
  cycle: number;
};

export type PomodoroSettings = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  rounds: number;
  autoStart: boolean;
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  rounds: 4,
  autoStart: false,
};

export function createPomodoroSessions(
  settings: PomodoroSettings,
): PomodoroSession[] {
  return Array.from({ length: settings.rounds }, (_, index) => {
    const cycle = index + 1;
    const breakSession: PomodoroSession = cycle === settings.rounds
      ? {
          kind: "long-break",
          label: "Long break",
          durationSeconds: settings.longBreakMinutes * 60,
          cycle,
        }
      : {
          kind: "short-break",
          label: "Short break",
          durationSeconds: settings.shortBreakMinutes * 60,
          cycle,
        };

    return [
      {
        kind: "focus" as const,
        label: "Focus",
        durationSeconds: settings.focusMinutes * 60,
        cycle,
      },
      breakSession,
    ];
  }).flat();
}

export const POMODORO_SESSIONS = createPomodoroSessions(
  DEFAULT_POMODORO_SETTINGS,
);

export function nextSessionIndex(
  currentIndex: number,
  sessionCount = POMODORO_SESSIONS.length,
) {
  return (currentIndex + 1) % sessionCount;
}

export function formatPomodoroTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
