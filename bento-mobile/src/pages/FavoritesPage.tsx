// bento-mobile/src/pages/FavoritesPage.tsx
import React, { useEffect, useState } from 'react';
import { getFavorites, FavoriteItem, moveItemToTrash, toggleFavorite, subscribe } from '../services/mockData';

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  const fetchFavorites = () => {
    setFavorites(getFavorites());
  };

  useEffect(() => {
    fetchFavorites();
    const unsubscribe = subscribe(fetchFavorites);
    return () => unsubscribe();
  }, []);

  const handleMoveToTrash = (item: FavoriteItem) => {
    moveItemToTrash(item);
  };

  const handleRemoveFavorite = (itemId: string) => {
    toggleFavorite(itemId); // Toggling favorite status removes it if already favorite
  };

  return (
    <div style={pageStyle}>
      <h2>My Favorites</h2>
      {favorites.length === 0 ? (
        <p>No favorite items.</p>
      ) : (
        <ul style={listStyle}>
          {favorites.map((item) => (
            <li key={item.id} style={listItemStyle}>
              <div style={itemInfoStyle}>
                <span>{item.type === 'folder' ? '📁' : '📄'} {item.name}</span>
                <span style={itemDetailStyle}>
                  Favorited {new Date(item.favoritedAt).toLocaleDateString()}
                </span>
              </div>
              <div style={itemActionsStyle}>
                <button onClick={() => handleRemoveFavorite(item.id)} style={actionButtonStyle}>
                  💔
                </button>
                <button onClick={() => handleMoveToTrash(item)} style={actionButtonStyle}>
                  🗑️
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
