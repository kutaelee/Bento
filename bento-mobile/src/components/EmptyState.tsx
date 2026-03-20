// bento-mobile/src/components/EmptyState.tsx
import React from 'react';

interface EmptyStateProps {
  message: string;
  iconClass?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({ message, iconClass = 'icon-file' }) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 text-gray-500">
      <span className={`icon ${iconClass} w-16 h-16 mb-4 text-gray-300`}></span>
      <p className="text-lg font-medium">{message}</p>
    </div>
  );
};

export default EmptyState;
