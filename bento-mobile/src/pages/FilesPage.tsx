import React from 'react';
import { mockFiles } from '../data/mocks';
import './Page.css';

const FilesPage: React.FC = () => {
  return (
    <div className="page files-page">
      <h2>Files</h2>
      <p>Browse your files and folders.</p>
      <ul>
        {mockFiles.map((file) => (
          <li key={file.id}>
            <strong>{file.name}</strong> ({file.size})
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FilesPage;
