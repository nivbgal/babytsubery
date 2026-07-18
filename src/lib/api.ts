import type { Album, JournalPayload, Occasion, Session } from "../types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_BASE) throw new Error("API_NOT_CONFIGURED");
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...init,
    headers: { ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...init?.headers },
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const apiConfigured = Boolean(API_BASE);
export const api = {
  session: () => request<Session>("/v1/session"),
  journal: () => request<JournalPayload>("/v1/journal"),
  parentLogin: (password: string) => request<Session>("/v1/auth/parent", { method: "POST", body: JSON.stringify({ password }) }),
  changePassword: (currentPassword: string, newPassword: string) => request<{ ok: true }>("/v1/auth/password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  guestLogin: (token: string) => request<Session>("/v1/auth/guest", { method: "POST", body: JSON.stringify({ token }) }),
  logout: () => request<{ ok: true }>("/v1/auth/logout", { method: "POST" }),
  uploadMemory: (form: FormData) => request<{ id: string }>("/v1/entries", { method: "POST", body: form }),
  deleteMemory: (id: string) => request<{ ok: true }>(`/v1/entries/${id}`, { method: "DELETE" }),
  saveAlbum: (album: Pick<Album, "title" | "description" | "entryIds">) => request<{ id: string }>("/v1/albums", { method: "POST", body: JSON.stringify(album) }),
  saveOccasion: (occasion: Pick<Occasion, "occasionDate" | "title" | "description" | "type">) => request<{ id: string }>("/v1/occasions", { method: "POST", body: JSON.stringify(occasion) }),
  deleteOccasion: (id: string) => request<{ ok: true }>(`/v1/occasions/${id}`, { method: "DELETE" }),
  rotateInvite: () => request<{ token: string }>("/v1/invites/rotate", { method: "POST" }),
};
