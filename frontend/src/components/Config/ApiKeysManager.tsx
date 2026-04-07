import React, { useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { API_BASE_URL } from '../../api/client';

export default function ApiKeysManager({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  const { config: keysList, refresh } = useConfig<any>('/api/keys', authToken, 'always', 'always');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`${API_BASE_URL}/api/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ label: newKeyLabel })
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error('Fallo al crear llave');
      const data = await res.json();
      setGeneratedToken(data.token);
      setStatus('success');
      setNewKeyLabel('');
      refresh();
    } catch (err) {
      setStatus('error');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Revocar la API Key ${name}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/keys`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ id })
      });
      if (res.ok) refresh();
    } catch (err) {
      alert('Error eliminando llave');
    }
  };

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-navy-dark mb-1">Claves API (M2M)</h3>
        <p className="text-sm text-gray-500">Genere tokens estáticos para integración con sistemas externos (Python, Grafana).</p>
      </div>
      
      <div className="p-6">
        {generatedToken && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
            <h4 className="text-sm font-bold text-emerald-800 mb-2">¡Guarde este token ahora!</h4>
            <p className="text-xs text-emerald-600 mb-2">No podrá volver a verlo por razones de seguridad.</p>
            <code className="block p-3 bg-white border border-emerald-200 rounded text-sm text-navy-dark break-all select-all">
              {generatedToken}
            </code>
            <button onClick={() => setGeneratedToken(null)} className="mt-3 text-xs font-bold text-emerald-700 hover:underline">Ocultar</button>
          </div>
        )}

        <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-4 items-end mb-8 p-4 bg-gray-50 rounded border border-gray-200">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-gray-600 mb-1">Etiqueta (Identificador)</label>
            <input type="text" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} required placeholder="Ej: Script Python Grafana" className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support text-sm" />
          </div>
          <button type="submit" disabled={status === 'saving'} className="w-full sm:w-auto bg-navy-dark hover:bg-gray-800 text-white font-bold py-2 px-4 rounded text-sm transition-colors h-[38px] whitespace-nowrap">
            {status === 'saving' ? 'Generando...' : '+ Generar Token'}
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Etiqueta</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {keysList?.keys ? keysList.keys.map((k: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-navy-dark">{k.name}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(k.id, k.name)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wider">Revocar</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={2} className="px-4 py-4 text-center text-gray-400">Cargando tokens API...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
