// bento-mobile/src/screens/FilesScreen.tsx
import React, { useEffect, useState } from 'react';
import { Item, getFiles, moveItem, toggleFavorite } from '../services/mockCoreDriveService';

const FilesScreen: React.FC = () => {
  const [files, setFiles] = useState<Item[]>([]);

  useEffect(() => {
    getFiles().then(setFiles);
  }, []);

  const handleMove = (id: string) => {
    moveItem(id, 'New Folder').then(() => {
      // Feedback can be implemented here, e.g., a toast notification
      console.log('Item moved (mock action).');
    }).catch(console.error);
  };

  const handleToggleFavorite = (id: string) => {
    toggleFavorite(id).then(() => {
      console.log('Favorite status toggled (mock action).');
      // Re-fetch files to update state if necessary or update locally
      getFiles().then(setFiles);
    }).catch(console.error);
  };

  return (
    <div style={{ padding: '16px', backgroundColor: '#f0f2f5', minHeight: '100vh', boxSizing: 'border-box' }}>
      <h2 style={{ color: '#333', marginBottom: '24px', textAlign: 'center' }}>Files</h2>
      {files.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#666' }}>No files found.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {files.map((item) => (
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

export default FilesScreen;
