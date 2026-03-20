// bento-mobile/src/routes/TrashScreen.tsx
import React, { useState, useCallback } from 'react';
import { TrashItem, Action, ListItem } from '../types';
import { mockTrashItems, deleteItemPermanently, restoreItem as restoreItemFromMock } from '../data/mockData';
import ItemCard from '../components/ItemCard';
import ActionSheet from '../components/ActionSheet';
import EmptyState from '../components/EmptyState';

const TrashScreen: React.FC = () => {
  const [trashItems, setTrashItems] = useState<TrashItem[]>(mockTrashItems);
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const handleItemClick = useCallback((item: ListItem) => {
    console.log('View trash item details:', item.name);
    // Perhaps show a preview or more details for trashed items
  }, []);

  const handleMoreClick = useCallback((item: ListItem) => {
    setSelectedItem(item);
    setIsActionSheetOpen(true);
  }, []);

  const handleCloseActionSheet = useCallback(() => {
    setIsActionSheetOpen(false);
    setSelectedItem(null);
  }, []);

  const handleRestore = useCallback((item: ListItem) => {
    restoreItemFromMock(item.id);
    setTrashItems(prev => prev.filter(t => t.id !== item.id));
    console.log('Item restored:', item.name);
  }, []);

  const handleDeletePermanently = useCallback((item: ListItem) => {
    deleteItemPermanently(item.id);
    setTrashItems(prev => prev.filter(t => t.id !== item.id));
    console.log('Item permanently deleted:', item.name);
  }, []);

  const trashActions: Action[] = [
    { id: 'restore', label: 'Restore', icon: 'icon-restore', handler: handleRestore },
    { id: 'delete_permanently', label: 'Delete Permanently', icon: 'icon-delete', handler: handleDeletePermanently, isDestructive: true },
  ];

  return (
    <div className="trash-screen">
      {trashItems.length === 0 ? (
        <EmptyState message="Your trash is empty. Nothing to restore or delete!" iconClass="icon-trash" />
      ) : (
        <div className="item-list">
          {trashItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={handleItemClick}
              onMoreClick={handleMoreClick}
              showPath={true}
            />
          ))}
        </div>
      )}

      <ActionSheet
        isOpen={isActionSheetOpen}
        onClose={handleCloseActionSheet}
        item={selectedItem}
        actions={trashActions}
      />
    </div>
  );
};

export default TrashScreen;
