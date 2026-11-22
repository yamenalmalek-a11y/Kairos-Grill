import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {ErrorBoundary} from './components/ErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  const params = new URLSearchParams(window.location.search);
  if (
    params.get('admin') === '1' ||
    window.location.hash === '#admin' ||
    window.location.pathname === '/admin'
  ) {
    window.location.replace('/admin.html');
  }
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
