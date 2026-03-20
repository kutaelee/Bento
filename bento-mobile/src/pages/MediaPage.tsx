import React from 'react';
import { mockMedia } from '../data/mocks';
import './Page.css';

const MediaPage: React.FC = () => {
  return (
    <div className="page media-page">
      <h2>Media</h2>
      <p>View your images and videos.</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px' }}>
        {mockMedia.map((media) => (
          <div key={media.id} style={{ border: '1px solid #ccc', padding: '5px', textAlign: 'center' }}>
            <img src={media.url} alt={media.name} style={{ width: '80px', height: '80px', objectFit: 'cover' }} />
            <p style={{ fontSize: '0.8em', margin: '5px 0 0' }}>{media.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MediaPage;
