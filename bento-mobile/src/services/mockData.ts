// bento-mobile/src/services/mockData.ts
import React from 'react';

// Mock UUID if uuid package isn't present
const generateMockId = () => Math.random().toString(36).substring(2, 15);

export interface BentoItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  lastModified: string;
  size?: string;
  path?: string;
}

export interface FileItem extends BentoItem {
  isFavorite: boolean;
}

export interface RecentItem extends BentoItem {
  accessedAt: string;
}

export interface FavoriteItem extends BentoItem {
  favoritedAt: string;
}

export interface TrashItem extends BentoItem {
  trashedAt: string;
}

// Initial Mock Data
let filesData: FileItem[] = [
  { id: generateMockId(), name: 'Documents', type: 'folder', lastModified: '2023-10-26', isFavorite: false },
  { id: generateMockId(), name: 'Photos', type: 'folder', lastModified: '2024-01-15', isFavorite: true },
  { id: generateMockId(), name: 'Report_Q1.pdf', type: 'file', lastModified: '2024-03-01', size: '2.5 MB', isFavorite: false },
  { id: generateMockId(), name: 'Presentation.pptx', type: 'file', lastModified: '2024-03-10', size: '10 MB', isFavorite: true },
];

let recentData: RecentItem[] = [
  { id: generateMockId(), name: 'MeetingNotes.docx', type: 'file', lastModified: '2024-03-15', accessedAt: '2024-03-16T10:00:00Z' },
  { id: generateMockId(), name: 'Budget_2024.xlsx', type: 'file', lastModified: '2024-02-28', accessedAt: '2024-03-16T09:30:00Z' },
  { id: generateMockId(), name: 'ProjectX Folder', type: 'folder', lastModified: '2024-03-12', accessedAt: '2024-03-15T16:00:00Z' },
];

let favoritesData: FavoriteItem[] = filesData.filter(f => f.isFavorite).map(f => ({
  ...f,
  favoritedAt: '2024-03-01T12:00:00Z' // Mock date
}));

let trashData: TrashItem[] = [
  { id: generateMockId(), name: 'Old_Draft.txt', type: 'file', lastModified: '2023-11-01', trashedAt: '2024-03-05T14:00:00Z' },
];

export const getFiles = (): FileItem[] => [...filesData];
export const getRecent = (): RecentItem[] => [...recentData].sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime());
export const getFavorites = (): FavoriteItem[] => [...favoritesData];
export const getTrash = (): TrashItem[] => [...trashData];

// Use a simple subject/observer pattern to notify components of changes
type Listener = () => void;
const listeners: Listener[] = [];

export const subscribe = (listener: Listener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

const notify = () => {
  listeners.forEach(listener => listener());
};

// Wrapped state-changing functions to notify listeners
export const moveItemToTrash = (item: FileItem | RecentItem | FavoriteItem) => {
  // Remove from other lists
  if ('isFavorite' in item) {
    filesData = filesData.filter(f => f.id !== item.id);
  }
  recentData = recentData.filter(r => r.id !== item.id);
  favoritesData = favoritesData.filter(f => f.id !== item.id);

  // Add to trash
  trashData.push({ ...item, trashedAt: new Date().toISOString() });
  console.log(`Moved item "${item.name}" to trash.`);
  notify();
};

export const restoreItemFromTrash = (item: TrashItem) => {
  trashData = trashData.filter(t => t.id !== item.id);
  const restoredItem: FileItem = { ...item, isFavorite: false }; // Assume restored files are not favorite by default
  filesData.push(restoredItem);
  console.log(`Restored item "${item.name}" from trash.`);
  notify();
};

export const deleteItemPermanently = (itemId: string) => {
  trashData = trashData.filter(t => t.id !== itemId);
  console.log(`Permanently deleted item with ID "${itemId}".`);
  notify();
};

export const toggleFavorite = (itemId: string) => {
  filesData = filesData.map(file => {
    if (file.id === itemId) {
      const newFavStatus = !file.isFavorite;
      if (newFavStatus) {
        favoritesData.push({ ...file, isFavorite: true, favoritedAt: new Date().toISOString() });
      } else {
        favoritesData = favoritesData.filter(fav => fav.id !== itemId);
      }
      return { ...file, isFavorite: newFavStatus };
    }
    return file;
  });
  console.log(`Toggled favorite status for item with ID "${itemId}".`);
  notify();
};
