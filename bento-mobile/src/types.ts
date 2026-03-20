export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  path: string;
  modifiedAt: string;
  size?: string; // For files
  items?: FileItem[]; // For folders
  isFavorite?: boolean;
}

export interface RecentItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  accessedAt: string;
  filePath: string; // To link to the actual file/folder
}

export interface TrashItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  deletedAt: string;
  originalPath: string;
}
