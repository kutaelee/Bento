// bento-mobile/src/components/Breadcrumbs.tsx
import React from 'react';
import { Breadcrumb } from '../types';
import { useNavigate } from 'react-router-dom';

interface BreadcrumbsProps {
  breadcrumbs: Breadcrumb[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ breadcrumbs }) => {
  const navigate = useNavigate();

  if (breadcrumbs.length === 0) return null;

  // Simple truncation for mobile: show first, last two, and current
  const displayedBreadcrumbs = breadcrumbs.length > 4
    ? [breadcrumbs[0], { name: '...', path: '' }, ...breadcrumbs.slice(-2)]
    : breadcrumbs;

  return (
    <nav className="breadcrumbs text-gray-500 text-sm overflow-hidden whitespace-nowrap mb-4">
      {displayedBreadcrumbs.map((crumb, index) => (
        <React.Fragment key={crumb.path || index}>
          {index > 0 && <span className="mx-1">/</span>}
          {crumb.name === '...' ? (
            <span className="text-gray-400">{crumb.name}</span>
          ) : (
            <button
              className={`font-medium ${index === breadcrumbs.length - 1 ? 'text-gray-800' : 'text-blue-600 hover:underline'}`}
              onClick={() => navigate(crumb.path)}
              disabled={index === breadcrumbs.length - 1}
            >
              {crumb.name}
            </button>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumbs;
