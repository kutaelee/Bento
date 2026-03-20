// bento-mobile/src/screens/TrashScreen.tsx
import React, { useEffect, useState } => 'react';
import { Item, getTrash, restoreTrashItem, permanentlyDeleteTrashItem } from '../services/mockCoreDriveService';

const TrashScreen: React.FC = () => {
  const [trashItems, setTrashItems] = useState<Item[]>([]);

  useEffect(() => {
    getTrash().then(setTrashItems);
  }, []);

  const handleRestore = (id: string) => {
    restoreTrashItem(id).then(success => {
      if (success) {
        console.log('Item restored (mock action).');
        getTrash().then(setTrashItems); // Re-fetch to update state
      } else {
        console.log('Failed to restore item.');
      }
    }).catch(console.error);
  };

  const handleDeletePermanent = (id: string) => {
    permanentlyDeleteTrashItem(id).then(success => {
      if (success) {
        console.log('Item permanently deleted (mock action).');
        getTrash().then(setTrashItems); // Re-fetch to update state
      } else {
        console.log('Failed to permanently delete item.');
      }
    }).catch(console.error);
  };

  return (
    <div style={{ padding: '16px', backgroundColor: '#f0f2f5', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h2 style={{ color: '#333', marginBottom: '24px', textAlign: 'center' }}>Trash</h2>
      {trashItems.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>Trash is empty.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {trashItems.map((item) => (
            <li
              key={item.id}
              style={{
                backgroundColor: '#fff',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#dc3545' }}>{item.name}</span>
                <span style={{ fontSize: '0.8em', color: '#666' }}>{item.lastModified}</span>
              </div>
              <div style={{ fontSize: '0.9em', color: '#555' }}>
                Type: {item.type} {item.size && ` | Size: ${item.size}`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => handleRestore(item.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: '#28a745',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8em',
                  }}
                >
                  Restore
                </button>
                <button
                  onClick={() => handleDeletePermanent(item.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '0.8em',
                  }}
                >
                  Delete Permanently
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default TrashScreen;
