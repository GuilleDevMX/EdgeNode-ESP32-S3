import NetworkForm from './NetworkForm';
import SensorsForm from './SensorsForm';
import { useConfig } from '../../hooks/useConfig';

export default function InfraGroup({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  // Pass arbitrary active parameters to hook to trick it if needed.
  const { config: netConfig } = useConfig<any>('/api/config/network', authToken, 'infra', 'infra');
  
  return (
    <div className="space-y-8 animate-fade-in">
      <NetworkForm initialConfig={netConfig} authToken={authToken} onLogout={onLogout} />
      <div className="border-t border-gray-100 pt-8">
        <SensorsForm authToken={authToken} onLogout={onLogout} />
      </div>
    </div>
  );
}
