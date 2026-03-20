// bento-mobile/src/components/MobileShell.tsx
import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import MobileHeader from './MobileHeader';
import MobileNav from './MobileNav';

const getTitle = (pathname: string): string => {
  if (pathname.startsWith('/files')) {
    const parts = pathname.split('/').filter(Boolean);
    return parts.length > 1 ? parts[parts.length - 1] : 'Files';
  }
  if (pathname === '/recent') return 'Recent';
  if (pathname === '/favorites') return 'Favorites';
  if (pathname === '/trash') return 'Trash';
  return 'Bento Mobile'; // Default title for other routes (e.g., auth)
};

const MobileShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const isRootPath = location.pathname === '/files' || location.pathname === '/'; // Assuming /files is the main root for content

  const handleBack = () => {
    navigate(-1);
  };

  // Assume routes like /login, /setup, /invite accept don't have the full shell
  const isAuthRoute = location.pathname.startsWith('/auth') || location.pathname === '/login' || location.pathname === '/setup';
  if (isAuthRoute) {
    return <Outlet />; // Render auth routes without the shell
  }

  return (
    <div className="mobile-shell flex flex-col min-h-screen pb-16"> {/* pb-16 for bottom nav */}
      <MobileHeader
        title={getTitle(location.pathname)}
        onBack={isRootPath ? undefined : handleBack} // Show back button if not on a root path
        onMenu={() => console.log('Menu clicked')} // Placeholder for global menu
        onAdd={() => console.log('Add clicked')} // Placeholder for global add action
      />
      <main className="flex-1 overflow-auto p-4"> {/* Added padding to main content */}
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
};

export default MobileShell;
