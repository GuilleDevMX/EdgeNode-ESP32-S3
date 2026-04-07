import { useConfig } from '../../hooks/useConfig';
import { API_BASE_URL } from '../../api/client';

export default function SystemInfo({ authToken }: { authToken: string | null; onLogout: () => void }) {
  const { config, isLoading } = useConfig<any>('/api/system/info', authToken, 'always', 'always');

  const handleReboot = async () => {
    if (!confirm("¿Está seguro de que desea reiniciar el ESP32?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/system/reboot`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      alert('Reiniciando nodo. La conexión se perderá momentáneamente.');
    } catch (e) {
      alert('Error enviando comando de reinicio.');
    }
  };

  return (
    <div className="bg-white border border-gray-100 shadow-sm rounded-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-navy-dark">Información del Sistema</h3>
        <button onClick={handleReboot} className="px-4 py-2 border border-red-200 text-red-600 rounded hover:bg-red-50 text-sm font-bold transition-colors">
          Reiniciar Nodo
        </button>
      </div>

      {isLoading ? (
        <div className="text-gray-500 animate-pulse">Cargando telemetría de sistema...</div>
      ) : config ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Chip Model</p>
            <p className="font-mono text-navy-dark font-bold">{config.chip_model}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Chip Cores</p>
            <p className="font-mono text-navy-dark font-bold">{config.chip_cores}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-1">CPU Freq</p>
            <p className="font-mono text-navy-dark font-bold">{config.cpu_freq_mhz} MHz</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs text-gray-500 font-semibold uppercase mb-1">Firmware SDK</p>
            <p className="font-mono text-navy-dark font-bold text-xs break-all">{config.sdk_version}</p>
          </div>
        </div>
      ) : (
        <div className="text-red-500">Error al cargar datos del sistema.</div>
      )}
    </div>
  );
}
