import { useMemo, useState, type CSSProperties } from "react";
import { Activity, CalendarDays, Flame, Sparkles } from "lucide-react";
import { habitColor } from "@/features/habits/habit-colors";
import { habitInsights } from "@/features/habits/habit-insights";
import { HabitProgressChart } from "@/features/habits/HabitProgressChart";
import { HabitIcon } from "@/features/habits/habit-icons";
import type { Habit, HabitLogs } from "@/features/habits/habit-types";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function HabitData({ habits, logs }: { habits: Habit[]; logs: HabitLogs }) {
  const [range, setRange] = useState(30);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const data = useMemo(() => habitInsights(habits, logs, range, today), [habits, logs, range, todayKey]);
  const progressByDate = Object.fromEntries(data.days.map(day => [day.key, day.progress]));
  const change = data.previousConsistency === null ? null : data.consistency - data.previousConsistency;
  const strongestStreak = Math.max(0, ...data.rows.map(row => row.currentStreak));
  const highlighted = data.days.find(day => day.key === hoveredDay);
  const weekdayData = WEEKDAYS.map((label, index) => {
    const days = data.days.filter(day => day.date.getDay() === index);
    const possible = days.reduce((total, day) => total + day.eligible, 0);
    return { label, count: days.length, progress: possible
      ? Math.round(days.reduce((total, day) => total + day.credit, 0) / possible * 100) : 0 };
  });

  return (
    <section className="habit-data" aria-label="Habit progress data">
      <div className="habit-data-heading">
        <div>
          <h2>Your habits, in perspective</h2>
          <p>Small efforts add up. See where your routine is taking shape.</p>
        </div>
        <div className="habit-view-switch" role="group" aria-label="Data range">
          {[7, 30, 90].map(days => <button type="button" key={days} aria-pressed={range === days}
            onClick={() => { setRange(days); setHoveredDay(null); }}>{days} days</button>)}
        </div>
      </div>
      <p className="habit-data-period">Last {range} days · through {data.end.toLocaleDateString(undefined,
        { month: "long", day: "numeric", year: "numeric" })}</p>

      {data.days.length === 0 ? (
        <div className="habit-data-empty">
          <Activity aria-hidden="true" />
          <h3>Your story starts with a mark</h3>
          <p>Log your habits in the tracker. Your first completed day will appear here tomorrow.</p>
        </div>
      ) : <>
        <div className="habit-data-stats">
          <article className="habit-data-stat">
            <span><Activity aria-hidden="true" />Consistency</span>
            <strong>{data.consistency}<small>%</small></strong>
            <p className={change !== null && change > 0 ? "is-improving" : undefined}>
              {change === null ? "Building your baseline" : change === 0 ? "Steady with the previous period"
                : `${change > 0 ? "+" : ""}${change} pts vs previous ${range} days`}
            </p>
          </article>
          <article className="habit-data-stat">
            <span><CalendarDays aria-hidden="true" />Days with activity</span>
            <strong>{data.loggedDays}<small> / {data.days.length}</small></strong>
            <p>{data.loggedEntries} habit logs in this period</p>
          </article>
          <article className="habit-data-stat">
            <span><Sparkles aria-hidden="true" />Full routine days</span>
            <strong>{data.fullDays}<small> / {data.days.length}</small></strong>
            <p>Every active habit fully completed</p>
          </article>
          <article className="habit-data-stat">
            <span><Flame aria-hidden="true" />Strongest current streak</span>
            <strong>{strongestStreak}<small> {strongestStreak === 1 ? "day" : "days"}</small></strong>
            <p>Consecutive full days for one habit</p>
          </article>
        </div>

        <div className="habit-data-card habit-data-trend">
          <div className="habit-data-card-heading"><h3>Daily consistency</h3><span>Partial effort counts</span></div>
          <HabitProgressChart habits={habits} logs={logs} days={data.days.map(day => day.date)} progressByDate={progressByDate} />
        </div>

        <div className="habit-data-patterns">
          <div className="habit-data-card">
            <div className="habit-data-card-heading"><h3>Your rhythm</h3><span>{data.days.length} days</span></div>
            <div className="habit-activity-calendar">
              <div className="habit-activity-weekdays" aria-hidden="true">
                {WEEKDAYS.map(label => <span key={label}>{label.slice(0, 1)}</span>)}
              </div>
              <div className="habit-activity-days">
                {Array.from({ length: data.days[0]!.date.getDay() }, (_, index) =>
                  <span className="habit-activity-placeholder" key={`empty-${index}`} />)}
                {data.days.map(day => (
                  <button type="button" key={day.key} className="habit-activity-day"
                    aria-label={`${day.key}: ${day.progress}% consistency, ${day.logged} of ${day.eligible} habits logged`}
                    style={{ "--activity-strength": day.progress === 0 ? 0 : 0.15 + day.progress * 0.0075 } as CSSProperties}
                    onMouseEnter={() => setHoveredDay(day.key)} onMouseLeave={() => setHoveredDay(null)}
                    onFocus={() => setHoveredDay(day.key)} onBlur={() => setHoveredDay(null)} />
                ))}
              </div>
            </div>
            <div className="habit-activity-legend" aria-hidden="true"><span>Less</span>
              {[0, 0.25, 0.5, 0.75, 1].map(value => <i key={value} style={{ "--activity-strength": value } as CSSProperties} />)}
              <span>More</span>
            </div>
            <p className="habit-activity-detail" aria-live="polite">
              {highlighted ? `${highlighted.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${highlighted.progress}% · ${highlighted.logged} of ${highlighted.eligible} habits logged`
                : "Hover or focus a day to explore your activity."}
            </p>
          </div>
          <div className="habit-data-card">
            <div className="habit-data-card-heading"><h3>Weekday patterns</h3><span>Average consistency</span></div>
            <div className="habit-weekday-bars">
              {weekdayData.map(day => <div key={day.label} aria-label={`${day.label}: ${day.count ? `${day.progress}%` : "no data"}`}>
                <span>{day.label}</span><div><i style={{ width: `${day.progress}%` }} /></div>
                <strong>{day.count ? `${day.progress}%` : "—"}</strong>
              </div>)}
            </div>
          </div>
        </div>

        <div className="habit-data-card habit-data-breakdown">
          <div className="habit-data-card-heading"><h3>Habit by habit</h3><span>Streaks across all tracked days</span></div>
          <div className="habit-data-rows">
            <div className="habit-data-row habit-data-row-header" aria-hidden="true">
              <span>Habit</span><span>Consistency</span><span>Current</span><span>Best</span>
            </div>
            {data.rows.map(row => (
              <div className="habit-data-row" key={row.habit.id} style={{ "--habit-color": habitColor(row.habit) } as CSSProperties}>
                <div className="habit-data-name">
                  <span>{row.habit.icon ? <HabitIcon name={row.habit.icon} /> : <i />}{row.habit.name}</span>
                  <small>{row.logged} of {row.eligible} days logged{row.habit.logType === "number"
                    ? ` · ${row.total.toLocaleString(undefined, { maximumFractionDigits: 2 })} total` : ""}</small>
                </div>
                <div className="habit-data-consistency" aria-label={`${row.habit.name} consistency: ${row.eligible ? `${row.consistency}%` : "no completed days"}`}>
                  <strong>{row.eligible ? `${row.consistency}%` : "—"}</strong><div><i style={{ width: `${row.consistency}%` }} /></div>
                </div>
                <div className="habit-data-streak" aria-label={`${row.habit.name} current streak: ${row.currentStreak} days`}>
                  <strong>{row.currentStreak}</strong><small>days</small>
                </div>
                <div className="habit-data-streak" aria-label={`${row.habit.name} best streak: ${row.bestStreak} days`}>
                  <strong>{row.bestStreak}</strong><small>days</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>}
      <p className="habit-data-note">Based on your current habits, from when each was added or first logged. Today is still in progress and is excluded.
        Levels earn ¼ credit per level; checks and positive numbers earn full credit. Streaks require full completion.</p>
    </section>
  );
}
