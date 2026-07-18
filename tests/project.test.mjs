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
