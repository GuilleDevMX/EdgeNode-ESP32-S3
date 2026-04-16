// src/views/Settings/WhatsAppSettings.tsx
import type { WAConfig } from '../../interfaces/whatsapp';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '../../api/client';

const WhatsAppSettings = () => {
  const [waConfig, setWaConfig] = useState<WAConfig>({
    enabled: false,
    phone: '',
    api_key: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/config/whatsapp');
        const data = await res.json();
        setWaConfig(data);
      } catch (error) {
        console.error('Error fetching whatsapp config:', error);
      }
    };
    fetchData();
  }, []);

  const handleSaveWA = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/config/whatsapp', {
      method: 'POST',
      body: JSON.stringify(waConfig),
    });
    toast.success('Configuración de WhatsApp guardada.');
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      {/* HEADER CON STATUS BADGE - Igual que SMTP */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-text-primary">
          Notificaciones de WhatsApp
        </h3>
        <span
          className={`border text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 ${waConfig.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-text-secondary border-gray-200'}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${waConfig.enabled ? 'bg-green-500' : 'bg-gray-400'}`}
          ></div>
          {waConfig.enabled ? 'Servicio Activo' : 'Servicio Apagado'}
        </span>
      </div>

      <form className="space-y-8" onSubmit={handleSaveWA}>
        {/* SECCIÓN PRINCIPAL - Mismo estilo que SMTP */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4 border-b border-border-color pb-2">
            <div className="flex items-center gap-2">
              {/* Ícono de WhatsApp */}
              <svg
                className="w-5 h-5 text-teal-600"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z'
                ></path>
              </svg>
              <h4 className="text-lg font-bold text-text-primary">
                Configuración de WhatsApp
              </h4>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type='checkbox'
                checked={waConfig.enabled}
                onChange={(e) =>
                  setWaConfig({ ...waConfig, enabled: e.target.checked })
                }
                className="checkbox-field"
              />
              <span className="label-field">
                Habilitar Alertas por WhatsApp
              </span>
            </label>
          </div>

          {/* CAMPOS CON DISABLED STATE - Igual patrón que SMTP */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity"
            style={{
              opacity: waConfig.enabled ? 1 : 0.5,
              pointerEvents: waConfig.enabled ? 'auto' : 'none',
            }}
          >
            <div>
              <label className="label-field">
                Número de Teléfono (con código de país)
              </label>
              <input
                type='text'
                placeholder='+521234567890'
                value={waConfig.phone}
                onChange={(e) =>
                  setWaConfig({ ...waConfig, phone: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">
                CallMeBot API Key
              </label>
              <input
                type='password'
                placeholder='Ej. 123456'
                value={waConfig.api_key}
                onChange={(e) =>
                  setWaConfig({ ...waConfig, api_key: e.target.value })
                }
                className="input-field"
              />
              <p className="text-[10px] text-muted mt-1">
                <a
                  href='https://www.callmebot.com/blog/free-api-whatsapp-messages/'
                  target='_blank'
                  rel='noreferrer'
                  className="text-teal-600 underline"
                >
                  Obtener API Key aquí
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* BOTONES DE ACCIÓN - Mismo estilo que SMTP */}
        <div className="flex justify-end items-center pt-2">
          <button
            type='submit'
            disabled={!waConfig.enabled}
            className="btn btn-primary disabled:opacity-50"
          >
            Guardar Configuración WhatsApp
          </button>
        </div>
      </form>
    </div>
  );
};

export default WhatsAppSettings;
