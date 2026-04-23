import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import GlobalRescueUI from './components/Shared/GlobalRescueUI';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <GlobalRescueUI>
      <App />
    </GlobalRescueUI>
  </React.StrictMode>
);
