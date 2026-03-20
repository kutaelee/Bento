// bento-mobile/src/components/ActionSheet.tsx
import React from 'react';
import { Action, ListItem } from '../types';

interface ActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  item: ListItem | null;
  actions: Action[];
}

const ActionSheet: React.FC<ActionSheetProps> = ({ isOpen, onClose, item, actions }) => {
  if (!isOpen || !item) return null;

  return (
    <div className="action-sheet-overlay fixed inset-0 bg-black bg-opacity-50 flex items-end z-50" onClick={onClose}>
      <div
        className="action-sheet bg-white w-full rounded-t-2xl shadow-lg p-4 transform transition-transform duration-300 ease-out"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        style={{
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
        }}
      >
        <div className="text-center pb-3 border-b border-gray-200 mb-3">
          <h3 className="text-lg font-semibold text-gray-800">{item.name}</h3>
          <p className="text-sm text-gray-500">{item.type === 'file' ? `File • ${item.fileType}` : 'Folder'}</p>
        </div>
        <ul className="space-y-2">
          {actions.map((action) => (
            <li key={action.id}>
              <button
                className={`w-full text-left py-3 px-4 rounded-lg text-lg font-medium transition-colors duration-200 flex items-center
                            ${action.isDestructive ? 'text-red-600 hover:bg-red-50' : 'text-blue-600 hover:bg-blue-50'}`}
                onClick={() => {
                  action.handler(item);
                  onClose();
                }}
              >
                {action.icon && <span className={`icon ${action.icon} mr-3`} style={{ color: action.isDestructive ? '#dc2626' : '#2563eb' }}></span>}
                {action.label}
              </button>
            </li>
          ))}
          <li>
            <button
              className="w-full text-left py-3 px-4 rounded-lg text-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors duration-200 mt-2"
              onClick={onClose}
            >
              Cancel
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default ActionSheet;
