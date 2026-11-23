import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary';
import {FirebaseProvider} from './contexts/FirebaseContext';
import './index.css';
import {initAutoUpdater} from './utils/autoUpdater';

initAutoUpdater();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  </ErrorBoundary>
);
