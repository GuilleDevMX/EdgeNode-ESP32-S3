// src/views/Settings/SecuritySettings.tsx
import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { SecurityConfig } from '../../interfaces/security';

const SecuritySettings = () => {
  const { logout } = useAuth();
  const [secConfig, setSecConfig] = useState<SecurityConfig>({
    current_pass: '',
    new_pass: '',
    confirm_pass: '',
    jwt_exp: '15',
    allowlist_enabled: false,
    allowlist: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch('/api/config/security');
        const data = await res.json();
        setSecConfig(prev => ({
          ...prev,
          allowlist: data.allowlist || '',
          allowlist_enabled: data.allowlist_enabled || false,
        }));
      } catch (error) {
        console.error('Error fetching security config:', error);
      }
    };
    fetchData();
  }, []);

  const handleLogout = () => {
    logout();
  };

  const handleRotateKey = async () => {
    if (
      !window.confirm('⚠️ ADVERTENCIA: Invalidará tokens activos. ¿Continuar?')
    )
      return;
    await apiFetch('/api/system/rotate_key', { method: 'POST' });
    toast.success('Llave rotada. Sesión terminada.');
    handleLogout();
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (secConfig.new_pass !== secConfig.confirm_pass)
      return toast.error('Las contraseñas nuevas no coinciden.');
    await apiFetch('/api/config/security', {
      method: 'POST',
      body: JSON.stringify({
        current_pass: secConfig.current_pass,
        new_pass: secConfig.new_pass,
        jwt_exp: secConfig.jwt_exp,
        allowlist_enabled: secConfig.allowlist_enabled,
        allowlist: secConfig.allowlist,
      }),
    });
    toast.success('Políticas de seguridad actualizadas.');
    setSecConfig((prev) => ({
      ...prev,
      current_pass: '',
      new_pass: '',
      confirm_pass: '',
    }));
  };

  return (
    <div className="max-w-4xl animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-text-primary">
          Gestión de Accesos y Criptografía
        </h3>
        <span className="badge badge-info flex items-center gap-1">
          <svg className="w-3 h-3" fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
              clipRule='evenodd'
            ></path>
          </svg>
          Postura de Seguridad: Alta
        </span>
      </div>

      <form className="space-y-8" onSubmit={handleSaveSecurity}>
        {/* 1. CONTROL DE ACCESO (IAM) */}
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
                d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Credenciales de Administrador Root
            </h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label-field">
                Contraseña Actual (Requerida)
              </label>
              <input
                type='password'
                value={secConfig.current_pass}
                onChange={(e) =>
                  setSecConfig({
                    ...secConfig,
                    current_pass: e.target.value,
                  })
                }
                placeholder='Ingrese su contraseña actual para validar cambios'
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">
                Nueva Contraseña
              </label>
              <input
                type='password'
                value={secConfig.new_pass}
                onChange={(e) =>
                  setSecConfig({ ...secConfig, new_pass: e.target.value })
                }
                placeholder='Mínimo 8 caracteres'
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">
                Confirmar Nueva Contraseña
              </label>
              <input
                type='password'
                value={secConfig.confirm_pass}
                onChange={(e) =>
                  setSecConfig({
                    ...secConfig,
                    confirm_pass: e.target.value,
                  })
                }
                placeholder='Repita la nueva contraseña'
                className="input-field"
              />
            </div>
          </div>
        </section>

        {/* 2. MOTOR CRIPTOGRÁFICO Y SESIONES */}
        <section className="card p-6 border-l-4 border-l-yellow-support">
          <div className="flex items-center justify-between mb-4 border-b border-border-color pb-2">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-yellow-support"
                fill='none'
                stroke='currentColor'
                viewBox='0 0 24 24'
              >
                <path
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  d='M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'
                ></path>
              </svg>
              <h4 className="text-lg font-bold text-text-primary">
                Gestión de Sesiones (JWT)
              </h4>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="label-field">
                Tiempo de Expiración de Sesión
              </label>
              <select
                value={secConfig.jwt_exp}
                onChange={(e) =>
                  setSecConfig({ ...secConfig, jwt_exp: e.target.value })
                }
                className="input-field"
              >
                <option value='15'>15 Minutos (Recomendado)</option>
                <option value='60'>1 Hora</option>
                <option value='1440'>24 Horas</option>
              </select>
            </div>
            <div>
              <button
                type='button'
                onClick={handleRotateKey}
                className="w-full py-2 bg-red-50 text-red-600 border border-red-200 rounded font-bold hover:bg-red-100 transition-colors flex justify-center items-center gap-2"
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
                Rotar Llave Secreta
              </button>
            </div>
            <p className="md:col-span-2 text-xs text-muted mt-1">
              Rotar la llave invalida inmediatamente todos los tokens emitidos.
              Todos los usuarios activos (incluyéndote) serán desconectados.
            </p>
          </div>
        </section>

        {/* 3. FIREWALL PERIMETRAL */}
        <section className="card p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
            <svg
              className="w-5 h-5 text-text-primary"
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Firewall y Filtrado de APIs
            </h4>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type='checkbox'
                checked={secConfig.allowlist_enabled}
                onChange={(e) =>
                  setSecConfig({
                    ...secConfig,
                    allowlist_enabled: e.target.checked,
                  })
                }
                className="checkbox-field"
              />
              <span className="text-sm font-semibold text-gray-700">
                Habilitar Lista Blanca de IPs (Allowlist)
              </span>
            </label>

            <div>
              <label className="label-field">
                Direcciones IP Permitidas (Separadas por salto de línea)
              </label>
              <textarea
                rows={3}
                value={secConfig.allowlist}
                onChange={(e) =>
                  setSecConfig({
                    ...secConfig,
                    allowlist: e.target.value,
                  })
                }
                placeholder='Ejemplo:&#10;192.168.1.50&#10;192.168.1.105'
                className="w-full p-3 border border-border-color rounded focus:ring-2 focus:ring-navy-dark focus:outline-none font-mono text-sm bg-panel"
              ></textarea>
              <p className="text-xs text-red-500 mt-1 font-semibold">
                ⚠️ ¡Precaución! Asegúrese de incluir su IP actual o perderá
                acceso al nodo instantáneamente al guardar.
              </p>
            </div>
          </div>
        </section>

        {/* CONTROLES DE ACCIÓN */}
        <div className="flex justify-end gap-4 pt-2">
          <button
            type='button'
            className="px-6 py-2 border border-border-color text-text-secondary rounded font-semibold hover:bg-gray-100 transition-colors"
          >
            Descartar Cambios
          </button>
          <button
            type='submit'
            className="btn btn-primary"
          >
            Guardar Políticas de Seguridad
          </button>
        </div>
      </form>
    </div>
  );
};

export default SecuritySettings;
