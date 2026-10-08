import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  BellRing,
  Clock3,
  Keyboard,
  ListRestart,
  Palette,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  createPomodoroSessions,
  DEFAULT_POMODORO_SETTINGS,
  formatPomodoroTime,
  nextSessionIndex,
  type PomodoroSettings,
} from "@/features/pomodoro/pomodoro-utils";
import {
  bellDelaySound,
  fluteNotificationSound,
  forestBirdsSound,
  happyBellsSound,
  magicMarimbaSound,
} from "./pomodoro-alarm-assets";
import { useSound } from "@/shared/sound/use-sound";

type TimingSetting = Exclude<keyof PomodoroSettings, "autoStart">;
type AlarmSound = "flute" | "birds" | "bells" | "marimba" | "delay-bell";
type ShortcutAction = "toggle" | "skip" | "reset" | "resetSession";
type Shortcut = {
  code: string;
  keyLabel: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

const ALARM_OPTIONS: ReadonlyArray<{ value: AlarmSound; label: string }> = [
  { value: "flute", label: "Flute" },
  { value: "bells", label: "Bells" },
  { value: "birds", label: "Birds" },
  { value: "marimba", label: "Marimba" },
  { value: "delay-bell", label: "Ring" },
];

const TIMER_THEMES = [
  { value: "#f5f5f4", label: "White" },
  { value: "#a8d5ba", label: "Sage" },
  { value: "#9dc4e8", label: "Sky" },
  { value: "#e7c27d", label: "Amber" },
  { value: "#dfa7b3", label: "Rose" },
  { value: "#c5b4e3", label: "Lilac" },
  { value: "#e7a08b", label: "Coral" },
  { value: "#78c6c0", label: "Teal" },
] as const;

const DEFAULT_SHORTCUTS: Record<ShortcutAction, Shortcut> = {
  toggle: createShortcut("Space", "Space"),
  skip: createShortcut("KeyS", "S"),
  reset: createShortcut("KeyR", "R"),
  resetSession: createShortcut("KeyR", "R", { shiftKey: true }),
};

const SHORTCUT_OPTIONS: ReadonlyArray<{
  action: ShortcutAction;
  label: string;
}> = [
  { action: "toggle", label: "Play / pause" },
  { action: "skip", label: "Skip session" },
  { action: "reset", label: "Reset current" },
  { action: "resetSession", label: "Reset session" },
];

const POMODORO_SETTINGS_STORAGE_KEY = "seiri.pomodoro.settings";

type PomodoroPreferences = {
  settings: PomodoroSettings;
  alarmSound: AlarmSound;
  alarmVolume: number;
  timerColor: string;
  shortcuts: Record<ShortcutAction, Shortcut>;
};

function loadPomodoroPreferences(): PomodoroPreferences {
  const defaults: PomodoroPreferences = {
    settings: DEFAULT_POMODORO_SETTINGS,
    alarmSound: "flute",
    alarmVolume: 65,
    timerColor: TIMER_THEMES[0].value,
    shortcuts: DEFAULT_SHORTCUTS,
  };

  try {
    const stored: Partial<PomodoroPreferences> | null = JSON.parse(
      window.localStorage.getItem(POMODORO_SETTINGS_STORAGE_KEY) ?? "null",
    );
    if (!stored || typeof stored !== "object") return defaults;

    const timing = stored.settings;
    const shortcuts = stored.shortcuts;
    const hasValidShortcuts = shortcuts && SHORTCUT_OPTIONS.every(
      ({ action }) => isShortcut(shortcuts[action]),
    ) && SHORTCUT_OPTIONS.every(({ action }, index) =>
      SHORTCUT_OPTIONS.slice(index + 1).every(({ action: otherAction }) =>
        !shortcutsMatch(shortcuts[action], shortcuts[otherAction]),
      ),
    );

    return {
      settings: {
        focusMinutes: savedNumber(timing?.focusMinutes, 5, 90, 25),
        shortBreakMinutes: savedNumber(timing?.shortBreakMinutes, 1, 30, 5),
        longBreakMinutes: savedNumber(timing?.longBreakMinutes, 1, 60, 15),
        rounds: savedNumber(timing?.rounds, 1, 8, 4),
        autoStart: typeof timing?.autoStart === "boolean"
          ? timing.autoStart
          : defaults.settings.autoStart,
      },
      alarmSound: ALARM_OPTIONS.some(({ value }) => value === stored.alarmSound)
        ? stored.alarmSound!
        : defaults.alarmSound,
      alarmVolume: savedNumber(stored.alarmVolume, 0, 100, defaults.alarmVolume),
      timerColor: TIMER_THEMES.some(({ value }) => value === stored.timerColor)
        ? stored.timerColor!
        : defaults.timerColor,
      shortcuts: hasValidShortcuts ? shortcuts : defaults.shortcuts,
    };
  } catch {
    return defaults;
  }
}

function savedNumber(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === "number" && Number.isInteger(value) &&
    value >= min && value <= max ? value : fallback;
}

function isShortcut(value: unknown): value is Shortcut {
  if (!value || typeof value !== "object") return false;
  const shortcut = value as Partial<Shortcut>;
  return typeof shortcut.code === "string" && shortcut.code.length > 0 &&
    typeof shortcut.keyLabel === "string" && shortcut.keyLabel.length > 0 &&
    typeof shortcut.altKey === "boolean" &&
    typeof shortcut.ctrlKey === "boolean" &&
    typeof shortcut.metaKey === "boolean" &&
    typeof shortcut.shiftKey === "boolean";
}

type PomodoroToolProps = {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
  soundEnabled: boolean;
  isActive: boolean;
};

export function PomodoroTool({
  settingsOpen,
  onSettingsOpenChange,
  soundEnabled,
  isActive,
}: PomodoroToolProps) {
  const [savedPreferences] = useState(loadPomodoroPreferences);
  const [settings, setSettings] = useState(savedPreferences.settings);
  const [alarmSound, setAlarmSound] = useState(savedPreferences.alarmSound);
  const [alarmVolume, setAlarmVolume] = useState(savedPreferences.alarmVolume);
  const [timerColor, setTimerColor] = useState(savedPreferences.timerColor);
  const [shortcuts, setShortcuts] = useState(savedPreferences.shortcuts);
  const [recordingShortcut, setRecordingShortcut] =
    useState<ShortcutAction | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        POMODORO_SETTINGS_STORAGE_KEY,
        JSON.stringify({ settings, alarmSound, alarmVolume, timerColor, shortcuts }),
      );
    } catch {
      // Keep the timer usable when browser storage is unavailable or full.
    }
  }, [settings, alarmSound, alarmVolume, timerColor, shortcuts]);
  const alarmPlaybackOptions = {
    volume: alarmVolume / 100,
    interrupt: true,
    soundEnabled,
    normalizeVolume: true,
  } as const;
  const [playFlute, { stop: stopFlute }] = useSound(
    fluteNotificationSound,
    alarmPlaybackOptions,
  );
  const [playBirds, { stop: stopBirds }] = useSound(
    forestBirdsSound,
    alarmPlaybackOptions,
  );
  const [playBells, { stop: stopBells }] = useSound(
    happyBellsSound,
    alarmPlaybackOptions,
  );
  const [playMarimba, { stop: stopMarimba }] = useSound(
    magicMarimbaSound,
    alarmPlaybackOptions,
  );
  const [playDelayBell, { stop: stopDelayBell }] = useSound(
    bellDelaySound,
    alarmPlaybackOptions,
  );
  const stopAlarms = useCallback(() => {
    stopFlute();
    stopBells();
    stopBirds();
    stopMarimba();
    stopDelayBell();
  }, [stopBells, stopBirds, stopDelayBell, stopFlute, stopMarimba]);
  const playAlarm = useCallback(
    (sound: AlarmSound = alarmSound) => {
      stopAlarms();
      if (sound === "flute") playFlute();
      if (sound === "birds") playBirds();
      if (sound === "bells") playBells();
      if (sound === "marimba") playMarimba();
      if (sound === "delay-bell") playDelayBell();
    },
    [
      alarmSound,
      playBells,
      playBirds,
      playDelayBell,
      playFlute,
      playMarimba,
      stopAlarms,
    ],
  );
  const sessions = useMemo(
    () => createPomodoroSessions(settings),
    [
      settings.focusMinutes,
      settings.longBreakMinutes,
      settings.rounds,
      settings.shortBreakMinutes,
    ],
  );
  const [sessionIndex, setSessionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(
    savedPreferences.settings.focusMinutes * 60,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [hasStartedSession, setHasStartedSession] = useState(false);
  const endAt = useRef(0);
  const session = sessions[sessionIndex];
  const elapsed = session.durationSeconds - secondsLeft;
  const progress = Math.min(1, Math.max(0, elapsed / session.durationSeconds));

  useEffect(() => {
    if (!isRunning) return;

    const update = () => {
      const remaining = Math.max(
        0,
        Math.ceil((endAt.current - Date.now()) / 1000),
      );

      if (remaining > 0) {
        setSecondsLeft(remaining);
        return;
      }

      playAlarm();
      setSessionIndex((currentIndex) => {
        const nextIndex = nextSessionIndex(currentIndex, sessions.length);
        const nextDuration = sessions[nextIndex].durationSeconds;
        endAt.current = settings.autoStart
          ? Date.now() + nextDuration * 1000
          : 0;
        setSecondsLeft(nextDuration);
        setHasStartedSession(settings.autoStart);
        setIsRunning(settings.autoStart);
        return nextIndex;
      });
    };

    update();
    const interval = window.setInterval(update, 250);
    return () => window.clearInterval(interval);
  }, [isRunning, playAlarm, sessions, settings.autoStart]);

  function toggleTimer() {
    if (isRunning) {
      setSecondsLeft(
        Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000)),
      );
      setIsRunning(false);
      return;
    }

    endAt.current = Date.now() + secondsLeft * 1000;
    setHasStartedSession(true);
    setIsRunning(true);
  }

  function skipSession() {
    const nextIndex = nextSessionIndex(sessionIndex, sessions.length);
    const nextDuration = sessions[nextIndex].durationSeconds;
    setSessionIndex(nextIndex);
    setSecondsLeft(nextDuration);
    setHasStartedSession(settings.autoStart);
    setIsRunning(settings.autoStart);
    endAt.current = settings.autoStart
      ? Date.now() + nextDuration * 1000
      : 0;
  }

  function resetSession() {
    setIsRunning(false);
    setSecondsLeft(session.durationSeconds);
    setHasStartedSession(false);
    endAt.current = 0;
  }

  function resetPomodoroSession() {
    setSessionIndex(0);
    setSecondsLeft(sessions[0].durationSeconds);
    setIsRunning(false);
    setHasStartedSession(false);
    endAt.current = 0;
  }

  function seekSession(event: ReactMouseEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const offsetX = event.clientX - centerX;
    const offsetY = event.clientY - centerY;
    const radius = bounds.width / 2;
    const distance = Math.hypot(offsetX, offsetY);

    if (distance < radius - 16 || distance > radius + 4) return;

    const angle = Math.atan2(offsetX, -offsetY);
    const fraction = (angle < 0 ? angle + Math.PI * 2 : angle) / (Math.PI * 2);
    const elapsedSeconds = Math.round(session.durationSeconds * fraction);
    const remaining = session.durationSeconds - elapsedSeconds;
    setSecondsLeft(remaining);
    setHasStartedSession(elapsedSeconds > 0);
    if (isRunning) endAt.current = Date.now() + remaining * 1000;
  }

  function updateTimingSetting(key: TimingSetting, value: number) {
    const nextSettings = { ...settings, [key]: value };
    setSettings(nextSettings);
    setSessionIndex(0);
    setSecondsLeft(nextSettings.focusMinutes * 60);
    setIsRunning(false);
    setHasStartedSession(false);
    endAt.current = 0;
  }

  function updateAutoStart() {
    setSettings((current) => ({
      ...current,
      autoStart: !current.autoStart,
    }));
  }

  function captureShortcut(
    action: ShortcutAction,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (event.key === "Escape") {
      setRecordingShortcut(null);
      return;
    }

    if (["Alt", "Control", "Meta", "Shift"].includes(event.key)) return;

    const nextShortcut = createShortcut(
      event.code,
      shortcutKeyLabel(event.key),
      event,
    );

    setShortcuts((current) => {
      const duplicate = SHORTCUT_OPTIONS.find(
        ({ action: otherAction }) =>
          otherAction !== action &&
          shortcutsMatch(current[otherAction], nextShortcut),
      );
      if (!duplicate) return { ...current, [action]: nextShortcut };

      return {
        ...current,
        [duplicate.action]: current[action],
        [action]: nextShortcut,
      };
    });
    setRecordingShortcut(null);
  }

  useEffect(() => {
    if (!settingsOpen) setRecordingShortcut(null);
  }, [settingsOpen]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        !isActive ||
        settingsOpen ||
        event.defaultPrevented ||
        event.repeat
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest(
          'input, select, textarea, [contenteditable="true"]',
        )
      ) {
        return;
      }

      if (shortcutMatchesEvent(shortcuts.toggle, event)) {
        event.preventDefault();
        toggleTimer();
        return;
      }

      if (shortcutMatchesEvent(shortcuts.skip, event)) {
        event.preventDefault();
        skipSession();
        return;
      }

      if (shortcutMatchesEvent(shortcuts.resetSession, event)) {
        event.preventDefault();
        resetPomodoroSession();
        return;
      }

      if (shortcutMatchesEvent(shortcuts.reset, event)) {
        event.preventDefault();
        resetSession();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isActive,
    isRunning,
    secondsLeft,
    session,
    sessionIndex,
    sessions,
    settings.autoStart,
    settingsOpen,
    shortcuts,
  ]);

  const completedFocusSessions = session.kind === "focus"
    ? session.cycle - 1
    : session.cycle;

  const dialStyle = {
    "--pomodoro-progress": `${progress * 360}deg`,
    "--pomodoro-accent": timerColor,
  } as CSSProperties;

  return (
    <section
      className="pomodoro-tool"
      aria-label="Pomodoro timer"
      style={dialStyle}
    >
      <DialogPrimitive.Root
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="pomodoro-settings-overlay" />
          <DialogPrimitive.Popup className="pomodoro-settings-panel">
            <div className="pomodoro-settings-header">
              <DialogPrimitive.Title>Pomodoro settings</DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="pomodoro-settings-close"
                aria-label="Close settings"
              >
                <X />
              </DialogPrimitive.Close>
            </div>

            <section
              className="pomodoro-settings-section"
              aria-labelledby="pomodoro-timer-settings"
            >
              <h3 id="pomodoro-timer-settings">
                <Clock3 aria-hidden="true" />
                Timer
              </h3>
              <SettingSlider
                label="Focus"
                ariaLabel="Focus duration in minutes"
                value={settings.focusMinutes}
                min={5}
                max={90}
                onChange={(value) => updateTimingSetting("focusMinutes", value)}
              />
              <SettingSlider
                label="Short break"
                ariaLabel="Short break duration in minutes"
                value={settings.shortBreakMinutes}
                min={1}
                max={30}
                onChange={(value) =>
                  updateTimingSetting("shortBreakMinutes", value)
                }
              />
              <SettingSlider
                label="Long break"
                ariaLabel="Long break duration in minutes"
                value={settings.longBreakMinutes}
                min={1}
                max={60}
                onChange={(value) =>
                  updateTimingSetting("longBreakMinutes", value)
                }
              />
              <SettingSlider
                label="Rounds"
                ariaLabel="Focus rounds"
                value={settings.rounds}
                min={1}
                max={8}
                formatValue={(value) =>
                  `${value} ${value === 1 ? "round" : "rounds"}`
                }
                onChange={(value) => updateTimingSetting("rounds", value)}
              />
              <div className="pomodoro-setting-row">
                <span>Auto-start</span>
                <button
                  className="pomodoro-auto-start"
                  type="button"
                  role="switch"
                  aria-label="Auto-start sessions"
                  aria-checked={settings.autoStart}
                  onClick={updateAutoStart}
                >
                  <span />
                </button>
              </div>
            </section>

            <section
              className="pomodoro-settings-section"
              aria-labelledby="pomodoro-alarm-settings"
            >
              <h3 id="pomodoro-alarm-settings">
                <BellRing aria-hidden="true" />
                Alarm
              </h3>
              <div className="pomodoro-alarm-setting">
                <span>Sound</span>
                <div
                  className="pomodoro-alarm-options"
                  role="radiogroup"
                  aria-label="Alarm sound"
                >
                  {ALARM_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={alarmSound === option.value}
                      onClick={() => {
                        setAlarmSound(option.value);
                        playAlarm(option.value);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <SettingSlider
                label="Volume"
                ariaLabel="Alarm volume"
                value={alarmVolume}
                min={0}
                max={100}
                formatValue={(value) => `${value}%`}
                onChange={setAlarmVolume}
              />
            </section>

            <section
              className="pomodoro-settings-section"
              aria-labelledby="pomodoro-theme-settings"
            >
              <h3 id="pomodoro-theme-settings">
                <Palette aria-hidden="true" />
                Themes
              </h3>
              <div
                className="pomodoro-theme-options"
                role="radiogroup"
                aria-label="Timer color"
              >
                {TIMER_THEMES.map((theme) => (
                  <button
                    key={theme.value}
                    className="pomodoro-theme-option"
                    type="button"
                    role="radio"
                    aria-checked={timerColor === theme.value}
                    aria-label={theme.label}
                    title={theme.label}
                    style={{ "--theme-color": theme.value } as CSSProperties}
                    onClick={() => setTimerColor(theme.value)}
                  >
                    <span />
                  </button>
                ))}
              </div>
            </section>

            <section
              className="pomodoro-settings-section"
              aria-labelledby="pomodoro-shortcut-settings"
            >
              <h3 id="pomodoro-shortcut-settings">
                <Keyboard aria-hidden="true" />
                Shortcuts
              </h3>
              <p className="pomodoro-shortcut-help">
                Select a shortcut, then press a key.
              </p>
              <div className="pomodoro-shortcut-options">
                {SHORTCUT_OPTIONS.map(({ action, label }) => (
                  <div className="pomodoro-shortcut-setting" key={action}>
                    <span>{label}</span>
                    <button
                      type="button"
                      aria-label={`Set ${label.toLowerCase()} shortcut`}
                      aria-pressed={recordingShortcut === action}
                      onClick={() => setRecordingShortcut(action)}
                      onBlur={() =>
                        setRecordingShortcut((current) =>
                          current === action ? null : current,
                        )
                      }
                      onKeyDown={(event) => {
                        if (recordingShortcut === action) {
                          captureShortcut(action, event);
                        }
                      }}
                    >
                      {recordingShortcut === action
                        ? "Press key…"
                        : formatShortcut(shortcuts[action])}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="pomodoro-stage">
        <div
          className="pomodoro-dial"
          role="progressbar"
          aria-label={`${session.label} progress`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={formatPomodoroTime(secondsLeft)}
          onClick={seekSession}
        >
          <div className="pomodoro-dial-face">
            <span className="pomodoro-session">{session.label}</span>
            <time dateTime={`PT${secondsLeft}S`}>
              {formatPomodoroTime(secondsLeft)}
            </time>
            <span className="pomodoro-focus-dots" aria-label="Focus sessions">
              {Array.from(
                { length: settings.rounds },
                (_, index) => index + 1,
              ).map((focusSession) => {
                const active =
                  focusSession <= completedFocusSessions ||
                  (session.kind === "focus" &&
                    session.cycle === focusSession &&
                    hasStartedSession);
                return (
                  <span
                    key={focusSession}
                    className={active ? "is-active" : undefined}
                    aria-hidden="true"
                  />
                );
              })}
            </span>
          </div>
        </div>
      </div>

      <div className="pomodoro-controls">
        <button
          className="pomodoro-control pomodoro-reset-control"
          type="button"
          data-ui-sound="close"
          aria-label="Reset current timer"
          aria-keyshortcuts={formatAriaShortcut(shortcuts.reset)}
          title={`Reset current timer (${formatShortcut(shortcuts.reset)})`}
          onClick={resetSession}
        >
          <RotateCcw />
        </button>

        <button
          className="pomodoro-control pomodoro-primary-control"
          type="button"
          data-ui-sound={isRunning ? "close" : "open"}
          aria-label={
            isRunning
              ? "Pause timer"
              : secondsLeft === session.durationSeconds
                ? "Start timer"
                : "Resume timer"
          }
          aria-pressed={isRunning}
          aria-keyshortcuts={formatAriaShortcut(shortcuts.toggle)}
          title={`${isRunning ? "Pause" : "Play"} timer (${formatShortcut(shortcuts.toggle)})`}
          onClick={toggleTimer}
        >
          {isRunning ? <Pause /> : <Play />}
        </button>

        <button
          className="pomodoro-control pomodoro-skip-control"
          type="button"
          data-ui-sound="open"
          aria-label={`Skip ${session.label.toLowerCase()}`}
          aria-keyshortcuts={formatAriaShortcut(shortcuts.skip)}
          title={`Skip ${session.label.toLowerCase()} (${formatShortcut(shortcuts.skip)})`}
          onClick={skipSession}
        >
          <SkipForward />
        </button>

        <button
          className="pomodoro-control pomodoro-session-reset-control"
          type="button"
          data-ui-sound="close"
          aria-label="Reset Pomodoro session"
          aria-keyshortcuts={formatAriaShortcut(shortcuts.resetSession)}
          title={`Reset Pomodoro session (${formatShortcut(shortcuts.resetSession)})`}
          onClick={resetPomodoroSession}
        >
          <ListRestart />
        </button>
      </div>
    </section>
  );
}

type ShortcutModifiers = Pick<
  Shortcut,
  "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
>;

function createShortcut(
  code: string,
  keyLabel: string,
  modifiers: Partial<ShortcutModifiers> = {},
): Shortcut {
  return {
    code,
    keyLabel,
    altKey: modifiers.altKey ?? false,
    ctrlKey: modifiers.ctrlKey ?? false,
    metaKey: modifiers.metaKey ?? false,
    shiftKey: modifiers.shiftKey ?? false,
  };
}

function shortcutKeyLabel(key: string) {
  if (key === " ") return "Space";
  if (key.startsWith("Arrow")) return key.replace("Arrow", "");
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function shortcutsMatch(left: Shortcut, right: Shortcut) {
  return (
    left.code === right.code &&
    left.altKey === right.altKey &&
    left.ctrlKey === right.ctrlKey &&
    left.metaKey === right.metaKey &&
    left.shiftKey === right.shiftKey
  );
}

function shortcutMatchesEvent(shortcut: Shortcut, event: KeyboardEvent) {
  return (
    shortcut.code === event.code &&
    shortcut.altKey === event.altKey &&
    shortcut.ctrlKey === event.ctrlKey &&
    shortcut.metaKey === event.metaKey &&
    shortcut.shiftKey === event.shiftKey
  );
}

function formatShortcut(shortcut: Shortcut) {
  const parts = [];
  if (shortcut.ctrlKey) parts.push("Ctrl");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  if (shortcut.metaKey) parts.push("Meta");
  parts.push(shortcut.keyLabel);
  return parts.join(" + ");
}

function formatAriaShortcut(shortcut: Shortcut) {
  const parts = [];
  if (shortcut.ctrlKey) parts.push("Control");
  if (shortcut.altKey) parts.push("Alt");
  if (shortcut.shiftKey) parts.push("Shift");
  if (shortcut.metaKey) parts.push("Meta");
  parts.push(shortcut.keyLabel);
  return parts.join("+");
}

type SettingSliderProps = {
  label: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

function SettingSlider({
  label,
  ariaLabel,
  value,
  min,
  max,
  formatValue = (currentValue) => `${currentValue} min`,
  onChange,
}: SettingSliderProps) {
  const progress = ((value - min) / (max - min)) * 100;
  const style = { "--slider-progress": `${progress}%` } as CSSProperties;

  return (
    <label className="pomodoro-duration-setting">
      <span className="pomodoro-duration-label">
        <span>{label}</span>
        <output>{formatValue(value)}</output>
      </span>
      <input
        type="range"
        aria-label={ariaLabel}
        value={value}
        min={min}
        max={max}
        step={1}
        style={style}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}
