// bento-mobile/src/routes/FavoritesScreen.tsx
import React, { useState, useCallback } from 'react';
import { Action, ListItem } from '../types';
import { mockFavoriteItems } from '../data/mockData';
import ItemCard from '../components/ItemCard';
import ActionSheet from '../components/ActionSheet';
import EmptyState from '../components/EmptyState';
import { useNavigate } from 'react-router-dom';

const FavoritesScreen: React.FC = () => {
  const navigate = useNavigate();
  const [favoriteItems, setFavoriteItems] = useState<ListItem[]>(mockFavoriteItems);
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const handleItemClick = useCallback((item: ListItem) => {
    console.log('Open favorite item:', item.name);
    if (item.type === 'folder') {
      navigate(`/files${item.path}`);
    } else {
      // Logic to open file preview
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

  const favoriteActions: Action[] = [
    { id: 'download', label: 'Download', icon: 'icon-download', handler: (item) => console.log('Download favorite', item.name) },
    { id: 'share', label: 'Share', icon: 'icon-share', handler: (item) => console.log('Share favorite', item.name) },
    { id: 'remove_from_favorites', label: 'Remove from Favorites', handler: (item) => {
      setFavoriteItems(prev => prev.filter(f => f.id !== item.id));
      console.log('Remove from favorites', item.name);
    }},
    { id: 'delete', label: 'Delete', icon: 'icon-delete', handler: (item) => console.log('Delete favorite', item.name), isDestructive: true },
  ];

  return (
    <div className="favorites-screen">
      {favoriteItems.length === 0 ? (
        <EmptyState message="No favorite items found. Mark files or folders as favorite to see them here!" iconClass="icon-star" />
      ) : (
        <div className="item-list">
          {favoriteItems.map((item) => (
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
        actions={favoriteActions}
      />
    </div>
  );
};

export default FavoritesScreen;
