// src/views/Settings/RedSettings.tsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { toast } from 'react-hot-toast';
import type { NetworkConfig } from '../../interfaces/network';
import { useAuth } from '../../context/AuthContext';

const RedSettings = () => {
    const [netConfig, setNetConfig] = useState<NetworkConfig>({ 
      ssid: "", 
      pass: "", 
      dhcp: true, 
      ip: "", 
      subnet: "", 
      gateway: "", 
      dns: "", 
      ap_ssid: "", 
      ap_pass: "", 
      ap_hide: false, 
      mdns: "edgenode", 
      ntp: "time.google.com", 
      tz: "CST6CDT,M4.1.0,M10.5.0" 
    });

    const { logout } = useAuth();

    useEffect(() => {
      const fetchData = async () => {
        try {
          const res = await apiFetch('/api/config/network');
          const data = await res.json();
          setNetConfig(data);
        } catch (error) {
          console.error('Error fetching network config:', error);
        }
      };
      fetchData();
    }, []);

    const handleLogout = () => {
        logout();
    };

    const handleSaveNetwork = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await apiFetch('/api/config/network', { method: "POST", body: JSON.stringify(netConfig) });
        const data = await res.json();
        toast.success(data.message); 
        handleLogout();
    };
    
    return (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-text-primary">
                Configuración de Red y Conectividad
              </h3>
              <span className="badge badge-success">
                Estado Actual: Conectado (STA)
              </span>
            </div>

            <form className="space-y-8" onSubmit={handleSaveNetwork}>
              {/* 1. RED OPERATIVA (STA) */}
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
                  <svg
                    className="w-5 h-5 text-blue-support"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-text-primary">
                    Red Operativa (Cliente WiFi)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">
                      SSID Corporativo
                    </label>
                    <input
                      type="text"
                      value={netConfig.ssid}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ssid: e.target.value })
                      }
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      Contraseña WPA2/WPA3
                    </label>
                    <input
                      type="password"
                      placeholder="•••••••• (Dejar en blanco para mantener actual)"
                      value={netConfig.pass}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, pass: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>

                  {/* Selector DHCP vs Estática */}
                  <div className="md:col-span-2 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netConfig.dhcp}
                        onChange={(e) =>
                          setNetConfig({ ...netConfig, dhcp: e.target.checked })
                        }
                        className="checkbox-field"
                      />
                      <span className="text-sm font-semibold text-text-secondary">
                        Usar Asignación Dinámica (DHCP)
                      </span>
                    </label>
                  </div>

                  {/* CAMPOS DE IP ESTÁTICA CONDICIONALES */}
                  {!netConfig.dhcp && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-5 bg-panel border border-border-color rounded shadow-inner animate-fade-in">
                      <div className="md:col-span-2 border-b border-border-color pb-2 mb-2">
                        <h5 className="text-sm font-bold text-text-primary">
                          Parámetros TCP/IP Manuales
                        </h5>
                      </div>
                      <div>
                        <label className="label-field text-xs uppercase tracking-wider">
                          Dirección IP Estática
                        </label>
                        <input
                          type="text"
                          placeholder="192.168.1.200"
                          value={netConfig.ip}
                          onChange={(e) =>
                            setNetConfig({ ...netConfig, ip: e.target.value })
                          }
                          className="input-field font-mono text-sm bg-app"
                        />
                      </div>
                      <div>
                        <label className="label-field text-xs uppercase tracking-wider">
                          Máscara de Subred
                        </label>
                        <input
                          type="text"
                          placeholder="255.255.255.0"
                          value={netConfig.subnet}
                          onChange={(e) =>
                            setNetConfig({
                              ...netConfig,
                              subnet: e.target.value,
                            })
                          }
                          className="input-field font-mono text-sm bg-app"
                        />
                      </div>
                      <div>
                        <label className="label-field text-xs uppercase tracking-wider">
                          Puerta de Enlace (Gateway)
                        </label>
                        <input
                          type="text"
                          placeholder="192.168.1.1"
                          value={netConfig.gateway}
                          onChange={(e) =>
                            setNetConfig({
                              ...netConfig,
                              gateway: e.target.value,
                            })
                          }
                          className="input-field font-mono text-sm bg-app"
                        />
                      </div>
                      <div>
                        <label className="label-field text-xs uppercase tracking-wider">
                          Servidor DNS Principal
                        </label>
                        <input
                          type="text"
                          placeholder="8.8.8.8"
                          value={netConfig.dns}
                          onChange={(e) =>
                            setNetConfig({ ...netConfig, dns: e.target.value })
                          }
                          className="input-field font-mono text-sm bg-app"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. RED DE RESCATE (SoftAP) */}
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
                  <svg
                    className="w-5 h-5 text-orange-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-text-primary">
                    Red de Rescate (Access Point Zero-Trust)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label-field">
                      SSID de Rescate
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. EdgeNode_Admin"
                      value={netConfig.ap_ssid}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ap_ssid: e.target.value })
                      }
                      className="input-field"
                    />
                    <p className="text-xs text-muted mt-1">
                      Dejar en blanco para usar nombre por defecto (MAC).
                    </p>
                  </div>
                  <div>
                    <label className="label-field">
                      Contraseña de Rescate
                    </label>
                    <input
                      type="password"
                      placeholder="•••••••• (En blanco = Default)"
                      value={netConfig.ap_pass}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ap_pass: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="md:col-span-2 flex gap-6 mt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={netConfig.ap_hide}
                        onChange={(e) =>
                          setNetConfig({
                            ...netConfig,
                            ap_hide: e.target.checked,
                          })
                        }
                        className="checkbox-field"
                      />
                      <span className="text-sm font-semibold text-text-secondary">
                        Ocultar SSID (Hidden Network)
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              {/* 3. SERVICIOS AVANZADOS */}
              <section className="card p-6">
                <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    ></path>
                  </svg>
                  <h4 className="text-lg font-bold text-text-primary">
                    Servicios de Red (mDNS & Tiempo Real NTP)
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="label-field">
                      Hostname (mDNS)
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        value={netConfig.mdns}
                        onChange={(e) =>
                          setNetConfig({ ...netConfig, mdns: e.target.value })
                        }
                        className="input-field rounded-l"
                      />
                      <span className="bg-app border border-l-0 border-border-color text-muted font-bold p-2 rounded-r flex items-center text-text-secondary">
                        .local
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="label-field">
                      Servidor NTP
                    </label>
                    <input
                      type="text"
                      value={netConfig.ntp}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, ntp: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      Zona Horaria (POSIX)
                    </label>
                    <select
                      value={netConfig.tz}
                      onChange={(e) =>
                        setNetConfig({ ...netConfig, tz: e.target.value })
                      }
                      className="input-field"
                    >
                      <option value="CST6CDT,M4.1.0,M10.5.0">
                        Hora Centro (México)
                      </option>
                      <option value="EST5EDT,M3.2.0,M11.1.0">
                        Hora del Este (US)
                      </option>
                      <option value="PST8PDT,M3.2.0,M11.1.0">
                        Hora del Pacífico (US)
                      </option>
                      <option value="CET-1CEST,M3.5.0,M10.5.0/3">
                        Europa Central (CET)
                      </option>
                      <option value="UTC0">UTC Universal</option>
                    </select>
                  </div>
                </div>
              </section>

              {/* CONTROLES DE ACCIÓN */}
              <div className="flex justify-end gap-4 pt-2">
                <button
                  type="submit"
                  className="px-6 py-2 bg-orange-accent text-text-primary rounded font-bold hover:bg-[#E08D55] shadow transition-all"
                >
                  Guardar y Aplicar Red
                </button>
              </div>
            </form>
          </div>
    );
};

export default RedSettings;