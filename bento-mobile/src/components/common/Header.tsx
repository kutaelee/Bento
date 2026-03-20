import React from 'react';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  title: string;
  showBack?: boolean;
}

const Header: React.FC<HeaderProps> = ({ title, showBack = false }) => {
  const navigate = useNavigate();

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      left: 0,
      right: 0,
      backgroundColor: 'white',
      borderBottom: '1px solid #E5E7EB',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      zIndex: 10,
      height: '56px',
    }}>
      {showBack && (
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            marginRight: '10px',
            padding: '0',
            lineHeight: '1',
          }}
        >
          &lt;
        </button>
      )}
      <h1 style={{
        fontSize: '18px',
        fontWeight: '600',
        margin: 0,
        flexGrow: 1, // Allow title to take remaining space
      }}>
        {title}
      </h1>
      {/* Optional: Add user icon or search button here */}
    </header>
  );
};

export default Header;
