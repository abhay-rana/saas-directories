export type DirectoryType = "free" | "freemium" | "paid";
export type SubmissionStatus = "todo" | "applied" | "listed" | "rejected";
export type DirectoryCategory = "directory" | "launch" | "reddit";

export interface StatusEntry {
  status: SubmissionStatus;
  updatedAt: string;   // ISO — when current status was set
  appliedAt?: string;  // ISO — frozen when first marked "applied", never overwritten
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
  isLaunchSite?: boolean;
  subcategory?: string;
}

export interface KitCustomField {
  id: string;
  label: string;
  value: string;
}

export interface KitData {
  fields: Record<string, string>;
  customFields: KitCustomField[];
  images: {
    logo?: string;
    icon?: string;
    screenshot1?: string;
    screenshot2?: string;
    screenshot3?: string;
  };
}

export interface Project {
  id: string;
  name: string;
  color: string;
  statuses: Record<string, StatusEntry>;
  notes: Record<string, string>;
  kit?: KitData;
  createdAt: string;
}

export interface FilterState {
  search: string;
  minDa: number;
  type: DirectoryType | "all";
  status: SubmissionStatus | "all";
  category: DirectoryCategory | "all";
  redditSubcategory: string;
}
