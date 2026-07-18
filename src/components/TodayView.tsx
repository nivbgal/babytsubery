import { useEffect, useState } from "react";
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

function relativePostTime(value: string, now: number) {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return "Recently";
  const seconds = Math.max(0, Math.floor((now - created) / 1000));
  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

export function TodayView({ entries, currentEntry, nickname, onSelectEntry }: TodayViewProps) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [currentEntry?.id]);

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
    a.memoryDate.localeCompare(b.memoryDate) || b.createdAt.localeCompare(a.createdAt),
  );
  const dayEntries = orderedEntries
    .filter((entry) => entry.memoryDate === currentEntry.memoryDate)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const carouselIndex = Math.max(0, dayEntries.findIndex((entry) => entry.id === currentEntry.id));
  const previousPhoto = dayEntries.length > 1
    ? dayEntries[(carouselIndex - 1 + dayEntries.length) % dayEntries.length]
    : null;
  const nextPhoto = dayEntries.length > 1
    ? dayEntries[(carouselIndex + 1) % dayEntries.length]
    : null;
  const dayGroups = [...new Set(orderedEntries.map((entry) => entry.memoryDate))];
  const currentDayIndex = dayGroups.indexOf(currentEntry.memoryDate);
  const previousDay = currentDayIndex > 0
    ? orderedEntries.find((entry) => entry.memoryDate === dayGroups[currentDayIndex - 1]) ?? null
    : null;
  const nextDay = currentDayIndex >= 0 && currentDayIndex < dayGroups.length - 1
    ? orderedEntries.find((entry) => entry.memoryDate === dayGroups[currentDayIndex + 1]) ?? null
    : null;
  const date = asDate(currentEntry.memoryDate);

  return (
    <article className="today-spread" aria-labelledby="today-title">
      <div className="today-photo-column">
        <div className="today-photo-mat">
          <span className="today-tape" aria-hidden="true" />
          <MemoryVisual entry={currentEntry} className="today-photo" />
          <time className="today-photo-time" dateTime={currentEntry.createdAt} title={new Date(currentEntry.createdAt).toLocaleString()}>
            {relativePostTime(currentEntry.createdAt, now)}
          </time>
          {previousPhoto && nextPhoto && (
            <>
              <button
                className="today-carousel-control today-carousel-control--previous"
                type="button"
                onClick={() => onSelectEntry(previousPhoto)}
                aria-label="Previous photo from this day"
              >
                <ChevronLeft size={22} aria-hidden="true" />
              </button>
              <button
                className="today-carousel-control today-carousel-control--next"
                type="button"
                onClick={() => onSelectEntry(nextPhoto)}
                aria-label="Next photo from this day"
              >
                <ChevronRight size={22} aria-hidden="true" />
              </button>
              <div className="today-carousel-dots" aria-label={`Photo ${carouselIndex + 1} of ${dayEntries.length}`}>
                {dayEntries.map((entry, index) => (
                  <button
                    type="button"
                    className={index === carouselIndex ? "is-active" : ""}
                    onClick={() => onSelectEntry(entry)}
                    aria-label={`Show photo ${index + 1} of ${dayEntries.length}`}
                    aria-current={index === carouselIndex ? "true" : undefined}
                    key={entry.id}
                  />
                ))}
              </div>
            </>
          )}
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

        {(previousDay || nextDay) && (
          <nav className="today-entry-nav" aria-label="Browse journal entries">
            {previousDay ? (
              <button type="button" onClick={() => onSelectEntry(previousDay)}>
                <ChevronLeft size={18} aria-hidden="true" />
                <span>
                  <small>Previous day</small>
                  {stampDate.format(asDate(previousDay.memoryDate))}
                </span>
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            {nextDay && (
              <button type="button" onClick={() => onSelectEntry(nextDay)}>
                <span>
                  <small>Next day</small>
                  {stampDate.format(asDate(nextDay.memoryDate))}
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
