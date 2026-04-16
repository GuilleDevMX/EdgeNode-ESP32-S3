// src/views/Logs/index.tsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import LogTable from '../../components/LogTable';
import { BlockLoader } from '../../components/Skeletons';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/system/logs');
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error("Error cargando auditoría", e);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = async () => {
    if (role !== 'admin') return;
    const pass = prompt("Confirme contraseña de administrador para PURGAR logs:");
    if (!pass) return;

    try {
      await apiFetch('/api/system/logs/clear', {
        method: 'POST',
        body: JSON.stringify({ password: pass })
      });
      fetchLogs();
    } catch (e) {
      alert("Fallo en la purga. Verifique credenciales.");
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-primary">Auditoría del Sistema</h2>
          <p className="text-secondary">Registros persistentes en LittleFS (Rotación: 50KB)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchLogs} className="btn btn-secondary">
            Actualizar
          </button>
          {role === 'admin' && (
            <button onClick={handleClear} className="btn btn-danger-outline">
              Purgar Logs
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <BlockLoader />
      ) : (
        <LogTable logs={logs} />
      )}
    </div>
  );
};

export default Logs;