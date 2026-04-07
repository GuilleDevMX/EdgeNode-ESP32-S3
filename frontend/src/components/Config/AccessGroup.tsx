import SecurityForm from './SecurityForm';
import UsersManager from './UsersManager';
import ApiKeysManager from './ApiKeysManager';

export default function AccessGroup({ authToken, onLogout }: { authToken: string | null; onLogout: () => void }) {
  return (
    <div className="space-y-8 animate-fade-in">
      <SecurityForm authToken={authToken} onLogout={onLogout} />
      <div className="border-t border-gray-100 pt-8">
        <UsersManager authToken={authToken} onLogout={onLogout} />
      </div>
      <div className="border-t border-gray-100 pt-8">
        <ApiKeysManager authToken={authToken} onLogout={onLogout} />
      </div>
    </div>
  );
}
