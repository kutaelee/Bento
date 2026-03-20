import React from 'react';

interface BottomNavigationProps {
  currentPage: 'files' | 'recent' | 'favorites' | 'trash';
  onNavigate: (page: 'files' | 'recent' | 'favorites' | 'trash') => void;
}

export function BottomNavigation({ currentPage, onNavigate }: BottomNavigationProps) {
  const navItems = [
    { id: 'files', label: 'Files' },
    { id: 'recent', label: 'Recent' },
    { id: 'favorites', label: 'Favorites' },
    { id: 'trash', label: 'Trash' },
  ];

  return (
    <nav style={navStyle}>
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id as any)} // Type assertion for simplicity
          style={item.id === currentPage ? activeNavItemStyle : navItemStyle}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: '56px',
  backgroundColor: '#ffffff',
  borderTop: '1px solid #e0e0e0',
  boxShadow: '0 -2px 4px rgba(0,0,0,0.05)',
  zIndex: 100,
};

const navItemStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 0',
  fontSize: '12px',
  color: '#757575',
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  outline: 'none',
  WebkitTapHighlightColor: 'transparent',
};

const activeNavItemStyle: React.CSSProperties = {
  ...navItemStyle,
  color: '#1976d2', // Primary blue
  fontWeight: 'bold',
};
