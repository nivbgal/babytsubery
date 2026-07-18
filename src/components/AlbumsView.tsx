import { ArrowLeft, BookOpen, Plus, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { MemoryVisual } from "./MemoryVisual";
import type { Album, MemoryEntry, Role } from "../types";
import "./AlbumsView.css";

export interface AlbumsViewProps {
  albums: Album[];
  entries: MemoryEntry[];
  role: Role;
  onCreateAlbum: () => void;
}

const readingDate = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function asDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`);
}

function albumCover(album: Album, albumEntries: MemoryEntry[]): MemoryEntry {
  const first = albumEntries[0];
  if (first && !album.coverUrl) return first;

  return {
    id: `cover-${album.id}`,
    memoryDate: first?.memoryDate ?? album.createdAt,
    caption: album.description,
    imageUrl: album.coverUrl ?? first?.imageUrl ?? "",
    thumbUrl: album.coverUrl ?? first?.thumbUrl ?? "",
    imageAlt: `Cover of ${album.title}`,
    placeholderTone: first?.placeholderTone ?? "rose",
    createdAt: album.createdAt,
  };
}

export function AlbumsView({ albums, entries, role, onCreateAlbum }: AlbumsViewProps) {
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const openAlbum = albums.find((album) => album.id === openAlbumId) ?? null;
  const openEntries = openAlbum
    ? openAlbum.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is MemoryEntry => Boolean(entry))
    : [];

  if (openAlbum) {
    return (
      <section className="album-reader" aria-labelledby="album-reader-title">
        <header className="album-reader-header">
          <button className="album-back-button" type="button" onClick={() => setOpenAlbumId(null)}>
            <ArrowLeft size={18} aria-hidden="true" />
            All albums
          </button>
          <div>
            <p className="eyebrow">A family keepsake</p>
            <h1 id="album-reader-title" className="display-type">{openAlbum.title}</h1>
            {openAlbum.description && <p>{openAlbum.description}</p>}
          </div>
          <button className="button button-secondary album-print-button" type="button" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            Print or save PDF
          </button>
        </header>

        {openEntries.length ? (
          <div className="album-pages">
            {openEntries.map((entry, index) => (
              <article className="album-page" key={entry.id}>
                <div className="album-page-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
                <div className="album-page-photo-mat">
                  <MemoryVisual entry={entry} className="album-page-photo" />
                </div>
                <div className="album-page-copy">
                  <time dateTime={entry.memoryDate}>{readingDate.format(asDate(entry.memoryDate))}</time>
                  <p className="display-type">{entry.caption || "A moment worth keeping."}</p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="albums-empty">This keepsake is ready for its first memory.</p>
        )}
      </section>
    );
  }

  return (
    <section className="albums-view" aria-labelledby="albums-title">
      <header className="albums-header">
        <div>
          <p className="eyebrow">Made to keep</p>
          <h1 id="albums-title" className="display-type">Little books of a life unfolding</h1>
          <p>Gather favorite days into keepsakes to read together now and print for years to come.</p>
        </div>
        {role === "parent" && (
          <button type="button" className="button button-primary" onClick={onCreateAlbum}>
            <Plus size={19} aria-hidden="true" />
            Create an album
          </button>
        )}
      </header>

      {albums.length ? (
        <div className="album-shelf">
          {albums.map((album, index) => {
            const albumEntries = album.entryIds
              .map((id) => entriesById.get(id))
              .filter((entry): entry is MemoryEntry => Boolean(entry));
            const cover = albumCover(album, albumEntries);
            return (
              <article className="album-card" key={album.id} style={{ "--album-tilt": `${index % 2 ? 1.1 : -0.8}deg` } as React.CSSProperties}>
                <button type="button" onClick={() => setOpenAlbumId(album.id)} aria-label={`Open ${album.title}, ${albumEntries.length} ${albumEntries.length === 1 ? "memory" : "memories"}`}>
                  <div className="album-cover">
                    <MemoryVisual entry={cover} thumbnail />
                    <div className="album-cover-wash" aria-hidden="true" />
                    <div className="album-cover-copy">
                      <BookOpen size={19} aria-hidden="true" />
                      <h2 className="display-type">{album.title}</h2>
                    </div>
                  </div>
                  <div className="album-card-copy">
                    <p>{album.description || "A collection of favorite family moments."}</p>
                    <span>{albumEntries.length} {albumEntries.length === 1 ? "memory" : "memories"}</span>
                  </div>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="albums-empty">
          <BookOpen size={30} aria-hidden="true" />
          <h2 className="display-type">The bookshelf is waiting</h2>
          <p>Albums created from favorite journal entries will live here.</p>
        </div>
      )}
    </section>
  );
}
