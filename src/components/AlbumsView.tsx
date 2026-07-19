import { ArrowLeft, BookHeart, ChevronLeft, ChevronRight, Plus, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MemoryVisual } from "./MemoryVisual";
import type { Album, AlbumPage, MemoryEntry, Role } from "../types";
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

function albumDateLine(albumEntries: MemoryEntry[]) {
  if (!albumEntries.length) return "Ready for its first memory";
  const dates = albumEntries.map((entry) => entry.memoryDate).sort();
  const first = readingDate.format(asDate(dates[0]));
  const last = readingDate.format(asDate(dates[dates.length - 1]));
  return first === last ? first : `${first} — ${last}`;
}

function AlbumCoverPage({ album, coverEntry, albumEntries }: { album: Album; coverEntry: MemoryEntry | null; albumEntries: MemoryEntry[] }) {
  return (
    <article className={`album-sheet album-cover-page${coverEntry ? " album-cover-page--photo" : " album-cover-page--type"}`} aria-label={`${album.title} cover`}>
      {coverEntry && <div className="album-cover-page__photo"><MemoryVisual entry={coverEntry} /></div>}
      <div className="album-cover-page__copy">
        <p>Baby Tsubery · Noa &amp; Rotem</p>
        <h2 className="display-type" dir="auto">{album.title}</h2>
        {album.description && <div className="album-cover-page__description" dir="auto">{album.description}</div>}
        <span>{albumDateLine(albumEntries)}</span>
      </div>
    </article>
  );
}

function PhotoWithCaption({ entry }: { entry: MemoryEntry }) {
  return (
    <figure className="album-designed-photo">
      <MemoryVisual entry={entry} />
      <figcaption dir="auto">
        {entry.caption && <span>{entry.caption}</span>}
        <time dateTime={entry.memoryDate}>{readingDate.format(asDate(entry.memoryDate))}</time>
      </figcaption>
    </figure>
  );
}

function AlbumDesignedPage({ page, entries, pageNumber }: { page: AlbumPage; entries: MemoryEntry[]; pageNumber: number }) {
  const primary = entries[0];
  return (
    <article className={`album-sheet album-designed-page album-designed-page--${page.layout}`} aria-label={`Album page ${pageNumber}`}>
      {page.layout === "duo" ? (
        <div className="album-duo-layout">
          {entries.map((entry) => <PhotoWithCaption entry={entry} key={entry.id} />)}
        </div>
      ) : page.layout === "full" && primary ? (
        <>
          <div className="album-full-photo"><MemoryVisual entry={primary} /></div>
          <div className="album-full-copy">
            {page.title && <h3 className="display-type" dir="auto">{page.title}</h3>}
            {primary.caption && <p dir="auto">{primary.caption}</p>}
            {page.text && <div dir="auto">{page.text}</div>}
            <time dateTime={primary.memoryDate}>{readingDate.format(asDate(primary.memoryDate))}</time>
          </div>
        </>
      ) : page.layout === "story" && primary ? (
        <div className="album-story-layout">
          <PhotoWithCaption entry={primary} />
          <div className="album-story-copy">
            {page.title && <h3 className="display-type" dir="auto">{page.title}</h3>}
            {page.text ? <p dir="auto">{page.text}</p> : <p className="album-story-copy__quiet">A little moment, held close.</p>}
          </div>
        </div>
      ) : primary ? (
        <div className="album-classic-layout">
          {page.title && <h3 className="display-type" dir="auto">{page.title}</h3>}
          <PhotoWithCaption entry={primary} />
          {page.text && <p className="album-classic-story" dir="auto">{page.text}</p>}
        </div>
      ) : null}
      {page.layout === "duo" && (page.title || page.text) && (
        <div className="album-duo-note">
          {page.title && <h3 className="display-type" dir="auto">{page.title}</h3>}
          {page.text && <p dir="auto">{page.text}</p>}
        </div>
      )}
      <span className="album-sheet-number" aria-hidden="true">{String(pageNumber).padStart(2, "0")}</span>
    </article>
  );
}

export function AlbumsView({ albums, entries, role, onCreateAlbum }: AlbumsViewProps) {
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [turnDirection, setTurnDirection] = useState<"next" | "previous">("next");
  const entriesById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const openAlbum = albums.find((album) => album.id === openAlbumId) ?? null;
  const openEntries = openAlbum
    ? openAlbum.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is MemoryEntry => Boolean(entry))
    : [];
  const openPages = openAlbum?.pages.map((page) => ({
    page,
    entries: page.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is MemoryEntry => Boolean(entry)),
  })).filter(({ entries: pageEntries }) => pageEntries.length > 0) ?? [];
  const openSpreads = [] as Array<[typeof openPages[number], typeof openPages[number] | null]>;
  for (let index = 0; index < openPages.length; index += 2) openSpreads.push([openPages[index], openPages[index + 1] ?? null]);
  const pageCount = openSpreads.length + 1;

  useEffect(() => { setPageIndex(0); }, [openAlbumId]);

  useEffect(() => {
    if (!openAlbum) return;
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "ArrowRight" && pageIndex < pageCount - 1) {
        setTurnDirection("next");
        setPageIndex((current) => current + 1);
      }
      if (event.key === "ArrowLeft" && pageIndex > 0) {
        setTurnDirection("previous");
        setPageIndex((current) => current - 1);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openAlbum, pageCount, pageIndex]);

  function turnPage(nextIndex: number) {
    if (nextIndex < 0 || nextIndex >= pageCount) return;
    setTurnDirection(nextIndex > pageIndex ? "next" : "previous");
    setPageIndex(nextIndex);
  }

  function printAlbum() {
    if (!openAlbum) return;
    const previousTitle = document.title;
    document.title = `${openAlbum.title} — Baby Tsubery`;
    window.print();
    window.setTimeout(() => { document.title = previousTitle; }, 250);
  }

  if (openAlbum) {
    const coverEntry = openAlbum.coverEntryId ? entriesById.get(openAlbum.coverEntryId) ?? null : null;
    const currentSpread = openSpreads[pageIndex - 1];
    const spreadFirstPage = pageIndex > 0 ? (pageIndex - 1) * 2 + 1 : 0;
    const spreadLastPage = currentSpread?.[1] ? spreadFirstPage + 1 : spreadFirstPage;
    return (
      <section className="album-reader" aria-labelledby="album-reader-title">
        <header className="album-reader-header no-print">
          <button className="album-back-button" type="button" onClick={() => setOpenAlbumId(null)}>
            <ArrowLeft size={18} aria-hidden="true" /> All albums
          </button>
          <div>
            <p className="eyebrow">Lay-flat photo album</p>
            <h1 id="album-reader-title" className="display-type" dir="auto">{openAlbum.title}</h1>
            <p>Turn each spread using the arrows below. The printed version keeps every designed page in this exact order.</p>
          </div>
          <button className="button button-secondary album-print-button" type="button" onClick={printAlbum}>
            <Printer size={18} aria-hidden="true" /> Print or save PDF
          </button>
        </header>

        <div className="album-flip-reader no-print">
          <p className="sr-only" aria-live="polite">{pageIndex === 0 ? "Album cover" : `Pages ${spreadFirstPage}${spreadLastPage > spreadFirstPage ? ` and ${spreadLastPage}` : ""} of ${openPages.length}`}</p>
          <div className={`album-flip-stage album-flip-stage--${pageIndex === 0 ? "cover" : "spread"}`}>
            <div className="album-sheet-stack" aria-hidden="true" />
            <div className={`album-turn album-turn--${turnDirection}`} key={`${pageIndex}-${turnDirection}`}>
              {pageIndex === 0 ? (
                <AlbumCoverPage album={openAlbum} coverEntry={coverEntry} albumEntries={openEntries} />
              ) : currentSpread ? (
                <div className="album-open-spread">
                  <AlbumDesignedPage page={currentSpread[0].page} entries={currentSpread[0].entries} pageNumber={spreadFirstPage} />
                  <div className="album-center-binding" aria-hidden="true" />
                  {currentSpread[1] ? (
                    <AlbumDesignedPage page={currentSpread[1].page} entries={currentSpread[1].entries} pageNumber={spreadLastPage} />
                  ) : (
                    <article className="album-sheet album-blank-page" aria-hidden="true"><BookHeart size={27} /><p className="display-type">More little moments to come.</p></article>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          <nav className="album-page-controls" aria-label="Album pages">
            <button type="button" onClick={() => turnPage(pageIndex - 1)} disabled={pageIndex === 0}>
              <ChevronLeft size={21} aria-hidden="true" /> Previous
            </button>
            <div className="album-page-progress" aria-hidden="true">
              {Array.from({ length: pageCount }, (_, index) => <span className={index === pageIndex ? "is-active" : ""} key={index} />)}
            </div>
            <span>{pageIndex === 0 ? "Cover" : spreadLastPage > spreadFirstPage ? `${spreadFirstPage}–${spreadLastPage}` : `${spreadFirstPage}`}</span>
            <button type="button" onClick={() => turnPage(pageIndex + 1)} disabled={pageIndex === pageCount - 1}>
              Next <ChevronRight size={21} aria-hidden="true" />
            </button>
          </nav>
        </div>

        <div className="album-print-document" aria-hidden="true">
          <AlbumCoverPage album={openAlbum} coverEntry={coverEntry} albumEntries={openEntries} />
          {openPages.map(({ page, entries: pageEntries }, index) => <AlbumDesignedPage page={page} entries={pageEntries} pageNumber={index + 1} key={page.id} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="albums-view" aria-labelledby="albums-title">
      <header className="albums-header">
        <div>
          <p className="eyebrow">Made to keep</p>
          <h1 id="albums-title" className="display-type">Albums to turn through together</h1>
          <p>Choose the cover, arrange every page, add longer stories, and print the finished book page by page.</p>
        </div>
        {role === "parent" && <button type="button" className="button button-primary" onClick={onCreateAlbum}><Plus size={19} aria-hidden="true" /> Create an album</button>}
      </header>

      {albums.length ? (
        <div className="album-shelf">
          {albums.map((album, index) => {
            const albumEntries = album.entryIds.map((id) => entriesById.get(id)).filter((entry): entry is MemoryEntry => Boolean(entry));
            const coverEntry = album.coverEntryId ? entriesById.get(album.coverEntryId) ?? null : null;
            return (
              <article className="album-card" key={album.id} data-cover={index % 3}>
                <button type="button" onClick={() => setOpenAlbumId(album.id)} aria-label={`Open ${album.title}, ${album.pages.length} ${album.pages.length === 1 ? "page" : "pages"}`}>
                  <div className={`album-cover${coverEntry ? " album-cover--photo" : " album-cover--type"}`}>
                    <div className="album-cover__spine" aria-hidden="true" />
                    {coverEntry && <div className="album-cover__window"><MemoryVisual entry={coverEntry} thumbnail /></div>}
                    {!coverEntry && <BookHeart className="album-cover__mark" size={31} strokeWidth={1.4} aria-hidden="true" />}
                    <div className="album-cover__label"><p>Baby Tsubery</p><h2 className="display-type" dir="auto">{album.title}</h2></div>
                    <p className="album-cover__edition">Noa &amp; Rotem · {album.pages.length} {album.pages.length === 1 ? "page" : "pages"}</p>
                  </div>
                  <div className="album-card-copy"><p dir="auto">{album.description || albumDateLine(albumEntries)}</p><span>Open and turn the pages <span aria-hidden="true">→</span></span></div>
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="albums-empty"><BookHeart size={30} aria-hidden="true" /><h2 className="display-type">The bookshelf is waiting</h2><p>Albums created from favorite journal entries will live here.</p></div>
      )}
    </section>
  );
}
