import React, { useState, useEffect } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { API_BASE_URL } from '../../api/client';

export default function SensorsForm({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  const { config, isLoading } = useConfig<any>('/api/config/sensors', authToken, 'always', 'always');
  const [formData, setFormData] = useState({ dht_pin: 4, dht_type: 22, adc_pin: 5, poll: 5000, t_off: -0.5 });
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');

  useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/sensors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(formData)
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error('Fallo al guardar.');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    }
  };

  if (isLoading) return <div className="text-gray-500 animate-pulse p-4">Cargando parámetros...</div>;

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
      <h3 className="text-lg font-bold text-navy-dark mb-4">Parámetros de Sensores</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Pin DHT (Data)</label>
          <input type="number" value={formData.dht_pin || ''} onChange={e => setFormData({...formData, dht_pin: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Tipo de Sensor</label>
          <select value={formData.dht_type || 22} onChange={e => setFormData({...formData, dht_type: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent bg-white">
            <option value={11}>DHT11</option>
            <option value={22}>DHT22 / AM2302</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Pin ADC (Batería)</label>
          <input type="number" value={formData.adc_pin || ''} onChange={e => setFormData({...formData, adc_pin: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Intervalo (ms)</label>
          <input type="number" value={formData.poll || ''} onChange={e => setFormData({...formData, poll: parseInt(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-600 mb-1">Offset Temp (°C)</label>
          <input type="number" step="0.1" value={formData.t_off || 0} onChange={e => setFormData({...formData, t_off: parseFloat(e.target.value)})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-orange-accent" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-sm font-semibold ${status==='success'?'text-emerald-500':status==='error'?'text-red-500':''}`}>{status === 'success' ? '✔ Aplicado en Hardware' : status === 'error' ? '✖ Fallo de comunicación' : ''}</span>
        <button type="submit" disabled={status === 'saving'} className="bg-orange-accent hover:bg-[#E08D55] text-navy-dark font-bold py-2 px-6 rounded transition-colors disabled:opacity-50">
          {status === 'saving' ? 'Guardando...' : 'Aplicar Cambios'}
        </button>
      </div>
    </form>
  );
}
