import React from 'react';
import { mockRecents } from '../data/mocks';
import './Page.css';

const RecentsPage: React.FC = () => {
  return (
    <div className="page recents-page">
      <h2>Recents</h2>
      <p>Recent activity and files.</p>
      <ul>
        {mockRecents.map((item) => (
          <li key={item.id}>
            <strong>{item.name}</strong> - {item.type} ({item.date})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default RecentsPage;
