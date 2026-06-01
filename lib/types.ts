export type DirectoryType = "free" | "freemium" | "paid";
export type SubmissionStatus = "todo" | "applied" | "listed" | "rejected";
export type DirectoryCategory = "directory" | "launch";

export interface StatusEntry {
  status: SubmissionStatus;
  updatedAt: string; // ISO timestamp
}

export interface Directory {
  id: string;
  num: number;
  name: string;
  url: string;
  da: number | null;
  dr: number | null;
  type: DirectoryType;
  dofollow: boolean;
  notes: string | null;
  category: DirectoryCategory;
}

export interface FilterState {
  search: string;
  minDa: number;
  type: DirectoryType | "all";
  status: SubmissionStatus | "all";
  category: DirectoryCategory | "all";
}
