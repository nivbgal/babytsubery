import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("production shell protects indexing and points to the custom domain", async () => {
  const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /noindex, nofollow, noarchive/);
  assert.match(html, /Welcome to the World, Baby Tsubery/);
});

test("GitHub Pages keeps the custom domain", async () => {
  const cname = await readFile(new URL("../dist/CNAME", import.meta.url), "utf8");
  assert.equal(cname.trim(), "babytsubery.com");
});

test("iPhone photo preparation has HEIC support and a JPEG encoding fallback", async () => {
  const studio = await readFile(new URL("../src/components/ParentStudio.tsx", import.meta.url), "utf8");
  assert.match(studio, /accept="image\/\*,\.heic,\.heif"/);
  assert.match(studio, /webpBlob\?\.type === "image\/webp"/);
  assert.match(studio, /await encode\("image\/jpeg"\)/);
});

test("mobile parent inputs avoid Safari focus zoom", async () => {
  const studioCss = await readFile(new URL("../src/components/ParentStudio.css", import.meta.url), "utf8");
  const accessCss = await readFile(new URL("../src/components/AccessGate.css", import.meta.url), "utf8");
  assert.match(studioCss, /font-size: 1rem/);
  assert.match(studioCss, /scroll-padding-block/);
  assert.match(accessCss, /font-size: 1rem/);
});

test("authentication transitions reset Safari's retained login scroll", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /\[role, view\]/);
  assert.match(app, /afterKeyboardCloses/);
  assert.match(app, /document\.documentElement\.scrollTop = 0/);
});

test("mobile Today view fits short memories into the dynamic viewport", async () => {
  const todayCss = await readFile(new URL("../src/components/TodayView.css", import.meta.url), "utf8");
  assert.match(todayCss, /\.today-photo\.memory-visual/);
  assert.match(todayCss, /height: clamp\(280px, 44dvh, 380px\)/);
  assert.match(todayCss, /max-height: 720px/);
  assert.match(todayCss, /height: clamp\(220px, 38dvh, 280px\)/);
  assert.match(todayCss, /height: clamp\(170px, 32dvh, 220px\)/);
});

test("Apple share and install metadata use the branded icon", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"));
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/site\.webmanifest"/);
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
});

test("bottom navigation uses a shared animated selection pill", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  assert.match(app, /data-active-view=\{view\}/);
  assert.match(styles, /\.primary-nav::before/);
  assert.match(styles, /translate3d\(200%, 0, 0\)/);
  assert.match(styles, /cubic-bezier\(\.16, 1\.18, \.28, 1\)/);
});

test("album creation exits the studio and opens the album shelf", async () => {
  const app = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
  assert.match(app, /async function saveAlbum[\s\S]*setView\("albums"\);[\s\S]*setStudioOpen\(false\)/);
});

test("albums render as spiral page-turn books and export one portrait page per sheet", async () => {
  const albums = await readFile(new URL("../src/components/AlbumsView.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/components/AlbumsView.css", import.meta.url), "utf8");
  assert.match(albums, /className="spiral-binding"/);
  assert.match(albums, /turnPage\(pageIndex \+ 1\)/);
  assert.match(albums, /className="album-print-document"/);
  assert.match(styles, /@page \{ size: A4 portrait; margin: 0; \}/);
  assert.match(styles, /height: 297mm !important/);
  assert.match(styles, /break-after: page/);
});

test("album creation stores explicit covers and parent-designed pages", async () => {
  const studio = await readFile(new URL("../src/components/ParentStudio.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");
  const migration = await readFile(new URL("../worker/migrations/0003_album_page_design.sql", import.meta.url), "utf8");
  assert.match(studio, /Choose the cover/);
  assert.match(studio, /Text-only cover/);
  assert.match(studio, /Design the pages/);
  assert.match(studio, /coverEntryId/);
  assert.match(worker, /validateAlbumPages/);
  assert.match(migration, /cover_entry_id/);
  assert.match(migration, /pages_json/);
});
