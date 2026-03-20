// bento-mobile/src/components/MobileHeader.tsx
import React from 'react';

interface MobileHeaderProps {
  title: string;
  onBack?: () => void;
  onMenu?: () => void;
  onAdd?: () => void;
}

const MobileHeader: React.FC<MobileHeaderProps> = ({ title, onBack, onMenu, onAdd }) => {
  return (
    <header className="mobile-header bg-white shadow-sm p-4 flex-between sticky top-0 z-10">
      {onBack ? (
        <button className="icon icon-arrow-back text-gray-600 p-2 -ml-2" onClick={onBack}></button>
      ) : (
        onMenu && <button className="icon icon-menu text-gray-600 p-2 -ml-2" onClick={onMenu}></button>
      )}
      <h1 className="text-xl font-bold text-gray-800 flex-1 text-center">{title}</h1>
      {onAdd && (
        <button className="icon icon-add text-blue-600 p-2 -mr-2" onClick={onAdd}></button>
      )}
      {!onAdd && <div className="w-10"></div>} {/* Placeholder for alignment */}
    </header>
  );
};

export default MobileHeader;
