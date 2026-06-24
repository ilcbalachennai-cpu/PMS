import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import GlobalRescueUI from './components/Shared/GlobalRescueUI';

// Polyfills for older environments like Windows 7 / old Electron
if (typeof Object.values !== 'function') {
  (Object as any).values = function (obj: any) {
    return Object.keys(obj).map((key) => obj[key]);
  };
}
if (typeof Object.entries !== 'function') {
  (Object as any).entries = function (obj: any) {
    return Object.keys(obj).map((key) => [key, obj[key]]);
  };
}
if (typeof Object.fromEntries !== 'function') {
  (Object as any).fromEntries = function (entries: any) {
    if (!entries || !entries[Symbol.iterator]) {
      throw new Error('Object.fromEntries requires an iterable object');
    }
    const obj: any = {};
    for (const [key, value] of entries) {
      obj[key] = value;
    }
    return obj;
  };
}

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
