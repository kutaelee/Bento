import React from 'react';
import './Page.css';

const SearchPage: React.FC = () => {
  return (
    <div className="page search-page">
      <h2>Search</h2>
      <p>Search across your Bento content.</p>
      <input type="text" placeholder="Search..." style={{ width: '100%', padding: '8px', margin: '10px 0' }} />
      <p>No results yet. Try searching for something!</p>
    </div>
  );
};

export default SearchPage;
