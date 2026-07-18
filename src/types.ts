export type Role = "parent" | "guest" | "anonymous";
export type ViewName = "today" | "calendar" | "albums";

export interface Session {
  role: Role;
  expiresAt?: string;
}

export interface MemoryEntry {
  id: string;
  memoryDate: string;
  caption: string | null;
  imageUrl: string;
  thumbUrl: string;
  imageAlt: string;
  placeholderTone?: "rose" | "blush" | "lilac" | "berry";
  createdAt: string;
}

export interface Album {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  entryIds: string[];
  createdAt: string;
}

export interface JournalPayload {
  entries: MemoryEntry[];
  albums: Album[];
  occasions: Occasion[];
  nickname: string;
}

export type OccasionType = "birthday" | "milestone" | "celebration" | "custom";

export interface Occasion {
  id: string;
  occasionDate: string;
  title: string;
  description: string | null;
  type: OccasionType;
  createdAt: string;
}
