// src/views/Settings/ApiSettings.tsx
import { apiFetch } from '../../api/client'
import toast from 'react-hot-toast'
import { BlockLoader } from '../../components/Skeletons'

import { useEffect, useState } from 'react'

const ApiSettings = () => {
  const [sysTime, setSysTime] = useState(new Date())
  const [newApiKey, setNewApiKey] = useState({ name: '', expiration: '30' })
  const [apiKeysList, setApiKeysList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/keys')
      .then((res) => res.json())
      .then((data) => {
        setApiKeysList(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleGenerateApiKey = async () => {
    if (!newApiKey.name) return toast.error('Asigne un nombre a la integración.')
    try {
      const res = await apiFetch('/api/keys', {
        method: 'POST',
        body: JSON.stringify(newApiKey),
      })
      const data = await res.json()
      toast.success(`¡API Key Generada!\n\n${data.token}\n\nCÓPIELO AHORA.`)
      setNewApiKey({ name: '', expiration: '30' })
      const listRes = await apiFetch('/api/keys')
      setApiKeysList(await listRes.json())
    } catch (err) {
      // apiFetch handles generic errors
    }
  }

  const handleRevokeApiKey = async (id: string) => {
    if (!window.confirm('¿Seguro que desea revocar este token?')) return
    try {
      await apiFetch(`/api/keys?id=${id}`, {
        method: 'DELETE',
      })
      setApiKeysList((prev) => prev.filter((key) => key.id !== id))
      toast.success('Token revocado con éxito.')
    } catch (err) {
      // apiFetch handles generic errors
    }
  }

  useEffect(() => {
    const timer = setInterval(() => setSysTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-text-primary">Integración y API RESTful</h3>
          <p className="text-sm text-muted mt-1">
            Gestión de Service Accounts y Documentación de Endpoints
          </p>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-2">
          <span className="badge badge-info flex items-center gap-1 shadow-sm">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              ></path>
            </svg>
            API v1.1 Operativa
          </span>
          <div
            className={`flex items-center gap-2 text-xs font-bold uppercase ${sysTime.getFullYear() > 2000 ? 'text-teal-600' : 'text-red-500 animate-pulse'}`}
          >
            <div
              className={`w-2 h-2 rounded-full ${sysTime.getFullYear() > 2000 ? 'bg-teal-600' : 'bg-red-500'}`}
            ></div>
            {sysTime.getFullYear() > 2000 ? 'NTP Sync: OK' : 'NTP Sync: Pendiente'}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* 1. GESTIÓN DE TOKENS DE SERVICIO (API KEYS) */}
        <section className="card p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-border-color pb-2">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              ></path>
            </svg>
            <h4 className="text-lg font-bold text-text-primary">
              Tokens de Servicio M2M (Machine-to-Machine)
            </h4>
          </div>

          <p className="text-sm text-text-secondary mb-6">
            Genere tokens estáticos de larga duración para integraciones automatizadas como
            Dashboards (Grafana), flujos de Node-RED o scripts de Python.
          </p>

          <div className="card p-4 flex flex-col md:flex-row gap-4 items-end mb-6 shadow-sm">
            <div className="flex-1 w-full">
              <label className="label-field text-xs uppercase tracking-wider mb-1">
                Nombre de la Integración
              </label>
              <input
                type="text"
                placeholder="Ej. Extractor Python Nocturno"
                value={newApiKey.name}
                onChange={(e) => setNewApiKey({ ...newApiKey, name: e.target.value })}
                className="input-field text-sm"
              />
            </div>
            <div className="w-full md:w-48">
              <label className="label-field text-xs uppercase tracking-wider mb-1">
                Vigencia
              </label>
              <select
                value={newApiKey.expiration}
                onChange={(e) => setNewApiKey({ ...newApiKey, expiration: e.target.value })}
                className="input-field text-sm"
              >
                <option value="30">30 Días</option>
                <option value="180">6 Meses</option>
                <option value="never">Nunca (Peligroso)</option>
              </select>
            </div>
            <button
              onClick={handleGenerateApiKey}
              className="w-full md:w-auto btn btn-primary shadow flex items-center justify-center gap-2 whitespace-nowrap h-[42px]"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                ></path>
              </svg>
              Generar Token
            </button>
          </div>

          <div className="overflow-x-auto border border-border-color rounded">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-100 text-text-secondary border-b border-border-color">
                <tr>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">
                    Integración
                  </th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">
                    Prefijo (Token)
                  </th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs">
                    Fecha de Expiración
                  </th>
                  <th className="px-4 py-3 font-bold uppercase tracking-wider text-xs text-right">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-panel">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <BlockLoader />
                    </td>
                  </tr>
                ) : apiKeysList.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted italic">
                      No hay API Keys activas. Genera una integración arriba.
                    </td>
                  </tr>
                ) : (
                  apiKeysList.map((key, idx) => (
                    <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="px-4 py-3 font-bold text-text-primary">{key.name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted">
                        <span className="bg-app rounded border border-gray-100 px-2 py-1">
                          {key.prefix}••••••••••
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{key.expiration_date}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevokeApiKey(key.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition-colors"
                          title="Revocar Token"
                        >
                          <svg
                            className="w-5 h-5 inline"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            ></path>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. CATÁLOGO DE ENDPOINTS CATEGORIZADO */}
        <section className="bg-panel p-4 md:p-6 rounded-lg border border-border-color">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-border-color pb-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-teal-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                ></path>
              </svg>
              <h4 className="text-lg font-bold text-text-primary">Referencia de Endpoints RESTful</h4>
            </div>
            <div className="bg-yellow-50 text-yellow-800 border border-yellow-200 p-2 rounded text-xs overflow-x-auto">
              <span className="font-bold">Auth Header:</span>{' '}
              <code className="bg-panel px-1 rounded whitespace-nowrap">
                Authorization: Bearer &lt;TOKEN&gt;
              </code>
            </div>
          </div>

          <div className="space-y-8">
            {[
              {
                category: 'Extracción de Datos & Telemetría',
                icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                endpoints: [
                  {
                    method: 'GET',
                    path: '/api/dataset',
                    roles: ['Admin', 'Operador', 'API Key'],
                    desc: 'Descarga del log histórico completo en formato CSV (Raw Data).',
                    payload: null,
                  },
                  {
                    method: 'WS',
                    path: '/ws',
                    roles: ['Admin', 'Operador', 'Visor'],
                    desc: 'Stream bidireccional. Retorna telemetría (JSON) y estado del nodo.',
                    payload: '{"type": "auth", "token": "<JWT>"}',
                  },
                ],
              },
              {
                category: 'Autenticación e Identidades (IAM)',
                icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
                endpoints: [
                  {
                    method: 'POST',
                    path: '/api/login',
                    roles: ['Público'],
                    desc: 'Intercambia credenciales por un JWT de sesión (Expiración variable).',
                    payload: '{"username": "str", "password": "str"}',
                  },
                  {
                    method: 'GET/POST/DEL',
                    path: '/api/users',
                    roles: ['Admin'],
                    desc: 'CRUD del Directorio Activo (RBAC). Límite de 5 usuarios secundarios.',
                    payload:
                      '{"username": "str", "password": "str", "role": "admin|operator|viewer"}',
                  },
                  {
                    method: 'GET/POST/DEL',
                    path: '/api/keys',
                    roles: ['Admin'],
                    desc: 'Gestión de Tokens M2M (Service Accounts). Límite de 5 llaves activas.',
                    payload: '{"name": "str", "expiration": "30|180|never"}',
                  },
                ],
              },
              {
                category: 'Configuración del Hardware (State)',
                icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
                endpoints: [
                  {
                    method: 'GET/POST',
                    path: '/api/config/network',
                    roles: ['Admin'],
                    desc: 'Parámetros TCP/IP, Red STA de Producción, Red AP de Rescate y servidor NTP.',
                    payload: '{"ssid": "str", "dhcp": bool, "ip": "str", ...}',
                  },
                  {
                    method: 'GET/POST',
                    path: '/api/config/security',
                    roles: ['Admin'],
                    desc: 'Configuración del Firewall L3 (Allowlist IP) y TTL de sesiones JWT.',
                    payload: '{"allowlist_enabled": bool, "allowlist": "ip1\\nip2"}',
                  },
                  {
                    method: 'GET/POST',
                    path: '/api/config/sensors',
                    roles: ['Admin', 'Operador'],
                    desc: 'Pines GPIO, atenuación del ADC, impedancias del divisor y offsets de calibración.',
                    payload: '{"dht_pin": int, "adc_pin": int, "temp_offset": float}',
                  },
                  {
                    method: 'GET/POST',
                    path: '/api/config/smtp',
                    roles: ['Admin'],
                    desc: 'Credenciales del servidor de correos y envolvente operacional (Umbrales de alarma).',
                    payload: '{"host": "str", "t_max": float, "alert_temp": bool}',
                  },
                  /* ⚠️ NUEVOS ENDPOINTS AÑADIDOS AQUÍ ⚠️ */
                  {
                    method: 'GET/POST',
                    path: '/api/config/whatsapp',
                    roles: ['Admin'],
                    desc: 'Credenciales de la API CallMeBot para notificaciones instantáneas de WhatsApp.',
                    payload: '{"enabled": bool, "phone": "str", "api_key": "str"}',
                  },
                  {
                    method: 'GET/POST',
                    path: '/api/config/cloud',
                    roles: ['Admin'],
                    desc: 'Sincronización M2M: Webhook HTTPS para inyectar telemetría directa a Bases de Datos en la nube.',
                    payload: '{"enabled": bool, "url": "str", "token": "str"}',
                  },
                ],
              },
              {
                category: 'Mantenimiento y Ciclo de Vida (SysOps)',
                icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
                endpoints: [
                  {
                    method: 'GET',
                    path: '/api/system/info',
                    roles: ['Admin', 'Operador', 'Visor'],
                    desc: 'Retorna versión de Firmware, modelo del Chip, Cores, e información del TinyML.',
                    payload: null,
                  },
                  {
                    method: 'GET',
                    path: '/api/system/storage',
                    roles: ['Admin'],
                    desc: 'Estadísticas de ocupación de las particiones NVS (Base de Datos) y LittleFS.',
                    payload: null,
                  },
                  {
                    method: 'POST',
                    path: '/api/system/ota',
                    roles: ['Admin'],
                    desc: 'Over-The-Air Update. Inyecta binarios directamente en particiones OTA_0 u OTA_1.',
                    payload: 'FormData { "firmware": File (.bin/.tflite) }',
                  },
                  {
                    method: 'POST',
                    path: '/api/system/reboot',
                    roles: ['Admin'],
                    desc: 'Ejecuta un reinicio seguro (Soft-Reset) a nivel microcontrolador.',
                    payload: 'Ninguno',
                  },
                  {
                    method: 'POST',
                    path: '/api/system/format_logs',
                    roles: ['Admin'],
                    desc: 'Purga destructiva: Elimina el dataset.csv de LittleFS permanentemente.',
                    payload: 'Ninguno',
                  },
                  {
                    method: 'POST',
                    path: '/api/system/factory_reset',
                    roles: ['Admin'],
                    desc: 'Borrado Criptográfico: Destruye la NVS completa. Fuerza modo OOBE.',
                    payload: 'Ninguno',
                  },
                  {
                    method: 'GET',
                    path: '/api/health',
                    roles: ['Público'],
                    desc: 'Healthcheck rápido. Retorna Uptime, Heap y calidad WiFi.',
                    payload: 'Ninguno',
                  },
                  {
                    method: 'GET',
                    path: '/api/system/battery',
                    roles: ['API Key', 'Admin', 'Operador'],
                    desc: 'Retorna voltaje, porcentaje y estado de carga (TP4056).',
                    payload: 'Ninguno',
                  },
                ],
              },
            ].map((group, gIdx) => (
              <div key={gIdx} className="mb-6">
                <h5 className="flex items-center gap-2 font-bold text-text-primary mb-3 border-b border-gray-100 pb-2">
                  <svg
                    className="w-5 h-5 text-muted shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d={group.icon}
                    ></path>
                  </svg>
                  {group.category}
                </h5>
                <div className="space-y-3">
                  {group.endpoints.map((ep, eIdx) => (
                    <div
                      key={eIdx}
                      className="group flex flex-col lg:flex-row gap-4 items-start lg:items-center p-4 bg-app hover:bg-white rounded-lg border border-border-color shadow-sm transition-all hover:shadow-md"
                    >
                      {/* Método y Ruta */}
                      <div className="flex items-center gap-3 w-full lg:w-64 shrink-0">
                        <span
                          className={`font-bold px-2 py-1 rounded text-[10px] w-16 text-center tracking-widest shrink-0 ${ ep.method.includes('GET') ? 'bg-blue-100 text-blue-800' : ep.method.includes('POST') ? 'bg-green-100 text-green-800' : ep.method.includes('DEL') ? 'bg-red-100 text-red-800' : ep.method.includes('WS') ? 'bg-purple-100 text-purple-800' : 'bg-gray-200 text-gray-800' }`}
                        >
                          {ep.method}
                        </span>
                        <span
                          className="font-mono text-sm text-text-primary font-bold truncate cursor-pointer hover:text-orange-accent"
                          title="Click para copiar"
                          onClick={() => {
                            navigator.clipboard.writeText(ep.path)
                            toast.success(`Ruta ${ep.path} copiada`)
                          }}
                        >
                          {ep.path}
                        </span>
                      </div>

                      {/* Descripción y Payload */}
                      <div className="flex-1 flex flex-col gap-1 w-full min-w-0">
                        <span className="text-sm text-gray-700 leading-tight">{ep.desc}</span>
                        {ep.payload && (
                          <div className="mt-1 flex items-start gap-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase mt-0.5 shrink-0">
                              Payload:
                            </span>
                            <code className="text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded border border-green-100 font-mono break-all">
                              {ep.payload}
                            </code>
                          </div>
                        )}
                      </div>

                      {/* Roles */}
                      <div className="shrink-0 flex flex-wrap gap-1 lg:w-48 lg:justify-end">
                        {ep.roles.map((role, rIdx) => (
                          <span
                            key={rIdx}
                            className={`text-[10px] font-bold px-2 py-1 rounded border whitespace-nowrap ${ role === 'Admin' ? 'bg-red-50 text-red-700 border-red-100' : role === 'Operador' ? 'bg-blue-50 text-blue-700 border-blue-100' : role === 'Público' ? 'bg-gray-100 text-muted border-gray-200' : role === 'API Key' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-50 text-gray-700 border-gray-200' }`}
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 3. EJEMPLO DE INTEGRACIÓN (cURL) */}
        <section className="bg-navy-dark p-4 md:p-6 rounded-lg shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-5 pointer-events-none">
            <svg
              width="200"
              height="200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1"
            >
              <path d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path>
            </svg>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b border-gray-700 pb-3 gap-3 relative z-10">
            <h4 className="text-lg font-bold text-white flex items-center gap-2">
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                ></path>
              </svg>
              Snippet: Extracción de CSV con cURL (M2M)
            </h4>
            <button
              onClick={() => {
                navigator.clipboard.writeText(
                  `curl -X GET http://${import.meta.env.DEV ? '192.168.1.171' : window.location.hostname}/api/dataset -H 'Authorization: Bearer TU_TOKEN_M2M' --output dataset_$(date +%s).csv`
                )
                toast.success('Comando copiado al portapapeles')
              }}
              className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded text-xs font-bold transition-colors shadow self-start sm:self-auto"
            >
              Copiar Código
            </button>
          </div>

          <div className="bg-[#0D0D14] p-4 md:p-5 rounded-lg font-mono text-sm overflow-x-auto custom-scrollbar shadow-inner relative z-10 border border-gray-800">
            <p className="text-gray-300 whitespace-nowrap">
              <span className="text-pink-500 font-bold">curl</span>{' '}
              <span className="text-blue-400">-X</span> GET \
            </p>
            <p className="pl-4 text-green-300 whitespace-nowrap">
              http://
              {import.meta.env.DEV ? '192.168.1.171' : window.location.hostname}
              /api/dataset \
            </p>
            <p className="pl-4 text-gray-300 whitespace-nowrap">
              <span className="text-blue-400">-H</span>{' '}
              <span className="text-yellow-300">
                'Authorization: Bearer{' '}
                <span className="text-white font-bold bg-white/10 px-1 rounded">
                  TU_TOKEN_M2M_AQUI
                </span>
                '
              </span>{' '}
              \
            </p>
            <p className="pl-4 text-gray-300 whitespace-nowrap">
              <span className="text-blue-400">--output</span> dataset_$(date +%s).csv
            </p>
          </div>
          <p className="text-xs text-gray-400 mt-4 font-sans relative z-10 border-l-2 border-orange-accent pl-3">
            Implemente este comando en un{' '}
            <code className="text-gray-300 bg-gray-800 px-1 rounded">CronJob</code> de Linux o un
            script de Python (con la librería{' '}
            <code className="text-gray-300 bg-gray-800 px-1 rounded">requests</code>) para orquestar
            la ingesta automatizada de datos (ETL) hacia su Data Lake.
          </p>
        </section>
      </div>
    </div>
  )
}

export default ApiSettings
