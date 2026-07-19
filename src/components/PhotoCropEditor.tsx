import { RotateCcw, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import "./PhotoCropEditor.css";

export type CropAspect = "original" | "portrait" | "square" | "landscape";
export interface PhotoCropSettings {
  aspect: CropAspect;
  zoom: number;
  focusX: number;
  focusY: number;
  rotation: 0 | 90 | 180 | 270;
}

export const defaultPhotoCrop: PhotoCropSettings = { aspect: "original", zoom: 1, focusX: .5, focusY: .5, rotation: 0 };

function clamp(value: number, min: number, max: number) { return Math.min(max, Math.max(min, value)); }

function rotatedSize(width: number, height: number, rotation: PhotoCropSettings["rotation"]) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

function cropAspect(settings: PhotoCropSettings, width: number, height: number) {
  if (settings.aspect === "portrait") return 4 / 5;
  if (settings.aspect === "square") return 1;
  if (settings.aspect === "landscape") return 3 / 2;
  const rotated = rotatedSize(width, height, settings.rotation);
  return rotated.width / rotated.height;
}

function rotatedCanvas(source: CanvasImageSource, width: number, height: number, rotation: PhotoCropSettings["rotation"]) {
  const rotated = rotatedSize(width, height, rotation);
  const canvas = document.createElement("canvas");
  canvas.width = rotated.width;
  canvas.height = rotated.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Photo editor unavailable");
  context.fillStyle = "#fffaf4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(rotation * Math.PI / 180);
  context.drawImage(source, -width / 2, -height / 2, width, height);
  return canvas;
}

function drawCrop(target: HTMLCanvasElement, source: CanvasImageSource, width: number, height: number, settings: PhotoCropSettings, outputWidth: number, outputHeight: number) {
  target.width = outputWidth;
  target.height = outputHeight;
  const context = target.getContext("2d", { alpha: false });
  if (!context) throw new Error("Photo editor unavailable");
  const rotated = rotatedCanvas(source, width, height, settings.rotation);
  const scale = Math.max(outputWidth / rotated.width, outputHeight / rotated.height) * settings.zoom;
  const sourceWidth = Math.min(rotated.width, outputWidth / scale);
  const sourceHeight = Math.min(rotated.height, outputHeight / scale);
  const sourceX = clamp(settings.focusX * rotated.width - sourceWidth / 2, 0, rotated.width - sourceWidth);
  const sourceY = clamp(settings.focusY * rotated.height - sourceHeight / 2, 0, rotated.height - sourceHeight);
  context.fillStyle = "#fffaf4";
  context.fillRect(0, 0, outputWidth, outputHeight);
  context.drawImage(rotated, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
}

async function decodeFile(file: File) {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap as CanvasImageSource, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Older Safari builds can expose createImageBitmap without decoding every
      // format reliably. The prepared browser-safe file still works in <img>.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("This photograph could not be opened."));
      element.src = url;
    });
    return { source: image as CanvasImageSource, width: image.naturalWidth, height: image.naturalHeight, close: () => undefined };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function renderCroppedPhoto(file: File, settings: PhotoCropSettings) {
  const image = await decodeFile(file);
  try {
    const aspect = cropAspect(settings, image.width, image.height);
    const width = aspect >= 1 ? 1800 : Math.round(1800 * aspect);
    const height = aspect >= 1 ? Math.round(1800 / aspect) : 1800;
    const canvas = document.createElement("canvas");
    drawCrop(canvas, image.source, image.width, image.height, settings, width, height);
    const encode = (type: "image/webp" | "image/jpeg") => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, .88));
    const webp = await encode("image/webp");
    const type = webp?.type === "image/webp" ? "image/webp" : "image/jpeg";
    const blob = type === "image/webp" ? webp : await encode("image/jpeg");
    if (!blob) throw new Error("Your browser couldn’t create the cropped photograph.");
    const base = file.name.replace(/\.[^.]+$/, "") || "memory";
    return new File([blob], `${base}.${type === "image/webp" ? "webp" : "jpg"}`, { type, lastModified: Date.now() });
  } finally {
    image.close();
  }
}

interface PhotoCropEditorProps {
  file: File;
  previewUrl: string;
  value: PhotoCropSettings;
  onChange: (value: PhotoCropSettings) => void;
  disabled?: boolean;
}

export function PhotoCropEditor({ file, previewUrl, value, onChange, disabled = false }: PhotoCropEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const naturalSize = useMemo(() => image ? { width: image.naturalWidth, height: image.naturalHeight } : null, [image]);
  const aspect = naturalSize ? cropAspect(value, naturalSize.width, naturalSize.height) : 4 / 5;

  useEffect(() => {
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = previewUrl;
    return () => { next.onload = null; };
  }, [file, previewUrl]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const width = 900;
    const height = Math.max(1, Math.round(width / aspect));
    drawCrop(canvasRef.current, image, image.naturalWidth, image.naturalHeight, value, width, height);
  }, [aspect, image, value]);

  function pointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom: value.zoom };
    }
  }

  function pointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || !pointers.current.has(event.pointerId)) return;
    const previous = pointers.current.get(event.pointerId)!;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      onChange({ ...value, zoom: clamp(pinch.current.zoom * distance / Math.max(1, pinch.current.distance), 1, 3) });
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    onChange({ ...value, focusX: clamp(value.focusX - dx / Math.max(1, rect.width) / value.zoom, 0, 1), focusY: clamp(value.focusY - dy / Math.max(1, rect.height) / value.zoom, 0, 1) });
  }

  function pointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  }

  function rotate() {
    onChange({ ...value, rotation: ((value.rotation + 90) % 360) as PhotoCropSettings["rotation"], focusX: .5, focusY: .5 });
  }

  return (
    <section className="photo-crop-editor" aria-label="Frame photograph">
      <div className="photo-crop-stage" style={{ aspectRatio: String(aspect) }}>
        <canvas ref={canvasRef} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} aria-label="Photograph crop preview. Drag to reposition and pinch to zoom." />
        <span aria-hidden="true" />
      </div>
      <p>Drag to reposition. Pinch or use the slider to zoom.</p>
      <div className="photo-crop-aspects" role="group" aria-label="Crop shape">
        {(["original", "portrait", "square", "landscape"] as CropAspect[]).map((item) => <button type="button" key={item} aria-pressed={value.aspect === item} onClick={() => onChange({ ...value, aspect: item, zoom: 1, focusX: .5, focusY: .5 })} disabled={disabled}>{item === "original" ? "Full photo" : item === "portrait" ? "Portrait 4:5" : item === "square" ? "Square" : "Landscape"}</button>)}
      </div>
      <label className="photo-crop-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.01" value={value.zoom} onChange={(event) => onChange({ ...value, zoom: Number(event.target.value) })} disabled={disabled} /></label>
      <div className="photo-crop-actions"><button type="button" onClick={rotate} disabled={disabled}><RotateCw size={17} aria-hidden="true" /> Rotate</button><button type="button" onClick={() => onChange(defaultPhotoCrop)} disabled={disabled}><RotateCcw size={17} aria-hidden="true" /> Reset framing</button></div>
    </section>
  );
}
