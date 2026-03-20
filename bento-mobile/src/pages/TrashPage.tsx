// bento-mobile/src/pages/TrashPage.tsx
import React, { useEffect, useState } from 'react';
import { getTrash, TrashItem, restoreItemFromTrash, deleteItemPermanently, subscribe } from '../services/mockData';

export function TrashPage() {
  const [trashItems, setTrashItems] = useState<TrashItem[]>([]);

  const fetchTrash = () => {
    setTrashItems(getTrash());
  };

  useEffect(() => {
    fetchTrash();
    const unsubscribe = subscribe(fetchTrash);
    return () => unsubscribe();
  }, []);

  const handleRestore = (item: TrashItem) => {
    restoreItemFromTrash(item);
  };

  const handleDeletePermanently = (itemId: string) => {
    deleteItemPermanently(itemId);
  };

  return (
    <div style={pageStyle}>
      <h2>Trash</h2>
      {trashItems.length === 0 ? (
        <p>Trash is empty.</p>
      ) : (
        <ul style={listStyle}>
          {trashItems.map((item) => (
            <li key={item.id} style={listItemStyle}>
              <div style={itemInfoStyle}>
                <span>{item.type === 'folder' ? '📁' : '📄'} {item.name}</span>
                <span style={itemDetailStyle}>
                  Trashed {new Date(item.trashedAt).toLocaleDateString()}
                </span>
              </div>
              <div style={itemActionsStyle}>
                <button onClick={() => handleRestore(item)} style={actionButtonStyle}>
                  ↩️
                </button>
                <button onClick={() => handleDeletePermanently(item.id)} style={actionButtonStyle}>
                   permanently
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Re-using styles for consistency
const pageStyle: React.CSSProperties = { padding: '16px' };
const listStyle: React.CSSProperties = { listStyle: 'none', padding: 0 };
const listItemStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  backgroundColor: '#ffffff', marginBottom: '8px', padding: '12px 16px',
  borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const itemInfoStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', flexGrow: 1 };
const itemDetailStyle: React.CSSProperties = { fontSize: '12px', color: '#888', marginTop: '4px' };
const itemActionsStyle: React.CSSProperties = { display: 'flex', gap: '8px' };
const actionButtonStyle: React.CSSProperties = {
  background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer',
  padding: '4px', borderRadius: '4px', transition: 'background-color 0.2s',
};
