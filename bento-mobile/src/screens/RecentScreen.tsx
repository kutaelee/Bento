// bento-mobile/src/screens/RecentScreen.tsx
import React, { useEffect, useState } => 'react';
import { Item, getRecents, moveItem, toggleFavorite } from '../services/mockCoreDriveService';

const RecentScreen: React.FC = () => {
  const [recents, setRecents] = useState<Item[]>([]);

  useEffect(() => {
    getRecents().then(setRecents);
  }, []);

  const handleMove = (id: string) => {
    moveItem(id, 'Archive').then(() => {
      console.log('Item moved (mock action).');
    }).catch(console.error);
  };

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id).then(() => {
      console.log('Favorite status toggled (mock action).');
      getRecents().then(setRecents); // Re-fetch to update state
    }).catch(console.error);
  };

  return (
    <div style={{ padding: '16px', backgroundColor: '#f0f2f5', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h2 style={{ color: '#333', marginBottom: '24px', textAlign: 'center' }}>Recent</h2>
      {recents.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>No recent items.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {recents.map((item) => (
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
                <span style={{ fontWeight: 'bold', color: '#007bff' }}>{item.name}</span>
                <span style={{ fontSize: '0.8em', color: '#666' }}>{item.lastModified}</span>
              </div>
              <div style={{ fontSize: '0.9em', color: '#555' }}>
                Type: {item.type} {item.size && ` | Size: ${item.size}`}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => handleToggleFavorite(item.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: item.isFavorite ? '#ffc107' : '#eee',
                    cursor: 'pointer',
                    fontSize: '0.8em',
                  }}
                >
                  {item.isFavorite ? 'Unfavorite' : 'Favorite'}
                </button>
                <button
                  onClick={() => handleMove(item.id)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '5px',
                    border: '1px solid #ccc',
                    backgroundColor: '#eee',
                    cursor: 'pointer',
                    fontSize: '0.8em',
                  }}
                >
                  Move
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default RecentScreen;
