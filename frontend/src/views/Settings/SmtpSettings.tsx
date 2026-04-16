// src/views/Settings/SmtpSettings.tsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import toast from "react-hot-toast";
import { BlockLoader } from '../../components/Skeletons';
import type { SmtpConfig } from '../../interfaces/smtp';

const SmtpSettings = () => {
  
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>({
    enabled: false,
    host: "smtp.gmail.com",
    port: 465,
    user: "",
    pass: "",
    dest: "",
    t_max: 35.0,
    t_min: 10.0,
    h_max: 60.0,
    h_min: 20.0,
    b_min: 3.2,
    cooldown: 60,
    alert_temp: true,
    alert_hum: true,
    alert_sec: true
  });
  
  const handleSaveSMTP = async () => {
    await apiFetch('/api/config/smtp', {
      method: 'POST',
      body: JSON.stringify(smtpConfig)
    });
    toast.success("Configuración SMTP guardada.");
  };
  const handleTestEmail = async () => {
    await apiFetch('/api/system/test_email', { 
      method: "POST", 
      body: JSON.stringify({ config: smtpConfig })
    });
    toast.success("Correo de prueba enviado (revisa tu bandeja de entrada).");
  };

  useEffect(() => {
    apiFetch('/api/config/smtp').then(res => res.json()).then(setSmtpConfig);
  }, []);


  if (!smtpConfig) {
    return <BlockLoader />;
  }

  return (
          <div className="max-w-4xl animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-text-primary">
                Motor de Alertas y Notificaciones (SMTP)
              </h3>
              <span
                className={`border text-xs px-3 py-1 rounded-full font-semibold flex items-center gap-1 ${smtpConfig.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-text-secondary border-gray-200"}`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${smtpConfig.enabled ? "bg-green-500" : "bg-gray-400"}`}
                ></div>
                {smtpConfig.enabled ? "Servicio Activo" : "Servicio Apagado"}
              </span>
            </div>

            <form className="space-y-8" onSubmit={handleSaveSMTP}>
              {/* 1. CREDENCIALES DE SERVIDOR */}
              <section className="card p-6">
                <div className="flex items-center justify-between mb-4 border-b border-border-color pb-2">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-purple-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      ></path>
                    </svg>
                    <h4 className="text-lg font-bold text-text-primary">
                      Servidor de Salida
                    </h4>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smtpConfig.enabled}
                      onChange={(e) =>
                        setSmtpConfig({
                          ...smtpConfig,
                          enabled: e.target.checked,
                        })
                      }
                      className="checkbox-field"
                    />
                    <span className="text-sm font-bold text-gray-700">
                      Habilitar Alertas Correo
                    </span>
                  </label>
                </div>

                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-100 transition-opacity"
                  style={{
                    opacity: smtpConfig.enabled ? 1 : 0.5,
                    pointerEvents: smtpConfig.enabled ? "auto" : "none",
                  }}
                >
                  <div>
                    <label className="label-field">
                      Servidor Host (Ej. smtp.gmail.com)
                    </label>
                    <input
                      type="text"
                      value={smtpConfig.host}
                      onChange={(e) =>
                        setSmtpConfig({ ...smtpConfig, host: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      Puerto (SSL/TLS)
                    </label>
                    <input
                      type="number"
                      value={smtpConfig.port}
                      onChange={(e) =>
                        setSmtpConfig({
                          ...smtpConfig,
                          port: parseInt(e.target.value),
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      Correo Remitente (Usuario)
                    </label>
                    <input
                      type="email"
                      value={smtpConfig.user}
                      onChange={(e) =>
                        setSmtpConfig({ ...smtpConfig, user: e.target.value })
                      }
                      placeholder="nodo.iot@gmail.com"
                      className="input-field"
                    />
                  </div>
                  <div>
                    <label className="label-field">
                      App Password (No su contraseña web)
                    </label>
                    <input
                      type="password"
                      value={smtpConfig.pass}
                      onChange={(e) =>
                        setSmtpConfig({ ...smtpConfig, pass: e.target.value })
                      }
                      placeholder="••••••••••••••••"
                      className="input-field"
                    />
                    <p className="text-[10px] text-muted mt-1">
                      Debe usar una contraseña de aplicación generada por
                      Google/Microsoft.
                    </p>
                  </div>
                </div>
              </section>

              {/* 2. REGLAS Y UMBRALES (HIGH/LOW) */}
              <section
                className="bg-panel p-6 rounded-lg border border-border-color shadow-sm"
                style={{
                  opacity: smtpConfig.enabled ? 1 : 0.5,
                  pointerEvents: smtpConfig.enabled ? "auto" : "none",
                }}
              >
                <h4 className="text-lg font-bold text-text-primary mb-4 border-b pb-2">
                  Destinatario y Envolvente Operacional
                </h4>

                <div className="mb-6">
                  <label className="label-field">
                    Correo del Administrador (Destino de Alertas)
                  </label>
                  <input
                    type="email"
                    value={smtpConfig.dest}
                    onChange={(e) =>
                      setSmtpConfig({ ...smtpConfig, dest: e.target.value })
                    }
                    placeholder="admin@empresa.com"
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Bloque Temperatura */}
                  <div className="bg-app p-4 rounded border border-border-color flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-orange-800">
                          Temperatura (°C)
                        </label>
                        <input
                          type="checkbox"
                          checked={smtpConfig.alert_temp}
                          onChange={(e) =>
                            setSmtpConfig({
                              ...smtpConfig,
                              alert_temp: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-orange-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <p className="text-[10px] text-orange-600 font-bold uppercase">
                            Máximo
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.t_max}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                t_max: parseFloat(e.target.value),
                              })
                            }
                            className="input-field text-sm"
                          />
                        </div>
                        <div className="w-1/2">
                          <p className="text-[10px] text-orange-600 font-bold uppercase">
                            Mínimo
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.t_min}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                t_min: parseFloat(e.target.value),
                              })
                            }
                            className="input-field text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque Humedad */}
                    <div className="bg-app p-4 rounded border border-border-color flex flex-col justify-between">
                      <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-bold text-blue-800">
                          Humedad (%)
                        </label>
                        <input
                          type="checkbox"
                          checked={smtpConfig.alert_hum}
                          onChange={(e) =>
                            setSmtpConfig({
                              ...smtpConfig,
                              alert_hum: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-blue-600"
                        />
                      </div>
                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <p className="text-[10px] text-blue-600 font-bold uppercase">
                            Alto (Corto)
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.h_max}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                h_max: parseFloat(e.target.value),
                              })
                            }
                            className="input-field text-sm"
                          />
                        </div>
                        <div className="w-1/2">
                          <p className="text-[10px] text-blue-600 font-bold uppercase">
                            Bajo (Estática)
                          </p>
                          <input
                            type="number"
                            step="0.1"
                            value={smtpConfig.h_min}
                            onChange={(e) =>
                              setSmtpConfig({
                                ...smtpConfig,
                                h_min: parseFloat(e.target.value),
                              })
                            }
                            className="input-field text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bloque Energía y Spam */}
                  <div className="bg-app p-4 rounded border border-border-color flex flex-col justify-between">
                    <div className="mb-2">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-bold text-text-primary">
                          Batería Crítica (V)
                        </label>
                        <input
                          type="checkbox"
                          checked={smtpConfig.alert_sec}
                          onChange={(e) =>
                            setSmtpConfig({
                              ...smtpConfig,
                              alert_sec: e.target.checked,
                            })
                          }
                          className="w-4 h-4 text-text-secondary"
                        />
                      </div>
                      <input
                        type="number"
                        step="0.1"
                        value={smtpConfig.b_min}
                        onChange={(e) =>
                          setSmtpConfig({
                            ...smtpConfig,
                            b_min: parseFloat(e.target.value),
                          })
                        }
                        className="w-full p-1 border border-border-color rounded text-sm"
                      />
                    </div>
                    <div className="border-t border-border-color pt-2">
                      <label className="text-[10px] font-bold text-muted uppercase">
                        Rate-Limit (Anti-Spam)
                      </label>
                      <select
                        value={smtpConfig.cooldown}
                        onChange={(e) =>
                          setSmtpConfig({
                            ...smtpConfig,
                            cooldown: parseInt(e.target.value),
                          })
                        }
                        className="w-full p-1 border border-border-color rounded bg-panel text-sm mt-1"
                      >
                        <option value="15">15 Minutos</option>
                        <option value="60">1 Hora (Recomendado)</option>
                        <option value="720">12 Horas</option>
                      </select>
                    </div>
                  </div>
                </div>
              </section>

              {/* CONTROLES DE ACCIÓN */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={!smtpConfig.enabled}
                  className="px-4 py-2 border-2 border-purple-600 text-purple-600 rounded font-bold hover:bg-purple-50 transition-colors disabled:opacity-50"
                >
                  Enviar Correo de Prueba
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Guardar Configuración SMTP
                </button>
              </div>
            </form>
          </div>
  );
};

export default SmtpSettings;