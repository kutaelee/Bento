// bento-mobile/src/routes/RecentScreen.tsx
import React, { useState, useCallback } from 'react';
import { RecentItem, Action, ListItem } from '../types';
import { mockRecentItems } from '../data/mockData';
import ItemCard from '../components/ItemCard';
import ActionSheet from '../components/ActionSheet';
import EmptyState from '../components/EmptyState';
import { useNavigate } from 'react-router-dom';

const RecentScreen: React.FC = () => {
  const navigate = useNavigate();
  const [recentItems, setRecentItems] = useState<RecentItem[]>(mockRecentItems);
  const [selectedItem, setSelectedItem] = useState<ListItem | null>(null);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);

  const handleItemClick = useCallback((item: ListItem) => {
    console.log('Open recent item:', item.name);
    // For a recent item, navigate to its original path or open directly
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

  const recentActions: Action[] = [
    { id: 'download', label: 'Download', icon: 'icon-download', handler: (item) => console.log('Download recent', item.name) },
    { id: 'share', label: 'Share', icon: 'icon-share', handler: (item) => console.log('Share recent', item.name) },
    { id: 'remove_from_recent', label: 'Remove from Recent', handler: (item) => {
      setRecentItems(prev => prev.filter(r => r.id !== item.id));
      console.log('Remove from recent', item.name);
    }},
  ];

  return (
    <div className="recent-screen">
      {recentItems.length === 0 ? (
        <EmptyState message="No recent items found. Start working on files to see them here!" iconClass="icon-recent" />
      ) : (
        <div className="item-list">
          {recentItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onClick={handleItemClick}
              onMoreClick={handleMoreClick}
              showPath={true} // Show original path for recent items
            />
          ))}
        </div>
      )}

      <ActionSheet
        isOpen={isActionSheetOpen}
        onClose={handleCloseActionSheet}
        item={selectedItem}
        actions={recentActions}
      />
    </div>
  );
};

export default RecentScreen;
