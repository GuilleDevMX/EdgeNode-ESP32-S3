import type { Telemetry } from '../../hooks/useTelemetry';

interface KpiGridProps {
  telemetry: Telemetry | null;
  wsStatus: string;
}

export default function KpiGrid({ telemetry, wsStatus }: KpiGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-panel-bg p-5 rounded-lg border-l-4 border-orange-accent shadow-sm">
        <p className="text-gray-500 text-sm font-semibold">T_DHT22 (Temperatura)</p>
        <p className="text-3xl font-bold text-navy-dark mt-2">{telemetry?.temperature?.toFixed(1) || '--'} °C</p>
        <p className={`text-sm mt-2 ${telemetry?.temperature && telemetry.temperature > 28 ? 'text-red-500' : 'text-teal-support'}`}>
          {telemetry?.temperature && telemetry.temperature > 28 ? '↑ Umbral Crítico' : '✓ Normal'}
        </p>
      </div>
      <div className="bg-panel-bg p-5 rounded-lg border-l-4 border-blue-support shadow-sm">
        <p className="text-gray-500 text-sm font-semibold">H_DHT22 (Humedad)</p>
        <p className="text-3xl font-bold text-navy-dark mt-2">{telemetry?.humidity?.toFixed(1) || '--'} %</p>
      </div>
      <div className="bg-panel-bg p-5 rounded-lg border-l-4 border-yellow-support shadow-sm">
        <p className="text-gray-500 text-sm font-semibold">V_BAT (Energía TP4056)</p>
        <p className="text-3xl font-bold text-navy-dark mt-2">{telemetry?.battery_v?.toFixed(2) || '--'} V</p>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
          <div className="bg-yellow-support h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, ((telemetry?.battery_v || 0) - 3.0) / 1.2 * 100))}%` }}></div>
        </div>
      </div>
      <div className="bg-panel-bg p-5 rounded-lg shadow-sm bg-navy-dark text-white">
        <p className="text-gray-400 text-sm font-semibold">Estado del Enlace WS</p>
        <p className="text-xl font-bold mt-2 text-teal-support">{wsStatus}</p>
        <p className="text-sm mt-2 font-mono">Uptime: {telemetry?.uptime || 0}s</p>
      </div>
    </div>
  );
}
