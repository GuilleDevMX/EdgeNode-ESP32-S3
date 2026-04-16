// src/views/SetupWizard/index.tsx
import React, { useState, useEffect, useCallback } from 'react';

// =====================================================================
// 1. INTERFACES Y TIPOS
// =====================================================================
interface WiFiNetwork {
  ssid: string;
  rssi: number;
  secure: boolean;
}

interface SetupWizardProps {
  onComplete?: () => void;
}

export default function SetupWizard({ onComplete }: SetupWizardProps) {
  // =====================================================================
  // 2. ESTADOS DEL COMPONENTE
  // =====================================================================
  
  // --- Estados de Infraestructura (Anti-Secuestro) ---
  const [isClaimed, setIsClaimed] = useState<boolean | null>(null);

  // --- Estados de Escaneo WiFi ---
  const [networks, setNetworks] = useState<WiFiNetwork[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  
  // --- Estados del Formulario (Payload) ---
  const [formData, setFormData] = useState({
    ssid: '',
    password: '', 
    dhcp: true,
    ip: '',
    gateway: '',
    subnet: '255.255.255.0',
    dns: '8.8.8.8',
    admin_user: 'admin',
    admin_pass: '', 
    admin_confirm: ''
  });

  // --- Estados de UI y Retroalimentación ---
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(15);


  // =====================================================================
  // 3. EFECTOS Y LÓGICA DE ARRANQUE (OOBE Status & Scan)
  // =====================================================================
  
  // Verificar si el nodo es Virgen o ya tiene dueño (Recovery Mode)
  useEffect(() => {
    const checkClaimStatus = async () => {
      try {
        const apiUrl = import.meta.env.DEV ? 'http://192.168.4.1/api/oobe/status' : '/api/oobe/status';
        const res = await fetch(apiUrl);
        if (res.ok) {
          const data = await res.json();
          setIsClaimed(data.is_claimed);
          if (data.is_claimed) {
            // Nodo reclamado: Bloqueamos el usuario a 'admin' para autorizar el rescate
            setFormData(prev => ({ ...prev, admin_user: 'admin' }));
          }
        } else {
          setIsClaimed(false); // Fallback de seguridad
        }
      } catch (e) {
        // Polling en caso de que el servidor web del ESP32 siga arrancando
        setTimeout(checkClaimStatus, 2000);
      }
    };
    checkClaimStatus();
  }, []);

  // Motor de Escaneo WiFi Asíncrono
  const fetchNetworks = useCallback(async () => {
    setScanning(true);
    setScanError('');
    try {
      const apiUrl = import.meta.env.DEV ? 'http://192.168.4.1/api/wifi/scan' : '/api/wifi/scan';
      const res = await fetch(apiUrl);
      
      // Manejo del patrón asíncrono (202 Accepted) del backend C++
      if (res.status === 202) {
        setTimeout(fetchNetworks, 1500); // Polling recursivo hasta obtener el JSON
        return;
      }

      if (!res.ok) throw new Error('Error al escanear redes');
      
      const data: WiFiNetwork[] = await res.json();
      
      // Limpieza de datos: Filtrar vacías, eliminar duplicados y ordenar por potencia (RSSI)
      const validNets = data.filter(n => n.ssid && n.ssid.trim() !== '');
      const uniqueNets = Array.from(new Map(validNets.map(item => [item.ssid, item])).values()) as WiFiNetwork[];
      uniqueNets.sort((a, b) => b.rssi - a.rssi);
      
      setNetworks(uniqueNets);
      setScanning(false);
    } catch (err: any) {
      setScanError('Fallo al escanear WiFi. Puede ingresar el SSID manualmente.');
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    fetchNetworks();
  }, [fetchNetworks]);

  // Controlador de cuenta regresiva para redirección exitosa
  useEffect(() => {
    let timer: number;
    if (status === 'success') {
      timer = window.setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = 'http://edgenode.local';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [status]);


  // =====================================================================
  // 4. CONTROLADORES DE EVENTOS (Handlers)
  // =====================================================================
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // Manejo dinámico para checkboxes y text inputs
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const submitProvisioning = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    
    // -- Lógica de Validación Estricta --
    if (!formData.ssid || !formData.admin_user || !formData.admin_pass) {
      setStatus('error');
      setErrorMessage('Los campos de SSID y Credenciales de Administrador son obligatorios.');
      return;
    }
    
    // Validaciones exclusivas para Inicialización (Creación de credenciales)
    if (!isClaimed) {
      if (formData.admin_pass.length < 8) {
        setStatus('error');
        setErrorMessage('La contraseña de Admin debe tener al menos 8 caracteres.');
        return;
      }
      if (formData.admin_pass !== formData.admin_confirm) {
        setStatus('error');
        setErrorMessage('Las contraseñas de administrador no coinciden.');
        return;
      }
    }

    // Validación de infraestructura IP
    if (!formData.dhcp && (!formData.ip || !formData.gateway || !formData.subnet)) {
      setStatus('error');
      setErrorMessage('Para IP Estática, debe proporcionar IP, Gateway y Subnet.');
      return;
    }

    setStatus('loading');
    
    // Mapeo preciso al Payload JSON del endpoint C++
    const payload = {
      ssid: formData.ssid,
      pass: formData.password,      
      dhcp: formData.dhcp,
      ip: formData.ip,
      gateway: formData.gateway,
      subnet: formData.subnet,
      dns: formData.dns,
      username: formData.admin_user, 
      password: formData.admin_pass 
    };

    try {
      const apiUrl = import.meta.env.DEV ? 'http://192.168.4.1/api/setup' : '/api/setup';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fallo de autorización.');

      setStatus('success');
      if (onComplete) onComplete(); // Disparador opcional si App.tsx lo requiere
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || 'Fallo de conexión. El dispositivo pudo haberse reiniciado ya.');
    }
  };


  // =====================================================================
  // 5. RENDERIZADO CONDICIONAL (Vistas)
  // =====================================================================

  // VISTA 1: Interfaz de Carga (Sondeo inicial)
  if (isClaimed === null) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center font-mono text-zinc-500">
        <div className="w-8 h-8 border-4 border-zinc-800 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
        <p className="animate-pulse">Sondeando hardware criptográfico...</p>
      </div>
    );
  }

  // VISTA 2: Éxito y Cuenta Regresiva
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center p-4 font-mono">
        <div className="max-w-md w-full border border-zinc-800 bg-zinc-900/50 p-8 shadow-2xl">
          <div className="flex items-center space-x-3 mb-6">
            <div className={`w-3 h-3 rounded-full animate-pulse ${isClaimed ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
            <h2 className={`text-xl font-bold tracking-tight ${isClaimed ? 'text-rose-400' : 'text-emerald-400'}`}>
              {isClaimed ? 'NETWORK RECOVERY COMPLETE' : 'PROVISIONING COMPLETE'}
            </h2>
          </div>
          
          <div className="space-y-4 text-sm text-zinc-400">
            <p>El nodo EdgeSecOps se está reiniciando y aplicando la configuración de red.</p>
            
            <div className="bg-zinc-950 border border-zinc-800 p-4 font-mono text-xs">
              <p className="text-zinc-500 mb-2">// SECUENCIA DE ACCIÓN REQUERIDA:</p>
              <ul className="list-decimal pl-4 space-y-2">
                <li>Desconéctese de esta red de rescate/configuración.</li>
                <li>Conecte este ordenador a la red operativa: <strong className="text-emerald-400">{formData.ssid}</strong></li>
                <li>Espere a que el dispositivo negocie su IP o mDNS.</li>
              </ul>
            </div>
            
            <div className="flex items-center justify-between border-t border-zinc-800 pt-4 mt-6">
              <span>Redirección automática en:</span>
              <span className={`text-xl font-bold ${isClaimed ? 'text-rose-400' : 'text-emerald-400'}`}>{countdown}s</span>
            </div>
            
            <button 
              onClick={() => window.location.href = 'http://edgenode.local'}
              className={`w-full mt-4 bg-transparent border py-2 text-sm uppercase tracking-widest font-semibold transition-colors ${
                isClaimed ? 'border-rose-500/50 text-rose-400 hover:bg-rose-950/30' : 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/30'
              }`}
            >
              Forzar Redirección
            </button>
          </div>
        </div>
      </div>
    );
  }

  // VISTA 3: Formulario Principal (Provisionamiento / Recuperación)
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300 flex items-center justify-center p-4 sm:p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-2xl w-full">
        
        {/* Encabezado Dinámico */}
        <header className="mb-8 border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold text-zinc-100 flex items-center gap-3">
            <svg className={`w-6 h-6 ${isClaimed ? 'text-rose-500' : 'text-zinc-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2v10a2 2 0 002 2zM9 9h6v6H9V9z"></path>
            </svg>
            EdgeSecOps {isClaimed ? 'Network Recovery' : 'Init'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1 font-mono">
            {isClaimed ? '⚠️ Protocolo Anti-Secuestro Activo' : 'Zero-Trust Provisioning Protocol'}
          </p>
        </header>

        {/* Advertencia de Modo Rescate */}
        {isClaimed && (
          <div className="mb-6 p-4 border border-rose-900/50 bg-rose-950/20 rounded text-sm text-rose-200">
            <strong className="text-rose-400">Atención:</strong> Este nodo ya pertenece a una infraestructura. Para cambiar la red WiFi y recuperar el acceso, debe autorizar la operación con su contraseña de administrador actual.
          </div>
        )}

        <form onSubmit={submitProvisioning} className="space-y-8">
          
          {/* SECCIÓN A: INFRAESTRUCTURA DE RED */}
          <section className="bg-zinc-900/40 border border-zinc-800 p-6">
            <h2 className="text-sm uppercase tracking-wider text-zinc-400 mb-6 font-semibold flex justify-between items-center">
              <span>1. Infraestructura de Red</span>
              {scanning && <span className="text-xs text-emerald-500 animate-pulse normal-case font-mono">Scanning...</span>}
            </h2>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Selector / Input de SSID */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">SSID Operacional</label>
                  {networks.length > 0 ? (
                    <div className="relative">
                      <select 
                        name="ssid" 
                        value={formData.ssid} 
                        onChange={handleChange}
                        className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-emerald-500 appearance-none"
                      >
                        <option value="" disabled>Seleccione una red...</option>
                        {networks.map(net => (
                          <option key={net.ssid} value={net.ssid}>
                            {net.ssid} {net.secure ? '🔒' : '⚠️'} ({net.rssi}dBm)
                          </option>
                        ))}
                      </select>
                      <button 
                        type="button" 
                        onClick={fetchNetworks}
                        className="absolute right-2 top-2 text-zinc-500 hover:text-emerald-400"
                        title="Rescan"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <input 
                      type="text" 
                      name="ssid" 
                      value={formData.ssid} 
                      onChange={handleChange} 
                      placeholder={scanError ? "Ingrese SSID manualmente" : "SSID"}
                      className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  )}
                </div>
                
                {/* Contraseña WiFi */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">Contraseña (WPA2/3)</label>
                  <input 
                    type="password" 
                    name="password" 
                    value={formData.password} 
                    onChange={handleChange}
                    className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm px-3 py-2 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Toggle DHCP */}
              <div className="pt-2">
                <label className="flex items-center space-x-2 cursor-pointer group w-max">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      name="dhcp" 
                      checked={formData.dhcp} 
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-zinc-800 border border-zinc-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-emerald-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 peer-checked:after:bg-emerald-400 after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-950/50 peer-checked:border-emerald-500/50"></div>
                  </div>
                  <span className="text-sm font-medium text-zinc-400 group-hover:text-zinc-300 transition-colors">Asignación Automática (DHCP)</span>
                </label>
              </div>

              {/* Campos de IP Estática (Condicionales) */}
              {!formData.dhcp && (
                <div className="grid grid-cols-2 gap-4 mt-4 p-4 border border-zinc-800 bg-zinc-950/50">
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Dirección IP</label>
                    <input type="text" name="ip" value={formData.ip} onChange={handleChange} placeholder="192.168.1.100" className="w-full bg-transparent border-b border-zinc-800 text-zinc-300 text-sm px-1 py-1 focus:outline-none focus:border-emerald-500" required={!formData.dhcp} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Puerta de Enlace (Gateway)</label>
                    <input type="text" name="gateway" value={formData.gateway} onChange={handleChange} placeholder="192.168.1.1" className="w-full bg-transparent border-b border-zinc-800 text-zinc-300 text-sm px-1 py-1 focus:outline-none focus:border-emerald-500" required={!formData.dhcp} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Máscara de Subred</label>
                    <input type="text" name="subnet" value={formData.subnet} onChange={handleChange} placeholder="255.255.255.0" className="w-full bg-transparent border-b border-zinc-800 text-zinc-300 text-sm px-1 py-1 focus:outline-none focus:border-emerald-500" required={!formData.dhcp} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-zinc-500">Servidor DNS Principal</label>
                    <input type="text" name="dns" value={formData.dns} onChange={handleChange} placeholder="8.8.8.8" className="w-full bg-transparent border-b border-zinc-800 text-zinc-300 text-sm px-1 py-1 focus:outline-none focus:border-emerald-500" required={!formData.dhcp} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* SECCIÓN B: IDENTIDAD Y AUTORIZACIÓN (IAM) */}
          <section className={`bg-zinc-900/40 border p-6 transition-colors ${isClaimed ? 'border-rose-900/50' : 'border-zinc-800'}`}>
            <h2 className={`text-sm uppercase tracking-wider mb-6 font-semibold flex items-center gap-2 ${isClaimed ? 'text-rose-500' : 'text-zinc-400'}`}>
              {isClaimed && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
              {isClaimed ? '2. Autorización (Anti-Secuestro)' : '2. Identidad Root (IAM)'}
            </h2>
            <div className="space-y-4">
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-400">Usuario Administrador</label>
                <input 
                  type="text" 
                  name="admin_user" 
                  value={formData.admin_user} 
                  onChange={handleChange}
                  disabled={isClaimed ? true : false}
                  className={`w-full sm:w-1/2 bg-zinc-950 border border-zinc-700 text-sm px-3 py-2 focus:outline-none focus:border-emerald-500 ${isClaimed ? 'text-zinc-500 cursor-not-allowed opacity-70' : 'text-zinc-200'}`}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-400">
                    {isClaimed ? 'Contraseña Actual' : 'Contraseña Segura'}
                  </label>
                  <input 
                    type="password" 
                    name="admin_pass" 
                    value={formData.admin_pass} 
                    onChange={handleChange}
                    className={`w-full bg-zinc-950 border border-zinc-700 text-zinc-200 text-sm px-3 py-2 focus:outline-none ${isClaimed ? 'focus:border-rose-500' : 'focus:border-emerald-500'}`}
                    placeholder={isClaimed ? 'Verifique su identidad...' : 'Mínimo 8 caracteres'}
                    required
                    minLength={isClaimed ? 1 : 8}
                  />
                </div>
                
                {/* Confirmación oculta si solo estamos autorizando */}
                {!isClaimed && (
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-400">Confirmar Contraseña</label>
                    <input 
                      type="password" 
                      name="admin_confirm" 
                      value={formData.admin_confirm} 
                      onChange={handleChange}
                      className={`w-full bg-zinc-950 border text-zinc-200 text-sm px-3 py-2 focus:outline-none ${formData.admin_confirm && formData.admin_pass !== formData.admin_confirm ? 'border-red-500 focus:border-red-500' : 'border-zinc-700 focus:border-emerald-500'}`}
                      required
                    />
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ZONA DE ACCIÓN Y RETROALIMENTACIÓN */}
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-zinc-800 gap-4">
            <div className="w-full sm:w-auto flex-1 text-sm font-mono">
              {status === 'error' && <span className="text-red-400">{'>> '} {errorMessage}</span>}
              {status === 'loading' && <span className={`${isClaimed ? 'text-rose-400' : 'text-emerald-400'} animate-pulse`}>{'>> '} Transmitiendo payload...</span>}
            </div>
            
            <button 
              type="submit" 
              disabled={status === 'loading'}
              className={`w-full sm:w-auto px-8 py-3 font-bold text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950 disabled:opacity-50 transition-all ${
                isClaimed 
                ? 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-500' 
                : 'bg-zinc-100 text-zinc-950 hover:bg-white focus:ring-zinc-400'
              }`}
            >
              {isClaimed ? 'AUTORIZAR Y CAMBIAR RED' : 'INICIALIZAR NODO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}