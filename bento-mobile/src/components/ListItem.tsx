import React from 'react';
import './ListItem.css';

interface ListItemProps {
  label: string;
  value: string | number | React.ReactNode;
  status?: 'success' | 'warning' | 'error' | 'info';
}

const ListItem: React.FC<ListItemProps> = ({ label, value, status }) => {
  const statusClass = status ? `list-item-status-${status}` : '';
  return (
    <div className="list-item">
      <span className="list-item-label">{label}:</span>
      <span className={`list-item-value ${statusClass}`}>{value}</span>
    </div>
  );
};

export default ListItem;
