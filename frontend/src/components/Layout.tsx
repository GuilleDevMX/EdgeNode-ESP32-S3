// src/components/Layout.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTelemetryContext } from '../context/TelemetryContext';

interface LayoutProps {
  children: React.ReactNode;
  activeMenu: 'dashboard' | 'settings' | 'logs';
  setActiveMenu: (menu: 'dashboard' | 'settings' | 'logs') => void;
}

const Layout = ({ children, activeMenu, setActiveMenu }: LayoutProps) => {
  const { logout, role } = useAuth();
  const { data: telemetry, status, wsStatusStr } = useTelemetryContext();
  const { theme, toggleTheme } = useTheme();
  const [sysTime, setSysTime] = useState(new Date());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setSysTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z',
    },
    {
      id: 'logs',
      label: 'Auditoría',
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01',
    },
    {
      id: 'settings',
      label: 'Ajustes',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
    },
  ];

  return (
    <div className='flex h-screen bg-app font-sans text-text-primary overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'>
      {/* ========== SIDEBAR ESCRITORIO ========== */}
      <aside className='hidden md:flex w-64 bg-primary text-white dark:text-slate-900 flex-col shadow-2xl z-20 shrink-0'>
        <div className='h-16 flex items-center justify-start px-6 border-b border-white/10 shrink-0'>
          <h2 className='text-lg font-black tracking-widest text-white dark:text-slate-900'>
            <span className='text-accent'>Edge</span>SecOps
          </h2>
        </div>
        <nav className='flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto'>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveMenu(item.id as any)}
              className={`flex items-center gap-3 px-3 py-3 rounded-lg font-bold transition-all text-left ${
                activeMenu === item.id
                  ? 'bg-accent text-white'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d={item.icon}></path></svg>
              <span className='truncate'>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className='p-4 border-t border-white/10 shrink-0'>
          <button
            onClick={logout}
            className='w-full flex justify-start items-center gap-3 px-3 py-2 text-white/60 hover:text-danger font-bold transition-colors'
          >
            <svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'></path></svg>
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* ========== DRAWER MÓVIL ========== */}
      {mobileMenuOpen && (
        <>
          <div className='fixed inset-0 bg-black/50 z-30 md:hidden animate-fade-in' onClick={() => setMobileMenuOpen(false)} />
          <div className='fixed inset-y-0 left-0 w-64 bg-primary text-white dark:text-slate-900 z-40 md:hidden transform transition-transform duration-300 flex flex-col shadow-2xl'>
            <div className='h-16 flex items-center justify-between px-6 border-b border-white/10 shrink-0'>
              <h2 className='text-lg font-black text-white dark:text-slate-900'><span className='text-accent'>Edge</span>SecOps</h2>
              <button onClick={() => setMobileMenuOpen(false)} className='p-2 hover:bg-white/10 rounded-lg transition-colors'>
                <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M6 18L18 6M6 6l12 12'></path></svg>
              </button>
            </div>
            <nav className='flex-1 py-6 flex flex-col gap-2 px-3 overflow-y-auto'>
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveMenu(item.id as any); setMobileMenuOpen(false); }}
                  className={`flex items-center gap-3 px-4 py-4 rounded-lg font-bold transition-all text-left ${
                    activeMenu === item.id ? 'bg-accent text-white' : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d={item.icon}></path></svg>
                  <span className='truncate'>{item.label}</span>
                </button>
              ))}
            </nav>
            <div className='p-4 border-t border-white/10 shrink-0'>
              <button onClick={() => { logout(); setMobileMenuOpen(false); }} className='w-full flex items-center gap-3 px-4 py-3 text-white/60 hover:text-danger font-bold transition-colors rounded-lg'>
                <svg className='w-6 h-6 shrink-0' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'></path></svg>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* ========== CONTENIDO PRINCIPAL ========== */}
      <main className='flex-1 flex flex-col min-w-0 bg-app'>
        {/* HEADER SUPERIOR */}
        <header className='h-16 bg-panel border-b border-border-color flex items-center justify-between px-4 md:px-6 shrink-0 z-10 shadow-sm'>
          <div className='flex items-center gap-3'>
            <button onClick={() => setMobileMenuOpen(true)} className='md:hidden p-2 text-text-primary hover:bg-border-color rounded-lg transition-colors -ml-2'>
              <svg className='w-6 h-6' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M4 6h16M4 12h16M4 18h16'></path></svg>
            </button>
            <h1 className='text-lg md:text-xl font-bold text-text-primary truncate'>
              {activeMenu === 'dashboard' ? 'Monitor Operacional' : activeMenu === 'logs' ? 'Auditoría' : 'Configuración del Sistema'}
            </h1>
          </div>

          <div className='flex items-center gap-4 shrink-0'>
            {/* Theme Toggle Button */}
            <button onClick={toggleTheme} className='hidden sm:flex items-center justify-center p-2 rounded-full hover:bg-app text-text-secondary transition-colors' title={`Cambiar a modo ${theme === 'light' ? 'oscuro' : 'claro'}`}>
              {theme === 'light' ? (
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z'></path></svg>
              ) : (
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'></path></svg>
              )}
            </button>

            {/* Estado de conexión WebSocket */}
            <div className='hidden lg:flex items-center gap-2 px-3 py-1.5 bg-app rounded-lg border border-border-color shadow-inner text-xs font-mono' title={wsStatusStr}>
              <span className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className='text-text-secondary truncate max-w-[150px]'>{wsStatusStr}</span>
            </div>

            <div className='hidden sm:flex flex-col items-end border-r border-border-color pr-4'>
              <span className='text-text-primary font-mono font-bold text-sm'>
                {sysTime?.toLocaleTimeString('es-MX', { hour12: false }) || '--:--:--'}
              </span>
              <span className='text-xs text-text-muted font-semibold'>
                Up: {telemetry ? Math.floor(telemetry.uptime / 60) : 0}m
              </span>
            </div>

            <div className='px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs md:text-sm font-mono rounded border border-blue-500/20 shadow-inner shrink-0'>
              {role?.toUpperCase() || 'GUEST'}
            </div>

            <button onClick={logout} className='hidden md:flex items-center gap-2 px-3 py-1.5 text-text-secondary hover:text-danger hover:bg-red-500/10 rounded-lg transition-colors font-medium text-sm border border-transparent hover:border-red-500/20'>
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'></path></svg>
              <span>Salir</span>
            </button>
          </div>
        </header>

        {/* BODY SCROLLABLE CON CONTENIDO */}
        <div className='flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 custom-scrollbar'>
          <div className='max-w-7xl mx-auto w-full'>{children}</div>
        </div>
      </main>
    </div>
  );
};

export default Layout;
