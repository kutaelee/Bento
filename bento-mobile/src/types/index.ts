// bento-mobile/src/types/index.ts

export type ItemType = 'file' | 'folder';

export interface BaseItem {
  id: string;
  name: string;
  type: ItemType;
  lastModified: string; // ISO 8601 string
  size?: number; // In bytes, optional for folders
  path: string; // Full path, e.g., '/documents/reports'
}

export interface FileItem extends BaseItem {
  type: 'file';
  fileType: string; // e.g., 'pdf', 'docx', 'jpg'
  thumbnail?: string; // URL for a thumbnail image
}

export interface FolderItem extends BaseItem {
  type: 'folder';
  childrenCount: number;
}

export type ListItem = FileItem | FolderItem;

export interface RecentItem extends ListItem {
  accessedAt: string; // ISO 8601 string
}

export interface TrashItem extends ListItem {
  deletedAt: string; // ISO 8601 string
  originalPath: string;
}

export type Breadcrumb = {
  name: string;
  path: string;
};

// Action Sheet types
export type Action = {
  id: string;
  label: string;
  icon?: string; // CSS class for icon
  handler: (item: ListItem) => void;
  isDestructive?: boolean;
};
