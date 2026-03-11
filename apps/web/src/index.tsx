import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Labrats</h1>
        <p className="text-gray-500">Feature flag service &mdash; coming soon</p>
      </div>
    </div>
  );
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
