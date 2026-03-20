export interface Item {
  id: string;
  name: string;
  type: 'file' | 'folder';
  lastModified: string;
  size?: string;
  isFavorite?: boolean;
  isTrashed?: boolean;
}

const mockFiles: Item[] = [
  { id: 'file-1', name: 'Document A.pdf', type: 'file', lastModified: '2023-10-26', size: '1.2 MB' },
  { id: 'folder-1', name: 'Project X', type: 'folder', lastModified: '2023-10-25' },
  { id: 'file-2', name: 'Image B.jpg', type: 'file', lastModified: '2023-10-24', size: '3.5 MB' },
  { id: 'file-3', name: 'Spreadsheet C.xlsx', type: 'file', lastModified: '2023-10-23', size: '0.8 MB' },
];

const mockRecents: Item[] = [
  { id: 'file-4', name: 'Meeting Notes.docx', type: 'file', lastModified: '2023-10-26 14:30', size: '0.5 MB' },
  { id: 'file-1', name: 'Document A.pdf', type: 'file', lastModified: '2023-10-26 10:00', size: '1.2 MB' },
  { id: 'folder-1', name: 'Project X', type: 'folder', lastModified: '2023-10-25 18:00' },
];

let mockFavorites: Item[] = [
  { id: 'file-1', name: 'Document A.pdf', type: 'file', lastModified: '2023-10-26', size: '1.2 MB', isFavorite: true },
  { id: 'folder-2', name: 'Important Docs', type: 'folder', lastModified: '2023-10-20', isFavorite: true },
];

let mockTrash: Item[] = [
  { id: 'file-5', name: 'Old Report.pdf', type: 'file', lastModified: '2023-10-15', size: '2.1 MB', isTrashed: true },
  { id: 'file-6', name: 'Draft Email.txt', type: 'file', lastModified: '2023-10-10', size: '0.1 MB', isTrashed: true },
];

export const getFiles = (): Promise<Item[]> => Promise.resolve(mockFiles);
export const getRecents = (): Promise<Item[]> => Promise.resolve(mockRecents);
export const getFavorites = (): Promise<Item[]> => Promise.resolve(mockFavorites);
export const getTrash = (): Promise<Item[]> => Promise.resolve(mockTrash);

export const toggleFavorite = (id: string): Promise<boolean> => {
  const item = mockFiles.find(f => f.id === id) || mockRecents.find(r => r.id === id);
  if (item) {
    item.isFavorite = !item.isFavorite;
    if (item.isFavorite && !mockFavorites.some(f => f.id === item.id)) {
      mockFavorites.push({ ...item, isFavorite: true });
    } else if (!item.isFavorite) {
      mockFavorites = mockFavorites.filter(f => f.id !== item.id);
    }
    return Promise.resolve(item.isFavorite);
  }
  return Promise.reject(new Error('Item not found'));
};

export const restoreTrashItem = (id: string): Promise<boolean> => {
  const itemIndex = mockTrash.findIndex(f => f.id === id);
  if (itemIndex > -1) {
    const [item] = mockTrash.splice(itemIndex, 1);
    item.isTrashed = false;
    mockFiles.push(item); // Restore to files for simplicity
    console.log(`Restored: ${item.name}`);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
};

export const permanentlyDeleteTrashItem = (id: string): Promise<boolean> => {
  const initialLength = mockTrash.length;
  mockTrash = mockTrash.filter(f => f.id !== id);
  console.log(`Permanently deleted: ${id}`);
  return Promise.resolve(mockTrash.length < initialLength);
};

export const moveItem = (id: string, destination: string): Promise<boolean> => {
  // Simulate moving an item to a new location.
  // In a real app, this would involve updating folder structures.
  // For mock, just log the action.
  const item = mockFiles.find(f => f.id === id) || mockRecents.find(r => r.id === id) || mockFavorites.find(f => f.id === id);
  if (item) {
    console.log(`Moved item ${item.name} to ${destination}`);
    return Promise.resolve(true);
  }
  return Promise.resolve(false);
};
