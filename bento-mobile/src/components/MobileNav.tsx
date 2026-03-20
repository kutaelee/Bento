// bento-mobile/src/components/MobileNav.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { name: 'Files', icon: 'icon-folder', path: '/files' },
  { name: 'Recent', icon: 'icon-recent', path: '/recent' },
  { name: 'Favorites', icon: 'icon-star', path: '/favorites' },
  { name: 'Trash', icon: 'icon-trash', path: '/trash' },
];

const MobileNav: React.FC = () => {
  return (
    <nav className="mobile-nav bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 z-10">
      <ul className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <li key={item.name} className="flex-1">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center p-1 text-sm font-medium transition-colors duration-200
                ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`
              }
            >
              <span className={`icon ${item.icon} w-6 h-6 mb-1`}></span>
              {item.name}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};

export default MobileNav;
