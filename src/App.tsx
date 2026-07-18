import { useCallback, useEffect, useMemo, useState } from "react";
import { LogOut, Plus, Share2 } from "lucide-react";
import { AccessGate, type GuestInviteState } from "./components/AccessGate";
import { AlbumsView } from "./components/AlbumsView";
import { CalendarView } from "./components/CalendarView";
import { ParentStudio, type StudioSection } from "./components/ParentStudio";
import { TodayView } from "./components/TodayView";
import { api, apiConfigured } from "./lib/api";
import type { Album, MemoryEntry, Occasion, Role, ViewName } from "./types";
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
  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [nickname, setNickname] = useState("Baby T");
  const [view, setView] = useState<ViewName>("today");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [guestInviteState, setGuestInviteState] = useState<GuestInviteState>("none");
  const [studioSection, setStudioSection] = useState<StudioSection>("memory");

  function openStudio(section: StudioSection) {
    setStudioSection(section);
    setStudioOpen(true);
  }

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedId) ?? newest(entries),
    [entries, selectedId],
  );

  const loadJournal = useCallback(async (preferredEntryId?: string) => {
    const journal = await api.journal();
    setEntries(journal.entries);
    setAlbums(journal.albums);
    setOccasions(journal.occasions ?? []);
    setNickname(journal.nickname || "Baby T");
    setSelectedId((current) => {
      if (preferredEntryId && journal.entries.some((entry) => entry.id === preferredEntryId)) return preferredEntryId;
      return current && journal.entries.some((entry) => entry.id === current)
        ? current
        : newest(journal.entries)?.id ?? null;
    });
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
    if (!apiConfigured) throw new Error("The private journal service is not connected yet.");
    const session = await api.parentLogin(password);
    setRole(session.role);
    await loadJournal();
  }

  function chooseEntry(entry: MemoryEntry) {
    setSelectedId(entry.id);
    setView("today");
  }

  async function uploadMemory(formData: FormData) {
    const uploaded = await api.uploadMemory(formData);
    setSelectedId(uploaded.id);
    setView("today");
    setStudioOpen(false);
    try {
      await loadJournal(uploaded.id);
    } catch {
      // The photo is already safely stored. Retry the view refresh without
      // reporting the completed upload as a failure to the parents.
      window.setTimeout(() => { void loadJournal(uploaded.id).catch(() => undefined); }, 1200);
    }
  }

  async function saveAlbum(album: Pick<Album, "title" | "description" | "entryIds">) {
    await api.saveAlbum(album);
    await loadJournal();
  }

  async function rotateInvite() {
    const { token } = await api.rotateInvite();
    const inviteUrl = `${window.location.origin}/?invite=${encodeURIComponent(token)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // The parent studio still shows the URL when clipboard access is unavailable.
    }
    return inviteUrl;
  }

  async function changePassword(currentPassword: string, newPassword: string) {
    await api.changePassword(currentPassword, newPassword);
  }

  async function saveOccasion(occasion: Pick<Occasion, "occasionDate" | "title" | "description" | "type">) {
    await api.saveOccasion(occasion);
    await loadJournal();
  }

  async function deleteOccasion(id: string) {
    await api.deleteOccasion(id);
    await loadJournal();
  }

  async function logout() {
    if (apiConfigured) await api.logout();
    setRole("anonymous");
    setEntries([]);
    setAlbums([]);
    setSelectedId(null);
    setStudioOpen(false);
  }

  if (booting) {
    return <main className="status-message" role="status">Opening Noa &amp; Rotem’s journal…</main>;
  }

  if (role === "anonymous") {
    return (
      <>
        {fatalError && <p className="app-global-error" role="alert">{fatalError}</p>}
        <AccessGate
          onParentLogin={parentLogin}
          guestInviteState={guestInviteState}
        />
      </>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header no-print">
        <div>
          <p className="brand-kicker">A little life, day by day</p>
          <p className="brand-title">Welcome to the World,<br />Baby Tsubery</p>
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
          {role === "parent" && (
            <button className="button button-primary" type="button" onClick={() => openStudio("memory")} aria-label="Add a memory">
              <Plus size={19} aria-hidden="true" /> <span>Add a memory</span>
            </button>
          )}
          {role === "parent" && (
            <button className="icon-button" type="button" onClick={() => openStudio("settings")} aria-label="Family access">
              <Share2 size={19} aria-hidden="true" />
            </button>
          )}
          <button className="icon-button" type="button" onClick={() => void logout()} aria-label="Leave the private journal">
            <LogOut size={19} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="view-container">
        <p className="sr-only" aria-live="polite">{view[0].toUpperCase() + view.slice(1)} view</p>
        {view === "today" && (
          <TodayView entries={entries} currentEntry={selectedEntry} nickname={nickname} onSelectEntry={chooseEntry} />
        )}
        {view === "calendar" && <CalendarView entries={entries} occasions={occasions} onSelectEntry={chooseEntry} />}
        {view === "albums" && (
          <AlbumsView albums={albums} entries={entries} role={role} onCreateAlbum={() => openStudio("album")} />
        )}
      </main>

      {role === "parent" && (
          <ParentStudio
            isOpen={studioOpen}
            memories={entries}
            occasions={occasions}
            initialSection={studioSection}
            onClose={() => setStudioOpen(false)}
            onUpload={uploadMemory}
            onSaveAlbum={saveAlbum}
            onRotateInvite={rotateInvite}
            onChangePassword={changePassword}
            onSaveOccasion={saveOccasion}
            onDeleteOccasion={deleteOccasion}
          />
      )}
    </div>
  );
}
