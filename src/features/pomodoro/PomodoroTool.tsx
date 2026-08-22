import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Pause, Play, RotateCcw, SkipForward, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  createPomodoroSessions,
  DEFAULT_POMODORO_SETTINGS,
  formatPomodoroTime,
  nextSessionIndex,
  type PomodoroSettings,
} from "@/features/pomodoro/pomodoro-utils";
type TimingSetting = Exclude<keyof PomodoroSettings, "autoStart">;

type PomodoroToolProps = {
  settingsOpen: boolean;
  onSettingsOpenChange: (open: boolean) => void;
};

export function PomodoroTool({
  settingsOpen,
  onSettingsOpenChange,
}: PomodoroToolProps) {
  const [settings, setSettings] = useState(DEFAULT_POMODORO_SETTINGS);
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
    DEFAULT_POMODORO_SETTINGS.focusMinutes * 60,
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
  }, [isRunning, sessions, settings.autoStart]);

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

  const completedFocusSessions = session.kind === "focus"
    ? session.cycle - 1
    : session.cycle;

  const dialStyle = {
    "--pomodoro-progress": `${progress * 360}deg`,
  } as CSSProperties;

  return (
    <section className="pomodoro-tool" aria-label="Pomodoro timer">
      <DialogPrimitive.Root
        open={settingsOpen}
        onOpenChange={onSettingsOpenChange}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop className="pomodoro-settings-overlay" />
          <DialogPrimitive.Popup className="pomodoro-settings-panel">
            <div className="pomodoro-settings-header">
              <DialogPrimitive.Title>Timer settings</DialogPrimitive.Title>
              <DialogPrimitive.Close
                className="pomodoro-settings-close"
                aria-label="Close settings"
              >
                <X />
              </DialogPrimitive.Close>
            </div>
            <DurationSlider
              label="Focus"
              ariaLabel="Focus duration in minutes"
              value={settings.focusMinutes}
              min={5}
              max={90}
              onChange={(value) => updateTimingSetting("focusMinutes", value)}
            />
            <DurationSlider
              label="Short break"
              ariaLabel="Short break duration in minutes"
              value={settings.shortBreakMinutes}
              min={1}
              max={30}
              onChange={(value) =>
                updateTimingSetting("shortBreakMinutes", value)
              }
            />
            <DurationSlider
              label="Long break"
              ariaLabel="Long break duration in minutes"
              value={settings.longBreakMinutes}
              min={1}
              max={60}
              onChange={(value) =>
                updateTimingSetting("longBreakMinutes", value)
              }
            />
            <DurationSlider
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
          style={dialStyle}
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
          title="Reset current timer"
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
          onClick={toggleTimer}
        >
          {isRunning ? <Pause /> : <Play />}
        </button>

        <button
          className="pomodoro-control pomodoro-skip-control"
          type="button"
          data-ui-sound="open"
          aria-label={`Skip ${session.label.toLowerCase()}`}
          title={`Skip ${session.label.toLowerCase()}`}
          onClick={skipSession}
        >
          <SkipForward />
        </button>
      </div>
    </section>
  );
}

type DurationSliderProps = {
  label: string;
  ariaLabel: string;
  value: number;
  min: number;
  max: number;
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
};

function DurationSlider({
  label,
  ariaLabel,
  value,
  min,
  max,
  formatValue = (currentValue) => `${currentValue} min`,
  onChange,
}: DurationSliderProps) {
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
