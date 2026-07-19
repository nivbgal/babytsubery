import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import {
  BookHeart,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  HeartHandshake,
  ImagePlus,
  KeyRound,
  Link2,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { Album, AlbumDraft, AlbumPage, AlbumPageLayout, MemoryEntry, Occasion, OccasionType } from "../types";
import { defaultPhotoCrop, PhotoCropEditor, renderCroppedPhoto, type PhotoCropSettings } from "./PhotoCropEditor";
import "./ParentStudio.css";

export interface ParentStudioProps {
  isOpen: boolean;
  memories: MemoryEntry[];
  occasions: Occasion[];
  initialSection?: StudioSection;
  editingAlbum?: Album | null;
  onClose: () => void;
  onUpload: (formData: FormData) => Promise<void>;
  onSaveAlbum: (album: AlbumDraft, albumId?: string) => Promise<void>;
  onDeleteAlbum: (id: string) => Promise<void>;
  onRotateInvite: () => Promise<string>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onSaveOccasion: (occasion: Pick<Occasion, "occasionDate" | "title" | "description" | "type">) => Promise<void>;
  onEditOccasion: (occasion: Occasion) => void;
}

export type StudioSection = "memory" | "album" | "settings" | "occasion";

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
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Some browsers expose createImageBitmap but still cannot decode HEIC/HEIF.
      // Let the <img> fallback have a chance before using the converter below.
    }
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

function isHeicFile(file: File) {
  const name = file.name.toLowerCase();
  return file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/.test(name);
}

async function loadUploadImage(file: File) {
  try {
    return await loadImage(file);
  } catch (error) {
    if (!isHeicFile(file)) throw error;

    try {
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const convertedBlob = Array.isArray(converted) ? converted[0] : converted;
      if (!convertedBlob) throw new Error("No image was found in that file.");
      const jpeg = new File([convertedBlob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      return await loadImage(jpeg);
    } catch {
      throw new Error("This iPhone photo could not be read. Try selecting it again, or choose Most Compatible in Camera settings.");
    }
  }
}

async function preparePhoto(file: File) {
  const image = await loadUploadImage(file);
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
    const encode = (type: "image/webp" | "image/jpeg") => new Promise<Blob | null>((resolve) => {
      canvas.toBlob(
        resolve,
        type,
        0.86,
      );
    });
    // Safari/iOS can accept a WebP request but return a different format (or no
    // blob at all). Never label bytes as WebP unless the browser confirms it.
    const webpBlob = await encode("image/webp");
    const outputType: "image/webp" | "image/jpeg" = webpBlob?.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = outputType === "image/webp" ? webpBlob : await encode("image/jpeg");
    if (!blob) throw new Error("Your browser couldn’t create the web photograph.");
    const baseName = file.name.replace(/\.[^.]+$/, "") || "memory";
    const extension = outputType === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${baseName}.${extension}`, { type: outputType, lastModified: Date.now() });
  } finally {
    image.close?.();
  }
}

function formatMemoryDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function newAlbumPage(entryIds: string[]): AlbumPage {
  return {
    id: crypto.randomUUID(),
    entryIds,
    layout: entryIds.length === 2 ? "duo" : "classic",
    title: null,
    text: null,
  };
}

export function ParentStudio({ isOpen, memories, occasions, initialSection = "memory", editingAlbum = null, onClose, onUpload, onSaveAlbum, onDeleteAlbum, onRotateInvite, onChangePassword, onSaveOccasion, onEditOccasion }: ParentStudioProps) {
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
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const [photoCrop, setPhotoCrop] = useState<PhotoCropSettings>(defaultPhotoCrop);

  const [albumTitle, setAlbumTitle] = useState("");
  const [albumDescription, setAlbumDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [coverEntryId, setCoverEntryId] = useState<string | null>(null);
  const [albumPages, setAlbumPages] = useState<AlbumPage[]>([]);
  const [albumError, setAlbumError] = useState("");
  const [isSavingAlbum, setIsSavingAlbum] = useState(false);
  const [showDeleteAlbumConfirm, setShowDeleteAlbumConfirm] = useState(false);

  const [rotateError, setRotateError] = useState("");
  const [rotatedInviteUrl, setRotatedInviteUrl] = useState("");
  const [isRotating, setIsRotating] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [occasionDate, setOccasionDate] = useState(localToday);
  const [occasionTitle, setOccasionTitle] = useState("");
  const [occasionDescription, setOccasionDescription] = useState("");
  const [occasionType, setOccasionType] = useState<OccasionType>("milestone");
  const [occasionError, setOccasionError] = useState("");
  const [isSavingOccasion, setIsSavingOccasion] = useState(false);

  useEffect(() => {
    if (isOpen) setSection(initialSection);
  }, [initialSection, isOpen]);

  useEffect(() => {
    if (!isOpen || initialSection !== "album") return;
    setShowDeleteAlbumConfirm(false);
    setAlbumError("");
    if (editingAlbum) {
      setAlbumTitle(editingAlbum.title);
      setAlbumDescription(editingAlbum.description ?? "");
      setSelectedIds(editingAlbum.entryIds);
      setCoverEntryId(editingAlbum.coverEntryId);
      setAlbumPages(editingAlbum.pages);
    } else {
      setAlbumTitle("");
      setAlbumDescription("");
      setSelectedIds([]);
      setCoverEntryId(null);
      setAlbumPages([]);
    }
  }, [editingAlbum, initialSection, isOpen]);

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

  async function selectPhoto(file: File | null) {
    setUploadError("");
    setPhoto(null);
    setPhotoCrop(defaultPhotoCrop);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl("");
    if (!file) return;
    setIsPreparingPhoto(true);
    try {
      const prepared = await preparePhoto(file);
      const nextUrl = URL.createObjectURL(prepared);
      previewUrlRef.current = nextUrl;
      setPhoto(prepared);
      setPreviewUrl(nextUrl);
    } catch (error) {
      setUploadError(readableError(error, "We couldn’t open that photograph. Please choose it again."));
    } finally {
      setIsPreparingPhoto(false);
    }
  }

  async function submitMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!photo || !memoryDate || isUploading || isPreparingPhoto) {
      setUploadError("Choose a photograph and add its date.");
      return;
    }
    setUploadError("");
    setIsUploading(true);
    try {
      const prepared = await renderCroppedPhoto(photo, photoCrop);
      const formData = new FormData();
      formData.append("image", prepared);
      formData.append("memoryDate", memoryDate);
      formData.append("caption", caption.trim());
      await onUpload(formData);
      await selectPhoto(null);
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
        coverEntryId,
        entryIds: selectedIds,
        pages: albumPages.map((page) => ({
          ...page,
          title: page.title?.trim() || null,
          text: page.text?.trim() || null,
        })),
      }, editingAlbum?.id);
      setAlbumTitle("");
      setAlbumDescription("");
      setSelectedIds([]);
      setCoverEntryId(null);
      setAlbumPages([]);
    } catch (error) {
      setAlbumError(readableError(error, "We couldn’t save this album. Please try again."));
    } finally {
      setIsSavingAlbum(false);
    }
  }

  async function removeAlbum() {
    if (!editingAlbum || isSavingAlbum) return;
    setAlbumError("");
    setIsSavingAlbum(true);
    try {
      await onDeleteAlbum(editingAlbum.id);
      onClose();
    } catch (error) {
      setAlbumError(readableError(error, "We couldn’t delete this album. Please try again."));
    } finally {
      setIsSavingAlbum(false);
    }
  }

  function toggleAlbumMemory(memoryId: string) {
    const selected = selectedIds.includes(memoryId);
    if (selected) {
      setSelectedIds((current) => current.filter((id) => id !== memoryId));
      setCoverEntryId((current) => current === memoryId ? null : current);
      setAlbumPages((current) => current
        .map((page) => {
          const entryIds = page.entryIds.filter((id) => id !== memoryId);
          if (!entryIds.length) return null;
          return { ...page, entryIds, layout: entryIds.length === 2 ? "duo" : page.layout === "duo" ? "classic" : page.layout };
        })
        .filter((page): page is AlbumPage => Boolean(page)));
      return;
    }

    setSelectedIds((current) => [...current, memoryId]);
    setAlbumPages((current) => {
      const last = current[current.length - 1];
      if (last && last.entryIds.length === 1 && !last.title && !last.text && last.layout === "classic") {
        return [...current.slice(0, -1), { ...last, entryIds: [...last.entryIds, memoryId], layout: "duo" }];
      }
      return [...current, newAlbumPage([memoryId])];
    });
  }

  function updateAlbumPage(index: number, updates: Partial<AlbumPage>) {
    setAlbumPages((current) => current.map((page, pageIndex) => pageIndex === index ? { ...page, ...updates } : page));
  }

  function splitAlbumPage(index: number) {
    setAlbumPages((current) => current.flatMap((page, pageIndex) => {
      if (pageIndex !== index || page.entryIds.length !== 2) return [page];
      return [
        { ...page, entryIds: [page.entryIds[0]], layout: "classic" as const },
        newAlbumPage([page.entryIds[1]]),
      ];
    }));
  }

  function joinAlbumPages(index: number) {
    setAlbumPages((current) => {
      const page = current[index];
      const next = current[index + 1];
      if (!page || !next || page.entryIds.length !== 1 || next.entryIds.length !== 1) return current;
      const joined: AlbumPage = {
        ...page,
        entryIds: [page.entryIds[0], next.entryIds[0]],
        layout: "duo",
        text: [page.text, next.text].filter(Boolean).join("\n\n") || null,
      };
      return [...current.slice(0, index), joined, ...current.slice(index + 2)];
    });
  }

  function moveAlbumPage(index: number, direction: -1 | 1) {
    setAlbumPages((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
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

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (newPassword.length < 12) {
      setPasswordError("Use at least 12 characters for a strong shared password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }
    setIsChangingPassword(true);
    try {
      await onChangePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage("Password updated. Noa and Rotem can use the new password right away.");
    } catch (error) {
      setPasswordError(readableError(error, "We couldn’t update the password. Please try again."));
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function submitOccasion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!occasionTitle.trim() || !occasionDate || isSavingOccasion) {
      setOccasionError("Add a date and name this special moment.");
      return;
    }
    setOccasionError("");
    setIsSavingOccasion(true);
    try {
      await onSaveOccasion({ occasionDate, title: occasionTitle.trim(), description: occasionDescription.trim() || null, type: occasionType });
      setOccasionTitle("");
      setOccasionDescription("");
      setOccasionDate(localToday());
    } catch (error) {
      setOccasionError(readableError(error, "We couldn’t save this special moment. Please try again."));
    } finally {
      setIsSavingOccasion(false);
    }
  }

  async function copyInvite() {
    if (!rotatedInviteUrl) return;
    await navigator.clipboard?.writeText(rotatedInviteUrl);
  }

  async function shareInvite() {
    if (!rotatedInviteUrl) return;
    if (navigator.share) await navigator.share({ title: "Baby Tsubery’s private journal", text: "A new family invitation to Baby Tsubery’s journal", url: rotatedInviteUrl });
    else await copyInvite();
  }

  if (!isOpen) return null;

  const sectionTitle = section === "memory"
    ? "Add to her story"
    : section === "album"
      ? editingAlbum ? "Edit album" : "Make an album"
      : section === "occasion"
        ? "Mark a moment"
        : "Family access";

  return (
    <div className="parent-studio__backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div
        ref={dialogRef}
        className="parent-studio"
        data-section={section}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <header className="parent-studio__header">
          <div>
            <p className="parent-studio__date-stamp"><CalendarDays size={15} aria-hidden="true" /> Parent studio</p>
            <h2 id={titleId}>{sectionTitle}</h2>
          </div>
          <button className="parent-studio__close" type="button" onClick={onClose} aria-label="Close parent studio"><X aria-hidden="true" /></button>
        </header>

        <nav className="parent-studio__tabs" aria-label="Parent studio sections">
          <button type="button" onClick={() => setSection("memory")} aria-current={section === "memory" ? "page" : undefined}><Camera size={18} aria-hidden="true" /> Memory</button>
          <button type="button" onClick={() => setSection("album")} aria-current={section === "album" ? "page" : undefined}><BookHeart size={18} aria-hidden="true" /> Album</button>
          <button type="button" onClick={() => setSection("occasion")} aria-current={section === "occasion" ? "page" : undefined}><HeartHandshake size={18} aria-hidden="true" /> Moments</button>
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
                {previewUrl && photo ? (
                  <>
                    <PhotoCropEditor file={photo} previewUrl={previewUrl} value={photoCrop} onChange={setPhotoCrop} disabled={isUploading} />
                    <label className="studio-replace-photo"><input type="file" accept="image/*,.heic,.heif" onChange={(event) => void selectPhoto(event.target.files?.[0] ?? null)} disabled={isUploading || isPreparingPhoto} /><Upload size={17} aria-hidden="true" /> Choose another photograph</label>
                  </>
                ) : (
                  <label className="studio-photo-picker">
                    <input type="file" accept="image/*,.heic,.heif" onChange={(event) => void selectPhoto(event.target.files?.[0] ?? null)} disabled={isUploading || isPreparingPhoto} />
                    <span>{isPreparingPhoto ? <LoaderCircle className="studio-spinner" size={30} aria-hidden="true" /> : <ImagePlus size={30} strokeWidth={1.5} aria-hidden="true" />}<strong>{isPreparingPhoto ? "Preparing photograph…" : "Choose a photograph"}</strong><small>JPEG, PNG, WebP, or iPhone HEIC/HEIF — converted securely</small></span>
                    <span className="studio-photo-picker__action"><Upload size={17} aria-hidden="true" /> Browse photos</span>
                  </label>
                )}
              </div>

              <div className="studio-section">
                <div className="studio-section__heading">
                  <span className="studio-section__number">02</span>
                  <div><h3>Write the memory</h3><p>A date is required. The caption can be as small as a single lovely detail.</p></div>
                </div>
                <div className="studio-form__grid">
                  <label className="studio-field">Date <span className="date-input-shell"><input type="date" value={memoryDate} onChange={(event) => setMemoryDate(event.target.value)} required disabled={isUploading} /></span></label>
                  <label className="studio-field studio-field--wide">Caption <span>(optional)</span><textarea dir="auto" value={caption} onChange={(event) => setCaption(event.target.value)} rows={3} maxLength={500} placeholder="The softest afternoon light…" disabled={isUploading} /></label>
                </div>
              </div>

              {uploadError && <p className="studio-message studio-message--error" role="alert">{uploadError}</p>}
              <button className="studio-primary" type="submit" disabled={isUploading || isPreparingPhoto}>
                {isUploading ? <><LoaderCircle className="studio-spinner" size={19} aria-hidden="true" /> Preparing photograph…</> : <><Camera size={19} aria-hidden="true" /> Add this memory</>}
              </button>
            </form>
          )}

          {section === "album" && (
            <form className="studio-form" onSubmit={submitAlbum}>
              <div className="studio-section studio-section--lilac">
                <div className="studio-section__heading">
                  <span className="studio-section__number">01</span>
                  <div><h3>Name this little chapter</h3><p>The title and introduction appear on the cover and opening page.</p></div>
                </div>
                <div className="studio-form__grid">
                  <label className="studio-field">Album title <input dir="auto" value={albumTitle} onChange={(event) => setAlbumTitle(event.target.value)} maxLength={120} required disabled={isSavingAlbum} /></label>
                  <label className="studio-field studio-field--wide">Opening note <span>(optional)</span><textarea dir="auto" value={albumDescription} onChange={(event) => setAlbumDescription(event.target.value)} rows={3} maxLength={500} placeholder="A few words about this chapter…" disabled={isSavingAlbum} /></label>
                </div>
              </div>

              <fieldset className="studio-memory-list studio-album-step">
                <legend><span className="studio-step-title"><b>02</b> Choose memories</span><span>{selectedIds.length} selected</span></legend>
                {memories.length === 0 ? (
                  <p className="studio-empty">Add a daily memory first, then return here to make an album.</p>
                ) : memories.map((memory) => {
                  const selected = selectedIds.includes(memory.id);
                  return (
                    <label className="studio-memory-option" key={memory.id}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleAlbumMemory(memory.id)}
                        disabled={isSavingAlbum}
                      />
                      <span className="studio-memory-option__check">{selected && <Check size={15} aria-hidden="true" />}</span>
                      <img src={memory.thumbUrl || memory.imageUrl} alt="" />
                      <span><strong>{formatMemoryDate(memory.memoryDate)}</strong><small>{memory.caption || "An untitled memory"}</small></span>
                    </label>
                  );
                })}
              </fieldset>

              {selectedIds.length > 0 && (
                <fieldset className="studio-cover-picker studio-album-step">
                  <legend><span className="studio-step-title"><b>03</b> Choose the cover</span><span>Optional</span></legend>
                  <p className="studio-step-help">Pick the exact photograph you want, or keep the cover beautifully text-only.</p>
                  <div className="studio-cover-options">
                    <label className="studio-cover-option studio-cover-option--none">
                      <input type="radio" name="album-cover" checked={coverEntryId === null} onChange={() => setCoverEntryId(null)} disabled={isSavingAlbum} />
                      <span className="studio-cover-option__preview"><BookHeart size={25} aria-hidden="true" /></span>
                      <span>Text-only cover</span>
                    </label>
                    {selectedIds.map((id) => {
                      const memory = memories.find((item) => item.id === id);
                      if (!memory) return null;
                      return (
                        <label className="studio-cover-option" key={id}>
                          <input type="radio" name="album-cover" checked={coverEntryId === id} onChange={() => setCoverEntryId(id)} disabled={isSavingAlbum} />
                          <span className="studio-cover-option__preview"><img src={memory.thumbUrl || memory.imageUrl} alt={memory.imageAlt} /></span>
                          <span>{formatMemoryDate(memory.memoryDate)}</span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              )}

              {albumPages.length > 0 && (
                <section className="studio-page-designer studio-album-step" aria-labelledby="album-pages-title">
                  <div className="studio-page-designer__heading">
                    <div><span className="studio-step-title"><b>04</b> Design the pages</span><p id="album-pages-title" className="studio-step-help">Two photographs share a page by default. Split them when one deserves its own page, then choose its layout and add more writing.</p></div>
                    <span>{albumPages.length} {albumPages.length === 1 ? "page" : "pages"}</span>
                  </div>
                  <div className="studio-page-list">
                    {albumPages.map((page, pageIndex) => {
                      const pageMemories = page.entryIds.map((id) => memories.find((memory) => memory.id === id)).filter((memory): memory is MemoryEntry => Boolean(memory));
                      const nextPage = albumPages[pageIndex + 1];
                      const canJoinNext = page.entryIds.length === 1 && nextPage?.entryIds.length === 1 && !nextPage.title && !nextPage.text;
                      return (
                        <article className="studio-page-card" key={page.id}>
                          <header>
                            <strong>Page {pageIndex + 1}</strong>
                            <div>
                              <button type="button" onClick={() => moveAlbumPage(pageIndex, -1)} disabled={pageIndex === 0 || isSavingAlbum} aria-label={`Move page ${pageIndex + 1} earlier`}>↑</button>
                              <button type="button" onClick={() => moveAlbumPage(pageIndex, 1)} disabled={pageIndex === albumPages.length - 1 || isSavingAlbum} aria-label={`Move page ${pageIndex + 1} later`}>↓</button>
                            </div>
                          </header>
                          <div className={`studio-page-preview studio-page-preview--${page.layout}`}>
                            {pageMemories.map((memory) => <img key={memory.id} src={memory.thumbUrl || memory.imageUrl} alt={memory.imageAlt} />)}
                            {page.layout === "story" && <span aria-hidden="true" />}
                          </div>
                          {page.entryIds.length === 2 ? (
                            <div className="studio-page-actions">
                              <span>Side-by-side photographs with their captions</span>
                              <button type="button" className="studio-secondary" onClick={() => splitAlbumPage(pageIndex)} disabled={isSavingAlbum}>Split into two pages</button>
                            </div>
                          ) : (
                            <>
                              <div className="studio-layout-options" aria-label={`Layout for page ${pageIndex + 1}`}>
                                {(["classic", "story", "full"] as AlbumPageLayout[]).map((layout) => (
                                  <button type="button" key={layout} aria-pressed={page.layout === layout} onClick={() => updateAlbumPage(pageIndex, { layout })} disabled={isSavingAlbum}>
                                    {layout === "classic" ? "Classic" : layout === "story" ? "Photo + story" : "Full photo"}
                                  </button>
                                ))}
                              </div>
                              {canJoinNext && <button type="button" className="studio-page-join" onClick={() => joinAlbumPages(pageIndex)} disabled={isSavingAlbum}>Put the next photograph on this page</button>}
                            </>
                          )}
                          <div className="studio-page-copy-fields">
                            <label className="studio-field">Page heading <span>(optional)</span><input dir="auto" value={page.title ?? ""} onChange={(event) => updateAlbumPage(pageIndex, { title: event.target.value || null })} maxLength={160} placeholder="A tiny adventure" disabled={isSavingAlbum} /></label>
                            <label className="studio-field">More of the story <span>(optional)</span><textarea dir="auto" value={page.text ?? ""} onChange={(event) => updateAlbumPage(pageIndex, { text: event.target.value || null })} maxLength={2000} rows={4} placeholder="Write as much or as little as you’d like…" disabled={isSavingAlbum} /></label>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
              {albumError && <p className="studio-message studio-message--error" role="alert">{albumError}</p>}
              <button className="studio-primary" type="submit" disabled={isSavingAlbum || memories.length === 0}>
                {isSavingAlbum ? <><LoaderCircle className="studio-spinner" size={19} aria-hidden="true" /> Saving album…</> : <><BookHeart size={19} aria-hidden="true" /> {editingAlbum ? "Save album changes" : "Create album"}</>}
              </button>
              {editingAlbum && <div className="studio-delete-zone">{!showDeleteAlbumConfirm ? <button type="button" onClick={() => setShowDeleteAlbumConfirm(true)} disabled={isSavingAlbum}><Trash2 size={17} aria-hidden="true" /> Delete album</button> : <div role="alert"><span><strong>Delete this album?</strong><small>The memories will stay safely in the journal.</small></span><button type="button" className="studio-secondary" onClick={() => setShowDeleteAlbumConfirm(false)} disabled={isSavingAlbum}>Cancel</button><button type="button" className="studio-danger" onClick={() => void removeAlbum()} disabled={isSavingAlbum}><Trash2 size={16} aria-hidden="true" /> Yes, delete</button></div>}</div>}
            </form>
          )}

          {section === "settings" && (
            <section className="studio-access" aria-labelledby="studio-access-title">
              <div className="studio-access__icon"><Link2 size={25} aria-hidden="true" /></div>
              <p className="parent-studio__date-stamp">Private family access</p>
              <h3 id="studio-access-title">Share the family link</h3>
              <p>Give trusted family members a private invitation. The link opens the journal without asking guests for a password.</p>
              {rotatedInviteUrl ? (
                <div className="studio-invite-card" role="status">
                  <div className="studio-invite-card__heading"><CheckCircle2 size={18} aria-hidden="true" /><strong>Family link ready</strong></div>
                  <span>It’s copied when your browser allows it. Share it directly or copy it again below.</span>
                  <code>{new URL(rotatedInviteUrl).host}/invite</code>
                  <div className="studio-invite-card__actions"><button className="studio-secondary" type="button" onClick={() => void copyInvite()}><Copy size={17} aria-hidden="true" /> Copy link</button><button className="studio-secondary" type="button" onClick={() => void shareInvite()}><HeartHandshake size={17} aria-hidden="true" /> Share</button></div>
                </div>
              ) : (
                <div className="studio-access__note"><strong>No active link is shown here</strong><span>Create one when you’re ready to send the family invitation. You’ll see a clear warning before an old link is retired.</span></div>
              )}
              {rotateError && <p className="studio-message studio-message--error" role="alert">{rotateError}</p>}
              {showRotateConfirm ? (
                <div className="studio-confirm-card" role="alert"><strong>Replace the current family link?</strong><span>Everyone using the old link will immediately lose access. Only continue if you’re ready to send a new link.</span><div><button className="studio-secondary" type="button" onClick={() => setShowRotateConfirm(false)}>Keep current link</button><button className="studio-primary" type="button" onClick={() => { setShowRotateConfirm(false); void rotateInvite(); }} disabled={isRotating}>{isRotating ? "Creating…" : "Yes, create a new link"}</button></div></div>
              ) : (
                <button className="studio-secondary" type="button" onClick={() => setShowRotateConfirm(true)} disabled={isRotating}>
                  <RefreshCw size={17} aria-hidden="true" /> {rotatedInviteUrl ? "Create a new link" : "Create family link"}
                </button>
              )}

              <div className="studio-password-card">
                <div className="studio-access__icon"><KeyRound size={23} aria-hidden="true" /></div>
                <p className="parent-studio__date-stamp">Noa &amp; Rotem</p>
                <h3>Change the parent password</h3>
                <p>One shared password keeps Noa &amp; Rotem’s studio private.</p>
                <form className="studio-password-form" onSubmit={submitPassword}>
                  <label className="studio-field">Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required disabled={isChangingPassword} /></label>
                  <label className="studio-field">New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={isChangingPassword} /></label>
                  <label className="studio-field">Confirm new password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={12} required disabled={isChangingPassword} /></label>
                  {passwordError && <p className="studio-message studio-message--error" role="alert">{passwordError}</p>}
                  {passwordMessage && <p className="studio-message studio-message--success" role="status">{passwordMessage}</p>}
                  <button className="studio-primary" type="submit" disabled={isChangingPassword}>{isChangingPassword ? "Updating password…" : "Update parent password"}</button>
                </form>
              </div>
            </section>
          )}

          {section === "occasion" && (
            <section className="studio-occasion" aria-labelledby="studio-occasion-title">
              <div className="studio-section studio-section--blush">
                <div className="studio-section__heading"><span className="studio-section__number">✦</span><div><h3 id="studio-occasion-title">Add a special moment</h3><p>Birthdays, first words, first teeth, and the tiny milestones you’ll want to find again.</p></div></div>
                <form className="studio-form" onSubmit={submitOccasion}>
                  <div className="studio-form__grid">
                    <label className="studio-field">Date<span className="date-input-shell"><input type="date" value={occasionDate} onChange={(event) => setOccasionDate(event.target.value)} required disabled={isSavingOccasion} /></span></label>
                    <label className="studio-field">Kind<select value={occasionType} onChange={(event) => setOccasionType(event.target.value as OccasionType)} disabled={isSavingOccasion}><option value="birthday">Birthday</option><option value="milestone">Milestone</option><option value="celebration">Celebration</option><option value="custom">Other</option></select></label>
                    <label className="studio-field studio-field--wide">Name<input dir="auto" value={occasionTitle} onChange={(event) => setOccasionTitle(event.target.value)} maxLength={160} placeholder="First word" required disabled={isSavingOccasion} /></label>
                    <label className="studio-field studio-field--wide">Note <span>(optional)</span><textarea dir="auto" value={occasionDescription} onChange={(event) => setOccasionDescription(event.target.value)} maxLength={500} rows={3} placeholder="A little detail to remember…" disabled={isSavingOccasion} /></label>
                  </div>
                  {occasionError && <p className="studio-message studio-message--error" role="alert">{occasionError}</p>}
                  <button className="studio-primary" type="submit" disabled={isSavingOccasion}>{isSavingOccasion ? "Saving moment…" : "Add to calendar"}</button>
                </form>
              </div>
              {occasions.length > 0 && <div className="studio-occasion-list"><h3>Saved moments</h3>{occasions.map((occasion) => <div className="studio-occasion-item" key={occasion.id}><span><strong>{occasion.title}</strong><small>{formatMemoryDate(occasion.occasionDate)}</small></span><button type="button" className="icon-button" onClick={() => onEditOccasion(occasion)} aria-label={`Edit ${occasion.title}`}><Pencil size={16} aria-hidden="true" /></button></div>)}</div>}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
