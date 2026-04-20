// src/views/Settings/CloudSettings.tsx
import type { CloudConfig } from '../../interfaces/cloud';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { apiFetch } from '../../api/client';

const CloudSettings = () => {
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({
    enabled: false,
    url: '',
    token: '',
    mtls_cert: '',
    mtls_key: '',
    mtls_ca: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/config/cloud');
        const data = await res.json();
        setCloudConfig(data);
      } catch (error) {
        console.error('Error fetching cloud config:', error);
      }
    };
    fetchData();
  }, []);

  const handleSaveCloud = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/config/cloud', {
        method: 'POST',
        body: JSON.stringify(cloudConfig),
      });
      toast.success('Webhook Cloud guardado.');
    } catch (err) {
      // apiFetch handles generic errors
    }
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      {/* HEADER CON STATUS BADGE - Igual que SMTP */}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-text-primary">
          Sincronización a Base de Datos
        </h3>
        <span
          className={`border text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 ${cloudConfig.enabled ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800/50 text-text-secondary border-gray-200 dark:border-gray-700'}`}
        >
          <div
            className={`w-2 h-2 rounded-full ${cloudConfig.enabled ? 'bg-green-500 dark:bg-green-600' : 'bg-gray-400 dark:bg-gray-500'}`}
          ></div>
          {cloudConfig.enabled ? 'Servicio Activo' : 'Servicio Apagado'}
        </span>
      </div>

      <form className="space-y-8" onSubmit={handleSaveCloud}>
        {/* SECCIÓN PRINCIPAL - Mismo estilo que SMTP */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-4 border-b border-border-color pb-2">
            <div className="flex items-center gap-2">
              {/* Ícono de Cloud */}
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
                  d='M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z'
                ></path>
              </svg>
              <h4 className="text-lg font-bold text-text-primary">
                Configuración de Webhook
              </h4>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type='checkbox'
                checked={cloudConfig.enabled}
                onChange={(e) =>
                  setCloudConfig({
                    ...cloudConfig,
                    enabled: e.target.checked,
                  })
                }
                className="checkbox-field"
              />
              <span className="text-sm font-bold text-text-secondary">
                Habilitar Webhook a la Nube
              </span>
            </label>
          </div>

          {/* CAMPOS CON DISABLED STATE - Igual patrón que SMTP */}
          <div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity"
            style={{
              opacity: cloudConfig.enabled ? 1 : 0.5,
              pointerEvents: cloudConfig.enabled ? 'auto' : 'none',
            }}
          >
            <div>
              <label className="label-field">
                Endpoint URL (HTTPS recomendado)
              </label>
              <input
                type='url'
                placeholder='https://mi-servidor.com/api/telemetry'
                value={cloudConfig.url}
                onChange={(e) =>
                  setCloudConfig({ ...cloudConfig, url: e.target.value })
                }
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">
                Token de Autorización (Bearer)
              </label>
              <input
                type='password'
                placeholder='Tu API Key o Token JWT'
                value={cloudConfig.token}
                onChange={(e) =>
                  setCloudConfig({
                    ...cloudConfig,
                    token: e.target.value,
                  })
                }
                className="input-field"
              />
              <p className="text-[10px] text-muted mt-1">
                Se enviará como header:{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">
                  Authorization: Bearer &lt;token&gt;
                </code>
              </p>
            </div>
          </div>
        </section>

        {/* SECCIÓN mTLS */}
        <section className="card p-6" style={{
              opacity: cloudConfig.enabled ? 1 : 0.5,
              pointerEvents: cloudConfig.enabled ? 'auto' : 'none',
            }}>
          <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
            <svg
              className="w-5 h-5 text-indigo-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Seguridad mTLS (Mutual TLS) - Opcional
            </h4>
          </div>
          <p className="text-xs text-text-secondary mb-4">
            Proporciona certificados X.509 (.pem) para autenticación de dispositivo a nivel industrial. Si dejas esto vacío, se usarán conexiones estándar (Insecure/Trust-All).
          </p>

          <div className="space-y-4">
            <div>
              <label className="label-field">Certificado de Cliente (Client Certificate)</label>
              <textarea
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={cloudConfig.mtls_cert || ''}
                onChange={(e) =>
                  setCloudConfig({ ...cloudConfig, mtls_cert: e.target.value })
                }
                className="input-field font-mono text-[10px] h-32 whitespace-pre"
              ></textarea>
            </div>
            
            <div>
              <label className="label-field">Llave Privada (Private Key)</label>
              <textarea
                placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                value={cloudConfig.mtls_key || ''}
                onChange={(e) =>
                  setCloudConfig({ ...cloudConfig, mtls_key: e.target.value })
                }
                className="input-field font-mono text-[10px] h-32 whitespace-pre"
              ></textarea>
              <p className="text-[10px] text-red-500 font-bold mt-1">Esta llave se guardará de forma encriptada en el dispositivo mediante AES-GCM.</p>
            </div>

            <div>
              <label className="label-field">Certificado de Autoridad (CA Root) - Opcional</label>
              <textarea
                placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                value={cloudConfig.mtls_ca || ''}
                onChange={(e) =>
                  setCloudConfig({ ...cloudConfig, mtls_ca: e.target.value })
                }
                className="input-field font-mono text-[10px] h-24 whitespace-pre"
              ></textarea>
            </div>
          </div>
        </section>

        {/* BOTONES DE ACCIÓN - Mismo estilo que SMTP */}
        <div className="flex justify-end items-center pt-2">
          <button
            type='submit'
            disabled={!cloudConfig.enabled}
            className="btn btn-primary disabled:opacity-50"
          >
            Guardar Configuración Cloud
          </button>
        </div>
      </form>
    </div>
  );
};

export default CloudSettings;
