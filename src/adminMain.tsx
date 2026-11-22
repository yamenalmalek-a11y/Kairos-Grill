import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import './hooks/usePWAInstall';
import './index.css';

registerSW({ immediate: true });

function AdminApp() {
  const [lang, setLang] = useState<'ar' | 'de'>('de');

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const handleExitAdmin = () => {
    window.location.href = '/';
  };

  return (
    <>
      <AdminDashboard
        lang={lang}
        onChangeLang={setLang}
        onExitAdmin={handleExitAdmin}
      />
      <OfflineIndicator lang={lang} />
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <AdminApp />
  </ErrorBoundary>
);
