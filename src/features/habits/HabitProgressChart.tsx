import { useLayoutEffect, useRef, useState } from "react";
import type { Habit, HabitLogs } from "@/features/habits/habit-types";
import { HABIT_TRACKING_START, habitDayProgress, localDateKey } from "@/features/habits/habit-utils";

export function HabitProgressChart({ habits, logs, days, progressByDate }: {
  habits: Habit[];
  logs: HabitLogs;
  days: Date[];
  progressByDate?: Record<string, number>;
}) {
  const chartRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(720);
  useLayoutEffect(() => {
    const chart = chartRef.current!;
    const measure = () => { if (chart.clientWidth > 0) setWidth(chart.clientWidth); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(chart);
    return () => observer.disconnect();
  }, []);
  const today = localDateKey(new Date());
  const x = (index: number) => 34 + (index / Math.max(1, days.length - 1)) * (width - (progressByDate ? 66 : 44));
  const y = (value: number) => 96 - value * 0.88;
  const entries = days.flatMap((day, index) => {
    const dateKey = localDateKey(day);
    if (progressByDate && progressByDate[dateKey] === undefined) return [];
    return dateKey >= HABIT_TRACKING_START && dateKey <= today
      ? [{ dateKey, index, value: progressByDate?.[dateKey] ?? habitDayProgress(habits, logs, dateKey) }] : [];
  });
  const points = entries.map((entry) => `${x(entry.index)},${y(entry.value)}`).join(" ");

  return (
    <figure className="habit-progress-chart" aria-label="Daily completeness">
      <svg ref={chartRef} viewBox={`0 0 ${width} 120`} role="img"
        aria-label="Daily habit completeness over the selected period">
        {[0, 50, 100].map((value) => (
          <g key={value} className="habit-chart-guide">
            <text x="27" y={y(value) + 3} textAnchor="end">{value}%</text>
            <line x1="34" x2={width - 10} y1={y(value)} y2={y(value)} />
          </g>
        ))}
        {entries.length > 0 && (
          <>
            <polygon className="habit-chart-area"
              points={`${x(entries[0]!.index)},96 ${points} ${x(entries[entries.length - 1]!.index)},96`} />
            <polyline className="habit-chart-line" points={points} />
          </>
        )}
        {entries.map(({ dateKey, index, value }) => (
          <circle className="habit-chart-point" key={dateKey} cx={x(index)} cy={y(value)} r="3"
            tabIndex={0} aria-label={`${dateKey} completeness: ${value}%`}>
            <title>{dateKey}: {value}% complete</title>
          </circle>
        ))}
        {days.map((day, index) => {
          if (progressByDate) {
            if (index !== 0 && index !== days.length - 1 && index % Math.ceil(days.length / 5) !== 0) return null;
            if (index !== days.length - 1 && index > days.length - Math.ceil(days.length / 10)) return null;
          } else if (days.length > 7 && index !== 0 && index !== days.length - 1 && day.getDate() % 5 !== 0) return null;
          if (days.length > 7 && index === days.length - 2) return null;
          return (
            <text className="habit-chart-date" key={index} x={x(index)} y="115" textAnchor="middle">
              {progressByDate ? day.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : days.length === 7 ? day.toLocaleDateString(undefined, { weekday: "long" }).slice(0, 1) : day.getDate()}
            </text>
          );
        })}
      </svg>
    </figure>
  );
}
