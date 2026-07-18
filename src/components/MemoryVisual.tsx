import type { MemoryEntry } from "../types";

interface MemoryVisualProps {
  entry: MemoryEntry;
  className?: string;
  thumbnail?: boolean;
}

export function MemoryVisual({ entry, className = "", thumbnail = false }: MemoryVisualProps) {
  const source = thumbnail ? entry.thumbUrl || entry.imageUrl : entry.imageUrl;
  return (
    <div className={`memory-visual ${className}`.trim()}>
      {source ? (
        <img src={source} alt={entry.imageAlt} loading={thumbnail ? "lazy" : "eager"} />
      ) : (
        <div
          className="memory-placeholder"
          data-tone={entry.placeholderTone ?? "rose"}
          role="img"
          aria-label={entry.imageAlt}
        />
      )}
    </div>
  );
}
