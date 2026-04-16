// src/views/Settings/FirmwareSettings.tsx
import { useState, useEffect } from 'react';
import type { SystemInfo } from '../../interfaces/firmware';
import { toast } from 'react-hot-toast';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';


const FirmwareSettings = () => {
  const [sysInfo, setSysInfo] = useState<SystemInfo>({
    chip_model: 'Cargando...',
    cores: 2,
    sdk_version: '...',
    fw_version: '...',
    build_date: '...',
    ml_status: '...',
  });

  const [otaUrl, setOtaUrl] = useState('');
  const [, setWsStatus] = useState<string>('Desconectado');
  const { token: authToken, logout } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/system/info');
        const data = await res.json();
        setSysInfo(data);
      } catch (error) {
        console.error('Error fetching firmware info:', error);
      }
    };
    fetchData();
  }, []);

  const handleOtaUpload = async () => {
    if (!otaUrl || !authToken) return toast.error('Ingrese una URL válida.');
    if (!otaUrl.startsWith('https://'))
      return toast.error('La URL debe ser HTTPS segura.');

    try {
      setWsStatus('Descargando y Flasheando Firmware...');
      await apiFetch('/api/system/ota', {
        method: 'POST',
        body: JSON.stringify({ url: otaUrl }),
      });

      toast.success(
        'Actualización iniciada. El dispositivo se reiniciará automáticamente al terminar.',
      );
      setOtaUrl('');
    } catch (error: any) {
      setWsStatus('Conectado');
    }
  };

  const handleSystemReboot = async () => {
    if (!window.confirm('¿Forzar reinicio del hardware?')) return;
    await apiFetch('/api/system/reboot', { method: 'POST' });
    toast('Reinicio iniciado...');
    handleLogout();
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-text-primary">
          Gestor de Firmware y Ciclo de Vida
        </h3>
        <span className="badge badge-neutral flex items-center gap-1">
          <svg className="w-3 h-3" fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z'
              clipRule='evenodd'
            ></path>
          </svg>
          Sistema Estable ({sysInfo.fw_version})
        </span>
      </div>

      <div className="space-y-8">
        {/* 1. INFORMACIÓN DEL SISTEMA */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 shadow-sm flex items-start gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded">
              <svg
                className="w-6 h-6"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z'
                ></path>
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                Core Hardware
              </p>
              <p className="font-bold text-text-primary">
                {sysInfo.chip_model} ({sysInfo.cores} Cores)
              </p>
              <p className="text-xs text-text-primary font-mono mt-1">
                ESP-IDF: {sysInfo.sdk_version}
              </p>
            </div>
          </div>

          <div className="card p-4 shadow-sm flex items-start gap-3">
            <div className="p-2 bg-orange-50 text-orange-600 rounded">
              <svg
                className="w-6 h-6"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
                ></path>
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                C++ Firmware
              </p>
              <p className="font-bold text-text-primary">{sysInfo.fw_version}</p>
              <p className="text-xs text-text-primary font-mono mt-1">
                Build: {sysInfo.build_date}
              </p>
            </div>
          </div>

          <div className="card p-4 shadow-sm flex items-start gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded">
              <svg
                className="w-6 h-6"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z'
                ></path>
              </svg>
            </div>
            <div>
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                TinyML Model
              </p>
              <p className="font-bold text-text-primary text-sm">
                anomaly_net.tflite
              </p>
              <p
                className={`text-xs font-mono mt-1 font-bold ${sysInfo.ml_status.includes('Activo') ? 'text-green-600' : 'text-red-500'}`}
              >
                Estado: {sysInfo.ml_status}
              </p>
            </div>
          </div>
        </section>

        {/* 2. MOTOR DE ACTUALIZACIÓN OTA */}
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
                d='M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Actualización Inalámbrica (OTA Update)
            </h4>
          </div>

          <div className="border-2 border-dashed border-border-color rounded-lg p-8 text-center bg-panel hover:bg-indigo-50/50 transition-colors cursor-pointer">
            <svg
              className="mx-auto h-12 w-12 text-text-primary mb-3"
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
              ></path>
            </svg>
            <p className="text-sm font-semibold text-secondary">
              Arrastre aquí el archivo .bin del Firmware, LittleFS o .tflite
            </p>
            <p className="text-xs text-text-primary mt-1">
              Soporta binarios de PlatformIO (firmware.bin, littlefs.bin)
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type='url'
                placeholder='https://...'
                value={otaUrl}
                onChange={(e) => setOtaUrl(e.target.value)}
                className="input-field flex-1 p-2 border border-border-color rounded font-mono text-sm outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                onClick={handleOtaUpload}
                className="btn btn-primary whitespace-nowrap"
              >
                Flashear
              </button>
            </div>
          </div>
        </section>

        {/* 3. CONTROL DE ENERGÍA */}
        <section className="bg-panel p-6 rounded-lg border border-border-color">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-bold text-text-primary">
                Reinicio del Sistema
              </h4>
              <p className="text-sm text-text-secondary mt-1">
                Fuerza un reinicio seguro. Se desconectarán todos
                los clientes de WebSocket temporalmente.
              </p>
            </div>
            <button
              onClick={handleSystemReboot}
              className="btn btn-secondary flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15'
                ></path>
              </svg>
              Reiniciar
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default FirmwareSettings;
