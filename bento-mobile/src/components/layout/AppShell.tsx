import React from 'react';
import BottomNavBar from '../navigation/BottomNavBar';
import './AppShell.css';

interface AppShellProps {
  children: React.ReactNode;
}

const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="app-shell">
      <main className="app-content">
        {children}
      </main>
      <BottomNavBar />
    </div>
  );
};

export default AppShell;
