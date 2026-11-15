import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MiniPlayer from './components/MiniPlayer';
import './index.css';

const isMini = new URLSearchParams(window.location.search).has('mini');
ReactDOM.createRoot(document.getElementById('root')).render(isMini ? <MiniPlayer /> : <App />);
