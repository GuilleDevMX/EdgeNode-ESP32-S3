import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../../api/client';

interface NetworkConfig {
  ssid: string;
  pass: string;
  dhcp: boolean;
  ip: string;
  subnet: string;
  gateway: string;
  dns: string;
  ap_ssid: string;
  ap_pass: string;
  ap_hide: boolean;
  mdns: string;
  ntp: string;
  tz: string;
}

interface NetworkFormProps {
  initialConfig: NetworkConfig | undefined;
  authToken: string | null;
  onLogout: () => void;
}

export default function NetworkForm({ initialConfig, authToken, onLogout }: NetworkFormProps) {
  const [config, setConfig] = useState<NetworkConfig>({
    ssid: '', pass: '', dhcp: true,
    ip: '', subnet: '', gateway: '', dns: '',
    ap_ssid: '', ap_pass: '', ap_hide: false,
    mdns: 'edgenode', ntp: 'pool.ntp.org', tz: 'CST6CDT,M4.1.0,M10.5.0'
  });
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');

  useEffect(() => {
    if (initialConfig) {
      setConfig({ ...initialConfig, pass: '' });
    }
  }, [initialConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const response = await fetch(`${API_BASE_URL}/api/config/network`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(config)
      });
      
      const resData = await response.json();
      if (response.status === 401) { onLogout(); return; }
      if (response.ok) {
        setStatus('success');
        setTimeout(() => {
          setStatus('idle');
          onLogout(); // The device restarts after network changes, force re-login
        }, 3000);
      } else {
        throw new Error(resData.error || 'Error en red');
      }
    } catch (err) {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-navy-dark">Red y Conectividad (STA)</h3>
        <span className="bg-teal-50 text-teal-700 border border-teal-200 text-xs px-3 py-1 rounded-full font-semibold">
          Conectado
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">SSID Corporativo</label>
          <input 
            type="text" 
            value={config.ssid || ''} 
            onChange={(e) => setConfig({...config, ssid: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent" 
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Contraseña WPA2/WPA3</label>
          <input 
            type="password" 
            placeholder="•••••••• (Dejar en blanco para mantener)" 
            value={config.pass || ''}
            onChange={(e) => setConfig({...config, pass: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent" 
          />
        </div>
      </div>

      <div className="mb-6 border-b border-gray-100 pb-6">
        <label className="flex items-center space-x-2 cursor-pointer mb-4">
          <input 
            type="checkbox" 
            checked={config.dhcp}
            onChange={(e) => setConfig({...config, dhcp: e.target.checked})}
            className="rounded text-orange-accent focus:ring-orange-accent w-4 h-4" 
          />
          <span className="text-sm font-semibold text-gray-600">Usar Asignación Dinámica (DHCP)</span>
        </label>

        {!config.dhcp && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded border border-gray-200">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Dirección IP</label>
              <input type="text" value={config.ip || ''} onChange={(e) => setConfig({...config, ip: e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Gateway</label>
              <input type="text" value={config.gateway || ''} onChange={(e) => setConfig({...config, gateway: e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Máscara (Subnet)</label>
              <input type="text" value={config.subnet || ''} onChange={(e) => setConfig({...config, subnet: e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">DNS Primario</label>
              <input type="text" value={config.dns || ''} onChange={(e) => setConfig({...config, dns: e.target.value})} className="w-full px-2 py-1 border border-gray-300 rounded font-mono text-sm bg-white" />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre mDNS</label>
          <input type="text" value={config.mdns || ''} onChange={(e) => setConfig({...config, mdns: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent font-mono text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Servidor NTP</label>
          <input type="text" value={config.ntp || ''} onChange={(e) => setConfig({...config, ntp: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent font-mono text-sm" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Zona Horaria (POSIX)</label>
          <input type="text" value={config.tz || ''} onChange={(e) => setConfig({...config, tz: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent font-mono text-sm" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <span className={`text-sm font-semibold ${status==='success'?'text-emerald-500':status==='error'?'text-red-500':''}`}>
          {status === 'success' ? '✔ Guardado. Reiniciando nodo...' : status === 'error' ? '✖ Error de comunicación' : ''}
        </span>
        <button type="submit" disabled={status === 'saving'} className="bg-orange-accent hover:bg-[#E08D55] text-navy-dark font-bold py-2 px-6 rounded transition-colors disabled:opacity-50">
          {status === 'saving' ? 'Guardando...' : 'Aplicar Red y Reiniciar'}
        </button>
      </div>
    </form>
  );
}
