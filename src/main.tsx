import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initAutoUpdater} from './utils/autoUpdater';

initAutoUpdater();

createRoot(document.getElementById('root')!).render(<App />);
