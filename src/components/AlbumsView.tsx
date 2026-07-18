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

function pairEntries(albumEntries: MemoryEntry[]) {
  const pairs: Array<[MemoryEntry, MemoryEntry | null]> = [];
  for (let index = 0; index < albumEntries.length; index += 2) {
    pairs.push([albumEntries[index], albumEntries[index + 1] ?? null]);
  }
  return pairs;
}

function albumDateLine(albumEntries: MemoryEntry[]) {
  if (!albumEntries.length) return "Ready for its first memory";
  const dates = albumEntries.map((entry) => entry.memoryDate).sort();
  const first = readingDate.format(asDate(dates[0]));
  const last = readingDate.format(asDate(dates[dates.length - 1]));
  return first === last ? first : `${first} — ${last}`;
}

function AlbumLeaf({ entry, pageNumber }: { entry: MemoryEntry; pageNumber: number }) {
  return (
    <div className="album-leaf">
      <div className="album-leaf-photo">
        <MemoryVisual entry={entry} />
      </div>
      <div className="album-leaf-caption">
        <time dateTime={entry.memoryDate}>{readingDate.format(asDate(entry.memoryDate))}</time>
        {entry.caption && <p className="display-type" dir="auto">{entry.caption}</p>}
      </div>
      <span className="album-page-number" aria-hidden="true">{String(pageNumber).padStart(2, "0")}</span>
    </div>
  );
}

export function AlbumsView({ albums, entries, role, onCreateAlbum }: AlbumsViewProps) {
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const openAlbum = albums.find((album) => album.id === openAlbumId) ?? null;
  const openEntries = openAlbum
    ? openAlbum.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is MemoryEntry => Boolean(entry))
    : [];
  const openSpreads = pairEntries(openEntries);

  if (openAlbum) {
    const cover = albumCover(openAlbum, openEntries);
    return (
      <section className="album-reader" aria-labelledby="album-reader-title">
        <header className="album-reader-header no-print">
          <button className="album-back-button" type="button" onClick={() => setOpenAlbumId(null)}>
            <ArrowLeft size={18} aria-hidden="true" />
            All albums
          </button>
          <div>
            <p className="eyebrow">A family keepsake</p>
            <h1 id="album-reader-title" className="display-type" dir="auto">{openAlbum.title}</h1>
            {openAlbum.description && <p dir="auto">{openAlbum.description}</p>}
          </div>
          <button className="button button-secondary album-print-button" type="button" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            Print or save PDF
          </button>
        </header>

        {openEntries.length ? (
          <div className="album-volume" aria-label={`${openAlbum.title} photo album`}>
            <section className="album-title-spread" aria-label="Album cover">
              <div className="album-title-page">
                <p className="album-edition">Baby Tsubery · Family album</p>
                <h2 className="display-type" dir="auto">{openAlbum.title}</h2>
                {openAlbum.description && <p className="album-title-description" dir="auto">{openAlbum.description}</p>}
                <p className="album-date-line">{albumDateLine(openEntries)}</p>
              </div>
              <div className="album-title-photo">
                <MemoryVisual entry={cover} />
              </div>
            </section>

            <div className="album-spreads">
              {openSpreads.map(([leftEntry, rightEntry], spreadIndex) => (
                <article className="album-spread" key={leftEntry.id} data-spread={spreadIndex % 3}>
                  <AlbumLeaf entry={leftEntry} pageNumber={spreadIndex * 2 + 1} />
                  {rightEntry ? (
                    <AlbumLeaf entry={rightEntry} pageNumber={spreadIndex * 2 + 2} />
                  ) : (
                    <div className="album-leaf album-closing-page" aria-hidden="true">
                      <BookOpen size={25} />
                      <p className="display-type">More little moments to come.</p>
                    </div>
                  )}
                </article>
              ))}
            </div>
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
          <p>Gather favorite days into keepsakes to read together now and print as polished photo books.</p>
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
              <article className="album-card" key={album.id} data-cover={index % 3}>
                <button type="button" onClick={() => setOpenAlbumId(album.id)} aria-label={`Open ${album.title}, ${albumEntries.length} ${albumEntries.length === 1 ? "memory" : "memories"}`}>
                  <div className="album-cover">
                    <div className="album-cover__spine" aria-hidden="true" />
                    <div className="album-cover__label">
                      <p>Baby Tsubery</p>
                      <h2 className="display-type" dir="auto">{album.title}</h2>
                    </div>
                    <div className="album-cover__window">
                      <MemoryVisual entry={cover} thumbnail />
                    </div>
                    <p className="album-cover__edition">Noa &amp; Rotem · {albumEntries.length} {albumEntries.length === 1 ? "memory" : "memories"}</p>
                  </div>
                  <div className="album-card-copy">
                    <p dir="auto">{album.description || albumDateLine(albumEntries)}</p>
                    <span>Open album <span aria-hidden="true">→</span></span>
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
