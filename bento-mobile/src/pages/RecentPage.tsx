// bento-mobile/src/pages/RecentPage.tsx
import React, { useEffect, useState } from 'react';
import { getRecent, RecentItem, moveItemToTrash, subscribe } from '../services/mockData';

export function RecentPage() {
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const fetchRecent = () => {
    setRecent(getRecent());
  };

  useEffect(() => {
    fetchRecent();
    const unsubscribe = subscribe(fetchRecent);
    return () => unsubscribe();
  }, []);

  const handleMoveToTrash = (item: RecentItem) => {
    moveItemToTrash(item);
  };

  return (
    <div style={pageStyle}>
      <h2>Recent Activity</h2>
      {recent.length === 0 ? (
        <p>No recent activity.</p>
      ) : (
        <ul style={listStyle}>
          {recent.map((item) => (
            <li key={item.id} style={listItemStyle}>
              <div style={itemInfoStyle}>
                <span>{item.type === 'folder' ? '📁' : '📄'} {item.name}</span>
                <span style={itemDetailStyle}>
                  Accessed {new Date(item.accessedAt).toLocaleString()}
                </span>
              </div>
              <div style={itemActionsStyle}>
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

// Re-using styles from FilesPage for consistency
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
