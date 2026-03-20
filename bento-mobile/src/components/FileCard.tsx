import React from 'react';
import { FileItem } from '../types';

interface FileCardProps {
  item: FileItem;
  onClick: (item: FileItem) => void;
  onActionClick?: (item: FileItem) => void;
}

const FileCard: React.FC<FileCardProps> = ({ item, onClick, onActionClick }) => {
  const isFolder = item.type === 'folder';

  return (
    <div
      onClick={() => onClick(item)}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #F3F4F6', // gray-100
        backgroundColor: 'white',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '20px', marginRight: '12px' }}>
        {isFolder ? '📁' : '📄'}
      </span>
      <div style={{ flexGrow: 1 }}>
        <div style={{ fontWeight: '500', fontSize: '16px' }}>{item.name}</div>
        <div style={{ fontSize: '12px', color: '#6B7280' }}>
          {isFolder ? 'Folder' : `${item.size || 'Unknown size'} • ${new Date(item.modifiedAt).toLocaleDateString()}`}
        </div>
      </div>
      {onActionClick && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Prevent card click
            onActionClick(item);
          }}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '0 8px',
            lineHeight: '1',
          }}
        >
          ⋯
        </button>
      )}
    </div>
  );
};

export default FileCard;
