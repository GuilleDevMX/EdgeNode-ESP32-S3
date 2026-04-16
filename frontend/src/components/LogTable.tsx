// src/components/LogTable.tsx
interface LogEntry {
  timestamp: string;
  severity: string;
  user: string;
  action: string;
}

const LogTable = ({ logs }: { logs: LogEntry[] }) => {
  const getSeverityStyle = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRIT': return 'text-red-500 font-bold';
      case 'WARN': return 'text-yellow-500';
      case 'INFO': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="overflow-x-auto card">
      <table className="w-full text-left text-sm">
        <thead className="bg-panel text-secondary uppercase text-xs">
          <tr>
            <th className="px-6 py-3">Timestamp</th>
            <th className="px-6 py-3">Nivel</th>
            <th className="px-6 py-3">Usuario</th>
            <th className="px-6 py-3">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-color">
          {logs.map((log, i) => (
            <tr key={i} className="hover:bg-app transition-colors">
              <td className="px-6 py-4 whitespace-nowrap text-primary font-mono">{log.timestamp}</td>
              <td className={`px-6 py-4 whitespace-nowrap ${getSeverityStyle(log.severity)}`}>
                {log.severity}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-blue-300">{log.user}</td>
              <td className="px-6 py-4 text-secondary italic">{log.action}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-6 py-10 text-center text-muted italic">No hay registros de auditoría disponibles.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default LogTable;