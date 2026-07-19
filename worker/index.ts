interface Env {
  DB: D1Database;
  PHOTOS: R2Bucket;
  PARENT_PASSWORD_HASH: string;
  JOURNAL_NICKNAME?: string;
}

type Role = "parent" | "guest";

const SESSION_COOKIE = "babytsubery_session";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const SESSION_TTL_SECONDS: Record<Role, number> = {
  parent: 30 * 24 * 60 * 60,
  guest: 7 * 24 * 60 * 60,
};
const ALLOWED_ORIGINS = new Set([
  "https://babytsubery.com",
  "https://www.babytsubery.com",
  "http://localhost:3000",
]);
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

interface SessionRow {
  role: Role;
  expires_at: string;
}

interface EntryRow {
  id: string;
  memory_date: string;
  caption: string | null;
  image_key: string;
  image_alt: string;
  created_at: string;
}

interface AlbumRow {
  id: string;
  title: string;
  description: string | null;
  cover_entry_id: string | null;
  pages_json: string | null;
  created_at: string;
}

type AlbumPageLayout = "classic" | "story" | "full" | "duo";

interface AlbumPagePayload {
  id: string;
  entryIds: string[];
  layout: AlbumPageLayout;
  title: string | null;
  text: string | null;
}

interface OccasionRow {
  id: string;
  occasion_date: string;
  title: string;
  description: string | null;
  type: "birthday" | "milestone" | "celebration" | "custom";
  created_at: string;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env): Promise<Response> {
    const origin = request.headers.get("Origin");
    if (origin && !ALLOWED_ORIGINS.has(origin)) return withHeaders(json({ error: "origin_not_allowed" }, 403), null);

    if (request.method === "OPTIONS") {
      if (!origin) return withHeaders(new Response(null, { status: 204 }), null);
      return withHeaders(new Response(null, { status: 204 }), origin);
    }

    try {
      const response = await route(request, env);
      return withHeaders(response, origin);
    } catch (error) {
      if (error instanceof HttpError) return withHeaders(json({ error: error.code }, error.status), origin);
      console.error("Unhandled API error", error instanceof Error ? error.message : "unknown");
      return withHeaders(json({ error: "internal_error" }, 500), origin);
    }
  },
};

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, "") || "/";

  if (request.method === "GET" && path === "/v1/session") {
    const session = await getSession(request, env);
    return json(session ? { role: session.role, expiresAt: session.expiresAt } : { role: "anonymous" });
  }

  if (request.method === "POST" && path === "/v1/auth/parent") {
    const body = await readJson<{ password?: unknown }>(request);
    if (typeof body.password !== "string" || !(await verifyPassword(body.password, await parentPasswordHash(env)))) {
      throw new HttpError(401, "invalid_credentials");
    }
    return createSessionResponse(request, env, "parent");
  }

  if (request.method === "POST" && path === "/v1/auth/password") {
    await requireParent(request, env);
    const body = await readJson<{ currentPassword?: unknown; newPassword?: unknown }>(request);
    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") throw new HttpError(400, "invalid_password");
    if (body.newPassword.length < 12 || body.newPassword.length > 256) throw new HttpError(400, "password_too_short");
    if (!(await verifyPassword(body.currentPassword, await parentPasswordHash(env)))) throw new HttpError(401, "invalid_credentials");
    await env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('parent_password_hash', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
      .bind(await hashPassword(body.newPassword), new Date().toISOString()).run();
    return json({ ok: true });
  }

  if (request.method === "POST" && path === "/v1/auth/guest") {
    const body = await readJson<{ token?: unknown }>(request);
    if (typeof body.token !== "string" || body.token.length < 20 || body.token.length > 256) {
      throw new HttpError(401, "invalid_invitation");
    }
    const candidateHash = await sha256Hex(body.token);
    const active = await env.DB.prepare(
      "SELECT token_hash FROM guest_invites WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1",
    ).first<{ token_hash: string }>();
    if (!active || !constantTimeEqual(candidateHash, active.token_hash)) {
      throw new HttpError(401, "invalid_invitation");
    }
    return createSessionResponse(request, env, "guest");
  }

  if (request.method === "POST" && path === "/v1/auth/logout") {
    const token = cookieValue(request, SESSION_COOKIE);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(request) });
  }

  if (request.method === "GET" && path === "/v1/journal") {
    await requireSession(request, env);
    return getJournal(request, env);
  }

  if (request.method === "POST" && path === "/v1/entries") {
    await requireParent(request, env);
    return createEntry(request, env);
  }

  const entryMatch = path.match(/^\/v1\/entries\/([^/]+)$/);
  if (request.method === "DELETE" && entryMatch) {
    await requireParent(request, env);
    return deleteEntry(decodeURIComponent(entryMatch[1]), env);
  }

  const mediaMatch = path.match(/^\/v1\/media\/(.+)$/);
  if (request.method === "GET" && mediaMatch) {
    await requireSession(request, env);
    return getMedia(decodeURIComponent(mediaMatch[1]), env);
  }

  if (request.method === "POST" && path === "/v1/albums") {
    await requireParent(request, env);
    return createAlbum(request, env);
  }

  if (request.method === "POST" && path === "/v1/occasions") {
    await requireParent(request, env);
    return createOccasion(request, env);
  }

  const occasionMatch = path.match(/^\/v1\/occasions\/([^/]+)$/);
  if (request.method === "DELETE" && occasionMatch) {
    await requireParent(request, env);
    return deleteOccasion(decodeURIComponent(occasionMatch[1]), env);
  }

  if (request.method === "POST" && path === "/v1/invites/rotate") {
    await requireParent(request, env);
    return rotateInvitation(env);
  }

  throw new HttpError(404, "not_found");
}

async function getSession(request: Request, env: Env): Promise<{ role: Role; expiresAt: string } | null> {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return null;
  const hash = await sha256Hex(token);
  const row = await env.DB.prepare(
    "SELECT role, expires_at FROM sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(hash, new Date().toISOString()).first<SessionRow>();
  if (!row) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(hash).run();
    return null;
  }
  return { role: row.role, expiresAt: row.expires_at };
}

async function requireSession(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) throw new HttpError(401, "authentication_required");
  return session;
}

async function requireParent(request: Request, env: Env) {
  const session = await requireSession(request, env);
  if (session.role !== "parent") throw new HttpError(403, "parent_access_required");
  return session;
}

async function createSessionResponse(request: Request, env: Env, role: Role): Promise<Response> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS[role] * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(new Date().toISOString()),
    env.DB.prepare("INSERT INTO sessions (token_hash, role, expires_at) VALUES (?, ?, ?)")
      .bind(await sha256Hex(token), role, expiresAt),
  ]);
  return json(
    { role, expiresAt },
    200,
    { "Set-Cookie": sessionCookie(request, token, SESSION_TTL_SECONDS[role]) },
  );
}

async function getJournal(request: Request, env: Env): Promise<Response> {
  const entriesResult = await env.DB.prepare(
    "SELECT id, memory_date, caption, image_key, image_alt, created_at FROM entries ORDER BY memory_date DESC, created_at DESC",
  ).all<EntryRow>();
  const albumsResult = await env.DB.prepare(
    "SELECT id, title, description, cover_entry_id, pages_json, created_at FROM albums ORDER BY created_at DESC",
  ).all<AlbumRow>();
  const albumEntryResult = await env.DB.prepare(
    "SELECT album_id, entry_id FROM album_entries ORDER BY album_id, position",
  ).all<{ album_id: string; entry_id: string }>();
  const occasionsResult = await env.DB.prepare(
    "SELECT id, occasion_date, title, description, type, created_at FROM occasions ORDER BY occasion_date ASC, created_at ASC",
  ).all<OccasionRow>();

  const entries = entriesResult.results.map((entry) => ({
    id: entry.id,
    memoryDate: entry.memory_date,
    caption: entry.caption,
    imageUrl: mediaUrl(entry.image_key, request.url),
    thumbUrl: mediaUrl(entry.image_key, request.url),
    imageAlt: entry.image_alt,
    createdAt: entry.created_at,
  }));
  const entryKeyById = new Map(entriesResult.results.map((entry) => [entry.id, entry.image_key]));
  const idsByAlbum = new Map<string, string[]>();
  for (const item of albumEntryResult.results) {
    const ids = idsByAlbum.get(item.album_id) ?? [];
    ids.push(item.entry_id);
    idsByAlbum.set(item.album_id, ids);
  }
  const albums = albumsResult.results.map((album) => {
    const entryIds = idsByAlbum.get(album.id) ?? [];
    const coverKey = album.cover_entry_id ? entryKeyById.get(album.cover_entry_id) : undefined;
    const pages = parseAlbumPages(album.pages_json, entryIds);
    return {
      id: album.id,
      title: album.title,
      description: album.description,
      coverEntryId: album.cover_entry_id,
      coverUrl: coverKey ? mediaUrl(coverKey, request.url) : null,
      entryIds,
      pages,
      createdAt: album.created_at,
    };
  });

  const occasions = occasionsResult.results.map((occasion) => ({
    id: occasion.id,
    occasionDate: occasion.occasion_date,
    title: occasion.title,
    description: occasion.description,
    type: occasion.type,
    createdAt: occasion.created_at,
  }));

  return json({ entries, albums, occasions, nickname: env.JOURNAL_NICKNAME?.trim() || "Our little one" });
}

async function createEntry(request: Request, env: Env): Promise<Response> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > MAX_IMAGE_BYTES + 1024 * 1024) throw new HttpError(413, "image_too_large");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    throw new HttpError(400, "invalid_multipart_form");
  }
  const image = form.get("image") ?? form.get("photo");
  const memoryDate = form.get("date") ?? form.get("memoryDate");
  const caption = form.get("caption");
  const alt = form.get("alt") ?? form.get("imageAlt");
  if (!(image instanceof File)) throw new HttpError(400, "image_required");
  if (typeof memoryDate !== "string" || !isDate(memoryDate)) throw new HttpError(400, "invalid_date");
  if (typeof caption !== "string" && caption !== null) throw new HttpError(400, "invalid_caption");
  if (typeof alt !== "string" && alt !== null) throw new HttpError(400, "invalid_alt_text");
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) throw new HttpError(413, "image_too_large");
  if (!IMAGE_TYPES.has(image.type) || !(await validImageSignature(image))) throw new HttpError(415, "unsupported_image");
  if ((caption?.length ?? 0) > 2000 || (alt?.length ?? 0) > 500) throw new HttpError(400, "text_too_long");

  const id = crypto.randomUUID();
  const extension = extensionFor(image.type);
  const key = `entries/${id}.${extension}`;
  const createdAt = new Date().toISOString();
  const cleanedCaption = cleanOptional(caption);
  const generatedAlt = cleanOptional(alt) || cleanedCaption || "Baby Tsubery daily photograph";
  await env.PHOTOS.put(key, image.stream(), {
    httpMetadata: { contentType: image.type, cacheControl: "private, max-age=86400" },
    customMetadata: { entryId: id },
  });
  try {
    await env.DB.prepare(
      "INSERT INTO entries (id, memory_date, caption, image_key, image_type, image_alt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, memoryDate, cleanedCaption, key, image.type, generatedAlt, createdAt).run();
  } catch (error) {
    await env.PHOTOS.delete(key);
    throw error;
  }
  return json({ id }, 201);
}

async function deleteEntry(id: string, env: Env): Promise<Response> {
  if (!isId(id)) throw new HttpError(404, "entry_not_found");
  const entry = await env.DB.prepare("SELECT image_key FROM entries WHERE id = ?").bind(id).first<{ image_key: string }>();
  if (!entry) throw new HttpError(404, "entry_not_found");
  await env.DB.prepare("DELETE FROM entries WHERE id = ?").bind(id).run();
  await env.PHOTOS.delete(entry.image_key);
  return json({ ok: true });
}

async function getMedia(key: string, env: Env): Promise<Response> {
  if (!/^entries\/[0-9a-f-]{36}\.(?:jpg|png|webp|avif)$/.test(key)) throw new HttpError(404, "media_not_found");
  const authorized = await env.DB.prepare("SELECT 1 AS found FROM entries WHERE image_key = ?").bind(key).first();
  if (!authorized) throw new HttpError(404, "media_not_found");
  const object = await env.PHOTOS.get(key);
  if (!object) throw new HttpError(404, "media_not_found");
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "private, max-age=3600");
  if (object.httpEtag) headers.set("ETag", object.httpEtag);
  return new Response(object.body, { headers });
}

async function createAlbum(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ title?: unknown; description?: unknown; coverEntryId?: unknown; entryIds?: unknown; pages?: unknown }>(request);
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 160) {
    throw new HttpError(400, "invalid_album_title");
  }
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
    throw new HttpError(400, "invalid_album_description");
  }
  if (typeof body.description === "string" && body.description.length > 2000) throw new HttpError(400, "text_too_long");
  if (!Array.isArray(body.entryIds) || body.entryIds.length > 500 || body.entryIds.some((id) => typeof id !== "string" || !isId(id))) {
    throw new HttpError(400, "invalid_entry_ids");
  }
  const entryIds = body.entryIds as string[];
  if (new Set(entryIds).size !== entryIds.length) throw new HttpError(400, "duplicate_entry_ids");
  if (entryIds.length) {
    const placeholders = entryIds.map(() => "?").join(",");
    const rows = await env.DB.prepare(`SELECT id FROM entries WHERE id IN (${placeholders})`).bind(...entryIds).all<{ id: string }>();
    if (rows.results.length !== entryIds.length) throw new HttpError(400, "entry_not_found");
  }
  if (body.coverEntryId !== undefined && body.coverEntryId !== null && (typeof body.coverEntryId !== "string" || !entryIds.includes(body.coverEntryId))) {
    throw new HttpError(400, "invalid_cover_entry");
  }
  const pages = validateAlbumPages(body.pages, entryIds);
  const id = crypto.randomUUID();
  const statements = [
    env.DB.prepare("INSERT INTO albums (id, title, description, cover_entry_id, pages_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, body.title.trim(), cleanOptional(body.description), body.coverEntryId ?? null, JSON.stringify(pages), new Date().toISOString()),
    ...entryIds.map((entryId, position) =>
      env.DB.prepare("INSERT INTO album_entries (album_id, entry_id, position) VALUES (?, ?, ?)").bind(id, entryId, position),
    ),
  ];
  await env.DB.batch(statements);
  return json({ id }, 201);
}

function defaultAlbumPages(entryIds: string[]): AlbumPagePayload[] {
  const pages: AlbumPagePayload[] = [];
  for (let index = 0; index < entryIds.length; index += 2) {
    const pageEntryIds = entryIds.slice(index, index + 2);
    pages.push({
      id: crypto.randomUUID(),
      entryIds: pageEntryIds,
      layout: pageEntryIds.length === 2 ? "duo" : "classic",
      title: null,
      text: null,
    });
  }
  return pages;
}

function validateAlbumPages(value: unknown, albumEntryIds: string[]): AlbumPagePayload[] {
  if (value === undefined || value === null) return defaultAlbumPages(albumEntryIds);
  if (!Array.isArray(value) || value.length > 500) throw new HttpError(400, "invalid_album_pages");

  const layouts = new Set<AlbumPageLayout>(["classic", "story", "full", "duo"]);
  const pages: AlbumPagePayload[] = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") throw new HttpError(400, "invalid_album_page");
    const page = candidate as Record<string, unknown>;
    if (typeof page.id !== "string" || !isId(page.id)) throw new HttpError(400, "invalid_album_page_id");
    if (!Array.isArray(page.entryIds) || page.entryIds.length < 1 || page.entryIds.length > 2 || page.entryIds.some((id) => typeof id !== "string" || !albumEntryIds.includes(id))) {
      throw new HttpError(400, "invalid_album_page_entries");
    }
    if (new Set(page.entryIds).size !== page.entryIds.length) throw new HttpError(400, "duplicate_album_page_entry");
    if (typeof page.layout !== "string" || !layouts.has(page.layout as AlbumPageLayout)) throw new HttpError(400, "invalid_album_page_layout");
    if ((page.layout === "duo") !== (page.entryIds.length === 2)) throw new HttpError(400, "invalid_album_page_layout");
    if (page.title !== undefined && page.title !== null && typeof page.title !== "string") throw new HttpError(400, "invalid_album_page_title");
    if (page.text !== undefined && page.text !== null && typeof page.text !== "string") throw new HttpError(400, "invalid_album_page_text");
    if (typeof page.title === "string" && page.title.length > 160) throw new HttpError(400, "text_too_long");
    if (typeof page.text === "string" && page.text.length > 2000) throw new HttpError(400, "text_too_long");
    return {
      id: page.id,
      entryIds: page.entryIds as string[],
      layout: page.layout as AlbumPageLayout,
      title: cleanOptional(page.title),
      text: cleanOptional(page.text),
    };
  });

  const plannedIds = pages.flatMap((page) => page.entryIds);
  if (plannedIds.length !== albumEntryIds.length || new Set(plannedIds).size !== plannedIds.length || albumEntryIds.some((id) => !plannedIds.includes(id))) {
    throw new HttpError(400, "album_pages_do_not_match_entries");
  }
  return pages;
}

function parseAlbumPages(value: string | null, albumEntryIds: string[]): AlbumPagePayload[] {
  if (!value) return defaultAlbumPages(albumEntryIds);
  try {
    return validateAlbumPages(JSON.parse(value), albumEntryIds);
  } catch {
    return defaultAlbumPages(albumEntryIds);
  }
}

async function createOccasion(request: Request, env: Env): Promise<Response> {
  const body = await readJson<{ occasionDate?: unknown; title?: unknown; description?: unknown; type?: unknown }>(request);
  const types = new Set(["birthday", "milestone", "celebration", "custom"]);
  if (typeof body.occasionDate !== "string" || !isDate(body.occasionDate)) throw new HttpError(400, "invalid_date");
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 160) throw new HttpError(400, "invalid_occasion_title");
  if (body.description !== undefined && body.description !== null && typeof body.description !== "string") throw new HttpError(400, "invalid_occasion_description");
  if (typeof body.description === "string" && body.description.length > 500) throw new HttpError(400, "text_too_long");
  if (typeof body.type !== "string" || !types.has(body.type)) throw new HttpError(400, "invalid_occasion_type");
  const id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO occasions (id, occasion_date, title, description, type, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, body.occasionDate, body.title.trim(), cleanOptional(body.description), body.type, new Date().toISOString()).run();
  return json({ id }, 201);
}

async function deleteOccasion(id: string, env: Env): Promise<Response> {
  if (!isId(id)) throw new HttpError(404, "occasion_not_found");
  const result = await env.DB.prepare("DELETE FROM occasions WHERE id = ?").bind(id).run();
  if (!result.meta.changes) throw new HttpError(404, "occasion_not_found");
  return json({ ok: true });
}

async function rotateInvitation(env: Env): Promise<Response> {
  const token = randomToken(32);
  const now = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE guest_invites SET revoked_at = ? WHERE revoked_at IS NULL").bind(now),
    env.DB.prepare("DELETE FROM sessions WHERE role = 'guest'"),
    env.DB.prepare("INSERT INTO guest_invites (id, token_hash, created_at) VALUES (?, ?, ?)")
      .bind(crypto.randomUUID(), await sha256Hex(token), now),
  ]);
  return json({ token }, 201);
}

async function readJson<T>(request: Request): Promise<T> {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 32 * 1024) throw new HttpError(413, "request_too_large");
  if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "json_required");
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 32 * 1024) throw new HttpError(413, "request_too_large");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const parts = encoded?.split("$") ?? [];
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations !== 100_000) return false;
  try {
    const salt = fromBase64(parts[2]);
    const expected = fromBase64(parts[3]);
    if (salt.byteLength < 16 || expected.byteLength !== 32) return false;
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const actual = new Uint8Array(await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations },
      key,
      256,
    ));
    return constantTimeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function parentPasswordHash(env: Env): Promise<string> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = 'parent_password_hash'").first<{ value: string }>();
  return row?.value || env.PARENT_PASSWORD_HASH;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt.buffer as ArrayBuffer, iterations: 100_000 }, key, 256));
  return `pbkdf2_sha256$100000$${base64(salt)}$${base64(bits)}`;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string | Uint8Array, right: string | Uint8Array): boolean {
  const a = typeof left === "string" ? new TextEncoder().encode(left) : left;
  const b = typeof right === "string" ? new TextEncoder().encode(right) : right;
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index % Math.max(a.length, 1)] ?? 0) ^ (b[index % Math.max(b.length, 1)] ?? 0);
  return difference === 0;
}

async function validImageSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (file.type === "image/webp") return ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP";
  if (file.type === "image/avif") return ascii(bytes, 4, 4) === "ftyp" && ["avif", "avis"].includes(ascii(bytes, 8, 4));
  return false;
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.slice(start, start + length));
}

function randomToken(byteLength: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base64Url(bytes);
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function sessionCookie(request: Request, token: string, maxAge: number): string {
  const secure = new URL(request.url).hostname !== "localhost";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

function clearSessionCookie(request: Request): string {
  const secure = new URL(request.url).hostname !== "localhost";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`;
}

function mediaUrl(key: string, requestUrl: string): string {
  const path = `/v1/media/${key.split("/").map(encodeURIComponent).join("/")}`;
  return new URL(path, requestUrl).toString();
}

function cleanOptional(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function isId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extensionFor(type: string): string {
  return type === "image/jpeg" ? "jpg" : type.slice("image/".length);
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function withHeaders(response: Response, origin: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  headers.set("Cache-Control", headers.get("Cache-Control") || "no-store");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.append("Vary", "Origin");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default worker;
