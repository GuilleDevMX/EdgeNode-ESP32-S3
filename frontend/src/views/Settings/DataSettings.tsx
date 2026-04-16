// src/views/Settings/DataSettings.tsx
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { StorageMetrics } from '../../interfaces/data';

const DataSettings = () => {
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics>({
    fs_total: 0,
    fs_used: 0,
    nvs_total: 0,
    nvs_used: 0,
  });
  
  const { token: authToken, logout } = useAuth();

  const downloadDataset = async () => {
    if (!authToken) return;
    const response = await apiFetch('/api/dataset');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `edgenode_telemetry_${new Date().getTime()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleFormatLogs = async () => {
    if (!window.confirm('⚠️ ADVERTENCIA: Se eliminará dataset.csv. ¿Proceder?'))
      return;
    await apiFetch('/api/system/format_logs', { method: 'POST' });
    toast.success('Historial purgado.');
    await refreshStorageMetrics();
  };

  const refreshStorageMetrics = async () => {
    if (!authToken) return;
    try {
      const res = await apiFetch('/api/system/storage');
      setStorageMetrics(await res.json());
    } catch (error) {
      console.error('[SecOps] Error actualizando métricas', error);
    }
  };

  const handleFactoryReset = async () => {
    if (
      !window.confirm(
        '⚠️ ADVERTENCIA: Borrado total a estado de fábrica. ¿Proceder?',
      )
    )
      return;
    await apiFetch('/api/system/factory_reset', { method: 'POST' });
    toast('Borrado Criptográfico iniciado...');
    handleLogout();
  };

  const handleLogout = () => {
    logout();
  };

  useEffect(() => {
    refreshStorageMetrics();
  }, []);

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-text-primary">
          Gestión de Almacenamiento No Volátil
        </h3>
        <span className="badge badge-success flex items-center gap-1">
          <svg className="w-3 h-3" fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z'
              clipRule='evenodd'
            ></path>
          </svg>
          LittleFS Montado
        </span>
      </div>

      <div className="space-y-8">
        {/* 1. MONITOR DE ALMACENAMIENTO (Particiones) */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
            <svg
              className="w-5 h-5 text-teal-support"
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Estado de la Memoria Flash (ESP32-S3)
            </h4>
          </div>

          {storageMetrics.flash_total && (
            <div className="mb-6 p-4 bg-panel border border-border-color rounded-lg flex items-center justify-between shadow-sm">
              <span className="text-text-secondary font-bold text-sm uppercase tracking-wider">Capacidad Física Total del Chip</span>
              <span className="text-teal-support font-black text-xl">{(storageMetrics.flash_total / (1024 * 1024)).toFixed(0)} MB <span className="text-gray-400 text-sm font-normal">(N16R8)</span></span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* LittleFS Bar */}
            <div>
              <div className="flex justify-between text-sm font-semibold text-text-secondary mb-2">
                <span>Partición: spiffs / LittleFS</span>
                <span>
                  {(storageMetrics.fs_used / (1024 * 1024)).toFixed(2)} MB /{' '}
                  {(storageMetrics.fs_total / (1024 * 1024)).toFixed(2)} MB (
                  {storageMetrics.fs_total > 0
                    ? Math.round(
                        (storageMetrics.fs_used / storageMetrics.fs_total) *
                          100,
                      )
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-teal-support h-3 rounded-full transition-all duration-1000"
                  style={{
                    width: `${storageMetrics.fs_total > 0 ? (storageMetrics.fs_used / storageMetrics.fs_total) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted mt-2">
                Aloja el binario de esta SPA React, assets y los logs de
                telemetría (CSV).
              </p>
            </div>

            {/* NVS Bar */}
            <div>
              <div className="flex justify-between text-sm font-semibold text-text-secondary mb-2">
                <span>Partición: nvs (Key-Value)</span>
                <span>
                  {storageMetrics.nvs_used} / {storageMetrics.nvs_total}{' '}
                  Entradas (
                  {storageMetrics.nvs_total > 0
                    ? Math.round(
                        (storageMetrics.nvs_used / storageMetrics.nvs_total) *
                          100,
                      )
                    : 0}
                  %)
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-support h-3 rounded-full transition-all duration-1000"
                  style={{
                    width: `${storageMetrics.nvs_total > 0 ? (storageMetrics.nvs_used / storageMetrics.nvs_total) * 100 : 0}%`,
                  }}
                ></div>
              </div>
              <p className="text-xs text-muted mt-2">
                Aloja configuración WiFi, políticas IAM y secretos
                criptográficos JWT.
              </p>
            </div>
          </div>
        </section>

        {/* 2. EXTRACCIÓN DE DATOS (TinyML Tubería) */}
        <section className="bg-panel p-6 rounded-lg border-2 border-dashed border-border-color">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold text-text-primary flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-orange-accent"
                  fill='none'
                  stroke='currentColor'
                  viewBox='0 0 24 24'
                >
                  <path
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    strokeWidth='2'
                    d='M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
                  ></path>
                </svg>
                Dataset de Entrenamiento (TinyML)
              </h4>
              <p className="text-sm text-text-secondary mt-1">
                Archivo:{' '}
                <span className="font-mono text-text-primary font-bold">
                  dataset.csv
                </span>{' '}
                • Tamaño: {(storageMetrics.fs_used / 1024).toFixed(1)} KB
              </p>
            </div>

            <button
              onClick={downloadDataset}
              className="flex items-center gap-2 btn btn-primary whitespace-nowrap"
            >
              <svg
                className="w-5 h-5"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4'
                ></path>
              </svg>
              Extraer Dataset
            </button>
          </div>
        </section>

        {/* 3. ZONA DE PELIGRO (Acciones Destructivas) */}
        <section className="bg-red-50 p-6 rounded-lg border border-red-200">
          <div className="flex items-center gap-2 mb-4 border-b border-red-200 pb-2">
            <svg
              className="w-5 h-5 text-red-600"
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-red-800">
              Zona de Peligro (Acciones Destructivas)
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-panel p-4 rounded border border-red-100 flex flex-col justify-between">
              <div>
                <h5 className="font-bold text-text-primary">
                  Purgar Historial de Telemetría
                </h5>
                <p className="text-xs text-text-secondary mt-1 mb-4">
                  Elimina permanentemente `dataset.csv` de LittleFS. Útil para
                  iniciar una nueva recolección de datos limpia.
                </p>
              </div>
              <button
                type='button'
                onClick={handleFormatLogs}
                className="btn btn-danger-outline w-full"
              >
                Formatear Logs
              </button>
            </div>

            <div className="bg-panel p-4 rounded border border-red-100 flex flex-col justify-between">
              <div>
                <h5 className="font-bold text-text-primary">
                  Factory Reset (Zero-Trust)
                </h5>
                <p className="text-xs text-text-secondary mt-1 mb-4">
                  Borra la partición NVS. Destruye credenciales WiFi,
                  administrador y llaves JWT. El nodo entrará en modo OOBE tras
                  reiniciar.
                </p>
              </div>
              <button
                type='button'
                onClick={handleFactoryReset}
                className="btn btn-danger w-full"
              >
                Borrado Criptográfico
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default DataSettings;
