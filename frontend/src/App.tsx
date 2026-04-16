// src/App.tsx
import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import SetupWizard from './views/SetupWizard';
import Login from './views/Login';
import Dashboard from './views/Dashboard';
import Logs from './views/Logs';
import Settings from './views/Settings';
import Layout from './components/Layout';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { isAuthenticated } = useAuth();
  const [isProvisioned, setIsProvisioned] = useState<boolean | null>(null);
  const [activeMenu, setActiveMenu] = useState<'dashboard' | 'settings' | 'logs'>('dashboard');

  useEffect(() => {
    const checkProvisioning = async () => {
      try {
        const hostname = window.location.hostname;
        if (hostname === '192.168.4.1' || hostname === '192.168.4.2') {
          setIsProvisioned(false);
          return;
        }
        const res = await fetch('/api/oobe/status');
        if (res.ok) {
          const data = await res.json();
          setIsProvisioned(data.is_provisioned !== false);
        } else {
          setIsProvisioned(true);
        }
      } catch (e) {
        setIsProvisioned(true);
      }
    };
    checkProvisioning();
  }, []);

  if (isProvisioned === null) {
    return (
      <div className='min-h-screen bg-gray-900 flex flex-col items-center justify-center font-mono text-gray-500'>
        <div className='w-8 h-8 border-4 border-gray-800 border-t-blue-500 rounded-full animate-spin mb-4'></div>
        <p className='animate-pulse'>Sondeando hardware...</p>
      </div>
    );
  }

  if (!isProvisioned) {
    return <SetupWizard onComplete={() => setIsProvisioned(true)} />;
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <>
      <Toaster position='top-right' toastOptions={{ style: { background: '#374151', color: '#fff' } }} />
      <Layout activeMenu={activeMenu} setActiveMenu={setActiveMenu}>
        {activeMenu === 'dashboard' && <Dashboard />}
        {activeMenu === 'settings' && <Settings />}
        {activeMenu === 'logs' && <Logs />}
      </Layout>
    </>
  );
}
