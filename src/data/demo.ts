import type { Album, MemoryEntry } from "../types";

export const demoEntries: MemoryEntry[] = [
  {
    id: "demo-18",
    memoryDate: "2026-07-18",
    caption: "A tiny yawn, a very big morning.",
    imageUrl: "",
    thumbUrl: "",
    imageAlt: "Warm rose placeholder for today's baby photo",
    placeholderTone: "rose",
    createdAt: "2026-07-18T08:42:00.000Z",
  },
  {
    id: "demo-16",
    memoryDate: "2026-07-16",
    caption: "The softest afternoon light.",
    imageUrl: "",
    thumbUrl: "",
    imageAlt: "Warm blush placeholder for a baby photo",
    placeholderTone: "blush",
    createdAt: "2026-07-16T14:12:00.000Z",
  },
  {
    id: "demo-12",
    memoryDate: "2026-07-12",
    caption: "Ten perfect fingers.",
    imageUrl: "",
    thumbUrl: "",
    imageAlt: "Lilac placeholder for a baby photo",
    placeholderTone: "lilac",
    createdAt: "2026-07-12T10:05:00.000Z",
  },
  {
    id: "demo-07",
    memoryDate: "2026-07-07",
    caption: "Home, together.",
    imageUrl: "",
    thumbUrl: "",
    imageAlt: "Rose placeholder for a baby photo",
    placeholderTone: "berry",
    createdAt: "2026-07-07T16:30:00.000Z",
  },
];

export const demoAlbums: Album[] = [
  {
    id: "demo-album",
    title: "The first little days",
    description: "A keepsake collection waiting to grow.",
    coverUrl: null,
    entryIds: demoEntries.map((entry) => entry.id),
    createdAt: "2026-07-18T09:00:00.000Z",
  },
];
