import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MiniPlayer from './components/MiniPlayer';
import SetupWizard from './components/SetupWizard';
import './index.css';

const params = new URLSearchParams(window.location.search);
const root = params.has('mini') ? <MiniPlayer /> : params.has('setup') ? <SetupWizard /> : <App />;
ReactDOM.createRoot(document.getElementById('root')).render(root);
