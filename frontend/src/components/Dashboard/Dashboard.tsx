import KpiGrid from './KpiGrid';
import TrendChart from './TrendChart';
import HardwareMetrics from './HardwareMetrics';
import type { Telemetry, ChartDataPoint } from '../../hooks/useTelemetry';

interface DashboardProps {
  telemetry: Telemetry | null;
  wsStatus: string;
  chartData: ChartDataPoint[];
}

export default function Dashboard({ telemetry, wsStatus, chartData }: DashboardProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <KpiGrid telemetry={telemetry} wsStatus={wsStatus} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <TrendChart data={chartData} />
        <HardwareMetrics telemetry={telemetry} />
      </div>
    </div>
  );
}
