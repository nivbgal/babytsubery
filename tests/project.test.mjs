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
  assert.match(todayCss, /height: clamp\(280px, 44dvh, 380px\)/);
  assert.match(todayCss, /max-height: 720px/);
  assert.match(todayCss, /height: clamp\(220px, 38dvh, 280px\)/);
});

test("Apple share and install metadata use the branded icon", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(await readFile(new URL("../public/site.webmanifest", import.meta.url), "utf8"));
  assert.match(html, /rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/);
  assert.match(html, /rel="manifest" href="\/site\.webmanifest"/);
  assert.deepEqual(manifest.icons.map(({ sizes }) => sizes), ["192x192", "512x512"]);
});
