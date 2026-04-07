import { fetcher, API_BASE_URL } from '../../api/client';

interface StorageMetrics {
  fs_total: number;
  fs_used: number;
  nvs_total: number;
  nvs_used: number;
}

interface StorageManagerProps {
  metrics: StorageMetrics;
  authToken: string | null;
  onRefresh: () => void;
  onLogout: () => void;
}

export default function StorageManager({ metrics, authToken, onRefresh, onLogout }: StorageManagerProps) {
  const handleFormatLogs = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA: Esto eliminará el archivo dataset.csv de LittleFS permanentemente. ¿Proceder?")) return;
    try {
      await fetcher('/api/system/format_logs', authToken);
      alert("Historial de telemetría purgado exitosamente.");
      onRefresh();
    } catch (err: any) { 
      alert(`Error al purgar: ${err.message}`); 
    }
  };

  const handleFactoryReset = async () => {
    if (!window.confirm("⚠️ ADVERTENCIA: Esto borrará todas las redes, usuarios y llaves de seguridad. El nodo volverá a su estado de fábrica (OOBE). ¿Proceder?")) return;
    try {
      await fetcher('/api/system/factory_reset', authToken);
      alert("Borrado Criptográfico iniciado. Desconectando...");
      onLogout();
    } catch (err: any) { alert(`Fallo enviando comando: ${err.message}`); }
  };

  const handleDownloadDataset = async () => {
    try {
      // Necesitamos hacer el fetch manualmente para acceder al objeto blob y gestionar descargas
      const response = await fetch(`${API_BASE_URL}/api/dataset`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (response.status === 404) throw new Error('El dataset está vacío o no se ha creado aún.');
      if (!response.ok) throw new Error('No autorizado o recurso no disponible.');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `dataset_edge_${new Date().toISOString().slice(0,10).replace(/-/g,'')}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Error descargando dataset: ${err.message}`);
    }
  };

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h3 className="text-lg font-bold text-navy-dark mb-1">Almacenamiento y Mantenimiento</h3>
        <p className="text-sm text-gray-500">Gestione el estado de la memoria Flash y acciones destructivas del sistema.</p>
      </div>

      <div className="p-6 space-y-8">
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-navy-dark">Partición LittleFS (Datos Web/Telemetría)</span>
            <span className="text-xs font-mono font-semibold text-gray-500">{(metrics.fs_used / (1024 * 1024)).toFixed(2)} MB / {(metrics.fs_total / (1024 * 1024)).toFixed(2)} MB</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-teal-support h-3 rounded-full transition-all" style={{ width: `${metrics.fs_total > 0 ? (metrics.fs_used / metrics.fs_total) * 100 : 0}%` }}></div>
          </div>
          <div className="mt-4">
            <button onClick={handleDownloadDataset} className="py-2 px-4 bg-navy-dark hover:bg-gray-800 text-white rounded text-sm font-bold transition-colors shadow-sm inline-flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Descargar Dataset CSV
            </button>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-navy-dark">Partición NVS (Credenciales IAM/WiFi)</span>
            <span className="text-xs font-mono font-semibold text-gray-500">{metrics.nvs_used} / {metrics.nvs_total} Bytes</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-orange-accent h-3 rounded-full transition-all" style={{ width: `${metrics.nvs_total > 0 ? (metrics.nvs_used / metrics.nvs_total) * 100 : 0}%` }}></div>
          </div>
        </div>

        <div className="pt-6 border-t border-red-100">
          <h4 className="text-sm font-bold text-red-600 uppercase tracking-wider mb-4">Zona de Peligro</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button onClick={handleFormatLogs} className="py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 text-sm font-bold transition-colors">
              Purgar Logs de Sensores
            </button>
            <button onClick={handleFactoryReset} className="py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-bold transition-colors shadow-sm">
              Factory Reset (Borrado Completo)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
