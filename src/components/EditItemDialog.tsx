import { FormEvent, useEffect, useId, useState } from "react";
import { CalendarDays, LoaderCircle, Save, Trash2, X } from "lucide-react";
import type { MemoryEntry, MemoryUpdate, Occasion, OccasionDraft, OccasionType } from "../types";
import "./EditItemDialog.css";

export type EditableItem =
  | { kind: "memory"; item: MemoryEntry }
  | { kind: "occasion"; item: Occasion };

interface EditItemDialogProps {
  target: EditableItem | null;
  onClose: () => void;
  onUpdateMemory: (id: string, update: MemoryUpdate) => Promise<void>;
  onDeleteMemory: (id: string) => Promise<void>;
  onUpdateOccasion: (id: string, update: OccasionDraft) => Promise<void>;
  onDeleteOccasion: (id: string) => Promise<void>;
}

export function EditItemDialog({ target, onClose, onUpdateMemory, onDeleteMemory, onUpdateOccasion, onDeleteOccasion }: EditItemDialogProps) {
  const titleId = useId();
  const [date, setDate] = useState("");
  const [caption, setCaption] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [occasionType, setOccasionType] = useState<OccasionType>("milestone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!target) return;
    setError("");
    setConfirmDelete(false);
    if (target.kind === "memory") {
      setDate(target.item.memoryDate);
      setCaption(target.item.caption ?? "");
    } else {
      setDate(target.item.occasionDate);
      setTitle(target.item.title);
      setDescription(target.item.description ?? "");
      setOccasionType(target.item.type);
    }
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, target]);

  if (!target) return null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      if (target.kind === "memory") {
        await onUpdateMemory(target.item.id, { memoryDate: date, caption: caption.trim() || null });
      } else {
        await onUpdateOccasion(target.item.id, { occasionDate: date, title: title.trim(), description: description.trim() || null, type: occasionType });
      }
      onClose();
    } catch {
      setError("We couldn’t save those changes. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!target || busy) return;
    setBusy(true);
    setError("");
    try {
      if (target.kind === "memory") await onDeleteMemory(target.item.id);
      else await onDeleteOccasion(target.item.id);
      onClose();
    } catch {
      setError("We couldn’t delete this yet. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isMemory = target.kind === "memory";
  return (
    <div className="edit-dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header>
          <div><p><CalendarDays size={14} aria-hidden="true" /> Parent edit</p><h2 id={titleId}>Edit {isMemory ? "memory" : "special moment"}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close edit menu"><X aria-hidden="true" /></button>
        </header>
        <form onSubmit={save}>
          {isMemory && <img className="edit-dialog-photo" src={target.item.thumbUrl || target.item.imageUrl} alt="" />}
          <div className="edit-dialog-grid">
            <label>Date<span className="date-input-shell"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required disabled={busy} /></span></label>
            {!isMemory && <label>Kind<select value={occasionType} onChange={(event) => setOccasionType(event.target.value as OccasionType)} disabled={busy}><option value="birthday">Birthday</option><option value="milestone">Milestone</option><option value="celebration">Celebration</option><option value="custom">Other</option></select></label>}
            {isMemory ? (
              <label className="edit-dialog-wide">Caption <span>(optional)</span><textarea dir="auto" value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={2000} rows={5} disabled={busy} /></label>
            ) : (
              <>
                <label className="edit-dialog-wide">Name<input dir="auto" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required disabled={busy} /></label>
                <label className="edit-dialog-wide">Note <span>(optional)</span><textarea dir="auto" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={4} disabled={busy} /></label>
              </>
            )}
          </div>
          {error && <p className="edit-dialog-error" role="alert">{error}</p>}
          <button className="edit-dialog-save" type="submit" disabled={busy}>{busy ? <LoaderCircle className="edit-dialog-spinner" size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />} Save changes</button>
        </form>
        <div className="edit-dialog-danger">
          {!confirmDelete ? (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy}><Trash2 size={17} aria-hidden="true" /> Delete {isMemory ? "memory" : "moment"}</button>
          ) : (
            <div role="alert"><p><strong>Delete permanently?</strong><span>This cannot be undone.</span></p><button type="button" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</button><button type="button" className="is-danger" onClick={() => void remove()} disabled={busy}><Trash2 size={16} aria-hidden="true" /> Yes, delete</button></div>
          )}
        </div>
      </section>
    </div>
  );
}
