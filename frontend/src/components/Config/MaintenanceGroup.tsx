import StorageManager from './StorageManager';
import SystemInfo from './SystemInfo';
import OtaUpdater from './OtaUpdater';
import { useStorage } from '../../hooks/useConfig';

export default function MaintenanceGroup({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  const { metrics: storageMetrics, refresh: refreshStorage } = useStorage(authToken);

  return (
    <div className="space-y-8 animate-fade-in">
      <SystemInfo authToken={authToken} onLogout={onLogout} />
      <div className="border-t border-gray-100 pt-8">
        <StorageManager metrics={storageMetrics} authToken={authToken} onRefresh={refreshStorage} onLogout={onLogout} />
      </div>
      <div className="border-t border-gray-100 pt-8">
        <OtaUpdater authToken={authToken} onLogout={onLogout} />
      </div>
    </div>
  );
}
