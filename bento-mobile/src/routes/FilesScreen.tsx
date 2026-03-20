// bento-mobile/src/routes/FilesScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ListItem, FolderItem, Breadcrumb, Action } from '../types';
import { getItemsByPath } from '../data/mockData';
import ItemCard from '../components/ItemCard';
import Breadcrumbs from '../components/Breadcrumbs';
import ActionSheet from '../components/ActionSheet';
import EmptyState from '../components/EmptyState';

const FilesScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentPath, setCurrentPath] = useState<string>('/');
  const [items, setItems] = useState<ListItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  useEffect(() => {
    const path = location.pathname.replace('/files', '') || '/';
    setCurrentPath(path);
    setItems(getItemsByPath(path));
  }, [location.pathname]);

  const handleItemClick = useCallback((item: ListItem) => {
    if (item.type === 'folder') {
      navigate(`/files${item.path}`);
    } else {
      console.log('Open file:', item.name);
      // Implement file preview/open logic here
    }
  }, [navigate]);

  const handleMoreClick = useCallback((item: ListItem) => {
    setSelectedItem(item);
    setIsActionSheetOpen(true);
  }, []);

  const handleCloseActionSheet = useCallback(() => {
    setIsActionSheetOpen(false);
    setSelectedItem(null);
  }, []);

  // Generate breadcrumbs from currentPath
  const pathSegments = currentPath.split('/').filter(Boolean);
  const breadcrumbs: Breadcrumb[] = [{ name: 'Home', path: '/files' }];
  pathSegments.reduce((accPath, segment) => {
    const newPath = `${accPath}/${segment}`;
    breadcrumbs.push({ name: segment, path: `/files${newPath}` });
    return newPath;
  }, '');

  const commonActions: Action[] = [
    { id: 'download', label: 'Download', icon: 'icon-download', handler: (item) => console.log('Download', item.name) },
    { id: 'share', label: 'Share', icon: 'icon-share', handler: (item) => console.log('Share', item.name) },
    { id: 'move', label: 'Move', handler: (item) => console.log('Move', item.name) },
    { id: 'rename', label: 'Rename', handler: (item) => console.log('Rename', item.name) },
    { id: 'delete', label: 'Delete', icon: 'icon-delete', handler: (item) => console.log('Delete', item.name), isDestructive: true },
  ];

  return (
    <div className="files-screen">
      <Breadcrumbs breadcrumbs={breadcrumbs} />

      {items.length === 0 ? (
        <EmptyState message="No files or folders here. Tap '+' to add new items." iconClass="icon-folder" />
      ) : (
        <div className="item-list">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={handleItemClick}
              onMoreClick={handleMoreClick}
            />
          ))}
        </div>
      )}

      <ActionSheet
        isOpen={isActionSheetOpen}
        onClose={handleCloseActionSheet}
        item={selectedItem}
        actions={commonActions}
      />
    </div>
  );
};

export default FilesScreen;
