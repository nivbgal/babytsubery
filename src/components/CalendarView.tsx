import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { MemoryVisual } from "./MemoryVisual";
import type { MemoryEntry } from "../types";
import "./CalendarView.css";

export interface CalendarViewProps {
  entries: MemoryEntry[];
  onSelectEntry: (entry: MemoryEntry) => void;
}

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayNames: Record<string, string> = {
  Sun: "Sunday",
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
};
const monthTitle = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const accessibleDate = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});

function monthFromDate(value: string) {
  const [year, month] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function CalendarView({ entries, onSelectEntry }: CalendarViewProps) {
  const latestDate = useMemo(
    () => [...entries].sort((a, b) => b.memoryDate.localeCompare(a.memoryDate))[0]?.memoryDate,
    [entries],
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    latestDate ? monthFromDate(latestDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );

  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlankCount = new Date(year, month, 1).getDay();
  const cellCount = Math.ceil((leadingBlankCount + daysInMonth) / 7) * 7;
  const todayKey = dateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const entriesByDate = useMemo(() => {
    const map = new Map<string, MemoryEntry[]>();
    entries.forEach((entry) => {
      const key = entry.memoryDate.slice(0, 10);
      map.set(key, [...(map.get(key) ?? []), entry]);
    });
    map.forEach((dayEntries) => dayEntries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    return map;
  }, [entries]);

  function moveMonth(offset: number) {
    setVisibleMonth(new Date(year, month + offset, 1));
  }

  return (
    <section className="calendar-view" aria-labelledby="calendar-title">
      <header className="calendar-header">
        <div>
          <p className="eyebrow">The family journal</p>
          <h1 id="calendar-title" className="display-type">A month of little moments</h1>
        </div>
        <div className="calendar-month-controls" aria-label="Choose month">
          <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month">
            <ChevronLeft size={21} aria-hidden="true" />
          </button>
          <p aria-live="polite">{monthTitle.format(visibleMonth)}</p>
          <button type="button" onClick={() => moveMonth(1)} aria-label="Next month">
            <ChevronRight size={21} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="calendar-scroll" tabIndex={0} aria-label={`Scrollable calendar for ${monthTitle.format(visibleMonth)}`}>
      <div className="calendar-grid">
        {weekdays.map((weekday) => (
          <div className="calendar-weekday" key={weekday}>
            <span aria-hidden="true">{weekday}</span>
            <span className="sr-only">{weekdayNames[weekday]}</span>
          </div>
        ))}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - leadingBlankCount + 1;
          if (day < 1 || day > daysInMonth) {
            return <div className="calendar-day calendar-day-blank" key={`blank-${index}`} />;
          }

          const key = dateKey(year, month, day);
          const dayEntries = entriesByDate.get(key) ?? [];
          const entry = dayEntries[0];
          const isToday = key === todayKey;
          const labelDate = accessibleDate.format(new Date(year, month, day));

          return (
            <div
              className={`calendar-day${isToday ? " is-today" : ""}${entry ? " has-memory" : ""}`}
              key={key}
            >
              {entry ? (
                <button
                  type="button"
                  className="calendar-memory-button"
                  onClick={() => onSelectEntry(entry)}
                  aria-label={`${labelDate}: ${entry.caption || entry.imageAlt}${dayEntries.length > 1 ? `, ${dayEntries.length} memories` : ""}`}
                >
                  <MemoryVisual entry={entry} thumbnail />
                  <span className="calendar-day-number">{day}</span>
                  {isToday && <span className="calendar-today-label">Today</span>}
                  {dayEntries.length > 1 && (
                    <span className="calendar-entry-count" aria-hidden="true">+{dayEntries.length - 1}</span>
                  )}
                </button>
              ) : (
                <>
                  <span className="calendar-day-number">{day}</span>
                  {isToday && <span className="calendar-today-label">Today</span>}
                  <span className="sr-only">{labelDate}, no entry</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </section>
  );
}
