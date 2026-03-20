// bento-mobile/src/components/ItemCard.tsx
import React from 'react';
import { ListItem, FileItem, FolderItem } from '../types';

interface ItemCardProps {
  item: ListItem;
  onClick: (item: ListItem) => void;
  onMoreClick: (item: ListItem) => void;
  showPath?: boolean; // For recent/trash views
}

const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onMoreClick, showPath = false }) => {
  const isFile = item.type === 'file';
  const iconClass = isFile ? `icon-file` : `icon-folder`;
  const detailText = isFile
    ? (item as FileItem).fileType.toUpperCase() + (item.size ? ` • ${Math.round(item.size / 1024)} KB` : '')
    : `${(item as FolderItem).childrenCount} items`;

  return (
    <div
      className="item-card flex items-center p-3 bg-white rounded-lg shadow-sm mb-2 active:bg-gray-100 transition-colors duration-100"
      onClick={() => onClick(item)}
    >
      <span className={`icon ${iconClass} text-blue-500 mr-3`}></span>
      <div className="flex-1 overflow-hidden">
        <p className="text-gray-800 font-medium truncate">{item.name}</p>
        <p className="text-gray-500 text-sm truncate">
          {detailText} {showPath && item.path !== '/' && ` • ${item.path}`}
        </p>
      </div>
      <button
        className="icon icon-more-vert text-gray-400 p-2 -mr-2"
        onClick={(e) => {
          e.stopPropagation(); // Prevent card click
          onMoreClick(item);
        }}
      ></button>
    </div>
  );
};

export default ItemCard;
