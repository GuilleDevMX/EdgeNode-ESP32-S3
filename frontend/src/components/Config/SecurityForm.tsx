import React, { useState, useEffect } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { API_BASE_URL } from '../../api/client';

export default function SecurityForm({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  const { config, isLoading } = useConfig<any>('/api/config/security', authToken, 'always', 'always');
  const [formData, setFormData] = useState({ jwt_exp: '15', al_en: false, al_ips: '' });
  const [passData, setPassData] = useState({ new_pass: '', confirm_pass: '' });
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'error'|'pass_mismatch'>('idle');

  useEffect(() => {
    if (config) setFormData(config);
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passData.new_pass && passData.new_pass !== passData.confirm_pass) {
      setStatus('pass_mismatch');
      return;
    }
    
    setStatus('saving');
    try {
      const payload = { ...formData, new_pass: passData.new_pass };
      const res = await fetch(`${API_BASE_URL}/api/config/security`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(payload)
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error('Fallo al guardar.');
      setStatus('success');
      setPassData({ new_pass: '', confirm_pass: '' });
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    }
  };

  const handleRotateKey = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA: Esto invalidará TODAS las sesiones activas actuales (incluyendo la tuya). Deberás volver a iniciar sesión. ¿Proceder?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/system/rotate_key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      alert("Llaves rotadas exitosamente. Por favor, inicia sesión nuevamente.");
      onLogout();
    } catch (err: any) { 
      alert(`Fallo al rotar las llaves: ${err.message}`); 
    }
  };

  if (isLoading) return <div className="text-gray-500 animate-pulse p-4">Cargando políticas...</div>;

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
        <h3 className="text-lg font-bold text-navy-dark mb-4">Políticas de Seguridad Global</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-600 mb-1">Expiración JWT (minutos)</label>
            <input type="number" value={formData.jwt_exp} onChange={e => setFormData({...formData, jwt_exp: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support" />
          </div>
        </div>

        <div className="mb-6">
          <label className="flex items-center space-x-2 cursor-pointer mb-2">
            <input type="checkbox" checked={formData.al_en} onChange={e => setFormData({...formData, al_en: e.target.checked})} className="rounded text-teal-support focus:ring-teal-support w-4 h-4" />
            <span className="text-sm font-semibold text-gray-600">Activar Firewall (Allowlist de IPs)</span>
          </label>
          
          {formData.al_en && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Una dirección IP por línea (IPv4)</label>
              <textarea 
                rows={3} 
                value={formData.al_ips} 
                onChange={e => setFormData({...formData, al_ips: e.target.value})} 
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support font-mono text-sm"
                placeholder="192.168.1.100&#10;192.168.1.150"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100 mb-6">
          <h4 className="text-sm font-bold text-navy-dark mb-4">Actualizar Contraseña de Administrador</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Nueva Contraseña</label>
              <input type="password" value={passData.new_pass} onChange={e => setPassData({...passData, new_pass: e.target.value})} placeholder="Dejar en blanco para mantener" minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600 mb-1">Confirmar Contraseña</label>
              <input type="password" value={passData.confirm_pass} onChange={e => setPassData({...passData, confirm_pass: e.target.value})} placeholder="Confirmar nueva contraseña" minLength={8} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-4">
          <span className={`text-sm font-semibold ${status==='success'?'text-emerald-500':status==='error'?'text-red-500':status==='pass_mismatch'?'text-red-500':''}`}>
            {status === 'success' ? '✔ Políticas actualizadas' : status === 'error' ? '✖ Error al guardar' : status === 'pass_mismatch' ? '✖ Las contraseñas no coinciden' : ''}
          </span>
          <button type="submit" disabled={status === 'saving'} className="bg-teal-support hover:bg-[#2CA09A] text-white font-bold py-2 px-6 rounded transition-colors disabled:opacity-50">
            {status === 'saving' ? 'Guardando...' : 'Guardar Políticas'}
          </button>
        </div>
      </form>

      <div className="bg-red-50 border border-red-200 shadow-sm rounded-lg p-6">
        <h4 className="text-lg font-bold text-red-800 mb-2">Auditoría IAM Activa</h4>
        <p className="text-sm text-red-600 mb-4">
          Si sospecha de un compromiso en la red, puede forzar una desconexión global. Esto destruirá los tokens de sesión de todos los administradores, operadores y visualizadores conectados actualmente.
        </p>
        <button onClick={handleRotateKey} className="py-2 px-6 bg-white border-2 border-red-500 text-red-600 rounded font-bold hover:bg-red-100 transition-colors shadow-sm">
          Rotar Llaves IAM (Cerrar Todas las Sesiones)
        </button>
      </div>
    </div>
  );
}
