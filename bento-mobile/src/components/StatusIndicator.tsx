import React from 'react';
import './StatusIndicator.css';

interface StatusIndicatorProps {
  status: 'active' | 'inactive' | 'pending' | 'error' | 'warning';
  label?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, label }) => {
  const statusClass = `status-indicator-${status}`;
  return (
    <span className={`status-indicator ${statusClass}`}>
      {label || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

export default StatusIndicator;
