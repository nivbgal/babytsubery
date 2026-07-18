import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Plus, Settings2 } from "lucide-react";
import { AccessGate, type GuestInviteState } from "./components/AccessGate";
import { AlbumsView } from "./components/AlbumsView";
import { CalendarView } from "./components/CalendarView";
import { ParentStudio } from "./components/ParentStudio";
import { TodayView } from "./components/TodayView";
import { demoAlbums, demoEntries } from "./data/demo";
import { api, apiConfigured } from "./lib/api";
import type { Album, MemoryEntry, Role, ViewName } from "./types";
import "./App.css";

function newest(entries: MemoryEntry[]) {
  return [...entries].sort((a, b) => b.memoryDate.localeCompare(a.memoryDate) || b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

function friendlyError(error: unknown) {
  if (!(error instanceof Error)) return "Something went wrong. Please try again.";
  if (error.message.includes("invalid_credentials")) return "That password didn’t match. Please try again.";
  if (error.message.includes("authentication_required")) return "Your private session has expired. Please open the invitation again.";
  return "The private journal service is unavailable right now. Please try again shortly.";
}

export default function App() {
  const [role, setRole] = useState<Role>("anonymous");
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [nickname, setNickname] = useState("Baby T");
  const [view, setView] = useState<ViewName>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [guestInviteState, setGuestInviteState] = useState<GuestInviteState>("none");
  const [demoMode, setDemoMode] = useState(false);

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? newest(entries),
    [entries, selectedId],
  );

  const loadJournal = useCallback(async () => {
    const journal = await api.journal();
    setEntries(journal.entries);
    setAlbums(journal.albums);
    setNickname(journal.nickname || "Baby T");
    setSelectedId((current) => current && journal.entries.some((entry) => entry.id === current) ? current : newest(journal.entries)?.id ?? null);
  }, []);

  useEffect(() => {
    let active = true;
    async function start() {
      if (!apiConfigured) {
        if (active) setBooting(false);
        return;
      }
      try {
        const url = new URL(window.location.href);
        const invite = url.searchParams.get("invite");
        let session;
        if (invite) {
          setGuestInviteState("checking");
          try {
            session = await api.guestLogin(invite);
            url.searchParams.delete("invite");
            window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
            setGuestInviteState("none");
          } catch (error) {
            if (active) {
              setGuestInviteState(error instanceof Error && error.message.includes("expired") ? "expired" : "invalid");
              setBooting(false);
            }
            return;
          }
        } else {
          session = await api.session();
        }
        if (!active) return;
        setRole(session.role);
        if (session.role !== "anonymous") await loadJournal();
      } catch (error) {
        if (active) setFatalError(friendlyError(error));
      } finally {
        if (active) setBooting(false);
      }
    }
    void start();
    return () => { active = false; };
  }, [loadJournal]);

  async function parentLogin(password: string) {
    if (!apiConfigured) throw new Error("The private API has not been connected yet. Use the demo preview for now.");
    const session = await api.parentLogin(password);
    setRole(session.role);
    await loadJournal();
  }

  function openDemo() {
    setDemoMode(true);
    setRole("parent");
    setEntries(demoEntries);
    setAlbums(demoAlbums);
    setNickname("Baby T");
    setSelectedId(demoEntries[0].id);
  }

  function chooseEntry(entry: MemoryEntry) {
    setSelectedId(entry.id);
    setView("today");
  }

  async function uploadMemory(formData: FormData) {
    if (demoMode) throw new Error("Uploads become available when the private Cloudflare service is connected.");
    await api.uploadMemory(formData);
    try {
      await loadJournal();
    } catch {
      // The photo is already safely stored. Retry the view refresh without
      // reporting the completed upload as a failure to the parents.
      window.setTimeout(() => { void loadJournal().catch(() => undefined); }, 1200);
    }
  }

  async function saveAlbum(album: Pick<Album, "title" | "description" | "entryIds">) {
    if (demoMode) throw new Error("Album saving becomes available when the private Cloudflare service is connected.");
    await api.saveAlbum(album);
    await loadJournal();
  }

  async function rotateInvite() {
    if (demoMode) throw new Error("Invitation links become available when the private Cloudflare service is connected.");
    const { token } = await api.rotateInvite();
    const inviteUrl = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // The parent studio still shows the URL when clipboard access is unavailable.
    }
    return inviteUrl;
  }

  async function logout() {
    if (!demoMode && apiConfigured) await api.logout();
    setRole("anonymous");
    setEntries([]);
    setAlbums([]);
    setSelectedId(null);
    setDemoMode(false);
    setStudioOpen(false);
  }

  if (booting) {
    return <main className="status-message" role="status">Opening the private family journal…</main>;
  }

  if (role === "anonymous") {
    return (
      <>
        {fatalError && <p className="app-global-error" role="alert">{fatalError}</p>}
        <AccessGate
          onParentLogin={parentLogin}
          guestInviteState={guestInviteState}
          demoPreview={!apiConfigured}
          onDemoPreview={openDemo}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <div>
          <p className="brand-kicker">Our private family journal</p>
          <p className="brand-title">Welcome to the world<br />Baby Tsubery</p>
        </div>

        <nav className="primary-nav" aria-label="Journal views">
          {(["today", "calendar", "albums"] as ViewName[]).map((item) => (
            <button
              className="nav-button"
              type="button"
              key={item}
              aria-current={view === item ? "page" : undefined}
              onClick={() => setView(item)}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {demoMode && <span className="demo-badge">Design preview</span>}
          {role === "parent" && (
            <button className="button button-primary" type="button" onClick={() => setStudioOpen(true)} aria-label="Add a memory">
              <Plus size={19} aria-hidden="true" /> <span>Add a memory</span>
            </button>
          )}
          {role === "parent" && (
            <button className="icon-button" type="button" onClick={() => setStudioOpen(true)} aria-label="Parent settings">
              <Settings2 size={19} aria-hidden="true" />
            </button>
          )}
          <button className="icon-button" type="button" onClick={() => void logout()} aria-label="Leave the private journal">
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="view-container">
        {view === "today" && (
          <TodayView entries={entries} currentEntry={selectedEntry} nickname={nickname} onSelectEntry={chooseEntry} />
        )}
        {view === "calendar" && <CalendarView entries={entries} onSelectEntry={chooseEntry} />}
        {view === "albums" && (
          <AlbumsView albums={albums} entries={entries} role={role} onCreateAlbum={() => setStudioOpen(true)} />
        )}
      </main>

      {role === "parent" && (
        <ParentStudio
          isOpen={studioOpen}
          memories={entries}
          onClose={() => setStudioOpen(false)}
          onUpload={uploadMemory}
          onSaveAlbum={saveAlbum}
          onRotateInvite={rotateInvite}
        />
      )}
    </div>
  );
}
