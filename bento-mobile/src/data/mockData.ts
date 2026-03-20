import { FileItem, RecentItem, TrashItem } from '../types';

const generateId = () => Math.random().toString(36).substring(2, 11);

const rootFiles: FileItem[] = [
  {
    id: generateId(),
    name: 'Documents',
    type: 'folder',
    parentId: null,
    path: '/Documents',
    modifiedAt: '2024-07-20T10:00:00Z',
    items: [],
  },
  {
    id: generateId(),
    name: 'Photos',
    type: 'folder',
    parentId: null,
    path: '/Photos',
    modifiedAt: '2024-07-19T14:30:00Z',
    items: [],
  },
  {
    id: generateId(),
    name: 'Presentation.pptx',
    type: 'file',
    parentId: null,
    path: '/Presentation.pptx',
    modifiedAt: '2024-07-21T09:15:00Z',
    size: '12 MB',
  },
  {
    id: generateId(),
    name: 'README.md',
    type: 'file',
    parentId: null,
    path: '/README.md',
    modifiedAt: '2024-07-22T08:00:00Z',
    size: '2 KB',
  },
];

const documentsSubFolder: FileItem[] = [
  {
    id: generateId(),
    name: 'Work',
    type: 'folder',
    parentId: rootFiles[0].id,
    path: '/Documents/Work',
    modifiedAt: '2024-07-18T11:00:00Z',
    items: [],
  },
  {
    id: generateId(),
    name: 'Personal',
    type: 'folder',
    parentId: rootFiles[0].id,
    path: '/Documents/Personal',
    modifiedAt: '2024-07-17T16:00:00Z',
    items: [],
  },
  {
    id: generateId(),
    name: 'Report.pdf',
    type: 'file',
    parentId: rootFiles[0].id,
    path: '/Documents/Report.pdf',
    modifiedAt: '2024-07-22T10:30:00Z',
    size: '5 MB',
  },
];

const workSubFolder: FileItem[] = [
  {
    id: generateId(),
    name: 'Project X',
    type: 'folder',
    parentId: documentsSubFolder[0].id,
    path: '/Documents/Work/Project X',
    modifiedAt: '2024-07-16T09:00:00Z',
    items: [],
  },
  {
    id: generateId(),
    name: 'MeetingNotes.docx',
    type: 'file',
    parentId: documentsSubFolder[0].id,
    path: '/Documents/Work/MeetingNotes.docx',
    modifiedAt: '2024-07-22T11:00:00Z',
    size: '300 KB',
  },
];

const photosSubFolder: FileItem[] = [
  {
    id: generateId(),
    name: 'Vacation',
    type: 'folder',
    parentId: rootFiles[1].id,
    path: '/Photos/Vacation',
    modifiedAt: '2024-07-15T10:00:00Z',
    items: [],
  },
  {
    id: generateId(),
    name: 'IMG_0001.jpg',
    type: 'file',
    parentId: rootFiles[1].id,
    path: '/Photos/IMG_0001.jpg',
    modifiedAt: '2024-07-20T12:00:00Z',
    size: '2 MB',
  },
];


// Populate nested items for demonstration
rootFiles[0].items = documentsSubFolder;
documentsSubFolder[0].items = workSubFolder;
rootFiles[1].items = photosSubFolder;

export const mockFilesystem: FileItem[] = rootFiles;

export const mockRecentItems: RecentItem[] = [
  {
    id: generateId(),
    name: 'MeetingNotes.docx',
    type: 'file',
    accessedAt: '2024-07-23T10:30:00Z',
    filePath: '/Documents/Work/MeetingNotes.docx',
  },
  {
    id: generateId(),
    name: 'Project X',
    type: 'folder',
    accessedAt: '2024-07-23T09:45:00Z',
    filePath: '/Documents/Work/Project X',
  },
  {
    id: generateId(),
    name: 'Report.pdf',
    type: 'file',
    accessedAt: '2024-07-22T16:00:00Z',
    filePath: '/Documents/Report.pdf',
  },
  {
    id: generateId(),
    name: 'Vacation',
    type: 'folder',
    accessedAt: '2024-07-22T14:00:00Z',
    filePath: '/Photos/Vacation',
  },
];

export const mockFavoriteItems: FileItem[] = [
  { ...documentsSubFolder[0], isFavorite: true }, // Work folder
  { ...rootFiles[2], isFavorite: true }, // Presentation.pptx
];

export const mockTrashItems: TrashItem[] = [
  {
    id: generateId(),
    name: 'Old_Draft.txt',
    type: 'file',
    deletedAt: '2024-07-10T08:00:00Z',
    originalPath: '/Documents/Old_Draft.txt',
  },
  {
    id: generateId(),
    name: 'Temporary_Folder',
    type: 'folder',
    deletedAt: '2024-07-12T15:00:00Z',
    originalPath: '/Documents/Work/Temporary_Folder',
  },
];

// Helper functions for mock file system
export const getFolderContents = (path: string, currentFs: FileItem[] = mockFilesystem): FileItem[] => {
  if (path === '/') {
    return currentFs.filter(item => item.parentId === null);
  }
  const pathParts = path.split('/').filter(p => p !== '');
  let currentFolder: FileItem | undefined;
  let itemsToSearch: FileItem[] = currentFs;

  for (const part of pathParts) {
    currentFolder = itemsToSearch.find(item => item.name === part && item.type === 'folder');
    if (currentFolder && currentFolder.items) {
      itemsToSearch = currentFolder.items;
    } else if (currentFolder && !currentFolder.items) {
      // Found the folder, but it has no children defined in mock, return empty
      return [];
    } else {
      // Path not found
      return [];
    }
  }
  return itemsToSearch || [];
};

export const findItemByPath = (path: string, currentFs: FileItem[] = mockFilesystem): FileItem | undefined => {
  if (path === '/') return undefined; // Root doesn't have an item itself
  const pathParts = path.split('/').filter(p => p !== '');
  let currentItems: FileItem[] = currentFs.filter(item => item.parentId === null);
  let foundItem: FileItem | undefined;

  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    foundItem = currentItems.find(item => item.name === part);
    if (foundItem) {
      if (i === pathParts.length - 1) {
        return foundItem; // Found the target item
      } else if (foundItem.type === 'folder' && foundItem.items) {
        currentItems = foundItem.items; // Continue searching in subfolder
      } else {
        return undefined; // Path leads into a non-folder item before end
      }
    }
    else {
      return undefined; // Part of path not found
    }
  }
  return undefined; // Should not reach here if path is valid and item found
};

// Mock state for actions
export const mockTrashBin: TrashItem[] = [...mockTrashItems];
export const mockFileSystemState: FileItem[] = JSON.parse(JSON.stringify(mockFilesystem)); // Deep copy to allow modification

export const simulateMoveToTrash = (item: FileItem) => {
  console.log(`Simulating moving "${item.name}" to trash.`);
  // In a real app, this would modify a global state or send to backend
  mockTrashBin.push({
    id: item.id,
    name: item.name,
    type: item.type,
    deletedAt: new Date().toISOString(),
    originalPath: item.path,
  });
  // Also remove from mock file system (complex for nested mock, simplified for now)
  // For actual implementation, would need a recursive delete from `mockFileSystemState`
  // For now, just logging action.
};

export const simulateRestoreFromTrash = (item: TrashItem) => {
  console.log(`Simulating restoring "${item.name}" from trash.`);
  // In a real app, remove from trash and add back to file system
  const index = mockTrashBin.findIndex(t => t.id === item.id);
  if (index > -1) {
    mockTrashBin.splice(index, 1);
  }
  // Simplified: not actually re-adding to mock file system tree
};

export const simulateDeletePermanently = (item: TrashItem) => {
  console.log(`Simulating permanently deleting "${item.name}".`);
  const index = mockTrashBin.findIndex(t => t.id === item.id);
  if (index > -1) {
    mockTrashBin.splice(index, 1);
  }
};
