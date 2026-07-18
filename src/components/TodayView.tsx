import { ChevronLeft, ChevronRight, LockKeyhole } from "lucide-react";
import { MemoryVisual } from "./MemoryVisual";
import type { MemoryEntry } from "../types";
import "./TodayView.css";

export interface TodayViewProps {
  entries: MemoryEntry[];
  currentEntry: MemoryEntry | null;
  nickname: string;
  onSelectEntry: (entry: MemoryEntry) => void;
}

const longDate = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const stampDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function asDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`);
}

export function TodayView({ entries, currentEntry, nickname, onSelectEntry }: TodayViewProps) {
  if (!currentEntry) {
    return (
      <section className="today-empty" aria-labelledby="today-empty-title">
        <p className="eyebrow">The first page is waiting</p>
        <h1 id="today-empty-title" className="display-type">
          A beautiful beginning for {nickname || "your little one"}
        </h1>
        <p>
          When the parents add the first photograph, it will become the opening page of this
          private family journal.
        </p>
      </section>
    );
  }

  const orderedEntries = [...entries].sort((a, b) =>
    a.memoryDate.localeCompare(b.memoryDate),
  );
  const currentIndex = orderedEntries.findIndex((entry) => entry.id === currentEntry.id);
  const previous = currentIndex > 0 ? orderedEntries[currentIndex - 1] : null;
  const next = currentIndex >= 0 && currentIndex < orderedEntries.length - 1
    ? orderedEntries[currentIndex + 1]
    : null;
  const date = asDate(currentEntry.memoryDate);

  return (
    <article className="today-spread" aria-labelledby="today-title">
      <div className="today-photo-column">
        <div className="today-photo-mat">
          <span className="today-tape" aria-hidden="true" />
          <MemoryVisual entry={currentEntry} className="today-photo" />
          <time className="today-date-stamp" dateTime={currentEntry.memoryDate}>
            {stampDate.format(date)}
          </time>
        </div>
      </div>

      <div className="today-copy">
        <p className="eyebrow">Newest entry · Today</p>
        <h1 id="today-title" className="display-type">
          Welcome to the world Baby Tsubery
        </h1>
        <p className="today-caption">
          {currentEntry.caption || `A little moment from ${nickname || "Baby Tsubery"}’s day.`}
        </p>
        <time className="today-long-date" dateTime={currentEntry.memoryDate}>
          {longDate.format(date)}
        </time>
        <p className="today-private-note">
          <LockKeyhole size={16} aria-hidden="true" />
          Shared privately with family
        </p>

        {(previous || next) && (
          <nav className="today-entry-nav" aria-label="Browse journal entries">
            {previous ? (
              <button type="button" onClick={() => onSelectEntry(previous)}>
                <ChevronLeft size={18} aria-hidden="true" />
                <span>
                  <small>Previous memory</small>
                  {stampDate.format(asDate(previous.memoryDate))}
                </span>
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            {next && (
              <button type="button" onClick={() => onSelectEntry(next)}>
                <span>
                  <small>Next memory</small>
                  {stampDate.format(asDate(next.memoryDate))}
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
          </nav>
        )}
      </div>
    </article>
  );
}
