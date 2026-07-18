import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import {
  BookHeart,
  CalendarDays,
  Camera,
  Check,
  ImagePlus,
  Link2,
  LoaderCircle,
  RefreshCw,
  Settings,
  Upload,
  X,
} from "lucide-react";
import type { Album, MemoryEntry } from "../types";
import "./ParentStudio.css";

export interface ParentStudioProps {
  isOpen: boolean;
  memories: MemoryEntry[];
  onClose: () => void;
  onUpload: (formData: FormData) => Promise<void>;
  onSaveAlbum: (album: Pick<Album, "title" | "description" | "entryIds">) => Promise<void>;
  onRotateInvite: () => Promise<string>;
}

type StudioSection = "memory" | "album" | "settings";

function localToday() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function readableError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message && !error.message.startsWith("{")) return error.message;
  return fallback;
}

async function loadImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This image format can’t be read by your browser."));
      element.src = url;
    });
    return { source: image, width: image.naturalWidth, height: image.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function preparePhoto(file: File) {
  const image = await loadImage(file);
  try {
    const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Your browser couldn’t prepare this photograph.");
    context.fillStyle = "#fffaf4";
    context.fillRect(0, 0, width, height);
    context.drawImage(image.source, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error("Your browser couldn’t create the web photograph.")),
        "image/webp",
        0.86,
      );
    });
    const baseName = file.name.replace(/\.[^.]+$/, "") || "memory";
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    image.close?.();
  }
}

function formatMemoryDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function ParentStudio({ isOpen, memories, onClose, onUpload, onSaveAlbum, onRotateInvite }: ParentStudioProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [section, setSection] = useState<StudioSection>("memory");

  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [memoryDate, setMemoryDate] = useState(localToday);
  const [caption, setCaption] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [albumError, setAlbumError] = useState("");
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);

  const [rotateError, setRotateError] = useState("");
  const [rotatedInviteUrl, setRotatedInviteUrl] = useState("");
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function selectPhoto(file: File | null) {
    setUploadError("");
    setPhoto(file);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextUrl = file ? URL.createObjectURL(file) : "";
    previewUrlRef.current = nextUrl || null;
    setPreviewUrl(nextUrl);
  }

  async function submitMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !memoryDate || isUploading) {
      setUploadError("Choose a photograph and add its date.");
      return;
    }
    setUploadError("");
    setIsUploading(true);
    try {
      const prepared = await preparePhoto(photo);
      const formData = new FormData();
      formData.append("image", prepared);
      formData.append("memoryDate", memoryDate);
      formData.append("caption", caption.trim());
      await onUpload(formData);
      selectPhoto(null);
      setCaption("");
      setMemoryDate(localToday());
    } catch (error) {
      setUploadError(readableError(error, "We couldn’t add this memory. Please try again."));
    } finally {
      setIsUploading(false);
    }
  }

  async function submitAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!albumTitle.trim() || selectedIds.length === 0 || isSavingAlbum) {
      setAlbumError("Give the album a title and choose at least one memory.");
      return;
    }
    setAlbumError("");
    setIsSavingAlbum(true);
    try {
      await onSaveAlbum({
        title: albumTitle.trim(),
        description: albumDescription.trim() || null,
        entryIds: selectedIds,
      });
      setAlbumTitle("");
      setAlbumDescription("");
      setSelectedIds([]);
    } catch (error) {
      setAlbumError(readableError(error, "We couldn’t save this album. Please try again."));
    } finally {
      setIsSavingAlbum(false);
    }
  }

  async function rotateInvite() {
    if (isRotating) return;
    setRotateError("");
    setRotatedInviteUrl("");
    setIsRotating(true);
    try {
      const inviteUrl = await onRotateInvite();
      setRotatedInviteUrl(inviteUrl);
    } catch (error) {
      setRotateError(readableError(error, "The invitation could not be rotated. Please try again."));
    } finally {
      setIsRotating(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="parent-studio__backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="parent-studio"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="parent-studio__header">
          <div>
            <p className="parent-studio__date-stamp"><CalendarDays size={15} aria-hidden="true" /> Parent studio</p>
            <h2 id={titleId}>Add to her story</h2>
          </div>
          <button className="parent-studio__close" type="button" onClick={onClose} aria-label="Close parent studio"><X aria-hidden="true" /></button>
        </header>

        <nav className="parent-studio__tabs" aria-label="Parent studio sections">
          <button type="button" onClick={() => setSection("memory")} aria-current={section === "memory" ? "page" : undefined}><Camera size={18} aria-hidden="true" /> Memory</button>
          <button type="button" onClick={() => setSection("album")} aria-current={section === "album" ? "page" : undefined}><BookHeart size={18} aria-hidden="true" /> Album</button>
          <button type="button" onClick={() => setSection("settings")} aria-current={section === "settings" ? "page" : undefined}><Settings size={18} aria-hidden="true" /> Access</button>
        </nav>

        <div className="parent-studio__body">
          {section === "memory" && (
            <form className="studio-form" onSubmit={submitMemory}>
              <div className="studio-section studio-section--blush">
                <div className="studio-section__heading">
                  <span className="studio-section__number">01</span>
                  <div><h3>Today’s photograph</h3><p>We resize it for the web and remove hidden location metadata before upload.</p></div>
                </div>
                <label className={`studio-photo-picker${previewUrl ? " studio-photo-picker--filled" : ""}`}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => selectPhoto(event.target.files?.[0] ?? null)}
                    disabled={isUploading}
                  />
                  {previewUrl ? (
                    <img src={previewUrl} alt="Selected photograph preview" />
                  ) : (
                    <span><ImagePlus size={30} strokeWidth={1.5} aria-hidden="true" /><strong>Choose a photograph</strong><small>JPEG, PNG, WebP, or a supported phone photo</small></span>
                  )}
                  <span className="studio-photo-picker__action"><Upload size={17} aria-hidden="true" /> {previewUrl ? "Choose another" : "Browse photos"}</span>
                </label>
              </div>

              <div className="studio-section">
                <div className="studio-section__heading">
                  <span className="studio-section__number">02</span>
                  <div><h3>Write the memory</h3><p>A date is required. The caption can be as small as a single lovely detail.</p></div>
                </div>
                <div className="studio-form__grid">
                  <label className="studio-field">Date <input type="date" value={memoryDate} onChange={(event) => setMemoryDate(event.target.value)} required disabled={isUploading} /></label>
                  <label className="studio-field studio-field--wide">Caption <span>(optional)</span><textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} maxLength={500} placeholder="The softest afternoon light…" disabled={isUploading} /></label>
                </div>
              </div>

              {uploadError && <p className="studio-message studio-message--error" role="alert">{uploadError}</p>}
              <button className="studio-primary" type="submit" disabled={isUploading}>
                {isUploading ? <><LoaderCircle className="studio-spinner" size={19} aria-hidden="true" /> Preparing photograph…</> : <><Camera size={19} aria-hidden="true" /> Add this memory</>}
              </button>
            </form>
          )}

          {section === "album" && (
            <form className="studio-form" onSubmit={submitAlbum}>
              <div className="studio-section studio-section--lilac">
                <div className="studio-section__heading">
                  <span className="studio-section__number">Album</span>
                  <div><h3>Gather a little chapter</h3><p>Choose a title, then collect the moments that belong together.</p></div>
                </div>
                <div className="studio-form__grid">
                  <label className="studio-field">Album title <input value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} maxLength={120} required disabled={isSavingAlbum} /></label>
                  <label className="studio-field studio-field--wide">Description <span>(optional)</span><textarea value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} rows={3} maxLength={500} disabled={isSavingAlbum} /></label>
                </div>
              </div>

              <fieldset className="studio-memory-list">
                <legend>Choose memories <span>{selectedIds.length} selected</span></legend>
                {memories.length === 0 ? (
                  <p className="studio-empty">Add a daily memory first, then return here to make an album.</p>
                ) : memories.map((memory) => {
                  const selected = selectedIds.includes(memory.id);
                  return (
                    <label className="studio-memory-option" key={memory.id}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSelectedIds((current) => selected ? current.filter((id) => id !== memory.id) : [...current, memory.id])}
                        disabled={isSavingAlbum}
                      />
                      <span className="studio-memory-option__check">{selected && <Check size={15} aria-hidden="true" />}</span>
                      <span><strong>{formatMemoryDate(memory.memoryDate)}</strong><small>{memory.caption || "An untitled memory"}</small></span>
                    </label>
                  );
                })}
              </fieldset>
              {albumError && <p className="studio-message studio-message--error" role="alert">{albumError}</p>}
              <button className="studio-primary" type="submit" disabled={isSavingAlbum || memories.length === 0}>
                {isSavingAlbum ? <><LoaderCircle className="studio-spinner" size={19} aria-hidden="true" /> Saving album…</> : <><BookHeart size={19} aria-hidden="true" /> Create album</>}
              </button>
            </form>
          )}

          {section === "settings" && (
            <section className="studio-access" aria-labelledby="studio-access-title">
              <div className="studio-access__icon"><Link2 size={25} aria-hidden="true" /></div>
              <p className="parent-studio__date-stamp">Private family access</p>
              <h3 id="studio-access-title">Rotate the invitation link</h3>
              <p>
                Rotating the link immediately retires the current family invitation. Anyone using the old link will need the new one, so only do this if it was shared beyond the people you trust.
              </p>
              <div className="studio-access__note"><strong>Before you continue</strong><span>The app will create the new invitation through the secure journal service. Share it privately with family afterward.</span></div>
              {rotateError && <p className="studio-message studio-message--error" role="alert">{rotateError}</p>}
              {rotatedInviteUrl && (
                <div className="studio-invite-success" role="status">
                  <strong>New invitation ready</strong>
                  <span>It has been copied when clipboard access is available. You can also copy it here:</span>
                  <code>{rotatedInviteUrl}</code>
                </div>
              )}
              <button className="studio-secondary" type="button" onClick={rotateInvite} disabled={isRotating}>
                {isRotating ? <><LoaderCircle className="studio-spinner" size={19} aria-hidden="true" /> Rotating invitation…</> : <><RefreshCw size={19} aria-hidden="true" /> Rotate invitation link</>}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
