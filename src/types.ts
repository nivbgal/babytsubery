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
  coverEntryId: string | null;
  coverUrl: string | null;
  entryIds: string[];
  pages: AlbumPage[];
  createdAt: string;
}

export type AlbumPageLayout = "classic" | "story" | "full" | "duo";

export interface AlbumPage {
  id: string;
  entryIds: string[];
  layout: AlbumPageLayout;
  title: string | null;
  text: string | null;
}

export type AlbumDraft = Pick<Album, "title" | "description" | "coverEntryId" | "entryIds" | "pages">;

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
