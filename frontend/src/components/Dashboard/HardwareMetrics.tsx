import type { Telemetry } from '../../hooks/useTelemetry';

interface HardwareMetricsProps {
  telemetry: Telemetry | null;
}

export default function HardwareMetrics({ telemetry }: HardwareMetricsProps) {
  return (
    <div className="bg-panel-bg p-6 rounded-lg shadow-sm border border-gray-100">
      <h3 className="text-lg font-bold text-navy-dark mb-4">Recursos de Hardware</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">SRAM Libre</span><span className="font-bold">{(telemetry?.heap_free || 0) / 1024} KB</span></div>
          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-support h-2 rounded-full w-3/4"></div></div>
        </div>
        <div>
          <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">PSRAM Libre</span><span className="font-bold">{((telemetry?.psram_free || 0) / 1024 / 1024).toFixed(2)} MB</span></div>
          <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-teal-support h-2 rounded-full w-11/12"></div></div>
        </div>
      </div>
    </div>
  );
}
