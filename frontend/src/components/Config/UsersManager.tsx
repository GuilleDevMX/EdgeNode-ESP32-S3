import React, { useState } from 'react';
import { useConfig } from '../../hooks/useConfig';
import { API_BASE_URL } from '../../api/client';

export default function UsersManager({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  const { config: usersList, refresh } = useConfig<any>('/api/users', authToken, 'always', 'always');
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'viewer' });
  const [status, setStatus] = useState<'idle'|'saving'|'success'|'error'>('idle');

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify(newUser)
      });
      if (res.status === 401) { onLogout(); return; }
      if (!res.ok) throw new Error('Fallo al crear usuario');
      setStatus('success');
      setNewUser({ username: '', password: '', role: 'viewer' });
      refresh();
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      setStatus('error');
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (!confirm(`¿Eliminar al usuario ${username}?`)) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ id })
      });
      if (res.ok) refresh();
    } catch (err) {
      alert('Error eliminando usuario');
    }
  };

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-navy-dark mb-1">Gestión IAM (Control de Acceso Basado en Roles)</h3>
        <p className="text-sm text-gray-500">Añada operadores o visualizadores al nodo.</p>
      </div>
      
      <div className="p-6">
        <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end mb-8 p-4 bg-gray-50 rounded border border-gray-200">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Usuario</label>
            <input type="text" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Contraseña</label>
            <input type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} required className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Rol</label>
            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:border-teal-support text-sm bg-white">
              <option value="operator">Operator (Lectura/Escritura)</option>
              <option value="viewer">Viewer (Solo Lectura)</option>
            </select>
          </div>
          <button type="submit" disabled={status === 'saving'} className="bg-teal-support hover:bg-[#2CA09A] text-white font-bold py-2 px-4 rounded text-sm transition-colors h-[38px]">
            {status === 'saving' ? 'Añadiendo...' : '+ Crear Usuario'}
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-700 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 rounded-tl-lg">Usuario</th>
                <th className="px-4 py-3">Rol IAM</th>
                <th className="px-4 py-3 text-right rounded-tr-lg">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersList?.users ? usersList.users.map((u: any, idx: number) => (
                <tr key={idx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-semibold text-navy-dark">{u.username}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-700' : u.role === 'operator' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.role !== 'admin' && (
                      <button onClick={() => handleDelete(u.id, u.username)} className="text-red-500 hover:text-red-700 text-xs font-bold uppercase tracking-wider">Revocar</button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">Cargando registros IAM...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
